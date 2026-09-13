import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Interface, parseUnits } from 'ethers';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { quoteBuy, quoteSell } from '../services/bondingCurve.service.js';
import { quoteTradeOnChain, registerMarketOnChain } from '../services/hedera.service.js';
import { logActivity } from '../services/activityLog.service.js';

const marketInput = z.object({
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,20}$/),
  curveType: z.literal('linear').default('linear'),
  basePrice: z.string().regex(/^\d+(\.\d+)?$/),
  slope: z.string().regex(/^\d+(\.\d+)?$/),
  maxSupply: z.string().regex(/^\d+(\.\d+)?$/)
});
const amountInput = z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/) });
const prepareInput = z.object({ tradeType: z.enum(['buy', 'sell']), tokenAmount: z.string().regex(/^\d+(\.\d+)?$/), maxSlippageBps: z.number().int().min(0).max(2000).default(100) });
const updateInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  update_type: z.enum(['general', 'milestone', 'announcement', 'warning']).default('general'),
});
const commentInput = z.object({ content: z.string().trim().min(1).max(1000) });
const reactionInput = z.object({ reaction: z.enum(['like', 'dislike']) });

export const marketRouter = Router();

/* ─── List markets ─────────────────────────────────────────────── */
marketRouter.get('/', async (request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply,
        CASE
          WHEN COALESCE(pt.price, m.current_price) > 0 THEN
            ROUND(((m.current_price - COALESCE(pt.price, m.current_price)) / COALESCE(pt.price, m.current_price) * 100), 2)
          ELSE 0
        END AS change
      FROM person_markets m
      JOIN bonding_curves c ON c.market_id = m.id
      LEFT JOIN LATERAL (
        SELECT price FROM price_ticks
        WHERE market_id = m.id AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC LIMIT 1
      ) pt ON true
      WHERE m.status = 'active'
      ORDER BY m.created_at DESC
    `);
    response.json({ markets: result.rows });
  } catch (error) { next(error); }
});

/* ─── Create market ────────────────────────────────────────────── */
marketRouter.post('/', requireAuth, async (request, response, next) => {
  const parsed = marketInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  const input = parsed.data;
  const database = await pool.connect();
  let marketId;
  let token;
  try {
    await database.query('BEGIN');
    const market = await database.query(`INSERT INTO person_markets (user_id, name, symbol, status, hedera_network, current_price)
      VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING id`, [request.user.sub, input.name, input.symbol, process.env.HEDERA_NETWORK || 'testnet', input.basePrice]);
    marketId = market.rows[0].id;
    await database.query(`INSERT INTO bonding_curves (market_id, curve_type, base_price, slope, max_supply)
      VALUES ($1, $2, $3, $4, $5)`, [marketId, input.curveType, input.basePrice, input.slope, input.maxSupply]);
    await database.query(`INSERT INTO price_ticks (market_id, price, supply, reserve_balance)
      VALUES ($1, $2, 0, 0)`, [marketId, input.basePrice]);
    await database.query('COMMIT');
    const chainMarket = await registerMarketOnChain({ ...input, decimals: Number(process.env.HEDERA_TOKEN_DECIMALS || 8) });
    token = { tokenId: chainMarket.tokenId, decimals: chainMarket.decimals, transactionId: chainMarket.transactionId, network: process.env.HEDERA_NETWORK || 'testnet' };
    await database.query(`UPDATE person_markets SET token_id = $1, creation_transaction_id = $2, token_decimals = $3, creation_status = 'confirmed' WHERE id = $4`, [token.tokenId, token.transactionId, token.decimals, marketId]);
    const updated = await database.query(`UPDATE person_markets SET status = 'active', creation_status = 'confirmed', token_id = $1,
      creation_transaction_id = $2, token_decimals = $3, contract_address = $4, contract_market_id = $5 WHERE id = $6 RETURNING *`, [token.tokenId, token.transactionId, token.decimals, chainMarket.contractAddress, chainMarket.contractMarketId, marketId]);
    await logActivity('market.created', { userId: request.user.sub, marketId, tokenId: token.tokenId, tokenTransactionId: token.transactionId, contractAddress: chainMarket.contractAddress, contractMarketId: chainMarket.contractMarketId, contractTransactionId: chainMarket.transactionId });
    response.status(201).json({ market: updated.rows[0], token, chainMarket });
  } catch (error) {
    if (marketId) {
      if (!token) {
        await database.query('DELETE FROM person_markets WHERE id = $1', [marketId]);
      } else {
        await database.query(`UPDATE person_markets SET status = 'failed', creation_status = 'confirmed',
          token_id = $1, creation_transaction_id = $2 WHERE id = $3`, [token.tokenId, token.transactionId, marketId]);
        await logActivity('market.token_created.registration_failed', { userId: request.user.sub, marketId, tokenId: token.tokenId, tokenTransactionId: token.transactionId, error: error.message });
        return response.status(202).json({ partial: true, message: 'HTS token created, but market registration failed. Keep this token ID and resolve registration before retrying.', marketId, token });
      }
    }
    next(error);
  } finally { database.release(); }
});

/* ─── Helpers ──────────────────────────────────────────────────── */
async function getMarket(request, response) {
  const result = await pool.query(`SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply
    FROM person_markets m JOIN bonding_curves c ON c.market_id = m.id WHERE m.id = $1`, [request.params.id]);
  if (!result.rows[0]) { response.status(404).json({ error: 'market_not_found' }); return null; }
  return result.rows[0];
}

function curveInput(market, amount) {
  return { basePrice: market.base_price, slope: market.slope, supply: market.circulating_supply, amount, maxSupply: market.max_supply, reserveBalance: market.reserve_balance };
}

/* ─── Get single market (with creator info) ────────────────────── */
marketRouter.get('/:id', async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply,
              u.username, u.display_name, u.bio, u.avatar_url,
              p.headline, p.category, p.location, p.website_url,
              p.twitter_url, p.github_url, p.linkedin_url,
              COALESCE(pt.price, m.current_price) AS baseline_price
       FROM person_markets m
       JOIN bonding_curves c ON c.market_id = m.id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN profiles p ON p.user_id = m.user_id
       LEFT JOIN LATERAL (
         SELECT price FROM price_ticks
         WHERE market_id = m.id AND created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY created_at ASC LIMIT 1
       ) pt ON true
       WHERE m.id = $1`,
      [request.params.id]
    );
    if (!result.rows[0]) return response.status(404).json({ error: 'market_not_found' });
    const row = result.rows[0];
    const baselinePrice = Number(row.baseline_price || row.current_price || 1);
    const currentPrice = Number(row.current_price || 0);
    const change = baselinePrice > 0 ? Number(((currentPrice - baselinePrice) / baselinePrice * 100).toFixed(2)) : 0;

    const market = {
      id: row.id, user_id: row.user_id, name: row.name, symbol: row.symbol, status: row.status,
      token_id: row.token_id, token_decimals: row.token_decimals,
      contract_address: row.contract_address, contract_market_id: row.contract_market_id,
      current_price: row.current_price, circulating_supply: row.circulating_supply,
      reserve_balance: row.reserve_balance, total_volume: row.total_volume, holder_count: row.holder_count,
      curve_type: row.curve_type, base_price: row.base_price, slope: row.slope, max_supply: row.max_supply,
      change,
      created_at: row.created_at, updated_at: row.updated_at,
    };
    const creator = {
      username: row.username, display_name: row.display_name, bio: row.bio, avatar_url: row.avatar_url,
      headline: row.headline, category: row.category, location: row.location,
      website_url: row.website_url, twitter_url: row.twitter_url,
      github_url: row.github_url, linkedin_url: row.linkedin_url,
    };
    response.json({ market, creator });
  } catch (error) { next(error); }
});

