import { Router } from 'express';
import { query } from '../lib/db.js';
import { verifyToken } from '../middleware/auth.js';
import { logAuditEvent, verifyAuditChain } from '../lib/auditLog.js';

const router = Router();

/**
 * GET /api/admin/stats
 * System-wide statistics for admin dashboard overview
 */
router.get('/stats', verifyToken(['admin']), async (req, res) => {
  try {
    const patientsRes = await query("SELECT COUNT(*) as count FROM users WHERE role = 'patient'");
    const orgsRes = await query("SELECT COUNT(*) as count FROM users WHERE role = 'org'");
    const rxRes = await query(
      "SELECT COUNT(*) as count FROM prescriptions WHERE created_at > NOW() - INTERVAL '24 hours'"
    );
    const docsRes = await query("SELECT COUNT(*) as count FROM medical_documents WHERE is_deleted = false");
    const activeAuthRes = await query(
      "SELECT COUNT(*) as count FROM access_requests WHERE status = 'approved' AND expires_at > NOW()"
    );
    const flagsRes = await query(
      "SELECT COUNT(*) as count FROM fraud_flags WHERE flagged_at > NOW() - INTERVAL '7 days'"
    );

    res.json({
      total_patients: parseInt(patientsRes.rows[0]?.count || 0, 10),
      total_orgs: parseInt(orgsRes.rows[0]?.count || 0, 10),
      prescriptions_today: parseInt(rxRes.rows[0]?.count || 0, 10),
      documents_total: parseInt(docsRes.rows[0]?.count || 0, 10),
      active_authorizations: parseInt(activeAuthRes.rows[0]?.count || 0, 10),
      flags_this_week: parseInt(flagsRes.rows[0]?.count || 0, 10)
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats', message: err.message });
  }
});

/**
 * GET /api/admin/orgs
 * List all healthcare organizations with verification status
 */
router.get('/orgs', verifyToken(['admin']), async (req, res) => {
  try {
    const orgsRes = await query(
      `SELECT id, name, email, org_type, org_verified, created_at,
        (SELECT COUNT(*) FROM access_requests WHERE org_id = users.id) as total_requests,
        (SELECT COUNT(*) FROM access_requests WHERE org_id = users.id AND status = 'approved') as approved_requests
       FROM users
       WHERE role = 'org'
       ORDER BY created_at DESC`
    );

    res.json(orgsRes.rows);
  } catch (err) {
    console.error('Admin orgs error:', err);
    res.status(500).json({ error: 'Failed to retrieve organizations', message: err.message });
  }
});

/**
 * POST /api/admin/orgs/:id/verify
 * Set org_verified = true (or toggle)
 */
router.post('/orgs/:id/verify', verifyToken(['admin']), async (req, res) => {
  try {
    const orgRes = await query('SELECT * FROM users WHERE id = $1 AND role = $2', [req.params.id, 'org']);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const org = orgRes.rows[0];
    const newStatus = !org.org_verified;

    await query('UPDATE users SET org_verified = $1 WHERE id = $2', [newStatus, org.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: 'admin',
      action: 'org_verified',
      targetId: org.id,
      targetType: 'user',
      metadata: { org_name: org.name, org_type: org.org_type, verified: newStatus }
    });

    res.json({
      success: true,
      message: `Organization ${newStatus ? 'verified' : 'unverified'} successfully`,
      org_verified: newStatus
    });
  } catch (err) {
    console.error('Admin verify org error:', err);
    res.status(500).json({ error: 'Failed to update org status', message: err.message });
  }
});

/**
 * GET /api/admin/fraud-flags
 * List all fraud flags with associated request and prescription details
 */
router.get('/fraud-flags', verifyToken(['admin', 'org']), async (req, res) => {
  try {
    const flagsRes = await query(
      `SELECT f.*, 
        r.purpose, r.data_categories,
        p.drug_name, p.dosage,
        u.name as patient_name
       FROM fraud_flags f
       LEFT JOIN access_requests r ON f.request_id = r.id
       LEFT JOIN prescriptions p ON f.prescription_id = p.id
       LEFT JOIN users u ON r.patient_id = u.id
       ORDER BY f.flagged_at DESC
       LIMIT 100`
    );

    res.json(flagsRes.rows);
  } catch (err) {
    console.error('Admin fraud flags error:', err);
    res.status(500).json({ error: 'Failed to retrieve fraud flags', message: err.message });
  }
});

/**
 * GET /api/admin/audit
 * Full system audit log, paginated
 */
router.get('/audit', verifyToken(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const offset = (page - 1) * limit;

    const totalRes = await query('SELECT COUNT(*) as count FROM audit_log');
    const total = parseInt(totalRes.rows[0]?.count || 0, 10);

    const logsRes = await query(
      `SELECT a.*, u.name as actor_name
       FROM audit_log a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      logs: logsRes.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Admin audit error:', err);
    res.status(500).json({ error: 'Failed to retrieve system audit', message: err.message });
  }
});

/**
 * GET /api/admin/audit/verify
 * Cryptographically recompute entire audit chain from genesis
 */
router.get('/audit/verify', verifyToken(['admin']), async (req, res) => {
  try {
    const verification = await verifyAuditChain();
    res.json(verification);
  } catch (err) {
    console.error('Admin audit verify error:', err);
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

export default router;
