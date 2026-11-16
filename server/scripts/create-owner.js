// Provision a new customer gym and its owner account (there is no admin dashboard in v1).
// Usage:
//   npm run create-owner -- --gym "Iron Temple" --name "Ravi Kumar" --email ravi@example.com --password "S3cret!pass" [--phone 9876543210]
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { pool, query, transaction } from '../src/db.js';
import { newQrToken } from '../src/routes/gym.js';

const { values } = parseArgs({
  options: {
    gym: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
    phone: { type: 'string' },
  },
});

const missing = ['gym', 'name', 'email', 'password'].filter((k) => !values[k]);
if (missing.length) {
  console.error(`Missing: ${missing.map((k) => `--${k}`).join(', ')}`);
  console.error('Usage: npm run create-owner -- --gym "Gym Name" --name "Owner Name" --email owner@example.com --password "min 8 chars"');
  process.exit(1);
}
if (values.password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const email = values.email.trim().toLowerCase();

try {
  const { gymId, userId } = await transaction(async (conn) => {
    const [taken] = await query(
      'SELECT (SELECT COUNT(*) FROM users WHERE email = :email) + (SELECT COUNT(*) FROM members WHERE email = :email) AS n',
      { email },
      conn,
    );
    if (taken.n) throw new Error(`Email ${email} is already in use`);
    const gym = await query('INSERT INTO gyms (name, qr_token) VALUES (:name, :token)', { name: values.gym, token: newQrToken() }, conn);
    const user = await query(
      `INSERT INTO users (gym_id, role, name, email, phone, password_hash)
       VALUES (:gymId, 'owner', :name, :email, :phone, :hash)`,
      {
        gymId: gym.insertId,
        name: values.name,
        email,
        phone: values.phone ?? null,
        hash: await bcrypt.hash(values.password, 10),
      },
      conn,
    );
    return { gymId: gym.insertId, userId: user.insertId };
  });
  console.log(`Created gym #${gymId} "${values.gym}" with owner #${userId} <${email}>.`);
  console.log('Next: log in as the owner and set the gym location under Gym settings.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
