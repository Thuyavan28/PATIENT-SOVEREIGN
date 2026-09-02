import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../lib/db.js';
import { verifyToken, verifyUserPin } from '../middleware/auth.js';
import { logAuditEvent } from '../lib/auditLog.js';

const router = Router();

/**
 * POST /api/documents
 * Upload a medical document with PIN authorization and SHA-256 integrity hash
 */
router.post('/', verifyToken(['patient']), async (req, res) => {
  try {
    const {
      title,
      document_type,
      description,
      file_data,
      file_name,
      mime_type,
      pin
    } = req.body;

    if (!title || !document_type || !file_data || !file_name || !mime_type || !pin) {
      return res.status(400).json({ error: 'Missing required document fields or PIN' });
    }

    // Verify PIN
    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    // Calculate SHA-256 content hash of the base64 file data
    const contentHash = crypto.createHash('sha256').update(file_data).digest('hex');
    
    // Estimate file size in bytes from base64 string
    const fileSize = Math.round((file_data.length * 3) / 4);

    const insertRes = await query(
      `INSERT INTO medical_documents
       (patient_id, document_type, title, description, file_name, file_size, file_data, mime_type, content_hash, uploaded_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), false)
       RETURNING id, patient_id, document_type, title, description, file_name, file_size, mime_type, content_hash, uploaded_at`,
      [
        req.user.id,
        document_type,
        title.trim(),
        description ? description.trim() : null,
        file_name,
        fileSize,
        file_data,
        mime_type,
        contentHash
      ]
    );

    const doc = insertRes.rows[0];

    // Audit log
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'document_uploaded',
      targetId: doc.id,
      targetType: 'medical_document',
      metadata: {
        title: doc.title,
        document_type: doc.document_type,
        content_hash: contentHash,
        file_size: fileSize
      }
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Failed to upload document', message: err.message });
  }
});

/**
 * GET /api/documents
 * List all non-deleted documents for authenticated patient (excluding large base64 data)
 */
router.get('/', verifyToken(['patient']), async (req, res) => {
  try {
    const docRes = await query(
      `SELECT id, patient_id, document_type, title, description, file_name, file_size, mime_type, content_hash, uploaded_at
       FROM medical_documents
       WHERE patient_id = $1 AND is_deleted = false
       ORDER BY uploaded_at DESC, id DESC`,
      [req.user.id]
    );

    res.json(docRes.rows);
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ error: 'Failed to retrieve documents', message: err.message });
  }
});

/**
 * GET /api/documents/:id
 * Retrieve full document including base64 file_data. Verifies content_hash integrity.
 */
router.get('/:id', verifyToken(['patient', 'org', 'admin']), async (req, res) => {
  try {
    const docRes = await query('SELECT * FROM medical_documents WHERE id = $1', [req.params.id]);
    if (docRes.rows.length === 0 || docRes.rows[0].is_deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docRes.rows[0];

    // If patient, ensure they own it
    if (req.user.role === 'patient' && doc.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have access to this document' });
    }

    // Verify SHA-256 hash match
    const computedHash = crypto.createHash('sha256').update(doc.file_data).digest('hex');
    const integrityIntact = computedHash === doc.content_hash;

    if (!integrityIntact) {
      await logAuditEvent({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'tamper_detected',
        targetId: doc.id,
        targetType: 'medical_document',
        metadata: {
          expected_hash: doc.content_hash,
          computed_hash: computedHash,
          document_id: doc.id
        }
      });
    }

    res.json({
      ...doc,
      integrity_intact: integrityIntact
    });
  } catch (err) {
    console.error('Get document detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve document', message: err.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Body: { pin }
 * Soft delete medical document with PIN authorization
 */
router.delete('/:id', verifyToken(['patient']), async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required to delete medical records' });
    }

    const validPin = await verifyUserPin(req.user, pin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Invalid 4-digit PIN' });
    }

    const docRes = await query('SELECT * FROM medical_documents WHERE id = $1 AND patient_id = $2', [
      req.params.id,
      req.user.id
    ]);

    if (docRes.rows.length === 0 || docRes.rows[0].is_deleted) {
      return res.status(404).json({ error: 'Document not found or already deleted' });
    }

    const doc = docRes.rows[0];

    await query('UPDATE medical_documents SET is_deleted = true WHERE id = $1', [doc.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'document_deleted',
      targetId: doc.id,
      targetType: 'medical_document',
      metadata: {
        title: doc.title,
        document_type: doc.document_type
      }
    });

    res.json({ success: true, message: 'Document deleted securely' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document', message: err.message });
  }
});

export default router;
