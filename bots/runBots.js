import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ethers } from '../backend/node_modules/ethers/dist/ethers.js'

// Load environment variables from backend/.env natively
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../backend/.env')

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

const API_URL = process.env.BOT_API_URL || 'http://localhost:4000'
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api'
const PRIVATE_KEY = process.env.BOT_PRIVATE_KEY?.trim()
const WALLET_ADDRESS = process.env.BOT_WALLET_ADDRESS?.trim()
const INTERVAL_MS = (Number(process.env.BOT_INTERVAL_SECONDS) || 15) * 1000

// ANSI Terminal Colors
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
}

console.log(`${C.bright}${C.cyan}====================================================${C.reset}`)
console.log(`${C.bright}${C.cyan}  🤖 PULSE AUTOMATED TRADING BOT SYSTEM (LIVE DEMO)  ${C.reset}`)
console.log(`${C.bright}${C.cyan}====================================================${C.reset}\n`)

if (!PRIVATE_KEY || !WALLET_ADDRESS) {
  console.log(`${C.red}❌ MISSING BOT WALLET CREDENTIALS IN backend/.env!${C.reset}`)
  console.log(`${C.yellow}Please add the following variables to backend/.env:${C.reset}\n`)
  console.log(`  BOT_PRIVATE_KEY=0x<your_hex_private_key>`)
  console.log(`  BOT_WALLET_ADDRESS=0x<your_evm_wallet_address>`)
  console.log(`  BOT_HEDERA_ACCOUNT_ID=0.0.<your_account_id>\n`)
  process.exit(1)
}

const provider = new ethers.JsonRpcProvider(RPC_URL)
const botWallet = new ethers.Wallet(PRIVATE_KEY, provider)

let authToken = ''
let botUserId = ''

async function authenticate() {
  console.log(`${C.dim}Authenticating bot wallet ${WALLET_ADDRESS}...${C.reset}`)
  try {
    // 1. Get Challenge Nonce
    const challengeRes = await fetch(`${API_URL}/v1/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        username: 'pulse_trading_bot',
        displayName: 'Pulse Liquidity Bot 🤖',
        bio: 'Automated high-conviction liquidity bot on Pulse.',
      }),
    })
    const challenge = await challengeRes.json()
    if (!challengeRes.ok) throw new Error(challenge.message || challenge.error || 'Challenge failed')

    // 2. Sign Message
    const signature = await botWallet.signMessage(challenge.message)

    // 3. Verify Signature & Get Token
    const verifyRes = await fetch(`${API_URL}/v1/auth/wallet/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: WALLET_ADDRESS, signature }),
    })
    const verify = await verifyRes.json()
    if (!verifyRes.ok) throw new Error(verify.message || verify.error || 'Verification failed')

    authToken = verify.token
    botUserId = verify.user.id
    console.log(`${C.green}✓ Bot authenticated successfully! Token active.${C.reset}\n`)
  } catch (err) {
    console.log(`${C.red}Authentication failed: ${err.message}${C.reset}`)
    console.log(`${C.yellow}👉 Make sure your local backend server is running via "npm run dev" on ${API_URL}!${C.reset}\n`)
    process.exit(1)
  }
}

function tokenIdToAddress(tokenId) {
  if (!tokenId) return ethers.ZeroAddress
  if (tokenId.startsWith('0x')) return tokenId
  const parts = tokenId.split('.')
  if (parts.length === 3) {
    const num = BigInt(parts[2])
    return `0x${num.toString(16).padStart(40, '0')}`
  }
  return tokenId
}

const associatedTokens = new Set()

async function ensureTokenAssociated(tokenId) {
  if (!tokenId || associatedTokens.has(tokenId)) return
  try {
    const tokenAddress = tokenIdToAddress(tokenId)
    const htsPrecompile = '0x0000000000000000000000000000000000000167'
    const htsAbi = ['function associateToken(address account, address token) external returns (int64 responseCode)']
    const contract = new ethers.Contract(htsPrecompile, htsAbi, botWallet)
    const tx = await contract.associateToken(WALLET_ADDRESS, tokenAddress, { gasLimit: 1000000 })
    await tx.wait()
    associatedTokens.add(tokenId)
  } catch {
    // Association might already exist on-chain; record as associated
    associatedTokens.add(tokenId)
  }
}

