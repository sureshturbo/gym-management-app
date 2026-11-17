import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { HttpError, notFound } from '../utils/http.js';
import { parse, z, zDate, zEmail, zId, zPassword, zPhone, zText } from '../utils/validate.js';
import { assertBatchAssignable } from './batches.js';
import { deletePhoto, savePhoto } from './photos.js';
import {
  MEMBER_CURRENT_EXPIRY,
  MEMBER_HAS_UPCOMING,
  MEMBER_LAST_VISIT,
  MS_PAID,
  MS_STATUS,
  memberStatus,
} from '../sql.js';

export const membersRouter = Router();
membersRouter.use(ownerOnly);

const memberSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: zPhone,
  email: zEmail,
  gender: z.enum(['male', 'female', 'other'], { message: 'Select gender' }),
  batch_id: z.preprocess((v) => (v === '' || v == null ? null : v), zId.nullable()),
  date_of_birth: zDate.nullable().optional().or(z.literal('').transform(() => null)),
  joined_on: zDate.optional(),
  notes: zText(500),
  is_active: z.coerce.boolean().optional(), // the edit form may send 0/1 from the database row
});

export async function getMemberOr404(gymId, id, conn) {
  const [m] = await query(
    `SELECT m.id, m.gym_id, m.user_id, m.batch_id, b.name AS batch_name,
            TIME_FORMAT(b.start_time, '%H:%i') AS batch_start, TIME_FORMAT(b.end_time, '%H:%i') AS batch_end,
            m.full_name, m.phone, m.email, m.gender, m.date_of_birth, m.joined_on, m.notes, m.photo_key,
            m.is_active, m.created_at
       FROM members m LEFT JOIN batches b ON b.id = m.batch_id
      WHERE m.id = :id AND m.gym_id = :gymId`,
    { id, gymId },
    conn,
  );
  if (!m) throw notFound('Member');
  return m;
}

membersRouter.get('/', async (req, res) => {
  const { search, status, gender, batch } = parse(
    z.object({
      search: z.string().trim().max(100).optional(),
      status: z.enum(['active', 'pending', 'expired', 'no_plan', 'inactive', 'invited']).optional(),
      gender: z.enum(['male', 'female', 'other', 'unset']).optional(),
      batch: z.union([zId, z.literal('none')]).optional(),
    }),
    req.query,
  );
  const rows = await query(
    `SELECT m.id, m.full_name, m.phone, m.email, m.gender, m.photo_key, m.batch_id, b.name AS batch_name,
            m.joined_on, m.is_active, m.user_id IS NOT NULL AS registered,
            ${MEMBER_CURRENT_EXPIRY('m')} AS current_expiry,
            ${MEMBER_HAS_UPCOMING('m')} AS has_upcoming,
            ${MEMBER_LAST_VISIT('m')} AS last_visit
       FROM members m LEFT JOIN batches b ON b.id = m.batch_id
      WHERE m.gym_id = :gymId
        ${search ? 'AND (m.full_name LIKE :like OR m.phone LIKE :like OR m.email LIKE :like)' : ''}
        ${gender === 'unset' ? 'AND m.gender IS NULL' : gender ? 'AND m.gender = :gender' : ''}
        ${batch === 'none' ? 'AND m.batch_id IS NULL' : batch ? 'AND m.batch_id = :batch' : ''}
      ORDER BY m.full_name`,
    { gymId: req.user.gymId, today: req.today, like: `%${search ?? ''}%`, gender: gender ?? null, batch: batch ?? null },
  );
  let members = rows.map((r) => ({
    ...r,
    registered: Boolean(r.registered),
    has_upcoming: Boolean(r.has_upcoming),
    status: memberStatus(r, req.today),
  }));
  if (status === 'invited') members = members.filter((m) => !m.registered);
  else if (status) members = members.filter((m) => m.status === status);
  res.json({ members });
});

membersRouter.post('/', async (req, res) => {
  const m = parse(memberSchema, req.body);
  const [taken] = await query(
    'SELECT (SELECT COUNT(*) FROM members WHERE email = :email) + (SELECT COUNT(*) FROM users WHERE email = :email) AS n',
    { email: m.email },
  );
  if (taken.n) throw new HttpError(409, 'This email is already in use', { email: ['Email already in use'] });
  if (m.batch_id) await assertBatchAssignable(req.user.gymId, m.batch_id, m.gender);

  const result = await query(
    `INSERT INTO members (gym_id, batch_id, full_name, phone, email, gender, date_of_birth, joined_on, notes)
     VALUES (:gymId, :batch_id, :full_name, :phone, :email, :gender, :date_of_birth, :joined_on, :notes)`,
    {
      gymId: req.user.gymId,
      batch_id: m.batch_id ?? null,
      full_name: m.full_name,
      phone: m.phone,
      email: m.email,
      gender: m.gender ?? null,
      date_of_birth: m.date_of_birth ?? null,
      joined_on: m.joined_on ?? req.today,
      notes: m.notes ?? null,
    },
  );
  res.status(201).json({ id: result.insertId });
});

