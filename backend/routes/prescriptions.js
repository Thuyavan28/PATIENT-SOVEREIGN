import { Router } from 'express';
import { query } from '../lib/db.js';
import { verifyToken, verifyUserPin } from '../middleware/auth.js';
import { decryptPrivateKey, signData, verifySignature, hashContent, buildChainHash } from '../lib/crypto.js';
import { logAuditEvent } from '../lib/auditLog.js';
import { analyzeDrugSafety } from '../lib/ai.js';

const router = Router();

function formatCanonicalDate(val) {
  if (!val) return null;
  if (typeof val === 'string') return val.split('T')[0];
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).split('T')[0];
}

// Helper to construct canonical prescription object for hashing
export function buildPrescriptionCanonicalObj(rx, patientId) {
  return {
    patient_id: patientId,
    drug_name: rx.drug_name,
    dosage: rx.dosage,
    frequency: rx.frequency,
    duration: rx.duration || null,
    doctor_name: rx.doctor_name,
    doctor_reg: rx.doctor_reg || null,
    diagnosis: rx.diagnosis || null,
    notes: rx.notes || null,
    issued_date: formatCanonicalDate(rx.issued_date),
    expiry_date: formatCanonicalDate(rx.expiry_date)
  };
}


/**
 * POST /api/prescriptions
 * Creates and cryptographically signs a prescription
 */
