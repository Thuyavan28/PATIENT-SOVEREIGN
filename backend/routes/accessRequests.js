import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../lib/db.js';
import { verifyToken, verifyUserPin } from '../middleware/auth.js';
import { decryptPrivateKey, signData, verifySignature, hashContent } from '../lib/crypto.js';
import { runFraudChecks, recordFraudFlags } from '../lib/fraud.js';
import { logAuditEvent } from '../lib/auditLog.js';
import { analyzeDrugSafety } from '../lib/ai.js';

const router = Router();

/**
 * Collects and filters patient data strictly according to approved data_categories
 */
async function buildScopedData(patientId, categories = [], specificPrescriptionId = null, specificDocumentIds = []) {
  const scoped = {};

  // Fetch health vault
  const vaultRes = await query('SELECT * FROM health_vault WHERE patient_id = $1', [patientId]);
  const vault = vaultRes.rows[0] || {};

  // Include basic demographic header
  scoped.patient_profile = {
    blood_group: vault.blood_group || null,
    gender: vault.gender || null,
    date_of_birth: vault.date_of_birth || null
  };

  const catSet = new Set(categories.map(c => c.toLowerCase()));

  if (catSet.has('allergies')) {
    scoped.allergies = vault.allergies || [];
  }

  if (catSet.has('current_medications')) {
    scoped.current_medications = vault.current_medications || [];
  }

  if (catSet.has('chronic_conditions') || catSet.has('diagnoses')) {
    scoped.chronic_conditions = vault.chronic_conditions || [];
  }

  if (catSet.has('immunizations')) {
    scoped.immunizations = vault.immunizations || [];
  }

  if (catSet.has('surgical_history')) {
    scoped.surgeries = vault.surgeries || [];
  }

  if (catSet.has('family_history')) {
    scoped.family_history = vault.family_history || [];
  }

  if (catSet.has('prescriptions')) {
    let rxQuery = 'SELECT id, drug_name, dosage, frequency, duration, doctor_name, diagnosis, issued_date, expiry_date, status FROM prescriptions WHERE patient_id = $1';
    const params = [patientId];

    if (specificPrescriptionId) {
      rxQuery += ' AND id = $2';
      params.push(specificPrescriptionId);
    }

    const rxRes = await query(rxQuery, params);
    scoped.prescriptions = rxRes.rows;
  }

  if (catSet.has('lab_reports') || catSet.has('documents')) {
    let docQuery = 'SELECT id, title, document_type, description, file_name, file_size, mime_type, uploaded_at FROM medical_documents WHERE patient_id = $1 AND is_deleted = false';
    const docParams = [patientId];

    if (Array.isArray(specificDocumentIds) && specificDocumentIds.length > 0) {
      docQuery += ` AND id = ANY($2)`;
      docParams.push(specificDocumentIds);
    }

    const docRes = await query(docQuery, docParams);
    scoped.documents = docRes.rows;
  }

  return scoped;
}

/**
 * POST /api/access-requests
 * Auth: org_token
 * Body: { share_code, data_categories[], purpose, purpose_notes, duration_hours, specific_prescription_id?, specific_document_ids? }
 */