/** Full member profile: details, memberships with balances, payments, recent attendance, follow-ups. */
membersRouter.get('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  const member = await getMemberOr404(req.user.gymId, id);
  const params = { id, gymId: req.user.gymId, today: req.today };

  const [memberships, payments, attendance, followups, [counts]] = await Promise.all([
    query(
      `SELECT ms.id, ms.plan_id, ms.plan_name, ms.start_date, ms.expiry_date, ms.amount, ms.is_cancelled,
              ${MS_PAID('ms')} AS paid, ${MS_STATUS('ms')} AS status
         FROM memberships ms WHERE ms.member_id = :id AND ms.gym_id = :gymId
        ORDER BY ms.start_date DESC, ms.id DESC`,
      params,
    ),
    query(
      `SELECT p.id, p.membership_id, ms.plan_name, p.amount, p.method, p.paid_on, p.reference, p.note
         FROM payments p JOIN memberships ms ON ms.id = p.membership_id
        WHERE p.member_id = :id AND p.gym_id = :gymId
        ORDER BY p.paid_on DESC, p.id DESC`,
      params,
    ),
    query(
      `SELECT id, check_in_date, check_in_at, distance_m FROM attendance
        WHERE member_id = :id AND gym_id = :gymId ORDER BY check_in_date DESC LIMIT 60`,
      params,
    ),
    query(
      `SELECT id, reason, remarks, followup_date, status, completed_at FROM followups
        WHERE member_id = :id AND gym_id = :gymId ORDER BY status = 'completed', followup_date DESC`,
      params,
    ),
    query(
      `SELECT COUNT(a.id) AS total_visits, ${MEMBER_CURRENT_EXPIRY('m')} AS current_expiry,
              ${MEMBER_HAS_UPCOMING('m')} AS has_upcoming
         FROM members m LEFT JOIN attendance a ON a.member_id = m.id
        WHERE m.id = :id GROUP BY m.id`,
      params,
    ),
  ]);

  res.json({
    member: {
      ...member,
      registered: member.user_id != null,
      status: memberStatus({ ...counts, is_active: member.is_active }, req.today),
      total_visits: counts.total_visits,
    },
    memberships: memberships.map((ms) => ({ ...ms, balance: Math.round((ms.amount - ms.paid) * 100) / 100 })),
    payments,
    attendance,
    followups,
  });
});

membersRouter.put('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  const m = parse(memberSchema, req.body);

  await transaction(async (conn) => {
    const current = await getMemberOr404(req.user.gymId, id, conn);
    if (m.email !== current.email) {
      if (current.user_id) {
        throw new HttpError(400, 'Email cannot be changed after the member has registered', {
          email: ['Locked after registration'],
        });
      }
      const [taken] = await query(
        `SELECT (SELECT COUNT(*) FROM members WHERE email = :email AND id <> :id)
              + (SELECT COUNT(*) FROM users WHERE email = :email) AS n`,
        { email: m.email, id },
        conn,
      );
      if (taken.n) throw new HttpError(409, 'This email is already in use', { email: ['Email already in use'] });
    }
    const isActive = m.is_active ?? Boolean(current.is_active);
    // Re-check the batch only when it or the gender changes, so a later capacity cut doesn't block other edits.
    if (m.batch_id && (m.batch_id !== current.batch_id || m.gender !== current.gender)) {
      await assertBatchAssignable(req.user.gymId, m.batch_id, m.gender, id, conn);
    }
    await query(
      `UPDATE members SET batch_id = :batch_id, full_name = :full_name, phone = :phone, email = :email, gender = :gender,
              date_of_birth = :date_of_birth, joined_on = :joined_on, notes = :notes, is_active = :is_active
        WHERE id = :id`,
      {
        id,
        batch_id: m.batch_id ?? null,
        full_name: m.full_name,
        phone: m.phone,
        email: m.email,
        gender: m.gender ?? null,
        date_of_birth: m.date_of_birth ?? null,
        joined_on: m.joined_on ?? current.joined_on,
        notes: m.notes ?? null,
        is_active: isActive,
      },
      conn,
    );
    if (current.user_id) {
      // Keep the login account in sync; deactivating a member also blocks their login.
      await query(
        'UPDATE users SET name = :name, phone = :phone, is_active = :is_active WHERE id = :userId',
        { name: m.full_name, phone: m.phone, is_active: isActive, userId: current.user_id },
        conn,
      );
    }
  });
  res.status(204).end();
});

/** Owner sets a temporary password for a registered member (there is no email-based reset in v1). */
membersRouter.post('/:id/reset-password', async (req, res) => {
  const id = parse(zId, req.params.id);
  const { newPassword } = parse(z.object({ newPassword: zPassword }), req.body);
  const member = await getMemberOr404(req.user.gymId, id);
  if (!member.user_id) throw new HttpError(400, 'This member has not registered an account yet');
  await query('UPDATE users SET password_hash = :hash WHERE id = :id', {
    hash: await bcrypt.hash(newPassword, 10),
    id: member.user_id,
  });
  res.status(204).end();
});

/** Owner sets or replaces a member's photo. Body: { image: 'data:image/jpeg;base64,...' } */
membersRouter.put('/:id/photo', async (req, res) => {
  const id = parse(zId, req.params.id);
  const key = await transaction(async (conn) => {
    const member = await getMemberOr404(req.user.gymId, id, conn);
    const newKey = await savePhoto(req.user.gymId, req.body, conn);
    await query('UPDATE members SET photo_key = :key WHERE id = :id', { key: newKey, id }, conn);
    await deletePhoto(member.photo_key, conn);
    return newKey;
  });
  res.json({ photo_key: key });
});

membersRouter.delete('/:id/photo', async (req, res) => {
  const id = parse(zId, req.params.id);
  await transaction(async (conn) => {
    const member = await getMemberOr404(req.user.gymId, id, conn);
    await query('UPDATE members SET photo_key = NULL WHERE id = :id', { id }, conn);
    await deletePhoto(member.photo_key, conn);
  });
  res.status(204).end();
});
