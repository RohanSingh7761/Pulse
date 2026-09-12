import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import MarketCard from '../components/market/MarketCard'
import MarketTicker from '../components/market/MarketTicker'
import { API_URL } from '../lib/api'
import { normalizeMarket } from '../lib/constants'

export default function MarketplacePage() {
  const [markets, setMarkets] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all') // 'all' | 'trending' | 'new'
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/markets`)
        if (!res.ok) return
        const payload = await res.json()
        setMarkets((payload.markets || []).map(normalizeMarket))
      } catch { /* ignore error on background poll */ }
      setLoading(false)
    }
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [])

  const visible = useMemo(() => {
    let list = markets

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((m) => {
        const name = (m.name || '').toLowerCase()
        const symbol = (m.symbol || '').toLowerCase()
        const category = (m.category || '').toLowerCase()
        const bio = (m.bio || '').toLowerCase()
        const username = (m.username || m.handle || '').toLowerCase()
        const displayName = (m.display_name || '').toLowerCase()
        const tokenId = (m.token_id || '').toLowerCase()
        return (
          name.includes(q) ||
          symbol.includes(q) ||
          category.includes(q) ||
          bio.includes(q) ||
          username.includes(q) ||
          displayName.includes(q) ||
          tokenId.includes(q)
        )
      })
    }

    if (tab === 'trending') {
      list = [...list].sort((a, b) => Number(b.total_volume || 0) - Number(a.total_volume || 0) || (b.holders || 0) - (a.holders || 0))
    } else if (tab === 'new') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    return list
  }, [markets, query, tab])

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
          <button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>All markets</button>
          <button className={tab === 'trending' ? 'selected' : ''} onClick={() => setTab('trending')}>Trending</button>
          <button className={tab === 'new' ? 'selected' : ''} onClick={() => setTab('new')}>Newly listed</button>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, symbol, or creator..."
          />
        </label>
      </div>

      <div className="section-title">
        <div>
          <h2>
            {tab === 'trending' ? 'Trending Markets' : tab === 'new' ? 'Newly Listed Markets' : 'Markets in motion'}{' '}
            <span className="count">{visible.length}</span>
          </h2>
          <p>
            {tab === 'trending'
              ? 'Ranked by highest trading volume and backer activity.'
              : tab === 'new'
              ? 'Chronologically sorted by creation date.'
              : 'Ranked by momentum over the last 24 hours.'}
          </p>
        </div>
      </div>

      {loading && <div className="loading-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div>}
      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <p>No markets found{query ? ` matching "${query}"` : '. Be the first to create one.'}.</p>
          {!query && (
            <button className="button button-primary" onClick={() => navigate('/app/create')}>
              Create a market <Plus size={15} />
            </button>
          )}
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
