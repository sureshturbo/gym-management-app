import { Router } from 'express';
import { query } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { HttpError, notFound } from '../utils/http.js';
import { parse, z, zId } from '../utils/validate.js';
import { MEMBER_IS_ACTIVE } from '../sql.js';

export const batchesRouter = Router();
batchesRouter.use(ownerOnly);

/** 'HH:MM' (24-hour) -> 'HH:MM:00' */
export const zTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, 'Use HH:MM')
  .transform((t) => `${t.slice(0, 5)}:00`);

const batchSchema = z
  .object({
    name: z.string().trim().min(2, 'At least 2 characters').max(60),
    start_time: zTime,
    end_time: zTime,
    gender: z.enum(['any', 'male', 'female']).default('any'),
    capacity: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().min(1).max(5000).nullable()),
    is_active: z.coerce.boolean().optional().default(true),
  })
  .refine((b) => b.end_time > b.start_time, { message: 'End time must be after start time', path: ['end_time'] });

/** Batches with member counts and today's check-ins (members of the batch who checked in today). */
export async function listBatches(gymId, today, { includeInactive = true } = {}) {
  const rows = await query(
    `SELECT b.id, b.name, TIME_FORMAT(b.start_time, '%H:%i') AS start_time, TIME_FORMAT(b.end_time, '%H:%i') AS end_time,
            b.gender, b.capacity, b.is_active,
            (SELECT COUNT(*) FROM members m WHERE m.batch_id = b.id AND m.is_active = 1) AS member_count,
            (SELECT COUNT(*) FROM members m WHERE m.batch_id = b.id AND m.is_active = 1 AND ${MEMBER_IS_ACTIVE('m')}) AS active_count,
            (SELECT COUNT(*) FROM attendance a JOIN members m ON m.id = a.member_id
              WHERE m.batch_id = b.id AND a.check_in_date = :today) AS today_count
       FROM batches b
      WHERE b.gym_id = :gymId ${includeInactive ? '' : 'AND b.is_active = 1'}
      ORDER BY b.is_active DESC, b.start_time, b.name`,
    { gymId, today },
  );
  return rows.map((b) => ({ ...b, is_active: Boolean(b.is_active) }));
}

batchesRouter.get('/', async (req, res) => {
  res.json({ batches: await listBatches(req.user.gymId, req.today, { includeInactive: req.query.includeInactive !== 'false' }) });
});

async function getBatchOr404(gymId, id) {
  const [b] = await query('SELECT id, gender, capacity, is_active FROM batches WHERE id = :id AND gym_id = :gymId', { id, gymId });
  if (!b) throw notFound('Batch');
  return b;
}

batchesRouter.post('/', async (req, res) => {
  const b = parse(batchSchema, req.body);
  const r = await query(
    `INSERT INTO batches (gym_id, name, start_time, end_time, gender, capacity, is_active)
     VALUES (:gymId, :name, :start_time, :end_time, :gender, :capacity, :is_active)`,
    { ...b, gymId: req.user.gymId },
  );
  res.status(201).json({ id: r.insertId });
});

batchesRouter.put('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  await getBatchOr404(req.user.gymId, id);
  const b = parse(batchSchema, req.body);
  await query(
    `UPDATE batches SET name = :name, start_time = :start_time, end_time = :end_time, gender = :gender,
            capacity = :capacity, is_active = :is_active
      WHERE id = :id`,
    { ...b, id },
  );
  res.json({ ok: true });
});

/** Deleting a batch only unassigns its members (FK ON DELETE SET NULL). */
batchesRouter.delete('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  await getBatchOr404(req.user.gymId, id);
  await query('DELETE FROM batches WHERE id = :id', { id });
  res.status(204).end();
});

/**
 * Check that a member can be put in this batch: same gym, offered, matching gender, not full.
 * `memberId` is excluded from the head count when the member is already in it.
 */
export async function assertBatchAssignable(gymId, batchId, gender, memberId = null, conn) {
  const [b] = await query(
    `SELECT b.id, b.name, b.gender, b.capacity, b.is_active,
            (SELECT COUNT(*) FROM members m WHERE m.batch_id = b.id AND m.is_active = 1 AND m.id <> :memberId) AS taken
       FROM batches b WHERE b.id = :batchId AND b.gym_id = :gymId`,
    { gymId, batchId, memberId: memberId ?? 0 },
    conn,
  );
  const fail = (msg) => new HttpError(400, msg, { batch_id: [msg] });
  if (!b) throw fail('Batch not found');
  if (!b.is_active) throw fail(`${b.name} is not offered any more`);
  if (b.gender !== 'any' && gender !== b.gender) {
    throw fail(`${b.name} is for ${b.gender === 'female' ? 'women' : 'men'} only`);
  }
  if (b.capacity != null && b.taken >= b.capacity) throw fail(`${b.name} is full (${b.capacity} members)`);
}
