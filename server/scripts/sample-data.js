// Adds a set of sample members (men and women) to an EXISTING gym so the dashboard has something to show:
// memberships, payments (some partial), ~5 weeks of check-ins, batches and gym hours if missing.
// Everything it creates uses @sample.gym emails, so it can be removed cleanly.
//
//   node scripts/sample-data.js            add sample members to the first gym (or --gym <id>)
//   node scripts/sample-data.js --remove   delete every @sample.gym member and their records
//
// It never touches other members. Batches it creates are kept on --remove (they may be in use by then).
import { pool, query, transaction } from '../src/db.js';
import { addDays, computeExpiry, todayIn } from '../src/utils/dates.js';

const DOMAIN = '@sample.gym';
const args = process.argv.slice(2);
const remove = args.includes('--remove');
const gymArg = args.includes('--gym') ? Number(args[args.indexOf('--gym') + 1]) : null;

// [name, gender, plan, start offset (days), paid fraction, visit rate 0-1 (0 = stopped coming), batch]
const PEOPLE = [
  ['Vikram Singh', 'male', 'Quarterly', -40, 1, 0.85, 'Morning'],
  ['Arun Kumar', 'male', 'Monthly', -18, 1, 0.7, 'Evening'],
  ['Mohammed Irfan', 'male', 'Yearly', -120, 1, 0.9, 'Morning'],
  ['Suresh Babu', 'male', 'Monthly', -27, 0.5, 0.5, 'Evening'],
  ['Deepak Raj', 'male', 'Half-yearly', -60, 1, 0, 'Evening'],
  ['Naveen Prakash', 'male', 'Monthly', -5, 0, 0.8, 'Morning'],
  ['Lakshmi Priya', 'female', 'Quarterly', -35, 1, 0.8, 'Ladies'],
  ['Anjali Menon', 'female', 'Monthly', -24, 1, 0.75, 'Ladies'],
  ['Kavya Reddy', 'female', 'Yearly', -90, 1, 0.65, 'Morning'],
  ['Meera Krishnan', 'female', 'Monthly', -28, 0, 0.6, 'Evening'],
  ['Fathima Begum', 'female', 'Half-yearly', -50, 0.5, 0, 'Ladies'],
  ['Pooja Sharma', 'female', 'Monthly', -8, 1, 0.9, 'Ladies'],
];

const PLANS = [
  ['Monthly', 'month', 1, 1500],
  ['Quarterly', 'month', 3, 4000],
  ['Half-yearly', 'month', 6, 7500],
  ['Yearly', 'month', 12, 14000],
];

const BATCHES = [
  ['Morning', '06:00', '08:00', 'any', 30],
  ['Ladies', '10:00', '11:30', 'female', 15],
  ['Evening', '18:00', '20:00', 'any', 30],
];

// Deterministic pseudo-random so re-runs look the same
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function pickGym() {
  const [g] = gymArg
    ? await query('SELECT id, timezone FROM gyms WHERE id = :id', { id: gymArg })
    : await query('SELECT id, timezone FROM gyms ORDER BY id LIMIT 1');
  if (!g) throw new Error('No gym found. Create the gym (owner account) first.');
  return g;
}

async function removeSample() {
  const ids = (await query(`SELECT id FROM members WHERE email LIKE :like`, { like: `%${DOMAIN}` })).map((r) => r.id);
  if (!ids.length) return console.log('No sample members found.');
  await transaction(async (conn) => {
    const q = (sql) => query(sql, { ids }, conn);
    await q('DELETE FROM followups WHERE member_id IN (:ids)');
    await q('DELETE FROM attendance WHERE member_id IN (:ids)');
    await q('DELETE FROM payments WHERE member_id IN (:ids)');
    await q('DELETE FROM memberships WHERE member_id IN (:ids)');
    await q('DELETE FROM photos WHERE photo_key IN (SELECT photo_key FROM members WHERE id IN (:ids))');
    await q('DELETE FROM members WHERE id IN (:ids)');
  });
  console.log(`Removed ${ids.length} sample members and their memberships, payments and check-ins.`);
}