async function runTradingStep() {
  const timestamp = new Date().toLocaleTimeString()
  try {
    // 1. Fetch Markets
    const res = await fetch(`${API_URL}/v1/markets`)
    if (!res.ok) {
      console.log(`${C.dim}[${timestamp}] Unable to fetch markets from server.${C.reset}`)
      return
    }
    const data = await res.json()
    const markets = (data.markets || []).filter((m) => m.status === 'active' && m.contract_address)

    if (markets.length === 0) {
      console.log(`${C.yellow}[${timestamp}] ⏳ No active markets found on Pulse. Waiting for market creation...${C.reset}`)
      return
    }

    // 2. Pick Random Market & Action
    const market = markets[Math.floor(Math.random() * markets.length)]
    const side = Math.random() > 0.35 ? 'buy' : 'sell' // 65% buys, 35% sells for volume growth
    const amount = (Math.floor(Math.random() * 20) + 1).toString()

    console.log(`${C.cyan}[${timestamp}] 🎯 Selecting Market: ${C.bright}${market.name} (${market.symbol})${C.reset} | Action: ${side.toUpperCase()} ${amount} tokens`)

    // 3. Ensure Token Association for buys, and ERC20 approval for sells
    if (side === 'buy' && market.token_id) {
      await ensureTokenAssociated(market.token_id)
    }

    // 4. Prepare Trade
    const prepRes = await fetch(`${API_URL}/v1/markets/${market.id}/trades/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ tradeType: side, tokenAmount: amount, maxSlippageBps: 200 }),
    })
    const prep = await prepRes.json()
    if (!prepRes.ok) {
      console.log(`${C.dim}[${timestamp}] Trade prepare note (${side}): ${prep.message || prep.error}${C.reset}`)
      return
    }

    // 4b. If Sell, approve bonding curve contract to spend token
    if (side === 'sell' && market.token_id) {
      try {
        const tokenAddress = tokenIdToAddress(market.token_id)
        const erc20Interface = new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)'])
        const decimals = Number(prep.market?.tokenDecimals || 8)
        const amountUnits = ethers.parseUnits(amount, decimals)
        const approveData = erc20Interface.encodeFunctionData('approve', [prep.transaction.to, amountUnits])
        const approveTx = await botWallet.sendTransaction({
          to: tokenAddress,
          data: approveData,
          value: '0x0',
          gasLimit: 1000000,
        })
        await approveTx.wait()
      } catch (approveErr) {
        console.log(`${C.dim}[${timestamp}] Sell approval note: ${approveErr.message}${C.reset}`)
        return
      }
    }

    // 5. Send EVM Transaction to Hedera
    const tx = await botWallet.sendTransaction({
      to: prep.transaction.to,
      data: prep.transaction.data,
      value: prep.transaction.value,
      gasLimit: 3000000,
    })

    console.log(`${C.dim}[${timestamp}] Transaction submitted: ${tx.hash.slice(0, 14)}... Awaiting block...${C.reset}`)
    await tx.wait()

    // 6. Confirm Trade with Backend
    const confirmRes = await fetch(`${API_URL}/v1/markets/${market.id}/trades/${prep.trade.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ transactionId: tx.hash, status: 'confirmed' }),
    })

    if (confirmRes.ok) {
      console.log(
        `${C.green}${C.bright}[${timestamp}] 🚀 CONFIRMED ${side.toUpperCase()} ${amount} ${market.symbol}${C.reset} | Market: ${market.name} | Est: ${prep.quote?.settlementAmount || '—'} HBAR | Tx: ${tx.hash.slice(0, 14)}...`
      )
    }
  } catch (err) {
    console.log(`${C.dim}[${timestamp}] Bot step info: ${err.message}${C.reset}`)
  }
}

async function main() {
  await authenticate()
  console.log(`${C.green}Starting automated demo trading loop every ${INTERVAL_MS / 1000} seconds...${C.reset}`)
  console.log(`${C.dim}Press Ctrl+C to stop the bot at any time.\n${C.reset}`)

  // Run first trade step immediately
  await runTradingStep()

  // Loop periodically
  setInterval(runTradingStep, INTERVAL_MS)
}

main().catch(console.error)
