import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const optionalString = z.string().trim().min(1).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: optionalString,
  PGSSL: z.enum(['true', 'false']).default('false'),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
  PGDATABASE: z.string().default('pulse'),
  PGUSER: z.string().default('postgres'),
  PGPASSWORD: z.string().default('postgres'),
  HEDERA_NETWORK: z.enum(['testnet', 'mainnet', 'previewnet', 'local']).default('testnet'),
  HEDERA_RPC_URL: z.string().url().default('https://testnet.hashio.io/api'),
  HEDERA_OPERATOR_ID: optionalString,
  HEDERA_OPERATOR_KEY: optionalString,
  HEDERA_TOKEN_DECIMALS: z.coerce.number().int().min(0).max(18).default(8),
  HEDERA_DEFAULT_TOKEN_SUPPLY: z.coerce.number().int().min(0).default(0),
  PULSE_MARKET_FACTORY_ADDRESS: optionalString,
  PULSE_BONDING_CURVE_ADDRESS: optionalString,
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-me-123456'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  AUTH_ISSUER: z.string().default('pulse-api'),
  DEFAULT_PROTOCOL_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(100),
  DEFAULT_MAX_SUPPLY: z.string().default('1000000'),
  TRANSACTION_DEADLINE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300)
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.JWT_SECRET === 'development-only-secret-change-me-123456') {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET must be changed in production' });
  }
  if (value.NODE_ENV === 'production' && value.HEDERA_NETWORK !== 'local' && (!value.HEDERA_OPERATOR_ID || !value.HEDERA_OPERATOR_KEY)) {
    context.addIssue({ code: 'custom', path: ['HEDERA_OPERATOR_ID'], message: 'Hedera operator credentials are required outside local mode' });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  PGSSL: parsed.data.PGSSL === 'true'
};