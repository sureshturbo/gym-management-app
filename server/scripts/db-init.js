// Creates the database and tables from database/schema.sql.
// Usage: npm run db:init            (safe to re-run; uses CREATE ... IF NOT EXISTS)
//        npm run db:init -- --reset (DROPS the database first — deletes all data)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../database/schema.sql');
const dbName = process.env.DB_NAME ?? 'gym_app';
const reset = process.argv.includes('--reset');

if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, digits and _');

let sql = await fs.readFile(schemaPath, 'utf8');
sql = sql.replaceAll('gym_app', dbName);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
});

try {
  if (reset) {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`Dropped database ${dbName}`);
  }
  await conn.query(sql);
  console.log(`Database "${dbName}" is ready.`);
} finally {
  await conn.end();
}