async function addSample() {
  const gym = await pickGym();
  const gymId = gym.id;
  const today = todayIn(gym.timezone);
  const [existing] = await query('SELECT COUNT(*) AS n FROM members WHERE email LIKE :like', { like: `%${DOMAIN}` });
  if (existing.n) return console.log(`Sample data already present (${existing.n} members). Run with --remove first to recreate it.`);
  const [owner] = await query("SELECT id FROM users WHERE gym_id = :gymId AND role = 'owner' ORDER BY id LIMIT 1", { gymId });
  if (!owner) throw new Error(`Gym ${gymId} has no owner account.`);

  await transaction(async (conn) => {
    const q = (sql, params) => query(sql, { gymId, ...params }, conn);

    // Gym hours, only if not set yet
    await q(`UPDATE gyms SET open_time = '05:30', close_time = '22:00', closed_days = 'sun' WHERE id = :gymId AND open_time IS NULL`);

    // Plans and batches: reuse ones with the same name, create the rest
    const plans = {};
    for (const [name, unit, value, price] of PLANS) {
      const [p] = await q('SELECT id, duration_unit, duration_value, price FROM membership_plans WHERE gym_id = :gymId AND name = :name', { name });
      plans[name] = p
        ? { id: p.id, unit: p.duration_unit, value: p.duration_value, price: Number(p.price) }
        : {
            id: (await q('INSERT INTO membership_plans (gym_id, name, duration_unit, duration_value, price) VALUES (:gymId, :name, :unit, :value, :price)', { name, unit, value, price })).insertId,
            unit,
            value,
            price,
          };
    }
    const batches = {};
    for (const [name, start, end, gender, capacity] of BATCHES) {
      const [b] = await q('SELECT id FROM batches WHERE gym_id = :gymId AND name = :name', { name });
      batches[name] = b
        ? b.id
        : (await q('INSERT INTO batches (gym_id, name, start_time, end_time, gender, capacity) VALUES (:gymId, :name, :start, :end, :gender, :capacity)', { name, start, end, gender, capacity })).insertId;
    }

    let n = 0;
    for (const [name, gender, planName, offset, paidFraction, rate, batch] of PEOPLE) {
      n++;
      const email = `${name.split(' ')[0].toLowerCase()}${DOMAIN}`;
      const start = addDays(today, offset);
      const m = await q(
        `INSERT INTO members (gym_id, batch_id, full_name, phone, email, gender, joined_on, notes)
         VALUES (:gymId, :batchId, :name, :phone, :email, :gender, :start, 'Sample data')`,
        { batchId: batches[batch], name, phone: `98400${String(10000 + n * 137).slice(-5)}`, email, gender, start },
      );
      const memberId = m.insertId;
      const plan = plans[planName];
      const expiry = computeExpiry(start, plan.unit, plan.value);
      const ms = await q(
        `INSERT INTO memberships (gym_id, member_id, plan_id, plan_name, start_date, expiry_date, amount)
         VALUES (:gymId, :memberId, :planId, :planName, :start, :expiry, :amount)`,
        { memberId, planId: plan.id, planName, start, expiry, amount: plan.price },
      );
      if (paidFraction > 0) {
        await q(
          `INSERT INTO payments (gym_id, member_id, membership_id, amount, method, paid_on, recorded_by)
           VALUES (:gymId, :memberId, :msId, :amount, :method, :paidOn, :ownerId)`,
          {
            memberId,
            msId: ms.insertId,
            amount: Math.round(plan.price * paidFraction),
            method: n % 3 ? 'upi' : 'cash',
            paidOn: start,
            ownerId: owner.id,
          },
        );
      }

      // Check-ins over the last 5 weeks, up to today. rate 0 = stopped coming 10 days ago.
      const first = Math.max(offset, -35);
      const last = rate === 0 ? -10 : 0;
      const morning = batch !== 'Evening';
      for (let d = first; d <= last; d++) {
        const date = addDays(today, d);
        if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue; // closed Sunday
        if (rand() > (rate || 0.7)) continue;
        if (d === 0 && rand() > 0.6) continue; // not everyone has come in yet today
        // UTC times: morning batch ~6-8 am IST (00:30-02:30 UTC), ladies ~10 am, evening ~6-8 pm (12:30-14:30 UTC)
        const baseHour = batch === 'Ladies' ? 4 : morning ? 0 : 12;
        const at =
          d === 0
            ? new Date(Date.now() - (10 + Math.floor(rand() * 170)) * 60000).toISOString().slice(0, 19).replace('T', ' ') // earlier today
            : `${date} ${String(baseHour + Math.floor(rand() * 2)).padStart(2, '0')}:${30 + Math.floor(rand() * 29)}:00`;
        await q(
          `INSERT INTO attendance (gym_id, member_id, check_in_date, check_in_at, distance_m)
           VALUES (:gymId, :memberId, :date, :at, :dist)`,
          { memberId, date, at, dist: 5 + Math.floor(rand() * 40) },
        );
      }
    }
  });
  console.log(`Added ${PEOPLE.length} sample members (${PEOPLE.filter((p) => p[1] === 'male').length} men, ${PEOPLE.filter((p) => p[1] === 'female').length} women) to gym #${gymId}.`);
  console.log('Remove them any time with: node scripts/sample-data.js --remove');
}

try {
  await (remove ? removeSample() : addSample());
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
