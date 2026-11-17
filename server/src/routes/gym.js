import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { authenticate, ownerOnly } from '../middleware/auth.js';
import { parse, z, zEmail, zPhone, zText } from '../utils/validate.js';

export const gymRouter = Router();

export const newQrToken = () => crypto.randomBytes(16).toString('hex');
export const qrPayload = (gymId, token) => `GYMAPP:${gymId}:${token}`;

gymRouter.get('/', authenticate, async (req, res) => {
  const [gym] = await query(
    `SELECT id, name, address, phone, email, latitude, longitude, radius_m, timezone, ${HOURS_COLS}
       FROM gyms WHERE id = :id`,
    { id: req.user.gymId },
  );
  res.json({ gym: withHours(gym) });
});

export const HOURS_COLS =
  "TIME_FORMAT(open_time, '%H:%i') AS open_time, TIME_FORMAT(close_time, '%H:%i') AS close_time, closed_days";
/** closed_days comes back from MySQL as 'sat,sun'; send it as an array. */
export const withHours = (g) => g && { ...g, closed_days: g.closed_days ? g.closed_days.split(',') : [] };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const zOptTime = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM').nullable(),
);
const hoursSchema = z
  .object({
    open_time: zOptTime,
    close_time: zOptTime,
    closed_days: z.array(z.enum(DAYS)).max(7).default([]),
  })
  .refine((h) => (h.open_time == null) === (h.close_time == null), { message: 'Set both times', path: ['close_time'] })
  .refine((h) => h.open_time == null || h.close_time > h.open_time, { message: 'Must be after opening time', path: ['close_time'] });

/** Opening hours shown to members. */
gymRouter.put('/hours', ownerOnly, async (req, res) => {
  const h = parse(hoursSchema, req.body);
  await query(
    'UPDATE gyms SET open_time = :open_time, close_time = :close_time, closed_days = :closed_days WHERE id = :id',
    { ...h, closed_days: DAYS.filter((d) => h.closed_days.includes(d)).join(','), id: req.user.gymId },
  );
  const [gym] = await query(`SELECT ${HOURS_COLS} FROM gyms WHERE id = :id`, { id: req.user.gymId });
  res.json({ hours: withHours(gym) });
});

const gymSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: zText(255),
    phone: zPhone.nullable().optional().or(z.literal('').transform(() => null)),
    email: zEmail.nullable().optional().or(z.literal('').transform(() => null)),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    radius_m: z.coerce.number().int().min(20, 'At least 20 m').max(2000, 'At most 2000 m'),
  })
  .refine((g) => (g.latitude == null) === (g.longitude == null), {
    message: 'Set both latitude and longitude',
    path: ['latitude'],
  });

gymRouter.put('/', ownerOnly, async (req, res) => {
  const g = parse(gymSchema, req.body);
  await query(
    `UPDATE gyms SET name = :name, address = :address, phone = :phone, email = :email,
            latitude = :latitude, longitude = :longitude, radius_m = :radius_m
      WHERE id = :id`,
    {
      name: g.name,
      address: g.address ?? null,
      phone: g.phone ?? null,
      email: g.email ?? null,
      latitude: g.latitude ?? null,
      longitude: g.longitude ?? null,
      radius_m: g.radius_m,
      id: req.user.gymId,
    },
  );
  const [gym] = await query(
    `SELECT id, name, address, phone, email, latitude, longitude, radius_m, timezone, ${HOURS_COLS} FROM gyms WHERE id = :id`,
    { id: req.user.gymId },
  );
  res.json({ gym: withHours(gym) });
});

gymRouter.get('/qr', ownerOnly, async (req, res) => {
  const [gym] = await query('SELECT id, name, qr_token FROM gyms WHERE id = :id', { id: req.user.gymId });
  res.json({ gymName: gym.name, payload: qrPayload(gym.id, gym.qr_token) });
});

/** Issue a new QR token. Old printed QR codes stop working immediately. */
gymRouter.post('/qr/rotate', ownerOnly, async (req, res) => {
  const token = newQrToken();
  await query('UPDATE gyms SET qr_token = :token WHERE id = :id', { token, id: req.user.gymId });
  const [gym] = await query('SELECT name FROM gyms WHERE id = :id', { id: req.user.gymId });
  res.json({ gymName: gym.name, payload: qrPayload(req.user.gymId, token) });
});