/* ─── Quotes ───────────────────────────────────────────────────── */
marketRouter.get('/:id/quote/buy', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteBuy(curveInput(market, amountInput.parse(request.query).amount))); }
  catch (error) { next(error); }
});

marketRouter.get('/:id/quote/sell', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteSell(curveInput(market, amountInput.parse(request.query).amount))); }
  catch (error) { next(error); }
});

/* ─── Chart / Trades / Holders ─────────────────────────────────── */
marketRouter.get('/:id/chart', async (request, response, next) => {
  try { const result = await pool.query('SELECT price, supply, reserve_balance, created_at FROM price_ticks WHERE market_id = $1 ORDER BY created_at ASC LIMIT 500', [request.params.id]); response.json({ ticks: result.rows }); }
  catch (error) { next(error); }
});

marketRouter.get('/:id/trades', async (request, response, next) => {
  try { const result = await pool.query(`SELECT t.id, t.trade_type, t.status, t.token_amount, t.settlement_amount, t.execution_price, t.transaction_id, t.created_at, u.username
    FROM trades t JOIN users u ON u.id = t.user_id WHERE t.market_id = $1 ORDER BY t.created_at DESC LIMIT 100`, [request.params.id]); response.json({ trades: result.rows }); }
  catch (error) { next(error); }
});