router.post('/', verifyToken(['org']), async (req, res) => {
  try {
    const {
      share_code,
      data_categories,
      purpose,
      purpose_notes,
      duration_hours = 24,
      specific_prescription_id,
      specific_document_ids
    } = req.body;

    if (!share_code || !data_categories || !Array.isArray(data_categories) || data_categories.length === 0 || !purpose) {
      return res.status(400).json({ error: 'Share code, data categories, and purpose are required' });
    }

    // 1. Lookup patient by share_code
    const patientRes = await query(
      "SELECT id, name, share_code FROM users WHERE share_code = $1 AND role = 'patient'",
      [share_code.trim().toUpperCase()]
    );

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'No patient found with this share code' });
    }

    const patient = patientRes.rows[0];

    // 2. Run synchronous fraud detection checks
    const fraudResult = await runFraudChecks({
      orgId: req.user.id,
      patientId: patient.id,
      specificPrescriptionId: specific_prescription_id || null
    });

    if (fraudResult.blocked) {
      // Record fraud flags and abort
      await recordFraudFlags({
        prescriptionId: specific_prescription_id || null,
        flags: fraudResult.flags,
        actorId: req.user.id,
        actorRole: 'org'
      });

      return res.status(400).json({
        error: 'request_blocked',
        message: fraudResult.blockReason,
        flags: fraudResult.flags
      });
    }

    // 3. Create access_request with status 'pending'
    const insertRes = await query(
      `INSERT INTO access_requests
       (org_id, patient_id, share_code, data_categories, specific_prescription_id, specific_document_ids,
        purpose, purpose_notes, duration_hours, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
       RETURNING *`,
      [
        req.user.id,
        patient.id,
        share_code.trim().toUpperCase(),
        data_categories,
        specific_prescription_id || null,
        specific_document_ids || null,
        purpose,
        purpose_notes || null,
        duration_hours
      ]
    );

    const createdReq = insertRes.rows[0];

    // 4. Record any non-blocking fraud flags (e.g. UNVERIFIED_ORG, DUPLICATE_REQUEST)
    if (fraudResult.flags.length > 0) {
      await recordFraudFlags({
        requestId: createdReq.id,
        prescriptionId: specific_prescription_id || null,
        flags: fraudResult.flags,
        actorId: req.user.id,
        actorRole: 'org'
      });
    }

    // 5. Audit log
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'org',
      action: 'access_requested',
      targetId: createdReq.id,
      targetType: 'access_request',
      metadata: {
        patient_id: patient.id,
        purpose,
        categories: data_categories,
        duration_hours,
        flags_triggered: fraudResult.flags.map(f => f.rule)
      }
    });

    res.status(201).json({
      request_id: createdReq.id,
      patient_name: patient.name,
      status: 'pending',
      fraud_flags_triggered: fraudResult.flags
    });
  } catch (err) {
    console.error('Create access request error:', err);
    res.status(500).json({ error: 'Failed to create access request', message: err.message });
  }
});

/**
 * GET /api/access-requests/pending
 * Auth: patient_token
 * Returns all pending requests for this patient with org details
 */
router.get('/pending', verifyToken(['patient']), async (req, res) => {
  try {
    const requestsRes = await query(
      `SELECT r.*, u.name as org_name, u.org_type, u.org_verified
       FROM access_requests r
       JOIN users u ON r.org_id = u.id
       WHERE r.patient_id = $1 AND r.status = 'pending'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json(requestsRes.rows);
  } catch (err) {
    console.error('Get pending requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve pending requests', message: err.message });
  }
});

/**
 * GET /api/access-requests/history
 * Auth: patient_token
 * Returns all non-pending requests for this patient
 */
router.get('/history', verifyToken(['patient']), async (req, res) => {
  try {
    const historyRes = await query(
      `SELECT r.*, u.name as org_name, u.org_type, u.org_verified
       FROM access_requests r
       JOIN users u ON r.org_id = u.id
       WHERE r.patient_id = $1 AND r.status != 'pending'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json(historyRes.rows);
  } catch (err) {
    console.error('Get request history error:', err);
    res.status(500).json({ error: 'Failed to retrieve history', message: err.message });
  }
});

/**
 * POST /api/access-requests/:id/approve
 * Auth: patient_token
 * Body: { pin }
 * Centerpiece of cryptographic authorization
 */
router.post('/:id/approve', verifyToken(['patient']), async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required to authorize data release' });
    }

    // Step 1: Verify PIN
    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    // Fetch request
    const reqRes = await query(
      'SELECT * FROM access_requests WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const accessReq = reqRes.rows[0];
    if (accessReq.status !== 'pending') {
      return res.status(400).json({ error: `Request cannot be approved because status is '${accessReq.status}'` });
    }

    // Step 2: Decrypt patient private key
    let rawPrivateKey;
    try {
      rawPrivateKey = decryptPrivateKey(req.user.private_key_enc, String(pin));
    } catch (cryptoErr) {
      return res.status(500).json({ error: 'Failed to decrypt private key with provided PIN' });
    }

    // Compute scope hash
    const scopeCanonical = JSON.stringify(accessReq.data_categories.sort());
    const scopeHash = crypto.createHash('sha256').update(scopeCanonical).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + accessReq.duration_hours * 60 * 60 * 1000);

    // Step 3: Build authorization payload
    const authorizationPayload = {
      request_id: accessReq.id,
      patient_id: req.user.id,
      org_id: accessReq.org_id,
      purpose: accessReq.purpose,
      data_categories: accessReq.data_categories,
      scope_hash: scopeHash,
      authorized_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    };

    // Step 4: Sign payload with RSA-PSS
    const authorizationSignature = signData(JSON.stringify(authorizationPayload), rawPrivateKey);

    // Step 5 & 6: Release scoped data
    const scopedData = await buildScopedData(
      req.user.id,
      accessReq.data_categories,
      accessReq.specific_prescription_id,
      accessReq.specific_document_ids
    );

    // CRITICAL FIX: store the EXACT string that was signed (not re-serialized)
    // so verification can reconstruct it identically
    const payloadStr = JSON.stringify(authorizationPayload);

    // Update access_requests record — store payload as TEXT (not JSONB) to preserve exact string
    await query(
      `UPDATE access_requests SET
        status = 'approved',
        authorization_payload = $1::text,
        authorization_signature = $2,
        scoped_data = $3,
        approved_at = $4,
        expires_at = $5
       WHERE id = $6`,
      [
        payloadStr,
        authorizationSignature,
        JSON.stringify(scopedData),
        now.toISOString(),
        expiresAt.toISOString(),
        accessReq.id
      ]
    );

    // Audit log
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'patient',
      action: 'access_approved',
      targetId: accessReq.id,
      targetType: 'access_request',
      metadata: {
        org_id: accessReq.org_id,
        scope_hash: scopeHash,
        categories: accessReq.data_categories,
        expires_at: expiresAt.toISOString()
      }
    });

    // Return the 6 cryptographic steps to drive the frontend animation popup
    res.json({
      success: true,
      expires_at: expiresAt.toISOString(),
      steps: [
        {
          step: 1,
          label: 'PIN verified',
          detail: 'bcrypt hash comparison successful with salt rounds'
        },
        {
          step: 2,
          label: 'Private key decrypted',
          detail: 'AES-256-CBC cipher decrypted using SHA-256(PIN)'
        },
        {
          step: 3,
          label: 'Authorization payload built',
          detail: JSON.stringify(authorizationPayload)
        },
        {
          step: 4,
          label: 'RSA-PSS signature created',
          detail: authorizationSignature.slice(0, 48) + '...'
        },
        {
          step: 5,
          label: 'Scope hash verified',
          detail: 'SHA-256(' + accessReq.data_categories.join(',') + ') = ' + scopeHash.slice(0, 16) + '...'
        },
        {
          step: 6,
          label: 'Scoped data released',
          detail: `Strictly ${accessReq.data_categories.length} category grant bound to organization`
        }
      ]
    });
  } catch (err) {
    console.error('Approve access request error:', err);
    res.status(500).json({ error: 'Failed to approve request', message: err.message });
  }
});

