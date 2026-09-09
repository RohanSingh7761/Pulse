import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { closeDatabase } from './db/pool.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { marketRouter } from './routes/market.routes.js';
import { userRouter } from './routes/user.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(healthRouter);
app.use('/v1/auth', authRouter);
app.use('/v1/users', userRouter);
app.use('/v1/markets', marketRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => console.log(`Pulse API listening on port ${env.PORT}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => { await closeDatabase(); process.exit(0); });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };