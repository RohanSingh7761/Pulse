import { Router } from 'express';
import { checkDatabase } from '../db/pool.js';
import { hederaStatus } from '../services/hedera.service.js';

export const healthRouter = Router();

healthRouter.get('/health', async (request, response, next) => {
  try {
    response.json({ status: 'ok', database: await checkDatabase(), hedera: hederaStatus() });
  } catch (error) {
    next(error);
  }
});

healthRouter.get('/ready', async (request, response, next) => {
  try {
    const database = await checkDatabase();
    response.status(database ? 200 : 503).json({ ready: database, database, hedera: hederaStatus() });
  } catch (error) {
    next(error);
  }
});