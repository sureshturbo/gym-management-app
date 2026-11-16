import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  namedPlaceholders: true, // write :name in SQL and pass an object
  dateStrings: true, // DATE -> 'YYYY-MM-DD', DATETIME -> 'YYYY-MM-DD HH:mm:ss' (UTC), no JS Date shifting
  decimalNumbers: true, // DECIMAL -> number
  timezone: 'Z',
});

// Keep every session in UTC so CURRENT_TIMESTAMP / DATETIME columns are UTC.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

/** Run a query on the pool (or on a transaction connection) and return the rows. */
export async function query(sql, params = {}, conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/** Run fn(conn) inside a transaction; commits on success, rolls back on error. */
export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
