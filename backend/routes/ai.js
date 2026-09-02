import { Router } from 'express';
import { analyzeDrugSafety } from '../lib/ai.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/ai/drug-check
 * Body: { drugs: string[], allergies: string[] }
 */
router.post('/drug-check', verifyToken(), async (req, res) => {
  try {
    const { drugs = [], allergies = [] } = req.body;

    if (!Array.isArray(drugs) || !Array.isArray(allergies)) {
      return res.status(400).json({ error: 'drugs and allergies must be arrays of strings' });
    }

    const result = await analyzeDrugSafety(drugs, allergies);
    res.json(result);
  } catch (err) {
    console.error('AI drug check route error:', err);
    res.status(500).json({ error: 'Drug safety analysis failed', message: err.message });
  }
});

export default router;
