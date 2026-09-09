import {
  Client,
  ContractId,
  PrivateKey,
  TokenId,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenType,
  TransferTransaction
} from '@hashgraph/sdk';
import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
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
    factoryConfigured: Boolean(env.PULSE_MARKET_FACTORY_ADDRESS)
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

async function associateAndFundProtocol(tokenId, amount, decimals) {
  if (!env.PULSE_BONDING_CURVE_ADDRESS) throw new Error('Bonding curve contract address is not configured');
  const client = getClient();
  const protocol = ContractId.fromEvmAddress(0, 0, env.PULSE_BONDING_CURVE_ADDRESS);
  try {
    const association = await new TokenAssociateTransaction()
      .setAccountId(protocol)
      .setTokenIds([TokenId.fromString(tokenId)])
      .execute(client);
    await association.getReceipt(client);
    const transfer = await new TransferTransaction()
      .addTokenTransferWithDecimals(TokenId.fromString(tokenId), env.HEDERA_OPERATOR_ID, -BigInt(amount), decimals)
      .addTokenTransferWithDecimals(TokenId.fromString(tokenId), protocol, BigInt(amount), decimals)
      .execute(client);
    await transfer.getReceipt(client);
    return { associationTransactionId: association.transactionId.toString(), fundingTransactionId: transfer.transactionId.toString() };
  } finally { client.close(); }
}

const factoryAbi = [
  'function createMarket(address token, uint256 basePrice, uint256 slope, uint256 maxSupply) external returns (uint256)',
  'event MarketRegistered(uint256 indexed marketId, address indexed creator, address token)'
];

export async function registerMarketOnChain({ tokenId, basePrice, slope, maxSupply, decimals = env.HEDERA_TOKEN_DECIMALS }) {
  if (!env.PULSE_MARKET_FACTORY_ADDRESS || !env.HEDERA_OPERATOR_KEY) throw new Error('Hedera factory and operator credentials are required');
  const provider = new JsonRpcProvider(env.HEDERA_RPC_URL);
  const signer = new Wallet(env.HEDERA_OPERATOR_KEY, provider);
  const factory = new Contract(env.PULSE_MARKET_FACTORY_ADDRESS, factoryAbi, signer);
  const tokenAddress = `0x${TokenId.fromString(tokenId).toSolidityAddress()}`;
  const transaction = await factory.createMarket(
    tokenAddress,
    parseUnits(basePrice, decimals),
    parseUnits(slope, decimals),
    parseUnits(maxSupply, decimals)
  );
  const receipt = await transaction.wait();
  const marketCreatedTopic = factory.interface.getEvent('MarketRegistered').topicHash;
  const event = receipt.logs.find((log) => log.topics?.[0] === marketCreatedTopic);
  const marketId = event ? BigInt(event.topics[1]).toString() : null;
  const funding = await associateAndFundProtocol(tokenId, maxSupply, decimals);
  return { contractAddress: env.PULSE_BONDING_CURVE_ADDRESS, factoryAddress: env.PULSE_MARKET_FACTORY_ADDRESS, contractMarketId: marketId, transactionId: transaction.hash, ...funding };
}