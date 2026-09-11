import { Flame, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../lib/constants'

export default function MarketTicker({ markets }) {
  return (
    <div className="ticker-row">
      <div className="ticker-intro"><Flame size={16} /><span>Market pulse</span></div>
      {markets.slice(0, 4).map((market) => (
        <div className="ticker-item" key={market.id}>
          <span>{market.symbol}</span>
          <strong>{formatCurrency(market.price)}</strong>
          <small className={market.change >= 0 ? 'positive' : 'negative'}>
            {market.change >= 0 ? '+' : ''}{market.change}%
          </small>
        </div>
      ))}
      <div className="ticker-end"><TrendingUp size={15} /> Live</div>
    </div>
  )
}
