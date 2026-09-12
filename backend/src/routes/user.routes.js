import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const profileInput = z.object({
  displayName: z.string().trim().max(100).optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(2000).optional(),
  headline: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  websiteUrl: z.string().url().optional().or(z.literal(''))
});

export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get('/me', async (request, response, next) => {
  try {
    const result = await pool.query(`SELECT u.id, u.wallet_address, u.username, u.display_name, u.bio, u.avatar_url,
      p.headline, p.category, p.location, p.website_url, p.verification_status
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`, [request.user.sub]);
    if (!result.rows[0]) return response.status(404).json({ error: 'user_not_found' });
    response.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

userRouter.patch('/me', async (request, response, next) => {
  const parsed = profileInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  const input = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(`UPDATE users SET username = COALESCE($1, username), display_name = COALESCE($2, display_name), bio = COALESCE($3, bio)
      WHERE id = $4 RETURNING id, wallet_address, username, display_name, bio`, [input.username, input.displayName, input.bio, request.user.sub]);
    await client.query(`INSERT INTO profiles (user_id, headline, category, location, website_url) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET headline = COALESCE(EXCLUDED.headline, profiles.headline), category = COALESCE(EXCLUDED.category, profiles.category),
      location = COALESCE(EXCLUDED.location, profiles.location), website_url = COALESCE(EXCLUDED.website_url, profiles.website_url)`, [request.user.sub, input.headline, input.category, input.location, input.websiteUrl]);
    await client.query('COMMIT');
    response.json({ user: user.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

userRouter.get('/me/holdings', async (request, response, next) => {
  try {
    const holdingsResult = await pool.query(
      `SELECT h.token_balance, h.average_entry_price, h.total_invested,
              m.id, m.name, m.symbol, m.current_price, m.circulating_supply,
              m.reserve_balance, m.holder_count, m.total_volume, m.token_id,
              m.contract_address, m.status
       FROM holdings h
       JOIN person_markets m ON m.id = h.market_id
       WHERE h.user_id = $1 AND h.token_balance > 0
       ORDER BY h.updated_at DESC`,
      [request.user.sub]
    );

    const statsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN settlement_amount ELSE 0 END), 0) AS total_bought,
         COALESCE(SUM(CASE WHEN trade_type = 'sell' THEN settlement_amount ELSE 0 END), 0) AS total_sold
       FROM trades
       WHERE user_id = $1 AND status = 'confirmed'`,
      [request.user.sub]
    );

    const summary = {
      totalBought: Number(statsResult.rows[0]?.total_bought || 0),
      totalSold: Number(statsResult.rows[0]?.total_sold || 0),
    };

    response.json({ holdings: holdingsResult.rows, summary });
  } catch (error) { next(error); }
});

userRouter.get('/me/trades', async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.market_id, t.trade_type, t.token_amount, t.settlement_amount,
              t.execution_price, t.status, t.transaction_id, t.created_at, t.confirmed_at,
              m.name AS market_name, m.symbol AS market_symbol, m.token_id, m.current_price
       FROM trades t
       JOIN person_markets m ON m.id = t.market_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [request.user.sub]
    );
    response.json({ trades: result.rows });
  } catch (error) { next(error); }
});