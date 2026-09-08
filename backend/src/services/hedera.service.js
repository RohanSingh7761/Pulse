import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType
} from '@hashgraph/sdk';
import { env } from '../config/env.js';

function getClient() {
  if (!env.HEDERA_OPERATOR_ID || !env.HEDERA_OPERATOR_KEY) return null;
  const client = env.HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromString(env.HEDERA_OPERATOR_KEY));
  return client;
}

export function hederaStatus() {
  return {
    network: env.HEDERA_NETWORK,
    configured: Boolean(env.HEDERA_OPERATOR_ID && env.HEDERA_OPERATOR_KEY),
    factoryConfigured: Boolean(env.PULSE_MARKET_FACTORY_ADDRESS)
  };
}

export async function createMarketToken({ name, symbol, decimals = env.HEDERA_TOKEN_DECIMALS }) {
  const client = getClient();
  if (!client) throw new Error('Hedera operator credentials are not configured');
  try {
    const treasuryKey = PrivateKey.fromString(env.HEDERA_OPERATOR_KEY);
    const transaction = await new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(decimals)
      .setInitialSupply(env.HEDERA_DEFAULT_TOKEN_SUPPLY)
      .setTreasuryAccountId(env.HEDERA_OPERATOR_ID)
      .setAdminKey(treasuryKey)
      .setSupplyKey(treasuryKey)
      .execute(client);
    const receipt = await transaction.getReceipt(client);
    return {
      tokenId: receipt.tokenId.toString(),
      transactionId: transaction.transactionId.toString(),
      network: env.HEDERA_NETWORK
    };
  } finally {
    client.close();
  }
}