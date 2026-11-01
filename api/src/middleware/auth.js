import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { User } from '../models/User.js';

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
    issuer: 'arangam',
  });
}

/** Verifies the bearer token and loads the user (so a suspended account is cut off immediately). */
export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { issuer: 'arangam' });
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized();
  if (user.status !== 'active') throw forbidden('This account is suspended. Contact support.');
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
