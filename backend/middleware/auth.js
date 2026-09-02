import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rxvault_jwt_secret_2024';

/**
 * Middleware to verify JWT and check user roles
 * @param {string[]} allowedRoles
 */
export function verifyToken(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized', message: 'No authorization token provided' });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired' });
      }

      // Fetch user from database
      const userRes = await query(
        `SELECT id, name, email, role, org_type, org_verified, share_code, public_key, private_key_enc, pin_hash
         FROM users WHERE id = $1`,
        [decoded.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'user_not_found', message: 'User account does not exist' });
      }

      const user = userRes.rows[0];

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'forbidden',
          message: `Access forbidden for role ${user.role}. Required: ${allowedRoles.join(' or ')}`
        });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error('Auth middleware error:', err);
      res.status(500).json({ error: 'internal_auth_error', message: err.message });
    }
  };
}

/**
 * Validates a user's 4-digit PIN against their pin_hash
 */
export async function verifyUserPin(user, pin) {
  if (!user || !user.pin_hash || !pin) {
    return false;
  }
  return bcrypt.compare(String(pin), user.pin_hash);
}
