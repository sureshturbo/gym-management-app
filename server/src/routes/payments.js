import { Router } from 'express';
import { query, transaction } from '../db.js';
import { config } from '../config.js';
import { memberOnly, ownerOnly } from '../middleware/auth.js';
import { HttpError, notFound } from '../utils/http.js';
import { addDays, monthStart } from '../utils/dates.js';
import { parse, z, zDate, zId, zText } from '../utils/validate.js';
import { MS_PAID, MS_STATUS } from '../sql.js';

export const paymentsRouter = Router();

const round2 = (n) => Math.round(n * 100) / 100;

/** Memberships with an unpaid balance. Overdue = still unpaid N days after the start date. */
export async function listDues(gymId, today, memberId) {
  const rows = await query(
    `SELECT ms.id AS membership_id, ms.member_id, m.full_name, m.phone, m.gender, m.photo_key, ms.plan_name, ms.start_date,
            ms.expiry_date, ms.amount, ${MS_PAID('ms')} AS paid, ${MS_STATUS('ms')} AS status
       FROM memberships ms JOIN members m ON m.id = ms.member_id
      WHERE ms.gym_id = :gymId AND ms.is_cancelled = 0
        ${memberId ? 'AND ms.member_id = :memberId' : ''}
     HAVING amount - paid > 0
      ORDER BY ms.start_date`,
    { gymId, today, memberId },
  );
  const overdueBefore = addDays(today, -config.overdueGraceDays);
  return rows.map((r) => ({
    ...r,
    balance: round2(r.amount - r.paid),
    overdue: r.start_date < overdueBefore,
  }));
}

paymentsRouter.get('/', ownerOnly, async (req, res) => {
  const q = parse(
    z.object({
      from: zDate.optional(),
      to: zDate.optional(),
      method: z.enum(['cash', 'upi']).optional(),
    }),
    req.query,
  );
  const from = q.from ?? monthStart(req.today);
  const to = q.to ?? req.today;
  const payments = await query(
    `SELECT p.id, p.member_id, m.full_name, ms.plan_name, p.amount, p.method, p.paid_on, p.reference, p.note
       FROM payments p
       JOIN members m ON m.id = p.member_id
       JOIN memberships ms ON ms.id = p.membership_id
      WHERE p.gym_id = :gymId AND p.paid_on BETWEEN :from AND :to
        ${q.method ? 'AND p.method = :method' : ''}
      ORDER BY p.paid_on DESC, p.id DESC`,
    { gymId: req.user.gymId, from, to, method: q.method },
  );
  const total = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  res.json({ from, to, total, payments });
});

paymentsRouter.get('/dues', ownerOnly, async (req, res) => {
  const dues = await listDues(req.user.gymId, req.today);
  res.json({
    totalPending: round2(dues.reduce((s, d) => s + d.balance, 0)),
    totalOverdue: round2(dues.filter((d) => d.overdue).reduce((s, d) => s + d.balance, 0)),
    dues,
  });
});

/** Record a cash/UPI payment against a membership. Partial payments allowed; overpaying is not. */
paymentsRouter.post('/', ownerOnly, async (req, res) => {
  const body = parse(
    z.object({
      membershipId: zId,
      amount: z.coerce.number().positive('Must be more than 0').multipleOf(0.01),
      method: z.enum(['cash', 'upi']),
      paidOn: zDate.optional(),
      reference: zText(100),
      note: zText(255),
    }),
    req.body,
  );
  const paidOn = body.paidOn ?? req.today;
  if (paidOn > req.today) throw new HttpError(400, 'Payment date cannot be in the future', { paidOn: ['In the future'] });

  const id = await transaction(async (conn) => {
    const [ms] = await query(
      `SELECT id, member_id, amount, is_cancelled FROM memberships WHERE id = :id AND gym_id = :gymId FOR UPDATE`,
      { id: body.membershipId, gymId: req.user.gymId },
      conn,
    );
    if (!ms) throw notFound('Membership');
    if (ms.is_cancelled) throw new HttpError(400, 'Cannot record a payment for a cancelled membership');
    const [{ paid }] = await query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE membership_id = :id',
      { id: ms.id },
      conn,
    );
    const balance = round2(ms.amount - paid);
    if (body.amount > balance) {
      throw new HttpError(400, `Amount is more than the balance due (₹${balance})`, { amount: [`Max ₹${balance}`] });
    }
    const result = await query(
      `INSERT INTO payments (gym_id, member_id, membership_id, amount, method, paid_on, reference, note, recorded_by)
       VALUES (:gymId, :memberId, :membershipId, :amount, :method, :paidOn, :reference, :note, :userId)`,
      {
        gymId: req.user.gymId,
        memberId: ms.member_id,
        membershipId: ms.id,
        amount: body.amount,
        method: body.method,
        paidOn,
        reference: body.reference ?? null,
        note: body.note ?? null,
        userId: req.user.id,
      },
      conn,
    );
    return result.insertId;
  });
  res.status(201).json({ id });
});

/** Member's own payment history and outstanding balances. */
paymentsRouter.get('/me', memberOnly, async (req, res) => {
  const [payments, dues] = await Promise.all([
    query(
      `SELECT p.id, ms.plan_name, p.amount, p.method, p.paid_on, p.reference
         FROM payments p JOIN memberships ms ON ms.id = p.membership_id
        WHERE p.member_id = :memberId ORDER BY p.paid_on DESC, p.id DESC`,
      { memberId: req.user.memberId },
    ),
    listDues(req.user.gymId, req.today, req.user.memberId),
  ]);
  res.json({ payments, dues });
});
