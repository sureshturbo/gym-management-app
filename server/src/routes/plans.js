import { Router } from 'express';
import { query } from '../db.js';
import { ownerOnly } from '../middleware/auth.js';
import { notFound } from '../utils/http.js';
import { parse, z, zId, zMoney, zText } from '../utils/validate.js';

export const plansRouter = Router();
plansRouter.use(ownerOnly);

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  duration_unit: z.enum(['month', 'day']),
  duration_value: z.coerce.number().int().min(1).max(3650),
  price: zMoney,
  description: zText(255),
  is_active: z.coerce.boolean().optional().default(true),
});

plansRouter.get('/', async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const plans = await query(
    `SELECT id, name, duration_unit, duration_value, price, description, is_active
       FROM membership_plans
      WHERE gym_id = :gymId ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY is_active DESC, duration_unit, duration_value, name`,
    { gymId: req.user.gymId },
  );
  res.json({ plans });
});

plansRouter.post('/', async (req, res) => {
  const p = parse(planSchema, req.body);
  const result = await query(
    `INSERT INTO membership_plans (gym_id, name, duration_unit, duration_value, price, description, is_active)
     VALUES (:gymId, :name, :duration_unit, :duration_value, :price, :description, :is_active)`,
    { ...p, description: p.description ?? null, gymId: req.user.gymId },
  );
  res.status(201).json({ id: result.insertId });
});

plansRouter.put('/:id', async (req, res) => {
  const id = parse(zId, req.params.id);
  const p = parse(planSchema, req.body);
  const result = await query(
    `UPDATE membership_plans
        SET name = :name, duration_unit = :duration_unit, duration_value = :duration_value,
            price = :price, description = :description, is_active = :is_active
      WHERE id = :id AND gym_id = :gymId`,
    { ...p, description: p.description ?? null, id, gymId: req.user.gymId },
  );
  if (!result.affectedRows) throw notFound('Plan');
  res.status(204).end();
});
