import { Router } from 'express';
import { query, transaction } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { HttpError, notFound } from '../utils/http.js';
import { computeExpiry } from '../utils/dates.js';
import { parse, z, zDate, zId, zMoney } from '../utils/validate.js';
import { getMemberOr404 } from './members.js';

export const membershipsRouter = Router();
membershipsRouter.use(ownerOnly);

/** Assign a plan to a member. Expiry is computed from the plan; overlapping periods are rejected. */
membershipsRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({ memberId: zId, planId: zId, startDate: zDate, amount: zMoney.optional() }),
    req.body,
  );

  const id = await transaction(async (conn) => {
    const member = await getMemberOr404(req.user.gymId, body.memberId, conn);
    if (!member.is_active) throw new HttpError(400, 'This member is inactive');

    const [plan] = await query(
      'SELECT id, name, duration_unit, duration_value, price, is_active FROM membership_plans WHERE id = :id AND gym_id = :gymId',
      { id: body.planId, gymId: req.user.gymId },
      conn,
    );
    if (!plan) throw notFound('Plan');
    if (!plan.is_active) throw new HttpError(400, 'This plan is no longer offered');

    const expiry = computeExpiry(body.startDate, plan.duration_unit, plan.duration_value);

    // Lock the member's memberships so two simultaneous requests can't both pass the overlap check.
    const [overlap] = await query(
      `SELECT id, start_date, expiry_date FROM memberships
        WHERE member_id = :memberId AND is_cancelled = 0
          AND start_date <= :expiry AND expiry_date >= :start
        LIMIT 1 FOR UPDATE`,
      { memberId: member.id, start: body.startDate, expiry },
      conn,
    );
    if (overlap) {
      throw new HttpError(
        409,
        `Overlaps an existing membership (${overlap.start_date} to ${overlap.expiry_date}). Start after ${overlap.expiry_date}.`,
        { startDate: ['Overlaps an existing membership'] },
      );
    }

    const result = await query(
      `INSERT INTO memberships (gym_id, member_id, plan_id, plan_name, start_date, expiry_date, amount)
       VALUES (:gymId, :memberId, :planId, :planName, :start, :expiry, :amount)`,
      {
        gymId: req.user.gymId,
        memberId: member.id,
        planId: plan.id,
        planName: plan.name,
        start: body.startDate,
        expiry,
        amount: body.amount ?? plan.price,
      },
      conn,
    );
    return result.insertId;
  });

  res.status(201).json({ id });
});

membershipsRouter.patch('/:id/cancel', async (req, res) => {
  const id = parse(zId, req.params.id);
  const [ms] = await query(
    `SELECT ms.id, ms.is_cancelled, (SELECT COUNT(*) FROM payments p WHERE p.membership_id = ms.id) AS payments
       FROM memberships ms WHERE ms.id = :id AND ms.gym_id = :gymId`,
    { id, gymId: req.user.gymId },
  );
  if (!ms) throw notFound('Membership');
  if (ms.is_cancelled) throw new HttpError(400, 'Already cancelled');
  await query('UPDATE memberships SET is_cancelled = 1, cancelled_at = UTC_TIMESTAMP() WHERE id = :id', { id });
  res.json({ cancelled: true, hadPayments: ms.payments > 0 });
});