router.post('/', verifyToken(['patient']), async (req, res) => {
  try {
    const {
      drug_name,
      dosage,
      frequency,
      duration,
      doctor_name,
      doctor_reg,
      diagnosis,
      notes,
      issued_date,
      expiry_date,
      pin
    } = req.body;

    if (!drug_name || !dosage || !frequency || !doctor_name || !issued_date || !pin) {
      return res.status(400).json({ error: 'Missing required prescription fields or PIN' });
    }

    // 1. Verify PIN
    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    // 2. Build canonical content hash
    const canonicalData = buildPrescriptionCanonicalObj({
      drug_name,
      dosage,
      frequency,
      duration,
      doctor_name,
      doctor_reg,
      diagnosis,
      notes,
      issued_date,
      expiry_date
    }, req.user.id);

    const contentHash = hashContent(canonicalData);

    // 3. Decrypt private key with PIN and sign contentHash with RSA-PSS
    const rawPrivateKey = decryptPrivateKey(req.user.private_key_enc, String(pin));
    const signature = signData(contentHash, rawPrivateKey);

    // 4. Get previous prescription chain_hash for this patient
    const prevRxRes = await query(
      `SELECT chain_hash FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [req.user.id]
    );
    const prevHash = prevRxRes.rows.length > 0 ? prevRxRes.rows[0].chain_hash : '0';

    // 5. Build new chain hash
    const chainHash = buildChainHash(prevHash, contentHash);

    // 6. Run AI drug safety check against patient's current medications and allergies from vault
    const vaultRes = await query('SELECT allergies, current_medications FROM health_vault WHERE patient_id = $1', [req.user.id]);
    const vault = vaultRes.rows[0] || {};
    const allergiesList = (vault.allergies || []).map(a => typeof a === 'string' ? a : a.name);
    const medsList = (vault.current_medications || []).map(m => typeof m === 'string' ? m : m.name);

    // Analyze combination of current drugs + newly added drug
    const allDrugs = [...medsList, drug_name];
    const aiWarnings = await analyzeDrugSafety(allDrugs, allergiesList);

    // 7. Store prescription
    const insertRes = await query(
      `INSERT INTO prescriptions
       (patient_id, drug_name, dosage, frequency, duration, doctor_name, doctor_reg,
        diagnosis, notes, issued_date, expiry_date, content_hash, signature, prev_hash,
        chain_hash, status, ai_warnings, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
       RETURNING *`,
      [
        req.user.id,
        drug_name,
        dosage,
        frequency,
        duration || null,
        doctor_name,
        doctor_reg || null,
        diagnosis || null,
        notes || null,
        issued_date,
        expiry_date || null,
        contentHash,
        signature,
        prevHash,
        chainHash,
        'active',
        JSON.stringify(aiWarnings)
      ]
    );

    const createdRx = insertRes.rows[0];

    // 8. Audit log
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'prescription_created',
      targetId: createdRx.id,
      targetType: 'prescription',
      metadata: {
        drug_name,
        dosage,
        chain_hash: chainHash,
        safe: aiWarnings.safe,
        ai_warnings_count: (aiWarnings.interactions?.length || 0) + (aiWarnings.allergy_conflicts?.length || 0)
      }
    });

    res.status(201).json(createdRx);
  } catch (err) {
    console.error('Create prescription error:', err);
    res.status(500).json({ error: 'Failed to create prescription', message: err.message });
  }
});

/**
 * GET /api/prescriptions
 * Returns all prescriptions for patient with verified integrity flags
 */
router.get('/', verifyToken(['patient']), async (req, res) => {
  try {
    const rxRes = await query(
      'SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );

    const prescriptions = rxRes.rows;
    const verifiedList = [];

    // Verify signatures and hash chain for each prescription
    for (let i = 0; i < prescriptions.length; i++) {
      const rx = prescriptions[i];
      const canonical = buildPrescriptionCanonicalObj(rx, req.user.id);
      const computedContentHash = hashContent(canonical);
      const hashMatch = computedContentHash === rx.content_hash;
      const signatureValid = verifySignature(computedContentHash, rx.signature, req.user.public_key);
      const computedChain = buildChainHash(rx.prev_hash, rx.content_hash);
      const chainValid = computedChain === rx.chain_hash;

      const integrityValid = hashMatch && signatureValid && chainValid;

      verifiedList.push({
        ...rx,
        integrity_valid: integrityValid,
        verification_details: {
          hash_match: hashMatch,
          signature_valid: signatureValid,
          chain_valid: chainValid
        }
      });
    }

    res.json(verifiedList);
  } catch (err) {
    console.error('Get prescriptions error:', err);
    res.status(500).json({ error: 'Failed to retrieve prescriptions', message: err.message });
  }
});

/**
 * GET /api/prescriptions/:id/verify
 * Recompute content_hash, verify RSA signature & hash chain
 */
router.get('/:id/verify', verifyToken(['patient', 'org', 'admin']), async (req, res) => {
  try {
    const rxRes = await query('SELECT * FROM prescriptions WHERE id = $1', [req.params.id]);
    if (rxRes.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const rx = rxRes.rows[0];

    // Fetch patient's public key
    const patientRes = await query('SELECT public_key FROM users WHERE id = $1', [rx.patient_id]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const publicKey = patientRes.rows[0].public_key;

    const canonical = buildPrescriptionCanonicalObj(rx, rx.patient_id);
    const computedContentHash = hashContent(canonical);
    const hashMatch = computedContentHash === rx.content_hash;
    const signatureValid = verifySignature(computedContentHash, rx.signature, publicKey);
    const computedChain = buildChainHash(rx.prev_hash, rx.content_hash);
    const chainValid = computedChain === rx.chain_hash;

    const tampered = !hashMatch || !signatureValid || !chainValid;

    if (tampered) {
      await logAuditEvent({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'tamper_detected',
        targetId: rx.id,
        targetType: 'prescription',
        metadata: {
          hash_match: hashMatch,
          signature_valid: signatureValid,
          chain_valid: chainValid
        }
      });
    }

    res.json({
      prescription_id: rx.id,
      drug_name: rx.drug_name,
      hash_match: hashMatch,
      signature_valid: signatureValid,
      chain_valid: chainValid,
      tampered,
      computed_hash: computedContentHash,
      stored_hash: rx.content_hash,
      chain_hash: rx.chain_hash,
      prev_hash: rx.prev_hash
    });
  } catch (err) {
    console.error('Verify prescription error:', err);
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

/**
 * DELETE /api/prescriptions/:id
 * Patient's sovereign right to delete their own prescription.
 * Requires PIN verification. Uses soft-delete to preserve hash chain integrity.
 */
router.delete('/:id', verifyToken(['patient']), async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN required to delete prescription' });
    }

    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    // Verify the prescription belongs to this patient
    const rxRes = await query(
      'SELECT * FROM prescriptions WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user.id]
    );

    if (rxRes.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found or access denied' });
    }

    const rx = rxRes.rows[0];

    // Remove references and delete prescription (Sovereign right to erasure)
    await query(
      `UPDATE access_requests SET specific_prescription_id = NULL WHERE specific_prescription_id = $1`,
      [rx.id]
    );
    await query(
      `DELETE FROM fraud_flags WHERE prescription_id = $1`,
      [rx.id]
    );
    await query(
      `DELETE FROM prescriptions WHERE id = $1`,
      [rx.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'patient',
      action: 'prescription_deleted',
      targetId: rx.id,
      targetType: 'prescription',
      metadata: {
        drug_name: rx.drug_name,
        reason: 'Patient exercised sovereign deletion right'
      }
    });

    res.json({ success: true, message: `Prescription for ${rx.drug_name} has been deleted` });
  } catch (err) {
    console.error('Delete prescription error:', err);
    res.status(500).json({ error: 'Failed to delete prescription', message: err.message });
  }
});

export default router;