marketRouter.get('/:id/holders', async (request, response, next) => {
  try { const result = await pool.query(`SELECT h.token_balance, h.average_entry_price, u.username FROM holdings h JOIN users u ON u.id = h.user_id
    WHERE h.market_id = $1 AND h.token_balance > 0 ORDER BY h.token_balance DESC LIMIT 100`, [request.params.id]); response.json({ holders: result.rows }); }
  catch (error) { next(error); }
});

/* ─── Prepare trade ─────────────────────────────────────────────── */
marketRouter.post('/:id/trades/prepare', requireAuth, async (request, response, next) => {
  const parsed = prepareInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const market = await getMarket(request, response); if (!market) return;
    const { tradeType, tokenAmount, maxSlippageBps } = parsed.data;
    if (!market.contract_address || market.contract_market_id === null) {
      throw new Error('This market is not registered with the bonding-curve contract.')
    }
    const quote = tradeType === 'buy' ? quoteBuy(curveInput(market, tokenAmount)) : quoteSell(curveInput(market, tokenAmount));
    const deadline = Math.floor(Date.now() / 1000) + Number(process.env.TRANSACTION_DEADLINE_SECONDS || 300);
    const decimals = Number(market.token_decimals || 8);
    const amountUnits = parseUnits(String(tokenAmount), decimals).toString();
    const onChain = await quoteTradeOnChain({ marketId: market.contract_market_id, amountUnits, tradeType });
    const totalTinybar = onChain.totalTinybar;
    const maxCostUnits = tradeType === 'buy'
      ? (BigInt(totalTinybar) * BigInt(10000 + maxSlippageBps) / 10000n).toString()
      : (BigInt(totalTinybar) * BigInt(10000 - maxSlippageBps) / 10000n).toString();
    const functionName = tradeType === 'buy' ? 'buy(uint256,uint256,uint256,uint256)' : 'sell(uint256,uint256,uint256,uint256)';
    const args = [market.contract_market_id, amountUnits, maxCostUnits, deadline];
    const data = new Interface([`function ${functionName}`]).encodeFunctionData(functionName, args);
    const idempotencyKey = crypto.randomUUID();
    const trade = await pool.query(`INSERT INTO trades (user_id, market_id, trade_type, token_amount, settlement_amount, execution_price, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, idempotency_key, status`, [request.user.sub, market.id, tradeType, tokenAmount, quote.settlementAmount, quote.priceAfter, idempotencyKey]);
    await logActivity('trade.prepared', { userId: request.user.sub, marketId: market.id, tradeId: trade.rows[0].id, tradeType, tokenAmount, settlementAmount: quote.settlementAmount, contractAddress: market.contract_address, contractMarketId: market.contract_market_id, deadline });
    response.status(201).json({ trade: trade.rows[0], market: { tokenId: market.token_id, tokenDecimals: decimals, contractAddress: market.contract_address, contractMarketId: market.contract_market_id }, quote, maxSlippageBps, deadline, transaction: { to: market.contract_address, data, value: tradeType === 'buy' ? `0x${BigInt(onChain.transactionValueWei).toString(16)}` : '0x0', gas: '0x2DC6C0' }, execution: 'wallet_signature_required' });
  } catch (error) { next(error); }
});

