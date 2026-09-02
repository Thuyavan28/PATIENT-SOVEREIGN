import { Router } from 'express';
import { query } from '../lib/db.js';
import { verifyToken } from '../middleware/auth.js';
import { logAuditEvent } from '../lib/auditLog.js';

const router = Router();

// Ensure vault row exists for patient
async function getOrCreateVault(patientId) {
  let res = await query('SELECT * FROM health_vault WHERE patient_id = $1', [patientId]);
  if (res.rows.length === 0) {
    res = await query(
      `INSERT INTO health_vault (patient_id) VALUES ($1) RETURNING *`,
      [patientId]
    );
  }
  return res.rows[0];
}

/**
 * GET /api/vault
 * Returns full health_vault row for authenticated patient
 */
router.get('/', verifyToken(['patient']), async (req, res) => {
  try {
    const vault = await getOrCreateVault(req.user.id);
    res.json(vault);
  } catch (err) {
    console.error('Fetch vault error:', err);
    res.status(500).json({ error: 'Failed to retrieve health vault', message: err.message });
  }
});

/**
 * PUT /api/vault
 * Body: any subset of basic profile fields
 */
router.put('/', verifyToken(['patient']), async (req, res) => {
  try {
    const {
      blood_group,
      date_of_birth,
      gender,
      height_cm,
      weight_kg,
      emergency_contact,
      emergency_phone
    } = req.body;

    const vault = await getOrCreateVault(req.user.id);

    const changedFields = [];
    const updates = [];
    const params = [vault.id];
    let pIndex = 2;

    const fields = {
      blood_group,
      date_of_birth,
      gender,
      height_cm,
      weight_kg,
      emergency_contact,
      emergency_phone
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = $${pIndex}`);
        params.push(val === '' ? null : val);
        changedFields.push(key);
        pIndex++;
      }
    }

    if (updates.length === 0) {
      return res.json(vault);
    }

    updates.push(`updated_at = NOW()`);

    const sql = `UPDATE health_vault SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const updateRes = await query(sql, params);
    const updatedVault = updateRes.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'vault_updated',
      targetId: vault.id,
      targetType: 'health_vault',
      metadata: { changed_fields: changedFields }
    });

    res.json(updatedVault);
  } catch (err) {
    console.error('Update vault error:', err);
    res.status(500).json({ error: 'Failed to update health vault', message: err.message });
  }
});

// Helper for appending to a JSONB list
async function appendJsonbList(req, res, fieldName, item) {
  try {
    const vault = await getOrCreateVault(req.user.id);
    const currentList = Array.isArray(vault[fieldName]) ? vault[fieldName] : JSON.parse(vault[fieldName] || '[]');
    
    // Add timestamp to items
    const itemWithMeta = { ...item, added_at: new Date().toISOString() };
    const updatedList = [...currentList, itemWithMeta];

    const updateRes = await query(
      `UPDATE health_vault SET ${fieldName} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(updatedList), vault.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'vault_updated',
      targetId: vault.id,
      targetType: 'health_vault',
      metadata: { section: fieldName, action: 'added_item', item: itemWithMeta }
    });

    res.json({ success: true, vault: updateRes.rows[0] });
  } catch (err) {
    console.error(`Append ${fieldName} error:`, err);
    res.status(500).json({ error: `Failed to add item to ${fieldName}`, message: err.message });
  }
}

// Helper for removing by index from a JSONB list
async function removeJsonbList(req, res, fieldName, index) {
  try {
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ error: 'Invalid item index' });
    }

    const vault = await getOrCreateVault(req.user.id);
    const currentList = Array.isArray(vault[fieldName]) ? vault[fieldName] : JSON.parse(vault[fieldName] || '[]');

    if (idx >= currentList.length) {
      return res.status(404).json({ error: 'Item index out of bounds' });
    }

    const removedItem = currentList[idx];
    const updatedList = currentList.filter((_, i) => i !== idx);

    const updateRes = await query(
      `UPDATE health_vault SET ${fieldName} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(updatedList), vault.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'vault_updated',
      targetId: vault.id,
      targetType: 'health_vault',
      metadata: { section: fieldName, action: 'removed_item', removedItem }
    });

    res.json({ success: true, vault: updateRes.rows[0] });
  } catch (err) {
    console.error(`Remove ${fieldName} error:`, err);
    res.status(500).json({ error: `Failed to remove item from ${fieldName}`, message: err.message });
  }
}

// ALLERGIES
router.post('/allergies', verifyToken(['patient']), (req, res) => {
  const { name, severity, reaction } = req.body;
  if (!name) return res.status(400).json({ error: 'Allergy name is required' });
  appendJsonbList(req, res, 'allergies', {
    name,
    severity: severity || 'medium',
    reaction: reaction || ''
  });
});
router.delete('/allergies/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'allergies', req.params.index);
});

// CURRENT MEDICATIONS
router.post('/medications', verifyToken(['patient']), (req, res) => {
  const { name, dosage, frequency, prescribed_by } = req.body;
  if (!name) return res.status(400).json({ error: 'Medication name is required' });
  appendJsonbList(req, res, 'current_medications', {
    name,
    dosage: dosage || '',
    frequency: frequency || '',
    prescribed_by: prescribed_by || ''
  });
});
router.delete('/medications/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'current_medications', req.params.index);
});

// CHRONIC CONDITIONS
router.post('/conditions', verifyToken(['patient']), (req, res) => {
  const { name, since, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Condition name is required' });
  appendJsonbList(req, res, 'chronic_conditions', {
    name,
    since: since || '',
    notes: notes || ''
  });
});
router.delete('/conditions/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'chronic_conditions', req.params.index);
});

// IMMUNIZATIONS
router.post('/immunizations', verifyToken(['patient']), (req, res) => {
  const { vaccine, date, provider } = req.body;
  if (!vaccine) return res.status(400).json({ error: 'Vaccine name is required' });
  appendJsonbList(req, res, 'immunizations', {
    vaccine,
    date: date || '',
    provider: provider || ''
  });
});
router.delete('/immunizations/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'immunizations', req.params.index);
});

// SURGERIES
router.post('/surgeries', verifyToken(['patient']), (req, res) => {
  const { procedure, date, hospital, notes } = req.body;
  if (!procedure) return res.status(400).json({ error: 'Procedure name is required' });
  appendJsonbList(req, res, 'surgeries', {
    procedure,
    date: date || '',
    hospital: hospital || '',
    notes: notes || ''
  });
});
router.delete('/surgeries/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'surgeries', req.params.index);
});

// FAMILY HISTORY
router.post('/family-history', verifyToken(['patient']), (req, res) => {
  const { condition, relation } = req.body;
  if (!condition) return res.status(400).json({ error: 'Condition is required' });
  appendJsonbList(req, res, 'family_history', {
    condition,
    relation: relation || ''
  });
});
router.delete('/family-history/:index', verifyToken(['patient']), (req, res) => {
  removeJsonbList(req, res, 'family_history', req.params.index);
});

export default router;
