import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../utils/http.js';
import { todayIn } from '../utils/dates.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, gymId: user.gym_id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verifies the bearer token and reloads the account so deactivated users are locked out immediately.
 * Sets req.user = { id, role, gymId, memberId, timeZone } and req.today (gym-local YYYY-MM-DD).
 */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Please log in');

  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired, please log in again');
  }

  const [row] = await query(
    `SELECT u.id, u.role, u.gym_id, u.is_active, g.timezone, m.id AS member_id
       FROM users u
       JOIN gyms g ON g.id = u.gym_id
       LEFT JOIN members m ON m.user_id = u.id
      WHERE u.id = :id`,
    { id: Number(payload.sub) },
  );
  if (!row || !row.is_active) throw new HttpError(401, 'This account is disabled');
  if (row.role === 'member' && !row.member_id) throw new HttpError(401, 'Member profile not found');

  req.user = { id: row.id, role: row.role, gymId: row.gym_id, memberId: row.member_id, timeZone: row.timezone };
  req.today = todayIn(row.timezone);
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) throw new HttpError(403, 'You do not have access to this');
  next();
};

export const ownerOnly = [authenticate, requireRole('owner')];
export const memberOnly = [authenticate, requireRole('member')];