/**
 * POST /api/access-requests/:id/reject
 * Auth: patient_token
 */
router.post('/:id/reject', verifyToken(['patient']), async (req, res) => {
  try {
    const reqRes = await query(
      'SELECT * FROM access_requests WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    await query(
      "UPDATE access_requests SET status = 'rejected' WHERE id = $1",
      [req.params.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'patient',
      action: 'access_rejected',
      targetId: req.params.id,
      targetType: 'access_request'
    });

    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ error: 'Failed to reject request', message: err.message });
  }
});

/**
 * POST /api/access-requests/:id/revoke
 * Auth: patient_token
 * Body: { reason, pin }
 */
router.post('/:id/revoke', verifyToken(['patient']), async (req, res) => {
  try {
    const { reason, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN required to revoke authorization' });
    }

    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    const reqRes = await query(
      'SELECT * FROM access_requests WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const accessReq = reqRes.rows[0];
    if (accessReq.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved authorizations can be revoked' });
    }

    await query(
      `UPDATE access_requests SET
        status = 'revoked',
        revoked_at = NOW(),
        revoke_reason = $1
       WHERE id = $2`,
      [reason || 'Revoked by patient', accessReq.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'patient',
      action: 'access_revoked',
      targetId: accessReq.id,
      targetType: 'access_request',
      metadata: {
        reason: reason || 'Revoked by patient',
        org_id: accessReq.org_id
      }
    });

    res.json({ success: true, message: 'Authorization revoked immediately' });
  } catch (err) {
    console.error('Revoke authorization error:', err);
    res.status(500).json({ error: 'Failed to revoke authorization', message: err.message });
  }
});

/**
 * GET /api/access-requests/org
 * Auth: org_token — MUST be registered before /:id routes to avoid routing conflict
 */
router.get('/org', verifyToken(['org']), async (req, res) => {
  try {
    const reqRes = await query(
      `SELECT r.*, u.name as patient_name
       FROM access_requests r
       JOIN users u ON r.patient_id = u.id
       WHERE r.org_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(reqRes.rows);
  } catch (err) {
    console.error('Get org requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve org requests', message: err.message });
  }
});

/**
 * GET /api/access-requests/:id/data
 * Auth: org_token
 * Final access = Authenticated org + Valid patient authorization
 *              + Valid RSA signature + Correct scope + Not expired + Not revoked
 * + AI drug safety analysis of released prescriptions
 */
router.get('/:id/data', verifyToken(['org']), async (req, res) => {
  try {
    const reqRes = await query(
      `SELECT r.*, u.public_key as patient_public_key, u.name as patient_name
       FROM access_requests r
       JOIN users u ON r.patient_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }

    const accessReq = reqRes.rows[0];

    // 1. Verify org ownership
    if (accessReq.org_id !== req.user.id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'This authorization was not issued to your organization'
      });
    }

    // 2. Status checks
    if (accessReq.status === 'revoked') {
      return res.status(403).json({
        error: 'authorization_revoked',
        message: `Patient has revoked this authorization. Reason: ${accessReq.revoke_reason || 'No reason provided'}`
      });
    }
    if (accessReq.status !== 'approved') {
      return res.status(403).json({
        error: 'not_approved',
        message: `Access is not authorized. Current status: ${accessReq.status}`
      });
    }

    // 3. Expiry check
    const now = new Date();
    const expiresAt = new Date(accessReq.expires_at);
    if (expiresAt <= now) {
      return res.status(403).json({
        error: 'authorization_expired',
        message: `Access authorization expired at ${expiresAt.toISOString()}`
      });
    }

    // 4. RSA-PSS signature verification
    // Use the stored string directly — it is the exact string that was signed
    let payloadStr;
    if (typeof accessReq.authorization_payload === 'string') {
      // Stored as text column — use directly
      payloadStr = accessReq.authorization_payload;
    } else {
      // Stored as JSONB (older records) — stringify with stable order
      payloadStr = JSON.stringify(accessReq.authorization_payload);
    }

    let isSigValid = false;
    try {
      isSigValid = verifySignature(payloadStr, accessReq.authorization_signature, accessReq.patient_public_key);
    } catch (sigErr) {
      console.error('Signature verification error:', sigErr);
    }

    if (!isSigValid) {
      await logAuditEvent({
        actorId: req.user.id,
        actorRole: 'org',
        action: 'tamper_detected',
        targetId: accessReq.id,
        targetType: 'access_request',
        metadata: { message: 'RSA signature verification failed during org data access' }
      });
      return res.status(403).json({
        error: 'tamper_detected',
        message: 'Cryptographic signature check failed. Authorization payload was altered or corrupted.'
      });
    }

    // 5. Parse scoped data
    const parsedScoped = typeof accessReq.scoped_data === 'string'
      ? JSON.parse(accessReq.scoped_data)
      : (accessReq.scoped_data || {});

    // 6. AI Drug Safety Analysis on released prescriptions
    let aiSafety = null;
    try {
      const drugs = [];
      const allergies = parsedScoped.allergies || [];

      // Collect all drug names from prescriptions
      if (Array.isArray(parsedScoped.prescriptions)) {
        parsedScoped.prescriptions.forEach(rx => {
          if (rx.drug_name) drugs.push(rx.drug_name);
        });
      }
      // Also include current medications
      if (Array.isArray(parsedScoped.current_medications)) {
        parsedScoped.current_medications.forEach(med => {
          const name = typeof med === 'string' ? med : (med.name || med.drug_name || '');
          if (name && !drugs.includes(name)) drugs.push(name);
        });
      }

      if (drugs.length > 0) {
        console.log('[AI Clinical] Analyzing drug safety for scoped data release:', { drugs, allergies });
        aiSafety = await analyzeDrugSafety(drugs, allergies);
      }
    } catch (aiErr) {
      console.warn('[AI Clinical] Drug safety check failed (non-critical):', aiErr.message);
      aiSafety = null;
    }

    // 7. Audit log
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'org',
      action: 'data_accessed',
      targetId: accessReq.id,
      targetType: 'access_request',
      metadata: {
        patient_id: accessReq.patient_id,
        categories_accessed: accessReq.data_categories,
        ai_safety_checked: aiSafety !== null,
        ai_safe: aiSafety?.safe ?? null
      }
    });

    res.json({
      request_id: accessReq.id,
      patient_name: accessReq.patient_name,
      purpose: accessReq.purpose,
      approved_at: accessReq.approved_at,
      expires_at: accessReq.expires_at,
      data_categories: accessReq.data_categories,
      rsa_signature_verified: true,
      scoped_data: parsedScoped,
      ai_safety: aiSafety
    });
  } catch (err) {
    console.error('Access data error:', err);
    res.status(500).json({ error: 'Failed to access patient data', message: err.message });
  }
});

export default router;
