// Pure-logic tests (no database needed): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_USER ??= 'test';
process.env.JWT_SECRET ??= 'test-secret';

const { addDays, addMonths, computeExpiry, daysBetween, todayIn } = await import('../src/utils/dates.js');
const { distanceMeters } = await import('../src/utils/geo.js');
const { parseQrPayload, isWithinGym } = await import('../src/routes/attendance.js');
const { memberStatus } = await import('../src/sql.js');

test('computeExpiry is inclusive and clamps month ends', () => {
  assert.equal(computeExpiry('2026-01-10', 'month', 1), '2026-02-09');
  assert.equal(computeExpiry('2026-01-01', 'month', 12), '2026-12-31');
  assert.equal(computeExpiry('2026-01-01', 'day', 15), '2026-01-15');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30);
  // 20:00 UTC is already the next day in India
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-11-16T20:00:00Z')), '2026-11-17');
});

test('distanceMeters', () => {
  assert.equal(Math.round(distanceMeters(13.06, 80.25, 13.06, 80.25)), 0);
  const d = distanceMeters(13.0604, 80.2495, 13.0613, 80.2495); // ~0.0009° latitude ≈ 100 m
  assert.ok(d > 95 && d < 105, `got ${d}`);
});

test('parseQrPayload', () => {
  const token = 'a'.repeat(32);
  assert.deepEqual(parseQrPayload(`GYMAPP:12:${token}`), { gymId: 12, token });
  assert.equal(parseQrPayload('https://example.com'), null);
  assert.equal(parseQrPayload(`GYMAPP:x:${token}`), null);
  assert.equal(parseQrPayload(null), null);
});

test('isWithinGym credits at most 50 m of GPS accuracy', () => {
  assert.equal(isWithinGym(140, 150, 0), true);
  assert.equal(isWithinGym(190, 150, 40), true);
  assert.equal(isWithinGym(250, 150, 500), false);
});

test('memberStatus', () => {
  const today = '2026-11-16';
  assert.equal(memberStatus({ is_active: 0, current_expiry: '2027-01-01' }, today), 'inactive');
  assert.equal(memberStatus({ is_active: 1, current_expiry: today }, today), 'active');
  assert.equal(memberStatus({ is_active: 1, current_expiry: '2026-11-01', has_upcoming: 1 }, today), 'pending');
  assert.equal(memberStatus({ is_active: 1, current_expiry: '2026-11-01' }, today), 'expired');
  assert.equal(memberStatus({ is_active: 1, current_expiry: null }, today), 'no_plan');
});
