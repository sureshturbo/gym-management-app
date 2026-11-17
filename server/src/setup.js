// First-run setup for hosted deployments, where there may be no terminal:
//  1. create any missing tables from server/db/schema.sql (CREATE TABLE IF NOT EXISTS),
//  2. if OWNER_EMAIL + OWNER_PASSWORD are set and no owner exists yet, create the gym and its owner.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from './config.js';
import { query, transaction } from './db.js';
import { newQrToken } from './routes/gym.js';

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

/** Create missing tables in the configured database (hosted DBs already exist, so skip CREATE DATABASE / USE). */
export async function ensureSchema() {
  const sql = (await fs.readFile(schemaPath, 'utf8'))
    .split('\n')
    .filter((line) => !/^\s*(CREATE DATABASE|USE)\b/i.test(line))
    .join('\n');
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    await conn.query(sql);
    await addMissingColumns(conn);
  } finally {
    await conn.end();
  }
}

// Columns added after the first release. CREATE TABLE IF NOT EXISTS skips existing tables,
// so databases created earlier get these columns here. Order matters (batches exists before the FK).
const COLUMN_MIGRATIONS = [
  ['gyms', 'open_time', 'ALTER TABLE gyms ADD COLUMN open_time TIME NULL AFTER timezone'],
  ['gyms', 'close_time', 'ALTER TABLE gyms ADD COLUMN close_time TIME NULL AFTER open_time'],
  [
    'gyms',
    'closed_days',
    "ALTER TABLE gyms ADD COLUMN closed_days SET('mon','tue','wed','thu','fri','sat','sun') NOT NULL DEFAULT '' AFTER close_time",
  ],
  ['users', 'photo_key', 'ALTER TABLE users ADD COLUMN photo_key CHAR(32) NULL AFTER password_hash'],
  ['members', 'photo_key', 'ALTER TABLE members ADD COLUMN photo_key CHAR(32) NULL AFTER notes'],
  [
    'members',
    'batch_id',
    `ALTER TABLE members ADD COLUMN batch_id INT UNSIGNED NULL AFTER user_id,
       ADD KEY ix_members_batch (batch_id),
       ADD CONSTRAINT fk_members_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL`,
  ],
];

async function addMissingColumns(conn) {
  const [cols] = await conn.query(
    'SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()',
  );
  const have = new Set(cols.map((r) => `${r.t}.${r.c}`));
  for (const [table, column, sql] of COLUMN_MIGRATIONS) {
    if (have.has(`${table}.${column}`)) continue;
    await conn.query(sql);
    console.log(`Database updated: added ${table}.${column}`);
  }
}

/** Create a gym plus its owner account. Throws if the email is already used. */
export async function createGymWithOwner({ gym, name, email, password, phone = null }) {
  email = email.trim().toLowerCase();
  return transaction(async (conn) => {
    const [taken] = await query(
      'SELECT (SELECT COUNT(*) FROM users WHERE email = :email) + (SELECT COUNT(*) FROM members WHERE email = :email) AS n',
      { email },
      conn,
    );
    if (taken.n) throw new Error(`Email ${email} is already in use`);
    const g = await query('INSERT INTO gyms (name, qr_token) VALUES (:name, :token)', { name: gym, token: newQrToken() }, conn);
    const u = await query(
      `INSERT INTO users (gym_id, role, name, email, phone, password_hash)
       VALUES (:gymId, 'owner', :name, :email, :phone, :hash)`,
      { gymId: g.insertId, name, email, phone, hash: await bcrypt.hash(password, 10) },
      conn,
    );
    return { gymId: g.insertId, userId: u.insertId, email };
  });
}

/** Create the first owner from OWNER_* env vars, only when the database has no owner yet. */
export async function ensureFirstOwner() {
  const { OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, GYM_NAME } = process.env;
  if (!OWNER_EMAIL || !OWNER_PASSWORD) return;
  const isPlaceholder = (v) => !v || /[<>]/.test(v);
  if (isPlaceholder(OWNER_EMAIL) || isPlaceholder(OWNER_PASSWORD) || !OWNER_EMAIL.includes('@')) {
    console.error('OWNER_EMAIL / OWNER_PASSWORD still contain placeholders like <your email>; first owner not created.');
    return;
  }
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'");
  if (n) return;
  if (OWNER_PASSWORD.length < 8) {
    console.error('OWNER_PASSWORD must be at least 8 characters; first owner not created.');
    return;
  }
  const r = await createGymWithOwner({
    // Name placeholders just fall back to defaults; both can be changed later in the app.
    gym: isPlaceholder(GYM_NAME) ? 'My Gym' : GYM_NAME,
    name: isPlaceholder(OWNER_NAME) ? 'Owner' : OWNER_NAME,
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  console.log(`Created first gym #${r.gymId} with owner <${r.email}>. You can now remove OWNER_PASSWORD from the settings.`);
}
