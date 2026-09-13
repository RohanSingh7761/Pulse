import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const isSslNeeded = env.PGSSL || env.DATABASE_URL?.includes('sslmode=require') || env.DATABASE_URL?.includes('neon.tech');

export const pool = new Pool(env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL, ssl: isSslNeeded ? { rejectUnauthorized: false } : false }
  : {
      host: env.PGHOST,
      port: env.PGPORT,
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      ssl: isSslNeeded ? { rejectUnauthorized: false } : false
    });

export async function checkDatabase() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

export async function closeDatabase() {
  await pool.end();
}