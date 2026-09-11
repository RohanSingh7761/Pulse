import { Interface, parseUnits } from 'ethers'

const HEDERA_TX_GAS = '0x2DC6C0'

export function tokenIdToAddress(tokenId) {
  if (!tokenId) throw new Error('This market has no Hedera token ID yet.')
  if (String(tokenId).startsWith('0x')) return tokenId
  const num = String(tokenId).split('.')[2] ?? String(tokenId)
  return `0x${BigInt(num).toString(16).padStart(40, '0')}`
}

async function waitForHederaReceipt(hash) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] })
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('The Hedera transaction reverted.')
      return receipt
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('Timed out waiting for Hedera to confirm the transaction.')
}

export async function sendHederaTransaction(params) {
  const hash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ gas: params.gas || HEDERA_TX_GAS, ...params }],
  })
  await waitForHederaReceipt(hash)
  return hash
}

export async function ensureHederaTokenAssociated(wallet, tokenId) {
  const tokenAddress = tokenIdToAddress(tokenId)
  const iface = new Interface(['function isAssociated() view returns (bool)', 'function associate()'])
  try {
    const associated = await window.ethereum.request({
      method: 'eth_call',
      params: [{ from: wallet, to: tokenAddress, data: iface.encodeFunctionData('isAssociated') }, 'latest'],
    })
    if (associated && BigInt(associated) !== 0n) return false
  } catch {
    throw new Error('Unable to verify whether this wallet is associated with the Hedera token.')
  }
  await sendHederaTransaction({ from: wallet, to: tokenAddress, data: iface.encodeFunctionData('associate'), value: '0x0' })
  return true
}

export { parseUnits, Interface, HEDERA_TX_GAS }
