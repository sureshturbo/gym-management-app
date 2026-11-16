import { Router } from 'express';
import { query } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { notFound } from '../utils/http.js';
import { parse, z, zDate, zId, zText } from '../utils/validate.js';
import { getMemberOr404 } from './members.js';

export const followupsRouter = Router();
followupsRouter.use(ownerOnly);

const REASONS = ['expiring', 'payment_pending', 'absent', 'renewal', 'general'];

followupsRouter.get('/', async (req, res) => {
  const { status, memberId } = parse(
    z.object({ status: z.enum(['pending', 'completed']).optional(), memberId: zId.optional() }),
    req.query,
  );
  const followups = await query(
    `SELECT f.id, f.member_id, m.full_name, m.phone, f.reason, f.remarks, f.followup_date, f.status, f.completed_at
       FROM followups f JOIN members m ON m.id = f.member_id
      WHERE f.gym_id = :gymId
        ${status ? 'AND f.status = :status' : ''}
        ${memberId ? 'AND f.member_id = :memberId' : ''}
      ORDER BY f.status = 'completed', f.followup_date ${status === 'completed' ? 'DESC' : 'ASC'}, f.id DESC
      LIMIT 500`,
    { gymId: req.user.gymId, status, memberId },
  );
  res.json({ followups });
});

followupsRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      memberId: zId,
      reason: z.enum(REASONS),
      remarks: zText(500),
      followupDate: zDate.optional(),
    }),
    req.body,
  );
  await getMemberOr404(req.user.gymId, body.memberId);
  const result = await query(
    `INSERT INTO followups (gym_id, member_id, reason, remarks, followup_date, created_by)
     VALUES (:gymId, :memberId, :reason, :remarks, :date, :userId)`,
    {
      gymId: req.user.gymId,
      memberId: body.memberId,
      reason: body.reason,
      remarks: body.remarks ?? null,
      date: body.followupDate ?? req.today,
      userId: req.user.id,
    },
  );
  res.status(201).json({ id: result.insertId });
});

followupsRouter.patch('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  const body = parse(
    z.object({
      status: z.enum(['pending', 'completed']).optional(),
      remarks: zText(500),
      followupDate: zDate.optional(),
    }),
    req.body,
  );
  const [current] = await query('SELECT id, status, remarks, followup_date FROM followups WHERE id = :id AND gym_id = :gymId', {
    id,
    gymId: req.user.gymId,
  });
  if (!current) throw notFound('Follow-up');

  const status = body.status ?? current.status;
  await query(
    `UPDATE followups
        SET status = :status, remarks = :remarks, followup_date = :date,
            completed_at = CASE WHEN :status = 'completed' THEN COALESCE(completed_at, UTC_TIMESTAMP()) ELSE NULL END
      WHERE id = :id`,
    {
      id,
      status,
      remarks: body.remarks === undefined ? current.remarks : body.remarks,
      date: body.followupDate ?? current.followup_date,
    },
  );
  res.status(204).end();
});
