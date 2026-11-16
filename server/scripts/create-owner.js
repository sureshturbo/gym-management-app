// Provision a new customer gym and its owner account (there is no admin dashboard in v1).
// Usage:
//   npm run create-owner -- --gym "Iron Temple" --name "Ravi Kumar" --email ravi@example.com --password "S3cret!pass" [--phone 9876543210]
import { parseArgs } from 'node:util';
import { pool } from '../src/db.js';
import { createGymWithOwner } from '../src/setup.js';

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

try {
  const { gymId, userId, email } = await createGymWithOwner(values);
  console.log(`Created gym #${gymId} "${values.gym}" with owner #${userId} <${email}>.`);
  console.log('Next: log in as the owner and set the gym location under Gym settings.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
