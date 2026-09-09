import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function requireAuth(request, response, next) {
  const header = request.get('authorization');
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ error: 'authentication_required' });
  try {
    request.user = jwt.verify(header.slice(7), env.JWT_SECRET, { issuer: env.AUTH_ISSUER });
    next();
  } catch {
    response.status(401).json({ error: 'invalid_or_expired_token' });
  }
}