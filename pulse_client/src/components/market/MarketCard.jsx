import { ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '../../lib/constants'

export default function MarketCard({ market, onClick }) {
  const change = Number(market.change || 0)
  const isPositive = change >= 0

  return (
    <button className="market-card" onClick={onClick}>
      <div className="market-card-top">
        <div className={`avatar avatar-${market.accent}`}>
          {market.name.split(' ').map((p) => p[0]).join('')}
        </div>
        <div className="market-card-name">
          <strong>{market.name}</strong>
          <span>{market.handle} · {market.category}</span>
        </div>
        <span className={isPositive ? 'change-pill positive-bg' : 'change-pill negative-bg'}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <div className="market-card-middle">
        <div>
          <span className="mini-label">Price</span>
          <strong>{formatCurrency(market.price)}</strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="mini-label">24h Change</span>
          <span
            className={isPositive ? 'positive' : 'negative'}
            style={{ display: 'block', fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '6px' }}
          >
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="market-card-footer">
        <span><small>Market cap</small>{market.marketCap}</span>
        <span><small>24h volume</small>{market.volume}</span>
        <span><small>Holders</small>{Number(market.holders).toLocaleString()}</span>
        <ArrowUpRight size={15} />
      </div>
    </button>
  )
}

