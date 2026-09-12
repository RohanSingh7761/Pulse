import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Settings2, X, Filter } from 'lucide-react'
import MarketCard from '../components/market/MarketCard'
import MarketTicker from '../components/market/MarketTicker'
import { API_URL } from '../lib/api'
import { normalizeMarket } from '../lib/constants'

export default function MarketplacePage() {
  const [markets, setMarkets] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all') // 'all' | 'trending' | 'new'
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [minVolume, setMinVolume] = useState('0')
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

  const categories = useMemo(() => {
    const set = new Set(markets.map((m) => m.category).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [markets])

  const visible = useMemo(() => {
    let list = markets.filter((m) => {
      const matchQuery = `${m.name} ${m.symbol} ${m.category} ${m.bio}`.toLowerCase().includes(query.toLowerCase())
      const matchCategory = categoryFilter === 'all' || m.category?.toLowerCase() === categoryFilter.toLowerCase()
      const matchVolume = Number(m.total_volume || 0) >= Number(minVolume || 0)
      return matchQuery && matchCategory && matchVolume
    })

    if (tab === 'trending') {
      list = [...list].sort((a, b) => Number(b.total_volume || 0) - Number(a.total_volume || 0) || b.holders - a.holders)
    } else if (tab === 'new') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    return list
  }, [markets, query, tab, categoryFilter, minVolume])

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
            placeholder="Search markets"
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
        <button
          className={`filter-button ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Settings2 size={15} /> Filters {showFilters ? <X size={13} style={{ marginLeft: 4 }} /> : null}
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel panel" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} className="muted" />
            <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Options:</strong>
          </div>
          <div>
            <label className="mini-label" style={{ display: 'block', marginBottom: '4px' }}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}
            >
              {categories.map((c) => (
                <option key={c} value={c} style={{ background: '#111', color: '#fff' }}>
                  {c === 'all' ? 'All categories' : c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mini-label" style={{ display: 'block', marginBottom: '4px' }}>Min 24h Volume ($)</label>
            <input
              type="number"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              placeholder="0"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', width: '100px' }}
            />
          </div>
          {(categoryFilter !== 'all' || minVolume !== '0') && (
            <button
              className="text-button"
              style={{ marginLeft: 'auto', fontSize: '13px', color: '#06b6d4' }}
              onClick={() => { setCategoryFilter('all'); setMinVolume('0') }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {loading && <div className="loading-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div>}
      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <p>No markets found{query ? ` for "${query}"` : categoryFilter !== 'all' ? ` in category "${categoryFilter}"` : '. Be the first to create one.'}.</p>
          {!query && categoryFilter === 'all' && (
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
