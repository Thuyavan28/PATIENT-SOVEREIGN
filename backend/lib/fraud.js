import { query } from './db.js';
import { logAuditEvent } from './auditLog.js';

/**
 * Runs the 4 synchronous fraud detection rules on access request submission.
 * Returns: { blocked: boolean, blockReason?: string, flags: Array<{ rule: string, severity: string, details: object }> }
 */
export async function runFraudChecks({
  orgId,
  patientId,
  specificPrescriptionId = null
}) {
  const flags = [];

  // Check Org verification status
  const orgRes = await query('SELECT id, name, org_verified FROM users WHERE id = $1', [orgId]);
  const org = orgRes.rows[0];

  // Rule 4 — Unverified org:
  if (org && org.org_verified === false) {
    flags.push({
      rule: 'UNVERIFIED_ORG',
      severity: 'medium',
      details: {
        org_id: orgId,
        org_name: org.name,
        message: 'Organization is not yet verified by platform administrators'
      }
    });
  }

  // Rule 2 — Duplicate request:
  // Check if this org requested access to this patient within the last 10 minutes
  const dupRes = await query(
    `SELECT COUNT(*) as count FROM access_requests
     WHERE patient_id = $1 AND org_id = $2
     AND created_at > NOW() - INTERVAL '10 minutes'`,
    [patientId, orgId]
  );
  const dupCount = parseInt(dupRes.rows[0]?.count || 0, 10);
  if (dupCount >= 1) {
    flags.push({
      rule: 'DUPLICATE_REQUEST',
      severity: 'medium',
      details: {
        org_id: orgId,
        patient_id: patientId,
        recent_requests_count: dupCount,
        message: 'Multiple access requests sent to this patient within 10 minutes'
      }
    });
  }

  // Prescription-specific checks
  if (specificPrescriptionId) {
    const rxRes = await query(
      'SELECT id, drug_name, expiry_date FROM prescriptions WHERE id = $1',
      [specificPrescriptionId]
    );

    if (rxRes.rows.length > 0) {
      const rx = rxRes.rows[0];

      // Rule 3 — Expired prescription:
      if (rx.expiry_date) {
        const expiryDate = new Date(rx.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiryDate < today) {
          flags.push({
            rule: 'EXPIRED_PRESCRIPTION',
            severity: 'high',
            details: {
              prescription_id: specificPrescriptionId,
              drug_name: rx.drug_name,
              expiry_date: rx.expiry_date,
              message: 'Attempted access to an expired prescription'
            }
          });

          return {
            blocked: true,
            blockReason: `Prescription for ${rx.drug_name} expired on ${new Date(rx.expiry_date).toLocaleDateString()}. Access cannot be requested.`,
            flags
          };
        }
      }

      // Rule 1 — Multi-org attempt:
      // Check if 3 or more distinct orgs requested this specific prescription in the last 60 minutes
      const multiOrgRes = await query(
        `SELECT DISTINCT org_id FROM access_requests
         WHERE specific_prescription_id = $1
         AND created_at > NOW() - INTERVAL '60 minutes'
         AND status != 'rejected'`,
        [specificPrescriptionId]
      );

      const existingOrgIds = multiOrgRes.rows.map(r => r.org_id);
      const allOrgIds = Array.from(new Set([...existingOrgIds, orgId]));

      if (allOrgIds.length >= 3) {
        flags.push({
          rule: 'MULTI_ORG_ATTEMPT',
          severity: 'high',
          details: {
            prescription_id: specificPrescriptionId,
            org_count: allOrgIds.length,
            org_ids: allOrgIds,
            message: 'High frequency requests for this prescription across 3 or more healthcare organizations within 60 minutes'
          }
        });
      }
    }
  }

  return {
    blocked: false,
    flags
  };
}

/**
 * Saves triggered fraud flags to database and writes to audit_log
 */
export async function recordFraudFlags({
  requestId = null,
  prescriptionId = null,
  flags = [],
  actorId,
  actorRole = 'org'
}) {
  for (const flag of flags) {
    const orgIds = flag.details?.org_ids || (flag.details?.org_id ? [flag.details.org_id] : []);
    const insertRes = await query(
      `INSERT INTO fraud_flags
       (request_id, prescription_id, rule_triggered, severity, org_ids, details, flagged_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        requestId,
        prescriptionId,
        flag.rule,
        flag.severity,
        orgIds,
        JSON.stringify(flag.details)
      ]
    );

    await logAuditEvent({
      actorId,
      actorRole,
      action: 'fraud_flagged',
      targetId: requestId || prescriptionId,
      targetType: requestId ? 'access_request' : 'prescription',
      metadata: {
        rule: flag.rule,
        severity: flag.severity,
        flag_id: insertRes.rows[0]?.id,
        details: flag.details
      }
    });
  }
}
