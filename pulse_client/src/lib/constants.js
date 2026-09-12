import { BarChart3, LayoutGrid, Plus, UserRound } from 'lucide-react'

export const navItems = [
  { id: 'marketplace', label: 'Marketplace', path: '/app', icon: LayoutGrid },
  { id: 'portfolio', label: 'Portfolio', path: '/app/portfolio', icon: BarChart3 },
  { id: 'create', label: 'Create token', path: '/app/create', icon: Plus },
  { id: 'profile', label: 'Profile', path: '/app/profile', icon: UserRound },
]

export const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatNumber2Decimals = (value) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const ACCENT_CYCLE = ['cyan', 'violet', 'orange', 'lime', 'pink']

export function getAccent(index) {
  return ACCENT_CYCLE[index % ACCENT_CYCLE.length]
}

export function normalizeMarket(market, index = 0) {
  const reserve = Number(market.reserve_balance || market.market_cap || 0)
  const vol = Number(market.total_volume || 0)
  return {
    ...market,
    handle: market.username ? `@${market.username}` : 'Pulse market',
    category: market.category || 'Market',
    price: Number(market.current_price || 0),
    change: Number(market.change || 0),
    marketCapFormatted: formatCurrency(reserve),
    volumeFormatted: formatCurrency(vol),
    marketCap: formatCurrency(reserve),
    volume: formatCurrency(vol),
    holders: Number(market.holder_count || 0),
    bio: market.bio || 'A live market on Pulse.',
    accent: market.accent || getAccent(index),
  }
}
