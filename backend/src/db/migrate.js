import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closeDatabase } from './pool.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(directory, '../../sql/schema.sql'), 'utf8');
await pool.query(schema);
await closeDatabase();
console.log('Database schema applied.');