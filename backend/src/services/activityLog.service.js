import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logDirectory = path.join(backendRoot, 'logs');
const logFile = path.join(logDirectory, 'activities.jsonl');

export async function logActivity(type, details = {}) {
  await fs.mkdir(logDirectory, { recursive: true });
  const entry = { timestamp: new Date().toISOString(), type, ...details };
  await fs.appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}