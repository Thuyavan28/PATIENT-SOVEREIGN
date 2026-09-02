import { Router } from 'express';
import { query } from '../lib/db.js';
import { verifyToken } from '../middleware/auth.js';
import { verifyAuditChain } from '../lib/auditLog.js';

const router = Router();

/**
 * GET /api/audit/my
 * Auth: patient_token
 * Returns all audit events related to this patient, with event_hash and prev_hash for chain visualization
 */
router.get('/my', verifyToken(['patient']), async (req, res) => {
  try {
    const auditRes = await query(
      `SELECT * FROM audit_log
       WHERE actor_id = $1 OR target_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json(auditRes.rows);
  } catch (err) {
    console.error('Get my audit error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit trail', message: err.message });
  }
});

/**
 * GET /api/audit/verify
 * Recomputes the entire audit log hash chain to verify cryptographic integrity
 */
router.get('/verify', verifyToken(['patient', 'admin']), async (req, res) => {
  try {
    const result = await verifyAuditChain();
    res.json(result);
  } catch (err) {
    console.error('Verify audit chain error:', err);
    res.status(500).json({ error: 'Chain verification failed', message: err.message });
  }
});

export default router;
