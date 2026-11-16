import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { memberOnly, ownerOnly } from '../middleware/auth.js';
import { addDays, addMonths, daysBetween, monthStart } from '../utils/dates.js';
import {
  MEMBER_CURRENT_EXPIRY,
  MEMBER_HAS_UPCOMING,
  MEMBER_IS_ACTIVE,
  MEMBER_LAST_VISIT,
  MS_PAID,
  MS_STATUS,
  memberStatus,
} from '../sql.js';
import { listDues } from './payments.js';

export const dashboardRouter = Router();

const round2 = (n) => Math.round(n * 100) / 100;

dashboardRouter.get('/owner', ownerOnly, async (req, res) => {
  const today = req.today;
  const p = {
    gymId: req.user.gymId,
    today,
    monthStart: monthStart(today),
    soon: addDays(today, config.expiringSoonDays),
    absentSince: addDays(today, -config.absentAlertDays),
    weekAgo: addDays(today, -7),
    yesterday: addDays(today, -1),
    // Same point last month, for "vs last month" comparisons
    lastMonthStart: monthStart(addMonths(today, -1)),
    lastMonthSameDay: addMonths(today, -1),
  };

  const [[counts], expiring, absent, followupsDue, dues] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM members m WHERE m.gym_id = :gymId AND m.is_active = 1) AS total_members,
         (SELECT COUNT(*) FROM members m WHERE m.gym_id = :gymId AND m.is_active = 1 AND ${MEMBER_IS_ACTIVE('m')}) AS active_members,
         (SELECT COUNT(*) FROM members m WHERE m.gym_id = :gymId AND m.is_active = 1 AND NOT ${MEMBER_IS_ACTIVE('m')}
            AND EXISTS (SELECT 1 FROM memberships x WHERE x.member_id = m.id AND x.is_cancelled = 0 AND x.expiry_date < :today)
            AND NOT EXISTS (SELECT 1 FROM memberships x WHERE x.member_id = m.id AND x.is_cancelled = 0 AND x.start_date > :today)
         ) AS expired_members,
         (SELECT COUNT(*) FROM members m WHERE m.gym_id = :gymId AND m.joined_on >= :weekAgo) AS new_members_week,
         (SELECT COUNT(*) FROM attendance a WHERE a.gym_id = :gymId AND a.check_in_date = :today) AS today_attendance,
         (SELECT COUNT(*) FROM attendance a WHERE a.gym_id = :gymId AND a.check_in_date = :yesterday) AS yesterday_attendance,
         (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
           WHERE p.gym_id = :gymId AND p.paid_on BETWEEN :monthStart AND :today) AS month_collection,
         (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
           WHERE p.gym_id = :gymId AND p.paid_on BETWEEN :lastMonthStart AND :lastMonthSameDay) AS last_month_collection,
         (SELECT COUNT(*) FROM followups f WHERE f.gym_id = :gymId AND f.status = 'pending') AS pending_followups`,
      p,
    ),
    // Expiring soon and not yet renewed
    query(
      `SELECT ms.member_id, m.full_name, m.phone, ms.plan_name, ms.expiry_date
         FROM memberships ms JOIN members m ON m.id = ms.member_id
        WHERE ms.gym_id = :gymId AND ms.is_cancelled = 0 AND m.is_active = 1
          AND ms.expiry_date BETWEEN :today AND :soon
          AND NOT EXISTS (SELECT 1 FROM memberships n WHERE n.member_id = ms.member_id
                           AND n.is_cancelled = 0 AND n.start_date > ms.expiry_date)
        ORDER BY ms.expiry_date LIMIT 50`,
      p,
    ),
    // Active members who haven't visited recently
    query(
      `SELECT * FROM (
         SELECT m.id AS member_id, m.full_name, m.phone, ${MEMBER_LAST_VISIT('m')} AS last_visit
           FROM members m
          WHERE m.gym_id = :gymId AND m.is_active = 1 AND ${MEMBER_IS_ACTIVE('m')}
       ) t
       WHERE t.last_visit IS NULL OR t.last_visit < :absentSince
       ORDER BY t.last_visit IS NOT NULL, t.last_visit LIMIT 50`,
      p,
    ),
    query(
      `SELECT f.id, f.member_id, m.full_name, m.phone, f.reason, f.remarks, f.followup_date
         FROM followups f JOIN members m ON m.id = f.member_id
        WHERE f.gym_id = :gymId AND f.status = 'pending' AND f.followup_date <= :today
        ORDER BY f.followup_date LIMIT 50`,
      p,
    ),
    listDues(req.user.gymId, today),
  ]);

  res.json({
    today,
    stats: {
      ...counts,
      month_collection: round2(counts.month_collection),
      last_month_collection: round2(counts.last_month_collection),
      pending_amount: round2(dues.reduce((s, d) => s + d.balance, 0)),
      overdue_count: dues.filter((d) => d.overdue).length,
    },
    expiring: expiring.map((e) => ({ ...e, days_left: daysBetween(today, e.expiry_date) })),
    absent: absent.map((a) => ({ ...a, days_absent: a.last_visit ? daysBetween(a.last_visit, today) : null })),
    followupsDue,
    dues: dues.slice(0, 50),
  });
});

/** Chart data for the owner dashboard: 14-day attendance, 6-month revenue, member mix, plan mix, busiest hours. */
dashboardRouter.get('/owner/charts', ownerOnly, async (req, res) => {
  const today = req.today;
  const p = {
    gymId: req.user.gymId,
    today,
    from14: addDays(today, -13),
    from30: addDays(today, -29),
    m0: addMonths(monthStart(today), -5),
  };

  const [att, rev, members, plans, checkins] = await Promise.all([
    query(
      `SELECT check_in_date AS date, COUNT(*) AS count FROM attendance
        WHERE gym_id = :gymId AND check_in_date BETWEEN :from14 AND :today GROUP BY check_in_date`,
      p,
    ),
    query(
      `SELECT DATE_FORMAT(paid_on, '%Y-%m') AS month,
              SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) AS cash,
              SUM(CASE WHEN method = 'upi' THEN amount ELSE 0 END) AS upi
         FROM payments WHERE gym_id = :gymId AND paid_on BETWEEN :m0 AND :today
        GROUP BY month`,
      p,
    ),
    query(
      `SELECT m.is_active, ${MEMBER_CURRENT_EXPIRY('m')} AS current_expiry, ${MEMBER_HAS_UPCOMING('m')} AS has_upcoming
         FROM members m WHERE m.gym_id = :gymId AND m.is_active = 1`,
      p,
    ),
    query(
      `SELECT plan_name AS plan, COUNT(*) AS count FROM memberships
        WHERE gym_id = :gymId AND is_cancelled = 0 AND start_date <= :today AND expiry_date >= :today
        GROUP BY plan_name ORDER BY count DESC, plan_name`,
      p,
    ),
    query(
      'SELECT check_in_at FROM attendance WHERE gym_id = :gymId AND check_in_date BETWEEN :from30 AND :today',
      p,
    ),
  ]);

  // Every day / month present, zero-filled
  const attByDate = new Map(att.map((r) => [r.date, r.count]));
  const attendance = [];
  for (let d = p.from14; d <= today; d = addDays(d, 1)) attendance.push({ date: d, count: attByDate.get(d) ?? 0 });

  const revByMonth = new Map(rev.map((r) => [r.month, r]));
  const revenue = [];
  for (let i = 0; i < 6; i++) {
    const month = addMonths(p.m0, i).slice(0, 7);
    const r = revByMonth.get(month);
    revenue.push({ month, cash: round2(Number(r?.cash ?? 0)), upi: round2(Number(r?.upi ?? 0)) });
  }

  // Member mix: active members whose plan ends within the window are "expiring"
  const soon = addDays(today, config.expiringSoonDays);
  const mix = { active: 0, expiring: 0, pending: 0, expired: 0, no_plan: 0 };
  for (const m of members) {
    const s = memberStatus(m, today);
    if (s === 'active' && m.current_expiry <= soon && !m.has_upcoming) mix.expiring++;
    else if (s in mix) mix[s]++;
  }

  // Busiest hours (gym-local), last 30 days
  const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: req.user.timeZone, hour: '2-digit', hourCycle: 'h23' });
  const byHour = new Array(24).fill(0);
  for (const c of checkins) byHour[Number(hourFmt.format(new Date(`${c.check_in_at.replace(' ', 'T')}Z`)))]++;
  const used = byHour.map((n, h) => (n ? h : -1)).filter((h) => h >= 0);
  const peakHours = used.length
    ? byHour.slice(Math.min(...used), Math.max(...used) + 1).map((count, i) => ({ hour: Math.min(...used) + i, count }))
    : [];

  res.json({ today, attendance, revenue, mix, plans, peakHours });
});

dashboardRouter.get('/member', memberOnly, async (req, res) => {
  const today = req.today;
  const p = { memberId: req.user.memberId, gymId: req.user.gymId, today, monthStart: monthStart(today) };

  p.from84 = addDays(today, -83);
  const [[gym], memberships, [visits], dues, recent] = await Promise.all([
    query('SELECT name, address, phone, email FROM gyms WHERE id = :gymId', p),
    query(
      `SELECT ms.id, ms.plan_name, ms.start_date, ms.expiry_date, ms.amount,
              ${MS_PAID('ms')} AS paid, ${MS_STATUS('ms')} AS status
         FROM memberships ms WHERE ms.member_id = :memberId AND ms.is_cancelled = 0
        ORDER BY ms.start_date DESC`,
      p,
    ),
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(check_in_date >= :monthStart), 0) AS this_month,
              COALESCE(SUM(check_in_date = :today), 0) AS today
         FROM attendance WHERE member_id = :memberId`,
      p,
    ),
    listDues(req.user.gymId, today, req.user.memberId),
    query('SELECT check_in_date AS d FROM attendance WHERE member_id = :memberId AND check_in_date >= :from84', p),
  ]);

  // Streak: consecutive days ending today (or yesterday, so it isn't "broken" before today's visit)
  const visited = new Set(recent.map((r) => r.d));
  let streak = 0;
  for (let d = visited.has(today) ? today : addDays(today, -1); visited.has(d); d = addDays(d, -1)) streak++;

  // Visits per week for the last 12 weeks (weeks start Monday)
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisWeek = addDays(today, -dow);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    weeks.push({ week: start, count: recent.filter((r) => r.d >= start && r.d <= end).length });
  }

  // Calendar: the last 5 full weeks including this one
  const calendar = [];
  for (let d = addDays(thisWeek, -28); d <= addDays(thisWeek, 6); d = addDays(d, 1)) {
    calendar.push({ date: d, visited: visited.has(d), future: d > today });
  }

  const current = memberships.find((m) => m.status === 'active') ?? null;
  const upcoming = memberships.filter((m) => m.status === 'pending').at(-1) ?? null;
  const lastExpired = current ? null : memberships.find((m) => m.status === 'expired') ?? null;
  const daysLeft = current ? daysBetween(today, current.expiry_date) : null;
  const pending = round2(dues.reduce((s, d) => s + d.balance, 0));

  const alerts = [];
  if (!current && !upcoming) {
    alerts.push({ tone: 'danger', text: lastExpired ? `Your membership expired on ${lastExpired.expiry_date}. Please renew.` : 'You have no active membership. Please contact the gym.' });
  } else if (current && daysLeft <= config.expiringSoonDays && !upcoming) {
    alerts.push({ tone: 'warning', text: daysLeft === 0 ? 'Your membership expires today.' : `Your membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` });
  }
  if (pending > 0) {
    const overdue = dues.some((d) => d.overdue);
    alerts.push({ tone: overdue ? 'danger' : 'warning', text: `Payment ${overdue ? 'overdue' : 'pending'}: ₹${pending}` });
  }

  res.json({
    today,
    gym,
    current: current && {
      ...current,
      days_left: daysLeft,
      total_days: daysBetween(current.start_date, current.expiry_date) + 1,
      days_used: daysBetween(current.start_date, today) + 1,
    },
    streak,
    weeks,
    calendar,
    upcoming,
    lastExpired,
    visits: { total: visits.total, thisMonth: Number(visits.this_month), checkedInToday: Number(visits.today) > 0 },
    pendingAmount: pending,
    alerts,
  });
});
