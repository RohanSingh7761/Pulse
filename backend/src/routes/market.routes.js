import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Interface, parseUnits } from 'ethers';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { quoteBuy, quoteSell } from '../services/bondingCurve.service.js';
import { registerMarketOnChain } from '../services/hedera.service.js';
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

export const marketRouter = Router();

marketRouter.get('/', async (request, response, next) => {
  try {
    const result = await pool.query(`SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply
      FROM person_markets m JOIN bonding_curves c ON c.market_id = m.id
      WHERE m.status = 'active' ORDER BY m.created_at DESC`);
    response.json({ markets: result.rows });
  } catch (error) { next(error); }
});

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
      await database.query(`UPDATE person_markets SET status = 'failed', creation_status = CASE WHEN token_id IS NULL THEN 'failed' ELSE 'confirmed' END,
        token_id = COALESCE($1, token_id), creation_transaction_id = COALESCE($2, creation_transaction_id) WHERE id = $3`, [token?.tokenId || null, token?.transactionId || null, marketId]);
      if (token) await logActivity('market.token_created.registration_failed', { userId: request.user.sub, marketId, tokenId: token.tokenId, tokenTransactionId: token.transactionId, error: error.message });
      if (token) return response.status(202).json({ partial: true, message: 'HTS token created, but market registration failed. Keep this token ID and resolve registration before retrying.', marketId, token });
    }
    next(error);
  } finally { database.release(); }
});

async function getMarket(request, response) {
  const result = await pool.query(`SELECT m.*, c.curve_type, c.base_price, c.slope, c.max_supply
    FROM person_markets m JOIN bonding_curves c ON c.market_id = m.id WHERE m.id = $1`, [request.params.id]);
  if (!result.rows[0]) { response.status(404).json({ error: 'market_not_found' }); return null; }
  return result.rows[0];
}

function curveInput(market, amount) {
  return { basePrice: market.base_price, slope: market.slope, supply: market.circulating_supply, amount, maxSupply: market.max_supply, reserveBalance: market.reserve_balance };
}

marketRouter.get('/:id', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (market) response.json({ market }); } catch (error) { next(error); }
});

marketRouter.get('/:id/quote/buy', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteBuy(curveInput(market, amountInput.parse(request.query).amount))); }
  catch (error) { next(error); }
});

marketRouter.get('/:id/quote/sell', async (request, response, next) => {
  try { const market = await getMarket(request, response); if (!market) return; response.json(quoteSell(curveInput(market, amountInput.parse(request.query).amount))); }
  catch (error) { next(error); }
});

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

marketRouter.post('/:id/trades/prepare', requireAuth, async (request, response, next) => {
  const parsed = prepareInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const market = await getMarket(request, response); if (!market) return;
    const { tradeType, tokenAmount, maxSlippageBps } = parsed.data;
    const quote = tradeType === 'buy' ? quoteBuy(curveInput(market, tokenAmount)) : quoteSell(curveInput(market, tokenAmount));
    const idempotencyKey = crypto.randomUUID();
    const trade = await pool.query(`INSERT INTO trades (user_id, market_id, trade_type, token_amount, settlement_amount, execution_price, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, idempotency_key, status`, [request.user.sub, market.id, tradeType, tokenAmount, quote.settlementAmount, quote.priceAfter, idempotencyKey]);
    const deadline = Math.floor(Date.now() / 1000) + Number(process.env.TRANSACTION_DEADLINE_SECONDS || 300);
    const decimals = Number(market.token_decimals || 8);
    const toUnits = (value) => parseUnits(String(value), decimals).toString();
    const amountUnits = toUnits(tokenAmount);
    const quoteUnits = toUnits(quote.settlementAmount);
    const maxCostUnits = (BigInt(quoteUnits) * BigInt(10000 + maxSlippageBps) / 10000n).toString();
    const feeUnits = BigInt(quoteUnits) * BigInt(process.env.DEFAULT_PROTOCOL_FEE_BPS || 100) / 10000n;
    const exactBuyValue = (BigInt(quoteUnits) + feeUnits).toString();
    const functionName = tradeType === 'buy' ? 'buy(uint256,uint256,uint256,uint256)' : 'sell(uint256,uint256,uint256,uint256)';
    const args = [market.contract_market_id, amountUnits, tradeType === 'buy' ? maxCostUnits : (BigInt(quoteUnits) * BigInt(10000 - maxSlippageBps) / 10000n).toString(), deadline];
    const data = new Interface([`function ${functionName}`]).encodeFunctionData(functionName, args);
    await logActivity('trade.prepared', { userId: request.user.sub, marketId: market.id, tradeId: trade.rows[0].id, tradeType, tokenAmount, settlementAmount: quote.settlementAmount, contractAddress: market.contract_address, contractMarketId: market.contract_market_id, deadline });
    response.status(201).json({ trade: trade.rows[0], market: { tokenId: market.token_id, tokenDecimals: decimals, contractAddress: market.contract_address, contractMarketId: market.contract_market_id }, quote, maxSlippageBps, deadline, transaction: { to: market.contract_address, data, value: tradeType === 'buy' ? `0x${BigInt(exactBuyValue).toString(16)}` : '0x0' }, execution: 'wallet_signature_required' });
  } catch (error) { next(error); }
});

marketRouter.post('/:id/trades/:tradeId/confirm', requireAuth, async (request, response, next) => {
  const input = z.object({ transactionId: z.string().trim().min(3), status: z.enum(['confirmed', 'failed']) }).safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: 'validation_error', details: input.error.issues });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trade = await client.query(`UPDATE trades SET status = $1, transaction_id = $2, confirmed_at = CASE WHEN $1 = 'confirmed' THEN now() ELSE NULL END
      WHERE id = $3 AND user_id = $4 RETURNING *`, [input.data.status, input.data.transactionId, request.params.tradeId, request.user.sub]);
    if (!trade.rows[0]) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'trade_not_found' }); }
    await client.query('COMMIT');
    await logActivity(`trade.${input.data.status}`, { userId: request.user.sub, tradeId: request.params.tradeId, transactionId: input.data.transactionId });
    response.json({ trade: trade.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});
