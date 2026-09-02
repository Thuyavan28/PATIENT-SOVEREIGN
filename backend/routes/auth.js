import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';
import { generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey, generateShareCode } from '../lib/crypto.js';
import { logAuditEvent } from '../lib/auditLog.js';
import { verifyToken, verifyUserPin } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'rxvault_jwt_secret_2024';

function generateJwt(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      org_type: user.org_type || null,
      share_code: user.share_code || null,
      org_verified: user.org_verified || false
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 * Body: { name, email, password, role, org_type?, pin }
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, org_type, pin } = req.body;

    if (!name || !email || !password || !role || !pin) {
      return res.status(400).json({ error: 'All fields (name, email, password, role, pin) are required' });
    }

    if (!['patient', 'org', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be patient, org, or admin' });
    }

    if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be exactly 4 numeric digits' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(String(pin), 10);

    let shareCode = null;
    let publicKey = null;
    let privateKeyEnc = null;

    if (role === 'patient') {
      // Generate unique 6-char share code
      let unique = false;
      while (!unique) {
        shareCode = generateShareCode();
        const scCheck = await query('SELECT id FROM users WHERE share_code = $1', [shareCode]);
        if (scCheck.rows.length === 0) unique = true;
      }

      // Generate RSA keypair and encrypt private key with PIN
      const keys = generateRSAKeyPair();
      publicKey = keys.publicKey;
      privateKeyEnc = encryptPrivateKey(keys.privateKey, String(pin));
    }

    const userRes = await query(
      `INSERT INTO users 
       (name, email, password_hash, role, org_type, org_verified, share_code, public_key, private_key_enc, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email, role, org_type, org_verified, share_code, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        role,
        role === 'org' ? (org_type || 'hospital') : null,
        role === 'org' ? false : true, // org starts unverified
        shareCode,
        publicKey,
        privateKeyEnc,
        pinHash
      ]
    );

    const user = userRes.rows[0];

    // If patient: create health_vault row
    if (role === 'patient') {
      await query(
        `INSERT INTO health_vault (patient_id) VALUES ($1)`,
        [user.id]
      );
    }

    // Audit log
    await logAuditEvent({
      actorId: user.id,
      actorRole: role,
      action: role === 'patient' ? 'patient_registered' : 'org_registered',
      targetId: user.id,
      targetType: 'user',
      metadata: {
        name: user.name,
        role: user.role,
        share_code: user.share_code,
        org_type: user.org_type
      }
    });

    const token = generateJwt(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        org_type: user.org_type,
        org_verified: user.org_verified,
        share_code: user.share_code
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed', message: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userRes = await query(
      `SELECT id, name, email, password_hash, role, org_type, org_verified, share_code, public_key, pin_hash
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateJwt(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        org_type: user.org_type,
        org_verified: user.org_verified,
        share_code: user.share_code
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', verifyToken(), async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      org_type: req.user.org_type,
      org_verified: req.user.org_verified,
      share_code: req.user.share_code
    }
  });
});

/**
 * POST /api/auth/change-pin
 * Body: { currentPin, newPin }
 */
router.post('/change-pin', verifyToken(), async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current PIN and new PIN are required' });
    }

    if (!/^\d{4}$/.test(String(newPin))) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 numeric digits' });
    }

    const validPin = await verifyUserPin(req.user, currentPin);
    if (!validPin) {
      return res.status(403).json({ error: 'invalid_pin', message: 'Current PIN is incorrect' });
    }

    let newEncPrivateKey = req.user.private_key_enc;

    // If patient: decrypt with current PIN and re-encrypt with new PIN
    if (req.user.role === 'patient' && req.user.private_key_enc) {
      try {
        const rawPrivateKey = decryptPrivateKey(req.user.private_key_enc, String(currentPin));
        newEncPrivateKey = encryptPrivateKey(rawPrivateKey, String(newPin));
      } catch (cryptoErr) {
        return res.status(500).json({ error: 'Failed to re-encrypt private key with new PIN' });
      }
    }

    const newPinHash = await bcrypt.hash(String(newPin), 10);

    await query(
      `UPDATE users SET pin_hash = $1, private_key_enc = $2 WHERE id = $3`,
      [newPinHash, newEncPrivateKey, req.user.id]
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'pin_changed',
      targetId: req.user.id,
      targetType: 'user'
    });

    res.json({ success: true, message: 'PIN changed and keys re-encrypted successfully' });
  } catch (err) {
    console.error('Change PIN error:', err);
    res.status(500).json({ error: 'Failed to change PIN', message: err.message });
  }
});

export default router;
