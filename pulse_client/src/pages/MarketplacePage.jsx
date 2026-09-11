import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Settings2 } from 'lucide-react'
import MarketCard from '../components/market/MarketCard'
import MarketTicker from '../components/market/MarketTicker'
import { API_URL } from '../lib/api'
import { normalizeMarket } from '../lib/constants'

export default function MarketplacePage() {
  const [markets, setMarkets] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/markets`)
        if (!res.ok) return
        const payload = await res.json()
        setMarkets((payload.markets || []).map(normalizeMarket))
      } catch { setMarkets([]) }
      setLoading(false)
    }
    load()
  }, [])

  const visible = markets.filter((m) =>
    `${m.name} ${m.symbol} ${m.category}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">The marketplace</span>
          <h1>Find your next conviction.</h1>
          <p>Live markets for people building the future.</p>
        </div>
        <button className="button button-light" onClick={() => navigate('/app/create')}>
          <Plus size={16} /> Create market
        </button>
      </div>

      <MarketTicker markets={markets} />

      <div className="market-toolbar">
        <div className="tabs">
          <button className="selected">All markets</button>
          <button>Trending</button>
          <button>Newly listed</button>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
          />
        </label>
      </div>

      <div className="section-title">
        <div>
          <h2>Markets in motion <span className="count">{visible.length}</span></h2>
          <p>Ranked by momentum over the last 24 hours.</p>
        </div>
        <button className="filter-button"><Settings2 size={15} /> Filters</button>
      </div>

      {loading && <div className="loading-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div>}
      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <p>No markets found{query ? ` for "${query}"` : '. Be the first to create one.'}.</p>
          {!query && <button className="button button-primary" onClick={() => navigate('/app/create')}>Create a market <Plus size={15} /></button>}
        </div>
      )}
      {!loading && (
        <div className="market-grid">
          {visible.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              onClick={() => navigate(`/app/market/${market.id}`, { state: { market } })}
            />
          ))}
        </div>
      )}
    </section>
  )
}
