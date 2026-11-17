import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { memberOnly, ownerOnly } from '../middleware/auth.js';
import { HttpError } from '../utils/http.js';
import { distanceMeters } from '../utils/geo.js';
import { monthStart } from '../utils/dates.js';
import { parse, z, zDate } from '../utils/validate.js';
import { MEMBER_IS_ACTIVE } from '../sql.js';

export const attendanceRouter = Router();

/** QR payload format: GYMAPP:<gymId>:<32-hex token>. Returns null if it isn't one of ours. */
export function parseQrPayload(text) {
  const match = /^GYMAPP:(\d+):([a-f0-9]{32})$/.exec(String(text ?? '').trim());
  return match ? { gymId: Number(match[1]), token: match[2] } : null;
}

/**
 * Whether a GPS reading counts as "at the gym". Up to gpsAccuracyAllowanceM of the reported
 * accuracy is credited, because indoor GPS is often 20–50 m off.
 */
export function isWithinGym(distance, radius, accuracy) {
  const allowance = Math.min(Math.max(accuracy ?? 0, 0), config.gpsAccuracyAllowanceM);
  return distance - allowance <= radius;
}

attendanceRouter.post('/check-in', memberOnly, async (req, res) => {
  const body = parse(
    z.object({
      qr: z.string().min(1, 'Scan the gym QR code').max(200),
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      accuracy: z.coerce.number().nonnegative().optional(),
    }),
    req.body,
  );

  // 1. QR belongs to this member's gym and is the current code
  const qr = parseQrPayload(body.qr);
  if (!qr) throw new HttpError(400, 'This is not a gym check-in QR code');
  if (qr.gymId !== req.user.gymId) throw new HttpError(400, 'This QR code belongs to a different gym');
  const [gym] = await query('SELECT qr_token, latitude, longitude, radius_m FROM gyms WHERE id = :id', {
    id: req.user.gymId,
  });
  if (gym.qr_token !== qr.token) {
    throw new HttpError(400, 'This QR code is no longer valid. Please scan the current code at the gym.');
  }

  // 2. Location
  if (gym.latitude == null || gym.longitude == null) {
    throw new HttpError(409, 'The gym location has not been set up yet. Please inform the gym owner.');
  }
  const distance = Math.round(distanceMeters(body.latitude, body.longitude, gym.latitude, gym.longitude));
  if (!isWithinGym(distance, gym.radius_m, body.accuracy)) {
    throw new HttpError(403, `You appear to be ${distance} m away from the gym. Please check in at the gym.`, {
      distance,
    });
  }

  // 3. Membership covers today
  const [member] = await query(
    `SELECT m.is_active, ${MEMBER_IS_ACTIVE('m')} AS has_active FROM members m WHERE m.id = :id`,
    { id: req.user.memberId, today: req.today },
  );
  if (!member.is_active) throw new HttpError(403, 'Your membership is disabled. Please contact the gym.');
  if (!member.has_active) {
    throw new HttpError(403, 'You do not have an active membership today. Please renew at the front desk.');
  }

  // 4. One check-in per day (unique key on member_id + check_in_date)
  try {
    await query(
      `INSERT INTO attendance (gym_id, member_id, check_in_date, check_in_at, latitude, longitude, distance_m)
       VALUES (:gymId, :memberId, :today, UTC_TIMESTAMP(), :lat, :lng, :distance)`,
      {
        gymId: req.user.gymId,
        memberId: req.user.memberId,
        today: req.today,
        lat: body.latitude,
        lng: body.longitude,
        distance,
      },
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    const [existing] = await query(
      'SELECT check_in_at FROM attendance WHERE member_id = :memberId AND check_in_date = :today',
      { memberId: req.user.memberId, today: req.today },
    );
    return res.status(409).json({ error: 'You have already checked in today', checkInAt: existing?.check_in_at });
  }

  const [row] = await query(
    'SELECT check_in_date, check_in_at FROM attendance WHERE member_id = :memberId AND check_in_date = :today',
    { memberId: req.user.memberId, today: req.today },
  );
  res.status(201).json({ message: 'Attendance marked. Have a great workout!', attendance: { ...row, distance_m: distance } });
});

/** Owner: who checked in on a given day (default today). */
attendanceRouter.get('/', ownerOnly, async (req, res) => {
  const { date } = parse(z.object({ date: zDate.optional() }), req.query);
  const day = date ?? req.today;
  const [records, [{ active_members }]] = await Promise.all([
    query(
      `SELECT a.id, a.member_id, m.full_name, m.phone, m.gender, m.photo_key, b.name AS batch_name,
              a.check_in_at, a.distance_m
         FROM attendance a JOIN members m ON m.id = a.member_id
         LEFT JOIN batches b ON b.id = m.batch_id
        WHERE a.gym_id = :gymId AND a.check_in_date = :day
        ORDER BY a.check_in_at`,
      { gymId: req.user.gymId, day },
    ),
    query(
      `SELECT COUNT(*) AS active_members FROM members m
        WHERE m.gym_id = :gymId AND m.is_active = 1 AND ${MEMBER_IS_ACTIVE('m')}`,
      { gymId: req.user.gymId, today: day },
    ),
  ]);
  const byGender = { male: 0, female: 0, other: 0 };
  for (const r of records) if (r.gender) byGender[r.gender]++;
  res.json({ date: day, present: records.length, activeMembers: active_members, byGender, records });
});

/** Member: own attendance history. */
attendanceRouter.get('/me', memberOnly, async (req, res) => {
  const params = { memberId: req.user.memberId, today: req.today, monthStart: monthStart(req.today) };
  const [records, [stats]] = await Promise.all([
    query(
      `SELECT check_in_date, check_in_at FROM attendance WHERE member_id = :memberId
        ORDER BY check_in_date DESC LIMIT 120`,
      params,
    ),
    query(
      `SELECT COUNT(*) AS total,
              SUM(check_in_date >= :monthStart) AS this_month,
              SUM(check_in_date = :today) AS today
         FROM attendance WHERE member_id = :memberId`,
      params,
    ),
  ]);
  res.json({
    total: stats.total,
    thisMonth: Number(stats.this_month ?? 0),
    checkedInToday: Number(stats.today ?? 0) > 0,
    records,
  });
});
