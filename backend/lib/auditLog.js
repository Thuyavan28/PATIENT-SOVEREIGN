import { query } from './db.js';
import { buildAuditHash } from './crypto.js';

/**
 * Appends a tamper-evident, cryptographically hash-chained entry to audit_log
 */
export async function logAuditEvent({
  actorId = null,
  actorRole = 'system',
  action,
  targetId = null,
  targetType = null,
  metadata = {}
}) {
  try {
    // Get the previous audit event hash
    const prevRes = await query(
      'SELECT event_hash FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 1'
    );
    const prevHash = prevRes.rows.length > 0 ? prevRes.rows[0].event_hash : '0';

    const timestamp = new Date().toISOString();
    const eventHash = buildAuditHash(prevHash, action, actorId || 'system', timestamp);

    const insertRes = await query(
      `INSERT INTO audit_log 
       (actor_id, actor_role, action, target_id, target_type, metadata, prev_hash, event_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        actorId,
        actorRole,
        action,
        targetId,
        targetType,
        JSON.stringify(metadata),
        prevHash,
        eventHash,
        timestamp
      ]
    );

    return insertRes.rows[0];
  } catch (err) {
    console.error('Failed to log audit event:', err);
    // Don't throw if logging fails, but log the error
    return null;
  }
}

/**
 * Recomputes and verifies the complete audit chain
 */
export async function verifyAuditChain() {
  const res = await query('SELECT * FROM audit_log ORDER BY created_at ASC, id ASC');
  const logs = res.rows;

  if (logs.length === 0) {
    return { valid: true, total_events: 0, broken_at_id: null };
  }

  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    const expectedPrev = i === 0 ? '0' : logs[i - 1].event_hash;

    // Check previous hash pointer
    if (current.prev_hash !== expectedPrev) {
      return {
        valid: false,
        total_events: logs.length,
        broken_at_id: current.id,
        reason: `Previous hash mismatch at step ${i + 1}. Expected ${expectedPrev}, found ${current.prev_hash}`
      };
    }

    // Standardize ISO timestamp format
    const timeIso = new Date(current.created_at).toISOString();
    const computedHash = buildAuditHash(
      current.prev_hash,
      current.action,
      current.actor_id || 'system',
      timeIso
    );

    if (computedHash !== current.event_hash) {
      // In case of slight date string rounding between DB and JS, test both
      const altTime = current.created_at instanceof Date ? current.created_at.toISOString() : String(current.created_at);
      const altHash = buildAuditHash(current.prev_hash, current.action, current.actor_id || 'system', altTime);
      if (altHash !== current.event_hash) {
        return {
          valid: false,
          total_events: logs.length,
          broken_at_id: current.id,
          reason: `Event hash mismatch at step ${i + 1}. Expected ${computedHash}, found ${current.event_hash}`
        };
      }
    }
  }

  return { valid: true, total_events: logs.length, broken_at_id: null };
}
