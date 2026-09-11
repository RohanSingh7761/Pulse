import { ArrowUpRight } from 'lucide-react'
import Sparkline from '../ui/Sparkline'
import { formatCurrency } from '../../lib/constants'

export default function MarketCard({ market, onClick }) {
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
        <span className={market.change >= 0 ? 'change-pill positive-bg' : 'change-pill negative-bg'}>
          {market.change >= 0 ? '+' : ''}{market.change}%
        </span>
      </div>
      <div className="market-card-middle">
        <div>
          <span className="mini-label">Price</span>
          <strong>{formatCurrency(market.price)}</strong>
        </div>
        <Sparkline accent={market.accent} down={market.change < 0} />
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
