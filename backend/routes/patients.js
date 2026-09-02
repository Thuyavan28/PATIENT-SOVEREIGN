import { Router } from 'express';
import { query } from '../lib/db.js';
import { verifyToken } from '../middleware/auth.js';
import { logAuditEvent } from '../lib/auditLog.js';

const router = Router();

/**
 * GET /api/patients/lookup/:shareCode
 * Auth: org_token (or admin)
 * Returns: { patient_id, name, share_code } — NO medical data
 * Core architectural principle: IDENTITY ≠ AUTHORIZATION ≠ ACCESS
 */
router.get('/lookup/:shareCode', verifyToken(['org', 'admin']), async (req, res) => {
  try {
    const rawCode = req.params.shareCode?.trim().toUpperCase();
    if (!rawCode || rawCode.length !== 6) {
      return res.status(400).json({ error: 'Share code must be a 6-character alphanumeric code' });
    }

    const patientRes = await query(
      `SELECT id, name, share_code FROM users WHERE share_code = $1 AND role = 'patient'`,
      [rawCode]
    );

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'No patient found with this share code' });
    }

    const patient = patientRes.rows[0];

    // Audit log this lookup
    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'share_code_lookup',
      targetId: patient.id,
      targetType: 'user',
      metadata: {
        share_code: rawCode,
        org_name: req.user.name,
        org_id: req.user.id
      }
    });

    // Strictly returns ONLY non-medical identity metadata
    res.json({
      patient_id: patient.id,
      name: patient.name,
      share_code: patient.share_code
    });
  } catch (err) {
    console.error('Share code lookup error:', err);
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

export default router;
