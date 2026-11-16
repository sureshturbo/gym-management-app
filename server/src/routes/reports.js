import { Router } from 'express';
import { query } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { HttpError } from '../utils/http.js';
import { addDays, daysBetween, monthStart } from '../utils/dates.js';
import { parse, z, zDate } from '../utils/validate.js';

export const reportsRouter = Router();
reportsRouter.use(ownerOnly);

function range(req) {
  const q = parse(z.object({ from: zDate.optional(), to: zDate.optional() }), req.query);
  const from = q.from ?? monthStart(req.today);
  const to = q.to ?? req.today;
  if (from > to) throw new HttpError(400, '"From" must be before "To"');
  if (daysBetween(from, to) > 366) throw new HttpError(400, 'Choose a range of at most one year');
  return { from, to };
}

/** Fill missing days with zero so charts/tables have every date in the range. */
function everyDay(from, to, rows, empty) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(byDate.get(d) ?? { date: d, ...empty });
  return out;
}

reportsRouter.get('/attendance', async (req, res) => {
  const { from, to } = range(req);
  const rows = await query(
    `SELECT check_in_date AS date, COUNT(*) AS count
       FROM attendance WHERE gym_id = :gymId AND check_in_date BETWEEN :from AND :to
      GROUP BY check_in_date`,
    { gymId: req.user.gymId, from, to },
  );
  const days = everyDay(from, to, rows, { count: 0 });
  const total = days.reduce((s, d) => s + d.count, 0);
  res.json({ from, to, total, averagePerDay: Math.round((total / days.length) * 10) / 10, days });
});

reportsRouter.get('/payments', async (req, res) => {
  const { from, to } = range(req);
  const rows = await query(
    `SELECT paid_on AS date,
            COALESCE(SUM(CASE WHEN method = 'cash' THEN amount END), 0) AS cash,
            COALESCE(SUM(CASE WHEN method = 'upi' THEN amount END), 0) AS upi,
            SUM(amount) AS total
       FROM payments WHERE gym_id = :gymId AND paid_on BETWEEN :from AND :to
      GROUP BY paid_on`,
    { gymId: req.user.gymId, from, to },
  );
  const days = everyDay(from, to, rows, { cash: 0, upi: 0, total: 0 });
  const sum = (k) => Math.round(days.reduce((s, d) => s + Number(d[k]), 0) * 100) / 100;
  res.json({ from, to, totals: { cash: sum('cash'), upi: sum('upi'), total: sum('total') }, days });
});
