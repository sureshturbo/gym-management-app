// Loads a demonstration gym with plans, members, memberships, payments, attendance and follow-ups.
// Usage: npm run db:seed   (skips if the demo owner already exists; use "npm run db:init -- --reset" to start over)
import bcrypt from 'bcryptjs';
import { pool, query, transaction } from '../src/db.js';
import { newQrToken } from '../src/routes/gym.js';
import { addDays, computeExpiry, todayIn } from '../src/utils/dates.js';

const OWNER_EMAIL = 'owner@demo.gym';
const OWNER_PASSWORD = 'Owner@123';
const MEMBER_PASSWORD = 'Member@123';
const today = todayIn('Asia/Kolkata');

try {
  const [exists] = await query('SELECT id FROM users WHERE email = :email', { email: OWNER_EMAIL });
  if (exists) {
    console.log('Demo data already present. Run "npm run db:init -- --reset" then "npm run db:seed" to recreate it.');
  } else {
    await transaction(seed);
    console.log('Demo data created.\n');
    console.log(`  Owner : ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
    console.log(`  Member: arjun@demo.gym / ${MEMBER_PASSWORD}  (registered, active, checked in on recent days)`);
    console.log(`  Member: priya@demo.gym / ${MEMBER_PASSWORD}  (registered, expiring soon, payment pending)`);
    console.log('  Invited (not registered yet): neha@demo.gym — register in the app with this email.\n');
    console.log('The demo gym location is Chennai; set your real location under Gym settings to test check-in.');
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function seed(conn) {
  const q = (sql, params) => query(sql, params, conn);

  const gym = await q(
    `INSERT INTO gyms (name, address, phone, email, latitude, longitude, radius_m, qr_token)
     VALUES ('Demo Fitness Studio', '12 Anna Salai, Chennai, Tamil Nadu', '9876500000', 'hello@demo.gym',
             13.0604220, 80.2495830, 150, :token)`,
    { token: newQrToken() },
  );
  const gymId = gym.insertId;

  const owner = await q(
    `INSERT INTO users (gym_id, role, name, email, phone, password_hash)
     VALUES (:gymId, 'owner', 'Demo Owner', :email, '9876500001', :hash)`,
    { gymId, email: OWNER_EMAIL, hash: await bcrypt.hash(OWNER_PASSWORD, 10) },
  );
  const ownerId = owner.insertId;

  const planDefs = [
    ['Monthly', 'month', 1, 1500],
    ['Quarterly', 'month', 3, 4000],
    ['Half-yearly', 'month', 6, 7500],
    ['Yearly', 'month', 12, 14000],
    ['15-day trial', 'day', 15, 800],
  ];
  const plans = {};
  for (const [name, unit, value, price] of planDefs) {
    const r = await q(
      `INSERT INTO membership_plans (gym_id, name, duration_unit, duration_value, price)
       VALUES (:gymId, :name, :unit, :value, :price)`,
      { gymId, name, unit, value, price },
    );
    plans[name] = { id: r.insertId, name, unit, value, price };
  }

  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10);

  // [name, email, phone, registered, plan, start offset (days from today), paid fraction, visit pattern]
  const people = [
    ['Arjun Mehta', 'arjun@demo.gym', '9840000001', true, 'Quarterly', -20, 1, 'regular'],
    ['Priya Sharma', 'priya@demo.gym', '9840000002', true, 'Monthly', -26, 0, 'regular'],
    ['Karthik Raja', 'karthik@demo.gym', '9840000003', false, 'Yearly', -100, 0.5, 'absent'],
    ['Divya Nair', 'divya@demo.gym', '9840000004', false, 'Monthly', -45, 1, 'none'],
    ['Rahul Verma', 'rahul@demo.gym', '9840000005', false, 'Half-yearly', -10, 1, 'regular'],
    ['Sneha Iyer', 'sneha@demo.gym', '9840000006', false, '15-day trial', -12, 1, 'regular'],
    ['Neha Gupta', 'neha@demo.gym', '9840000007', false, 'Monthly', 0, 0, 'none'],
  ];

  for (const [fullName, email, phone, registered, planName, offset, paidFraction, pattern] of people) {
    const start = addDays(today, offset);
    let userId = null;
    if (registered) {
      const u = await q(
        `INSERT INTO users (gym_id, role, name, email, phone, password_hash)
         VALUES (:gymId, 'member', :fullName, :email, :phone, :hash)`,
        { gymId, fullName, email, phone, hash: memberHash },
      );
      userId = u.insertId;
    }
    const m = await q(
      `INSERT INTO members (gym_id, user_id, full_name, phone, email, joined_on)
       VALUES (:gymId, :userId, :fullName, :phone, :email, :joined)`,
      { gymId, userId, fullName, phone, email, joined: start },
    );
    const memberId = m.insertId;

    const plan = plans[planName];
    const expiry = computeExpiry(start, plan.unit, plan.value);
    const ms = await q(
      `INSERT INTO memberships (gym_id, member_id, plan_id, plan_name, start_date, expiry_date, amount)
       VALUES (:gymId, :memberId, :planId, :planName, :start, :expiry, :amount)`,
      { gymId, memberId, planId: plan.id, planName, start, expiry, amount: plan.price },
    );

    if (paidFraction > 0) {
      await q(
        `INSERT INTO payments (gym_id, member_id, membership_id, amount, method, paid_on, reference, recorded_by)
         VALUES (:gymId, :memberId, :msId, :amount, :method, :paidOn, :ref, :ownerId)`,
        {
          gymId,
          memberId,
          msId: ms.insertId,
          amount: Math.round(plan.price * paidFraction),
          method: memberId % 2 ? 'upi' : 'cash',
          paidOn: start,
          ref: memberId % 2 ? `UPI${100000 + memberId}` : null,
          ownerId,
        },
      );
    }

    // Attendance: "regular" visits most days since start (not today), "absent" stopped 9 days ago.
    if (pattern !== 'none') {
      const firstDay = Math.max(offset, -30);
      const lastDay = pattern === 'absent' ? -9 : -1;
      for (let d = firstDay; d <= lastDay; d++) {
        if ((d + memberId) % 4 === 0) continue; // skip some days
        const date = addDays(today, d);
        await q(
          `INSERT INTO attendance (gym_id, member_id, check_in_date, check_in_at, latitude, longitude, distance_m)
           VALUES (:gymId, :memberId, :date,
                   CONCAT(:date, ' ', LPAD(:hour, 2, '0'), ':', LPAD(:minute, 2, '0'), ':00'), 13.0604220, 80.2495830, 12)`,
          {
            gymId,
            memberId,
            date,
            // UTC hours -> IST 5:30am–9:30pm, weighted to the morning and evening rush
            hour: [0, 0, 1, 1, 1, 2, 4, 12, 13, 13, 14, 14, 15][(memberId * 5 + (d + 60) * 7) % 13],
            minute: (memberId * 7 + d * 3 + 60) % 60,
          },
        );
      }
    }
  }

  const [karthik] = await q("SELECT id FROM members WHERE email = 'karthik@demo.gym'");
  const [priya] = await q("SELECT id FROM members WHERE email = 'priya@demo.gym'");
  await q(
    `INSERT INTO followups (gym_id, member_id, reason, remarks, followup_date, created_by) VALUES
       (:gymId, :karthik, 'absent', 'Not seen for over a week — call to check in.', :today, :ownerId),
       (:gymId, :priya, 'payment_pending', 'Promised to pay by UPI this week.', :tomorrow, :ownerId)`,
    { gymId, karthik: karthik.id, priya: priya.id, today, tomorrow: addDays(today, 1), ownerId },
  );
}
