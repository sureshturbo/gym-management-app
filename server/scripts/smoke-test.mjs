// End-to-end smoke test against a running API with seeded demo data.
// Usage: npm run dev (in another terminal), then: npm run smoke [-- baseUrl]
// Creates a few test records (a member, plan, payment, follow-up) in the demo gym.
const BASE = process.argv[2] ?? 'http://localhost:4100/api';
let failures = 0;

async function call(method, path, { token, body, expect } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  const ok = expect === undefined ? res.ok : res.status === expect;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${method} ${path} -> ${res.status}${ok ? '' : `  ${JSON.stringify(data)}`}`);
  if (!ok) failures++;
  return data;
}

const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  ${extra}`}`);
  if (!cond) failures++;
};

const stamp = Date.now().toString(36);

// --- auth
await call('POST', '/auth/login', { body: { email: 'owner@demo.gym', password: 'wrong' }, expect: 401 });
const owner = (await call('POST', '/auth/login', { body: { email: 'owner@demo.gym', password: 'Owner@123' } })).token;
const arjun = (await call('POST', '/auth/login', { body: { email: 'arjun@demo.gym', password: 'Member@123' } })).token;
await call('GET', '/dashboard/owner', { expect: 401 });
await call('GET', '/members', { token: arjun, expect: 403 });
await call('POST', '/auth/register', { body: { email: `nobody-${stamp}@x.com`, password: 'Password1' }, expect: 404 });

// --- owner reads
const dash = await call('GET', '/dashboard/owner', { token: owner });
check('dashboard has stats', dash?.stats?.total_members >= 7, JSON.stringify(dash?.stats));
const list = await call('GET', '/members', { token: owner });
const statuses = new Set(list.members.map((m) => m.status));
check('member statuses derived', statuses.has('active') && statuses.has('expired'), [...statuses].join(','));
await call('GET', '/members?search=priya', { token: owner });
await call('GET', '/members?status=invited', { token: owner });
await call('GET', '/payments/dues', { token: owner });
await call('GET', '/payments', { token: owner });
await call('GET', '/attendance', { token: owner });
await call('GET', '/followups?status=pending', { token: owner });
await call('GET', '/reports/attendance', { token: owner });
await call('GET', '/reports/payments', { token: owner });
await call('GET', '/reports/attendance?from=2026-02-01&to=2026-01-01', { token: owner, expect: 400 });

// --- plans
const plan = await call('POST', '/plans', {
  token: owner,
  body: { name: `Test 30-day ${stamp}`, duration_unit: 'day', duration_value: 30, price: 999 },
  expect: 201,
});
await call('POST', '/plans', { token: owner, body: { name: 'x', duration_unit: 'week', price: -1 }, expect: 400 });

// --- member lifecycle: add -> register -> membership -> payment -> check-in
const email = `test-${stamp}@demo.gym`;
const created = await call('POST', '/members', {
  token: owner,
  body: { full_name: 'Test Member', phone: '9000000000', email, gender: 'male' },
  expect: 201,
});
await call('POST', '/members', { token: owner, body: { full_name: 'Dup', phone: '9000000001', email, gender: 'male' }, expect: 409 });
const reg = await call('POST', '/auth/register', { body: { email, password: 'Password1' }, expect: 201 });
await call('POST', '/auth/register', { body: { email, password: 'Password1' }, expect: 409 });
const testTok = reg.token;

const today = dash.today;
await call('POST', '/attendance/check-in', { token: testTok, body: { qr: 'x', latitude: 0, longitude: 0 }, expect: 400 });

const ms = await call('POST', '/memberships', {
  token: owner,
  body: { memberId: created.id, planId: plan.id, startDate: today },
  expect: 201,
});
await call('POST', '/memberships', {
  token: owner,
  body: { memberId: created.id, planId: plan.id, startDate: today },
  expect: 409,
});
const detail = await call('GET', `/members/${created.id}`, { token: owner });
check('membership expiry = start + 29 days', detail.memberships[0]?.expiry_date > today && detail.memberships[0].balance === 999, JSON.stringify(detail.memberships[0]));

await call('POST', '/payments', { token: owner, body: { membershipId: ms.id, amount: 2000, method: 'cash' }, expect: 400 });
await call('POST', '/payments', { token: owner, body: { membershipId: ms.id, amount: 500, method: 'upi', reference: 'UPI-TEST' }, expect: 201 });
const dues = await call('GET', '/payments/me', { token: testTok });
check('partial payment leaves balance 499', dues.dues[0]?.balance === 499, JSON.stringify(dues.dues));

// QR + location
const { payload } = await call('GET', '/gym/qr', { token: owner });
const { gym } = await call('GET', '/gym', { token: owner });
await call('POST', '/attendance/check-in', {
  token: testTok,
  body: { qr: payload, latitude: gym.latitude + 0.05, longitude: gym.longitude, accuracy: 10 },
  expect: 403,
});
const ci = await call('POST', '/attendance/check-in', {
  token: testTok,
  body: { qr: payload, latitude: gym.latitude + 0.0005, longitude: gym.longitude, accuracy: 15 },
  expect: 201,
});
check('check-in distance ~56 m', ci?.attendance?.distance_m > 40 && ci.attendance.distance_m < 70, JSON.stringify(ci));
await call('POST', '/attendance/check-in', {
  token: testTok,
  body: { qr: payload, latitude: gym.latitude, longitude: gym.longitude },
  expect: 409,
});
const me = await call('GET', '/attendance/me', { token: testTok });
check('member sees today check-in', me.checkedInToday === true, JSON.stringify(me));
const mdash = await call('GET', '/dashboard/member', { token: testTok });
check('member dashboard shows pending payment', mdash.pendingAmount === 499 && mdash.alerts.length > 0, JSON.stringify(mdash.alerts));

// rotated QR invalidates the old one
const rotated = await call('POST', '/gym/qr/rotate', { token: owner });
check('rotated QR differs', rotated.payload !== payload);
await call('POST', '/attendance/check-in', {
  token: arjun,
  body: { qr: payload, latitude: gym.latitude, longitude: gym.longitude },
  expect: 400,
});

// --- follow-ups
const fu = await call('POST', '/followups', {
  token: owner,
  body: { memberId: created.id, reason: 'payment_pending', remarks: 'Balance 499' },
  expect: 201,
});
await call('PATCH', `/followups/${fu.id}`, { token: owner, body: { status: 'completed' }, expect: 204 });

// --- deactivate member blocks login
await call('PUT', `/members/${created.id}`, {
  token: owner,
  body: { full_name: 'Test Member', phone: '9000000000', email, gender: 'male', is_active: false },
  expect: 204,
});
await call('GET', '/auth/me', { token: testTok, expect: 401 });

// --- profile & password
await call('PATCH', '/auth/me', { token: arjun, body: { name: 'Arjun Mehta', phone: '9840000001' } });
await call('POST', '/auth/change-password', { token: arjun, body: { currentPassword: 'nope', newPassword: 'Whatever1' }, expect: 400 });

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
