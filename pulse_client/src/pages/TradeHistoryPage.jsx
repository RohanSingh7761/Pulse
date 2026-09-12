import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, ExternalLink, History, RefreshCw, ShoppingBag } from 'lucide-react'
import { API_URL } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Stat from '../components/ui/Stat'

export default function TradeHistoryPage() {
  const { authToken } = useAuth()
  const navigate = useNavigate()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'buy' | 'sell'

  async function loadTrades() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/v1/users/me/trades`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const d = await res.json()
        setTrades(d.trades || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    loadTrades()
  }, [authToken])

  const filteredTrades = trades.filter((t) => {
    if (filter === 'buy') return t.trade_type === 'buy'
    if (filter === 'sell') return t.trade_type === 'sell'
    return true
  })

  const totalVolume = trades.reduce((acc, t) => acc + Number(t.settlement_amount || 0), 0)
  const buyCount = trades.filter((t) => t.trade_type === 'buy').length
  const sellCount = trades.filter((t) => t.trade_type === 'sell').length

  return (
    <section className="page-section">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">Activity & Records</span>
          <h1>Trade History</h1>
          <p>Complete record of your token buys, sells, prices, and Hedera settlement transactions.</p>
        </div>
        <button className="button button-light" onClick={loadTrades} disabled={loading} style={{ gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="asset-stats" style={{ margin: '24px 0 32px' }}>
        <Stat label="Total Trades" value={trades.length.toString()} note="All time executions" />
        <Stat label="Total Volume" value={`${totalVolume.toFixed(2)} HBAR`} note="Settlement value" />
        <Stat label="Total Buys" value={buyCount.toString()} note="Buy orders executed" positive />
        <Stat label="Total Sells" value={sellCount.toString()} note="Sell orders executed" />
      </div>

      {/* Filter Tabs */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Your Orders <span className="count">{filteredTrades.length}</span></h2>
          <p>Showing {filter === 'all' ? 'all' : filter} executions</p>
        </div>
        <div className="tabs">
          <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>
            All ({trades.length})
          </button>
          <button className={filter === 'buy' ? 'selected' : ''} onClick={() => setFilter('buy')}>
            Buys ({buyCount})
          </button>
          <button className={filter === 'sell' ? 'selected' : ''} onClick={() => setFilter('sell')}>
            Sells ({sellCount})
          </button>
        </div>
      </div>

      {loading && <p className="muted" style={{ padding: '2rem 0' }}>Loading trade history...</p>}

      {!loading && trades.length === 0 && (
        <div className="portfolio-empty" style={{ textAlign: 'center', padding: '60px 24px', border: '1px dashed var(--line)', borderRadius: '12px' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'grid', placeItems: 'center', color: '#64748b' }}>
            <History size={24} />
          </div>
          <h3>No trades recorded yet</h3>
          <p className="muted" style={{ fontSize: '13px', margin: '8px 0 24px' }}>Buy or sell tokens on any Pulse market to populate your activity history.</p>
          <button className="button button-primary" onClick={() => navigate('/app')}>
            Browse Markets <ArrowUpRight size={15} />
          </button>
        </div>
      )}

      {!loading && filteredTrades.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTrades.map((t) => {
            const isBuy = t.trade_type === 'buy'
            const isConfirmed = t.status === 'confirmed'
            const isFailed = t.status === 'failed'
            const formattedDate = new Date(t.created_at).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })

            return (
              <div
                key={t.id}
                className="panel"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1.5fr 1fr 1fr 1fr 120px',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  gap: '12px',
                  background: 'rgba(17, 19, 23, 0.75)',
                  border: '1px solid var(--line)',
                }}
              >
                {/* Order Type Badge */}
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      background: isBuy ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: isBuy ? '#4ade80' : '#f87171',
                      border: `1px solid ${isBuy ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    }}
                  >
                    {isBuy ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {isBuy ? 'BUY' : 'SELL'}
                  </span>
                </div>

                {/* Token Info */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                  onClick={() => navigate(`/app/market/${t.market_id}`)}
                >
                  <div className="avatar avatar-cyan avatar-sm">{(t.market_symbol || '??').slice(0, 2)}</div>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>{t.market_name}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{t.market_symbol}</span>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Amount</span>
                  <strong style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                    {Number(t.token_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} {t.market_symbol}
                  </strong>
                </div>

                {/* Price per Token */}
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Price / Token</span>
                  <span style={{ fontSize: '13px', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                    {Number(t.execution_price || 0).toFixed(4)} HBAR
                  </span>
                </div>

                {/* Settlement Amount */}
                <div>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Settlement</span>
                  <strong style={{ fontSize: '13px', color: isBuy ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)' }}>
                    {isBuy ? '-' : '+'}{Number(t.settlement_amount || 0).toFixed(4)} HBAR
                  </strong>
                </div>

                {/* Status & Tx / Time */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: isConfirmed ? '#4ade80' : isFailed ? '#ef4444' : '#eab308',
                      }}
                    >
                      {isConfirmed ? '✓ Confirmed' : isFailed ? '✕ Failed' : '⏳ Pending'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>{formattedDate}</span>
                  {t.transaction_id && (
                    <a
                      href={`https://hashscan.io/testnet/tx/${t.transaction_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '10px', color: '#06b6d4', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                    >
                      Tx {t.transaction_id.slice(0, 6)}... <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
