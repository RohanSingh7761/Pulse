import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, History } from 'lucide-react'
import Sparkline from '../components/ui/Sparkline'
import { API_URL } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, normalizeMarket } from '../lib/constants'

export default function PortfolioPage() {
  const { authToken } = useAuth()
  const navigate = useNavigate()
  const [holdings, setHoldings] = useState([])
  const [summary, setSummary] = useState({ totalBought: 0, totalSold: 0 })
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [holdingsRes, marketsRes] = await Promise.all([
          fetch(`${API_URL}/v1/users/me/holdings`, { headers: { Authorization: `Bearer ${authToken}` } }),
          fetch(`${API_URL}/v1/markets`),
        ])
        if (holdingsRes.ok) {
          const d = await holdingsRes.json()
          setHoldings(d.holdings || [])
          if (d.summary) setSummary(d.summary)
        }
        if (marketsRes.ok) { const d = await marketsRes.json(); setMarkets((d.markets || []).map(normalizeMarket)) }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [authToken])

  const totalValue = holdings.reduce((s, h) => s + Number(h.token_balance) * Number(h.current_price || 0), 0)
  const totalPnl = (totalValue + Number(summary.totalSold || 0)) - Number(summary.totalBought || 0)
  const pnlPositive = totalPnl >= 0

  return (
    <section className="page-section">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">Your portfolio</span>
          <h1>Track your conviction.</h1>
          <p>Everything you own, in one clear view.</p>
        </div>
        <button className="button button-outline" onClick={() => navigate('/app/trades')} style={{ gap: '6px' }}>
          <History size={15} /> Trade history
        </button>
      </div>

      {/* Overview card */}
      <div className="portfolio-overview">
        <div>
          <span className="mini-label">Total portfolio value</span>
          <strong>{formatCurrency(totalValue)}</strong>
          <span className={pnlPositive ? 'positive' : 'negative'}>
            {pnlPositive ? '+' : ''}{formatCurrency(totalPnl)} all time P&L
          </span>
        </div>
        <div className="portfolio-mini-chart"><Sparkline down={!pnlPositive} /></div>
      </div>

      {/* Positions */}
      <div className="section-title">
        <div>
          <h2>Your positions <span className="count">{holdings.length}</span></h2>
          <p>Tokens you currently hold.</p>
        </div>
      </div>

      {loading && <p className="muted" style={{ padding: '1rem' }}>Loading positions...</p>}

      {!loading && holdings.length === 0 && (
        <div className="portfolio-empty">
          <h3>No positions yet</h3>
          <p>Buy a token from the marketplace to get started.</p>
          <button className="button button-primary" onClick={() => navigate('/app')}>
            Browse markets <ArrowUpRight size={15} />
          </button>
        </div>
      )}

      {!loading && holdings.length > 0 && (
        <div className="watchlist">
          {holdings.map((h) => {
            const currentValue = Number(h.token_balance) * Number(h.current_price || 0)
            const pnl = currentValue - Number(h.total_invested || 0)
            const isPnlPositive = pnl >= 0
            const md = markets.find((m) => m.id === h.id) || {}
            return (
              <button
                className="watch-row"
                key={h.id}
                onClick={() => navigate(`/app/market/${h.id}`, {
                  state: {
                    market: { ...md, ...h, price: Number(h.current_price || 0), holders: Number(h.holder_count || 0), accent: md.accent || 'cyan', handle: md.handle || 'Pulse market', category: md.category || 'Market', change: md.change || 0, bio: md.bio || 'A live market on Pulse.' }
                  }
                })}
              >
                <div className={`avatar avatar-${md.accent || 'cyan'}`}>{(h.symbol || '??').slice(0, 2)}</div>
                <div className="watch-name">
                  <strong>{h.name}</strong>
                  <span>{h.symbol} · {Number(h.token_balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</span>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  <strong>{formatCurrency(currentValue)}</strong>
                  <span className={isPnlPositive ? 'positive' : 'negative'} style={{ display: 'block', fontSize: '0.78rem' }}>
                    {isPnlPositive ? '+' : ''}{formatCurrency(pnl)}
                  </span>
                </div>
                <span className="mini-label" style={{ fontSize: '0.72rem' }}>avg {formatCurrency(Number(h.average_entry_price || 0))}</span>
                <ArrowUpRight size={15} />
              </button>
            )
          })}
        </div>
      )}

      {/* Explore more */}
      {markets.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: '2.5rem' }}>
            <div>
              <h2>Explore more <span className="count">{markets.length}</span></h2>
              <p>Markets you might want to follow.</p>
            </div>
          </div>
          <div className="watchlist">
            {markets.slice(0, 5).map((market) => (
              <button
                className="watch-row"
                key={market.id}
                onClick={() => navigate(`/app/market/${market.id}`, { state: { market } })}
              >
                <div className={`avatar avatar-${market.accent}`}>{market.symbol.slice(0, 2)}</div>
                <div className="watch-name">
                  <strong>{market.name}</strong>
                  <span>{market.symbol} · {market.category}</span>
                </div>
                <Sparkline accent={market.accent} down={market.change < 0} />
                <strong>{formatCurrency(market.price)}</strong>
                <span className={market.change >= 0 ? 'positive' : 'negative'}>
                  {market.change >= 0 ? '+' : ''}{market.change}%
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
