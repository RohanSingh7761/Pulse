import crypto from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PublicKey } from '@hashgraph/sdk';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';

const challengeInput = z.object({
  walletAddress: z.string().trim().min(3).max(255),
  publicKey: z.string().trim().min(10).max(255),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/)
});
const verifyInput = challengeInput.extend({ signature: z.string().trim().min(20) });

export const authRouter = Router();

authRouter.post('/wallet/challenge', async (request, response, next) => {
  const parsed = challengeInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const { walletAddress, publicKey, username } = parsed.data;
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + env.AUTH_CHALLENGE_TTL_SECONDS * 1000);
    const message = `Pulse authentication\nWallet: ${walletAddress}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
    await pool.query(`INSERT INTO users (wallet_address, username, auth_nonce, auth_nonce_expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (wallet_address) DO UPDATE SET auth_nonce = EXCLUDED.auth_nonce, auth_nonce_expires_at = EXCLUDED.auth_nonce_expires_at,
      username = CASE WHEN users.username = EXCLUDED.username THEN users.username ELSE users.username END`, [walletAddress, username, JSON.stringify({ nonce, publicKey, message }), expiresAt]);
    response.json({ message, expiresAt });
  } catch (error) { next(error); }
});

authRouter.post('/wallet/verify', async (request, response, next) => {
  const parsed = verifyInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const { walletAddress, publicKey, signature } = parsed.data;
    const result = await pool.query('SELECT id, username, auth_nonce, auth_nonce_expires_at FROM users WHERE wallet_address = $1', [walletAddress]);
    const user = result.rows[0];
    if (!user || !user.auth_nonce || new Date(user.auth_nonce_expires_at) <= new Date()) return response.status(401).json({ error: 'challenge_expired' });
    const challenge = JSON.parse(user.auth_nonce);
    if (challenge.publicKey !== publicKey) return response.status(401).json({ error: 'public_key_mismatch' });
    const valid = PublicKey.fromString(publicKey).verify(Buffer.from(challenge.message), Buffer.from(signature, 'base64'));
    if (!valid) return response.status(401).json({ error: 'invalid_signature' });
    await pool.query('UPDATE users SET auth_nonce = NULL, auth_nonce_expires_at = NULL WHERE id = $1', [user.id]);
    const token = jwt.sign({ sub: user.id, walletAddress, username: user.username }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: env.AUTH_ISSUER });
    response.json({ token, user: { id: user.id, username: user.username, walletAddress } });
  } catch (error) { next(error); }
});

authRouter.post('/logout', (request, response) => response.status(204).send());