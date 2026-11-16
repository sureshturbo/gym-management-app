import { z } from 'zod';
import { HttpError } from './http.js';

/** Validate data against a zod schema; throws a 400 with per-field messages on failure. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new HttpError(400, 'Please check the highlighted fields', result.error.flatten().fieldErrors);
  }
  return result.data;
}

const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(isRealDate, 'Invalid date');
export const zId = z.coerce.number().int().positive();
export const zEmail = z.string().trim().toLowerCase().email('Enter a valid email').max(160);
export const zPhone = z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid phone number');
export const zPassword = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters');
export const zMoney = z.coerce.number().nonnegative().max(10_000_000).multipleOf(0.01, 'At most 2 decimals');
/** Optional text: empty strings become null. */
export const zText = (max) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());

export { z };