/* ─── Confirm trade ─────────────────────────────────────────────── */
marketRouter.post('/:id/trades/:tradeId/confirm', requireAuth, async (request, response, next) => {
  const input = z.object({ transactionId: z.string().min(1), status: z.enum(['confirmed', 'failed']) }).safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: 'validation_error', details: input.error.issues });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tradeResult = await client.query(
      `SELECT t.*, m.circulating_supply, m.reserve_balance, m.current_price, m.holder_count,
              c.base_price, c.slope
       FROM trades t
       JOIN person_markets m ON m.id = t.market_id
       JOIN bonding_curves c ON c.market_id = t.market_id
       WHERE t.id = $1 AND t.market_id = $2 AND t.user_id = $3`,
      [request.params.tradeId, request.params.id, request.user.sub]
    );

    if (!tradeResult.rows[0]) return response.status(404).json({ error: 'trade_not_found' });
    const trade = tradeResult.rows[0];

    if (trade.status === 'confirmed') {
      await client.query('ROLLBACK');
      return response.json({ trade });
    }

    await client.query(
      `UPDATE trades SET status = $1, transaction_id = $2, confirmed_at = now() WHERE id = $3`,
      [input.data.status, input.data.transactionId, trade.id]
    );

    if (input.data.status === 'confirmed') {
      const isBuy = trade.trade_type === 'buy';
      const tokenDelta = isBuy ? Number(trade.token_amount) : -Number(trade.token_amount);
      const reserveDelta = isBuy ? Number(trade.settlement_amount) : -Number(trade.settlement_amount);

      const newSupply = Math.max(0, Number(trade.circulating_supply) + tokenDelta);
      const newReserve = Math.max(0, Number(trade.reserve_balance) + reserveDelta);
      const newPrice = Number(trade.base_price) + Number(trade.slope) * newSupply;
      const newVolume = Number(trade.settlement_amount);

      await client.query(
        `UPDATE person_markets
         SET current_price = $1, circulating_supply = $2, reserve_balance = $3,
             total_volume = total_volume + $4
         WHERE id = $5`,
        [newPrice, newSupply, newReserve, newVolume, trade.market_id]
      );

      if (isBuy) {
        await client.query(
          `INSERT INTO holdings (user_id, market_id, token_balance, average_entry_price, total_invested)
           VALUES ($1, $2, $3::numeric, $4::numeric / NULLIF($3::numeric, 0), $4::numeric)
           ON CONFLICT (user_id, market_id) DO UPDATE SET
             average_entry_price = (holdings.total_invested + EXCLUDED.total_invested) / NULLIF(holdings.token_balance + EXCLUDED.token_balance, 0),
             total_invested = holdings.total_invested + EXCLUDED.total_invested,
             token_balance = holdings.token_balance + EXCLUDED.token_balance,
             updated_at = now()`,
          [request.user.sub, trade.market_id, Number(trade.token_amount), Number(trade.settlement_amount)]
        );
      } else {
        await client.query(
          `UPDATE holdings SET
             total_invested = GREATEST(0, total_invested * (GREATEST(0, token_balance - $1::numeric) / NULLIF(token_balance, 0))),
             token_balance = GREATEST(0, token_balance - $1::numeric),
             updated_at = now()
           WHERE user_id = $2 AND market_id = $3`,
          [Number(trade.token_amount), request.user.sub, trade.market_id]
        );
      }

      const holdersResult = await client.query(
        `SELECT COUNT(*) FROM holdings WHERE market_id = $1 AND token_balance > 0`,
        [trade.market_id]
      );
      await client.query(
        `UPDATE person_markets SET holder_count = $1 WHERE id = $2`,
        [parseInt(holdersResult.rows[0].count, 10), trade.market_id]
      );

      await client.query(
        `INSERT INTO price_ticks (market_id, price, supply, reserve_balance)
         VALUES ($1, $2, $3, $4)`,
        [trade.market_id, newPrice, newSupply, newReserve]
      );
    }

    await client.query('COMMIT');
    await logActivity(`trade.${input.data.status}`, { userId: request.user.sub, tradeId: request.params.tradeId, transactionId: input.data.transactionId });
    response.json({ trade });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

/* ─── Creator Updates ───────────────────────────────────────────── */
marketRouter.get('/:id/updates', async (request, response, next) => {
  try {
    const limit = Math.min(Number(request.query.limit) || 20, 50);
    const result = await pool.query(
      `SELECT tu.*, u.username, u.display_name FROM token_updates tu
       JOIN users u ON u.id = tu.user_id
       WHERE tu.market_id = $1 ORDER BY tu.created_at DESC LIMIT $2`,
      [request.params.id, limit]
    );
    response.json({ updates: result.rows });
  } catch (error) { next(error); }
});

marketRouter.post('/:id/updates', requireAuth, async (request, response, next) => {
  const parsed = updateInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const market = await pool.query('SELECT user_id FROM person_markets WHERE id = $1', [request.params.id]);
    if (!market.rows[0]) return response.status(404).json({ error: 'market_not_found' });
    if (market.rows[0].user_id !== request.user.sub)
      return response.status(403).json({ error: 'forbidden', message: 'Only the market creator can post updates.' });
    const result = await pool.query(
      `INSERT INTO token_updates (market_id, user_id, title, body, update_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.params.id, request.user.sub, parsed.data.title, parsed.data.body, parsed.data.update_type]
    );
    await logActivity('market.update.posted', { userId: request.user.sub, marketId: request.params.id, updateId: result.rows[0].id });
    response.status(201).json({ update: result.rows[0] });
  } catch (error) { next(error); }
});

/* ─── Comments ─────────────────────────────────────────────────── */
marketRouter.get('/:id/comments', async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT mc.*, u.username, u.display_name, u.avatar_url
       FROM market_comments mc
       JOIN users u ON u.id = mc.user_id
       WHERE mc.market_id = $1 ORDER BY mc.created_at DESC LIMIT 100`,
      [request.params.id]
    );
    response.json({ comments: result.rows });
  } catch (error) { next(error); }
});

