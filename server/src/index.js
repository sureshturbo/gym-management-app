import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`Cannot connect to MySQL at ${config.db.host}:${config.db.port} (${err.code ?? err.message}).`);
  console.error('Check DB_* values in server/.env and run "npm run db:init" first.');
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`Gym API listening on http://localhost:${config.port}`);
});
