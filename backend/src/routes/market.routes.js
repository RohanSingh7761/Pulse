import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { quoteBuy, quoteSell } from '../services/bondingCurve.service.js';
import { createMarketToken } from '../services/hedera.service.js';

const marketInput = z.object({
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,20}$/),
  curveType: z.literal('linear').default('linear'),
  basePrice: z.string().regex(/^\d+(\.\d+)?$/),
  slope: z.string().regex(/^\d+(\.\d+)?$/),
  maxSupply: z.string().regex(/^\d+(\.\d+)?$/)
});

const quoteInput = z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/) });

export const marketRouter = Router();

marketRouter.get('/', async (request, response, next) => {
  try {
    const result = await pool.query(`SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply
      FROM person_markets m JOIN bonding_curves c ON c.market_id = m.id
      WHERE m.status = 'active' ORDER BY m.created_at DESC`);
    response.json({ markets: result.rows });
  } catch (error) { next(error); }
});

marketRouter.post('/', async (request, response, next) => {
  const parsed = marketInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  const input = parsed.data;
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const user = await database.query('SELECT id FROM users ORDER BY created_at LIMIT 1');
    if (!user.rows[0]) return response.status(400).json({ error: 'owner_required', message: 'Create a user before creating a market' });
    const market = await database.query(`INSERT INTO person_markets (user_id, name, symbol, status, hedera_network)
      VALUES ($1, $2, $3, 'pending', $4) RETURNING id`, [user.rows[0].id, input.name, input.symbol, process.env.HEDERA_NETWORK || 'testnet']);
    await database.query(`INSERT INTO bonding_curves (market_id, curve_type, base_price, slope, max_supply)
      VALUES ($1, $2, $3, $4, $5)`, [market.rows[0].id, input.curveType, input.basePrice, input.slope, input.maxSupply]);
    const token = await createMarketToken({ name: input.name, symbol: input.symbol });
    const updated = await database.query(`UPDATE person_markets SET status = 'active', creation_status = 'confirmed', token_id = $1,
      creation_transaction_id = $2, token_decimals = $3 WHERE id = $4 RETURNING *`, [token.tokenId, token.transactionId, token.decimals || 8, market.rows[0].id]);
    await database.query('COMMIT');
    response.status(201).json({ market: updated.rows[0], token });
  } catch (error) {
    await database.query('ROLLBACK');
    next(error);
  } finally { database.release(); }
});

async function getMarket(request, response) {
  const result = await pool.query(`SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply
    FROM person_markets m JOIN bonding_curves c ON c.market_id = m.id WHERE m.id = $1`, [request.params.id]);
  if (!result.rows[0]) { response.status(404).json({ error: 'market_not_found' }); return null; }
  return result.rows[0];
}

marketRouter.get('/:id/quote/buy', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteBuy({ ...market, amount: quoteInput.parse(request.query).amount })); }
  catch (error) { next(error); }
});

marketRouter.get('/:id/quote/sell', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteSell({ ...market, amount: quoteInput.parse(request.query).amount, reserveBalance: market.reserve_balance })); }
  catch (error) { next(error); }
});