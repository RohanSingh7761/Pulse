import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool(env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL, ssl: env.PGSSL ? { rejectUnauthorized: false } : false }
  : {
      host: env.PGHOST,
      port: env.PGPORT,
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      ssl: env.PGSSL ? { rejectUnauthorized: false } : false
    });

export async function checkDatabase() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

export async function closeDatabase() {
  await pool.end();
}