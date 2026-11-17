import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query, transaction } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { HttpError } from '../utils/http.js';
import { parse, z, zEmail, zPassword, zPhone } from '../utils/validate.js';
import { deletePhoto, savePhoto } from './photos.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

async function loadProfile(userId) {
  const [u] = await query(
    `SELECT u.id, u.role, u.name, u.email, u.phone, u.gym_id, g.name AS gym_name, m.id AS member_id,
            CASE WHEN m.id IS NULL THEN u.photo_key ELSE m.photo_key END AS photo_key
       FROM users u JOIN gyms g ON g.id = u.gym_id
       LEFT JOIN members m ON m.user_id = u.id
      WHERE u.id = :id`,
    { id: userId },
  );
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
    gymId: u.gym_id,
    gymName: u.gym_name,
    memberId: u.member_id,
    photoKey: u.photo_key,
  };
}

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: zEmail, password: z.string().min(1, 'Required') }), req.body);
  const [user] = await query(
    'SELECT id, role, gym_id, password_hash, is_active FROM users WHERE email = :email',
    { email },
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.is_active) throw new HttpError(403, 'This account is disabled. Please contact your gym.');
  res.json({ token: signToken(user), user: await loadProfile(user.id) });
});

/** Member self-registration: only works for an email the gym owner has already added as a member. */
authRouter.post('/register', authLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: zEmail, password: zPassword }), req.body);

  const userId = await transaction(async (conn) => {
    const [member] = await query(
      'SELECT id, gym_id, user_id, full_name, phone, is_active FROM members WHERE email = :email FOR UPDATE',
      { email },
      conn,
    );
    if (!member) {
      throw new HttpError(404, 'No membership found for this email. Ask your gym to add you first.');
    }
    if (member.user_id) throw new HttpError(409, 'An account already exists for this email. Please log in.');
    if (!member.is_active) throw new HttpError(403, 'Your membership is disabled. Please contact your gym.');

    const [existing] = await query('SELECT id FROM users WHERE email = :email', { email }, conn);
    if (existing) throw new HttpError(409, 'An account already exists for this email. Please log in.');

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (gym_id, role, name, email, phone, password_hash)
       VALUES (:gymId, 'member', :name, :email, :phone, :hash)`,
      { gymId: member.gym_id, name: member.full_name, email, phone: member.phone, hash },
      conn,
    );
    await query('UPDATE members SET user_id = :userId WHERE id = :id', { userId: result.insertId, id: member.id }, conn);
    return result.insertId;
  });

  const profile = await loadProfile(userId);
  res.status(201).json({ token: signToken({ id: userId, role: 'member', gym_id: profile.gymId }), user: profile });
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json({ user: await loadProfile(req.user.id) });
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const body = parse(
    z.object({ name: z.string().trim().min(2).max(120), phone: zPhone }),
    req.body,
  );
  await transaction(async (conn) => {
    await query('UPDATE users SET name = :name, phone = :phone WHERE id = :id', { ...body, id: req.user.id }, conn);
    if (req.user.memberId) {
      await query('UPDATE members SET full_name = :name, phone = :phone WHERE id = :id', { ...body, id: req.user.memberId }, conn);
    }
  });
  res.json({ user: await loadProfile(req.user.id) });
});

authRouter.post('/change-password', authenticate, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = parse(
    z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: zPassword }),
    req.body,
  );
  const [user] = await query('SELECT password_hash FROM users WHERE id = :id', { id: req.user.id });
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect', { currentPassword: ['Incorrect password'] });
  }
  await query('UPDATE users SET password_hash = :hash WHERE id = :id', {
    hash: await bcrypt.hash(newPassword, 10),
    id: req.user.id,
  });
  res.status(204).end();
});

/**
 * Own profile photo. A member's photo lives on their member record (the one the owner sees);
 * an owner's photo lives on their user account.
 */
async function setOwnPhoto(req, newKey, conn) {
  const table = req.user.memberId ? 'members' : 'users';
  const id = req.user.memberId ?? req.user.id;
  const [row] = await query(`SELECT photo_key FROM ${table} WHERE id = :id FOR UPDATE`, { id }, conn);
  await query(`UPDATE ${table} SET photo_key = :key WHERE id = :id`, { key: newKey, id }, conn);
  await deletePhoto(row?.photo_key, conn);
}

authRouter.put('/me/photo', authenticate, async (req, res) => {
  await transaction(async (conn) => setOwnPhoto(req, await savePhoto(req.user.gymId, req.body, conn), conn));
  res.json({ user: await loadProfile(req.user.id) });
});

authRouter.delete('/me/photo', authenticate, async (req, res) => {
  await transaction((conn) => setOwnPhoto(req, null, conn));
  res.json({ user: await loadProfile(req.user.id) });
});
