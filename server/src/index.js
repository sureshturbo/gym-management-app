import './env.js'; // must be first: loads server/.env before config is read
import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { ensureFirstOwner, ensureSchema } from './setup.js';

try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`Cannot connect to MySQL at ${config.db.host}:${config.db.port} (${err.code ?? err.message}).`);
  console.error('Check the DB_* settings (server/.env or the host control panel).');
  process.exit(1);
}

try {
  await ensureSchema();
  await ensureFirstOwner();
} catch (err) {
  console.error(`Database setup failed: ${err.message}`);
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`Gym app listening on port ${config.port}`);
});
