import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType
} from '@hashgraph/sdk';
import { Contract, Interface, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { env } from '../config/env.js';

function getOperatorKey() {
  const value = env.HEDERA_OPERATOR_KEY;
  if (!value) throw new Error('Hedera operator key is not configured');
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return PrivateKey.fromStringECDSA(value);
  if (/^[0-9a-fA-F]{64}$/.test(value)) return PrivateKey.fromStringECDSA(value);
  return PrivateKey.fromString(value);
}

function getClient() {
  if (!env.HEDERA_OPERATOR_ID || !env.HEDERA_OPERATOR_KEY) return null;
  const client = env.HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(env.HEDERA_OPERATOR_ID, getOperatorKey());
  return client;
}

export function hederaStatus() {
  return {
    network: env.HEDERA_NETWORK,
    configured: Boolean(env.HEDERA_OPERATOR_ID && env.HEDERA_OPERATOR_KEY),
    factoryConfigured: Boolean(env.PULSE_MARKET_FACTORY_ADDRESS),
    tokenCreationFeeHbar: env.HEDERA_TOKEN_CREATION_FEE_HBAR
  };
}

export async function createMarketToken({ name, symbol, maxSupply, decimals = env.HEDERA_TOKEN_DECIMALS }) {
  const client = getClient();
  if (!client) throw new Error('Hedera operator credentials are not configured');
  try {
    const treasuryKey = getOperatorKey();
    const transaction = await new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(decimals)
      .setInitialSupply(maxSupply ? parseUnits(maxSupply, decimals) : env.HEDERA_DEFAULT_TOKEN_SUPPLY)
      .setTreasuryAccountId(env.HEDERA_OPERATOR_ID)
      .setAdminKey(treasuryKey)
      .setSupplyKey(treasuryKey)
      .execute(client);
    const receipt = await transaction.getReceipt(client);
    return {
      tokenId: receipt.tokenId.toString(),
      transactionId: transaction.transactionId.toString(),
      decimals,
      network: env.HEDERA_NETWORK
    };
  } finally {
    client.close();
  }
}

const factoryAbi = [
  'function createMarket(string name,string symbol,uint256 basePrice,uint256 slope,uint256 maxSupply,uint32 decimals) external payable returns (uint256 marketId)',
  'event MarketRegistered(uint256 indexed marketId, address indexed creator, address token)'
];

const protocolAbi = [
  'event MarketCreated(uint256 indexed marketId, address indexed token, uint256 basePrice, uint256 slope, uint256 maxSupply)'
];

function evmAddressToHederaTokenId(address) {
  const hex = String(address).toLowerCase().replace(/^0x/, '').padStart(40, '0');
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error(`Invalid HTS token address: ${address}`);
  const shard = BigInt(`0x${hex.slice(0, 8)}`);
  const realm = BigInt(`0x${hex.slice(8, 24)}`);
  const num = BigInt(`0x${hex.slice(24)}`);
  return `${shard}.${realm}.${num}`;
}

function parseCreatedMarket(receipt) {
  const factoryInterface = new Interface(factoryAbi);
  const protocolInterface = new Interface(protocolAbi);
  for (const log of receipt.logs || []) {
    try {
      const parsed = factoryInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'MarketRegistered' && parsed.args.token && parsed.args.token !== '0x0000000000000000000000000000000000000000') {
        return { marketId: parsed.args.marketId.toString(), tokenAddress: parsed.args.token };
      }
    } catch { /* not a factory event */ }
    try {
      const parsed = protocolInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'MarketCreated' && parsed.args.token) {
        return { marketId: parsed.args.marketId.toString(), tokenAddress: parsed.args.token };
      }
    } catch { /* not a protocol event */ }
  }
  return { marketId: null, tokenAddress: null };
}

async function resolveCreatedToken(tokenAddress, decimals) {
  const tokenId = evmAddressToHederaTokenId(tokenAddress);
  const delaysMs = [0, 1500, 3000, 5000];
  for (const delayMs of delaysMs) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const tokenResponse = await fetch(`${env.HEDERA_MIRROR_NODE_URL}/api/v1/tokens/${tokenId}`);
    if (tokenResponse.ok) {
      const token = await tokenResponse.json();
      return { tokenId: token.token_id || tokenId, decimals: Number(token.decimals ?? decimals) };
    }
    if (tokenResponse.status !== 404) continue;
  }
  return { tokenId, decimals };
}

export async function registerMarketOnChain({ name, symbol, basePrice, slope, maxSupply, decimals = env.HEDERA_TOKEN_DECIMALS }) {
  if (!env.PULSE_MARKET_FACTORY_ADDRESS || !env.HEDERA_OPERATOR_KEY) throw new Error('Hedera factory and operator credentials are required');
  const provider = new JsonRpcProvider(env.HEDERA_RPC_URL);
  const signer = new Wallet(env.HEDERA_OPERATOR_KEY, provider);
  const factory = new Contract(env.PULSE_MARKET_FACTORY_ADDRESS, factoryAbi, signer);
  const transaction = await factory.createMarket(
    name,
    symbol,
    parseUnits(basePrice, decimals),
    parseUnits(slope, decimals),
    parseUnits(maxSupply, decimals),
    decimals,
    { value: parseUnits(env.HEDERA_TOKEN_CREATION_FEE_HBAR, 8) * 10n ** 10n }
  );
  const receipt = await transaction.wait();
  const { marketId, tokenAddress } = parseCreatedMarket(receipt);
  if (!tokenAddress) throw new Error('Market registration did not emit an HTS token address');
  const token = await resolveCreatedToken(tokenAddress, decimals);
  return { contractAddress: env.PULSE_BONDING_CURVE_ADDRESS, factoryAddress: env.PULSE_MARKET_FACTORY_ADDRESS, contractMarketId: marketId, transactionId: transaction.hash, tokenId: token.tokenId, tokenAddress, decimals: token.decimals };
}