marketRouter.post('/:id/comments', requireAuth, async (request, response, next) => {
  const parsed = commentInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const market = await pool.query('SELECT id FROM person_markets WHERE id = $1', [request.params.id]);
    if (!market.rows[0]) return response.status(404).json({ error: 'market_not_found' });
    const result = await pool.query(
      `INSERT INTO market_comments (market_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [request.params.id, request.user.sub, parsed.data.content]
    );
    const userRes = await pool.query('SELECT username, display_name, avatar_url FROM users WHERE id = $1', [request.user.sub]);
    const comment = { ...result.rows[0], ...userRes.rows[0] };
    await logActivity('market.comment.posted', { userId: request.user.sub, marketId: request.params.id, commentId: comment.id });
    response.status(201).json({ comment });
  } catch (error) { next(error); }
});

marketRouter.delete('/:id/comments/:commentId', requireAuth, async (request, response, next) => {
  try {
    const comment = await pool.query('SELECT user_id FROM market_comments WHERE id = $1 AND market_id = $2', [request.params.commentId, request.params.id]);
    if (!comment.rows[0]) return response.status(404).json({ error: 'comment_not_found' });
    if (comment.rows[0].user_id !== request.user.sub) return response.status(403).json({ error: 'forbidden' });
    await pool.query('DELETE FROM market_comments WHERE id = $1', [request.params.commentId]);
    response.json({ success: true });
  } catch (error) { next(error); }
});

/* ─── Reactions (Likes / Dislikes) ────────────────────────────── */
marketRouter.get('/:id/reactions', async (request, response, next) => {
  try {
    const counts = await pool.query(
      `SELECT
         COUNT(CASE WHEN reaction_type = 'like' THEN 1 END)::int AS likes,
         COUNT(CASE WHEN reaction_type = 'dislike' THEN 1 END)::int AS dislikes
       FROM market_reactions WHERE market_id = $1`,
      [request.params.id]
    );
    let userReaction = null;
    const userId = request.query.userId;
    if (userId) {
      const userRec = await pool.query('SELECT reaction_type FROM market_reactions WHERE market_id = $1 AND user_id = $2', [request.params.id, userId]);
      if (userRec.rows[0]) userReaction = userRec.rows[0].reaction_type;
    }
    response.json({
      likes: counts.rows[0]?.likes || 0,
      dislikes: counts.rows[0]?.dislikes || 0,
      userReaction,
    });
  } catch (error) { next(error); }
});

marketRouter.post('/:id/reactions', requireAuth, async (request, response, next) => {
  const parsed = reactionInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const { reaction } = parsed.data;
    const userId = request.user.sub;
    const marketId = request.params.id;

    const existing = await pool.query('SELECT reaction_type FROM market_reactions WHERE market_id = $1 AND user_id = $2', [marketId, userId]);
    if (existing.rows[0]) {
      if (existing.rows[0].reaction_type === reaction) {
        await pool.query('DELETE FROM market_reactions WHERE market_id = $1 AND user_id = $2', [marketId, userId]);
      } else {
        await pool.query('UPDATE market_reactions SET reaction_type = $1 WHERE market_id = $2 AND user_id = $3', [reaction, marketId, userId]);
      }
    } else {
      await pool.query('INSERT INTO market_reactions (market_id, user_id, reaction_type) VALUES ($1, $2, $3)', [marketId, userId, reaction]);
    }

    const counts = await pool.query(
      `SELECT
         COUNT(CASE WHEN reaction_type = 'like' THEN 1 END)::int AS likes,
         COUNT(CASE WHEN reaction_type = 'dislike' THEN 1 END)::int AS dislikes
       FROM market_reactions WHERE market_id = $1`,
      [marketId]
    );

    const userRec = await pool.query('SELECT reaction_type FROM market_reactions WHERE market_id = $1 AND user_id = $2', [marketId, userId]);
    const currentUserReaction = userRec.rows[0] ? userRec.rows[0].reaction_type : null;

    response.json({
      likes: counts.rows[0]?.likes || 0,
      dislikes: counts.rows[0]?.dislikes || 0,
      userReaction: currentUserReaction,
    });
  } catch (error) { next(error); }
});
