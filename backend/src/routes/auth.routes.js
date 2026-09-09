import crypto from 'node:crypto';
import { Router } from 'express';
import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logActivity } from '../services/activityLog.service.js';

const wallet = z.string().trim().refine((value) => /^0x[0-9a-fA-F]{40}$/.test(value), 'Invalid EVM wallet address');
const challengeInput = z.object({ walletAddress: wallet, username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(), displayName: z.string().trim().min(1).max(100).optional(), bio: z.string().trim().max(2000).optional().default('') });
const verifyInput = z.object({ walletAddress: wallet, signature: z.string().trim().min(20) });

export const authRouter = Router();

authRouter.post('/wallet/challenge', async (request, response, next) => {
  const parsed = challengeInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const { walletAddress, displayName, bio } = parsed.data;
    const existing = await pool.query('SELECT username, display_name, bio FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]);
    if (!existing.rows[0] && (!parsed.data.username || !displayName)) return response.status(400).json({ error: 'profile_details_required', message: 'Create-account authentication requires username and display name.' });
    const username = parsed.data.username || existing.rows[0].username;
    const profileName = displayName || existing.rows[0]?.display_name || username;
    const profileBio = parsed.data.bio || existing.rows[0]?.bio || '';
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + env.AUTH_CHALLENGE_TTL_SECONDS * 1000);
    const message = `Pulse authentication\nWallet: ${walletAddress}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
    await pool.query(`INSERT INTO users (wallet_address, username, display_name, bio, auth_nonce, auth_nonce_expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (wallet_address) DO UPDATE SET auth_nonce = EXCLUDED.auth_nonce, auth_nonce_expires_at = EXCLUDED.auth_nonce_expires_at`, [walletAddress.toLowerCase(), username, null, null, JSON.stringify({ nonce, message, displayName: profileName, bio: profileBio }), expiresAt]);
    await logActivity('auth.challenge.created', { walletAddress: walletAddress.toLowerCase(), username, displayName: profileName });
    response.json({ message, expiresAt });
  } catch (error) { next(error); }
});

authRouter.post('/wallet/verify', async (request, response, next) => {
  const parsed = verifyInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'validation_error', details: parsed.error.issues });
  try {
    const { walletAddress, signature } = parsed.data;
    const normalizedAddress = walletAddress.toLowerCase();
    const result = await pool.query('SELECT id, username, auth_nonce, auth_nonce_expires_at FROM users WHERE wallet_address = $1', [normalizedAddress]);
    const user = result.rows[0];
    if (!user || !user.auth_nonce || new Date(user.auth_nonce_expires_at) <= new Date()) return response.status(401).json({ error: 'challenge_expired' });
    const challenge = JSON.parse(user.auth_nonce);
    const recoveredAddress = verifyMessage(challenge.message, signature).toLowerCase();
    if (recoveredAddress !== normalizedAddress) return response.status(401).json({ error: 'invalid_signature' });
    await pool.query('UPDATE users SET display_name = $1, bio = $2, auth_nonce = NULL, auth_nonce_expires_at = NULL WHERE id = $3', [challenge.displayName, challenge.bio, user.id]);
    const token = jwt.sign({ sub: user.id, walletAddress: normalizedAddress, username: user.username }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: env.AUTH_ISSUER });
    await logActivity('auth.login', { userId: user.id, walletAddress: normalizedAddress });
    response.json({ token, user: { id: user.id, username: user.username, walletAddress: normalizedAddress } });
  } catch (error) { response.status(401).json({ error: 'invalid_signature' }); }
});

authRouter.post('/logout', (request, response) => response.status(204).send());
