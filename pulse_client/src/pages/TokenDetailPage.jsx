import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownRight, ArrowUpRight, Bell, Megaphone, ShieldCheck,
  Globe, Send, TrendingUp, AlertTriangle, Info, ThumbsUp, ThumbsDown,
  MessageSquare, Trash2,
} from 'lucide-react'

const IconTwitter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
)
const IconGithub = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
)
const IconLinkedin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
)
import Stat from '../components/ui/Stat'
import CandleChart from '../components/ui/CandleChart'
import { API_URL } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, normalizeMarket } from '../lib/constants'
import {
  tokenIdToAddress, sendHederaTransaction, ensureHederaTokenAssociated,
  parseUnits, Interface, HEDERA_TX_GAS,
} from '../lib/hedera'

export default function TokenDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { wallet, authToken, userId, signOut } = useAuth()

  const [market, setMarket] = useState(location.state?.market || null)
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(!location.state?.market)
  const [ticks, setTicks] = useState([])
  const [timeframe, setTimeframe] = useState('1D') // '1D' | '5D' | '1M' | '1Y' | 'YTD' | 'ALL'
  const [reactions, setReactions] = useState({ likes: 0, dislikes: 0, userReaction: null })


  useEffect(() => {
    async function fetchMarket() {
      try {
        const res = await fetch(`${API_URL}/v1/markets/${id}`)
        if (!res.ok) return
        const payload = await res.json()
        setMarket(normalizeMarket(payload.market))
        if (payload.creator) setCreator(payload.creator)
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchMarket()
    const timer = setInterval(fetchMarket, 3000)
    return () => clearInterval(timer)
  }, [id])

  useEffect(() => {
    async function fetchChart() {
      try {
        const res = await fetch(`${API_URL}/v1/markets/${id}/chart`)
        if (res.ok) {
          const d = await res.json()
          setTicks(d.ticks || [])
        }
      } catch { /* ignore */ }
    }
    fetchChart()
    const timer = setInterval(fetchChart, 3000)
    return () => clearInterval(timer)
  }, [id])

  useEffect(() => {
    async function fetchReactions() {
      try {
        const url = userId ? `${API_URL}/v1/markets/${id}/reactions?userId=${userId}` : `${API_URL}/v1/markets/${id}/reactions`
        const res = await fetch(url)
        if (res.ok) {
          const d = await res.json()
          setReactions(d)
        }
      } catch { /* ignore */ }
    }
    fetchReactions()
  }, [id, userId])

  async function toggleReaction(type) {
    if (!authToken) return
    try {
      const res = await fetch(`${API_URL}/v1/markets/${id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ reaction: type }),
      })
      if (res.ok) {
        const d = await res.json()
        setReactions(d)
      }
    } catch { /* ignore */ }
  }

  function handleMarketUpdated(updated) {
    setMarket(updated)
    // Reload chart ticks after a trade
    fetch(`${API_URL}/v1/markets/${id}/chart`)
      .then((res) => res.json())
      .then((d) => setTicks(d.ticks || []))
      .catch(() => {})
  }

  if (loading) return <div className="page-section"><p className="muted">Loading market...</p></div>
  if (!market) return null

  const isCreator = market.user_id && (market.user_id === userId)

  return (
    <section className="page-section asset-page">
      <button className="back-link" onClick={() => navigate('/app')}>
        <ArrowDownRight size={15} /> Back to marketplace
      </button>

      {/* Market header */}
      <div className="asset-head">
        <div className="asset-identity">
          <div className={`avatar avatar-${market.accent} avatar-xl`}>
            {market.name.split(' ').map((p) => p[0]).join('')}
          </div>
          <div>
            <span className="eyebrow">{market.category} market</span>
            <h1>{market.name} <small>{market.symbol}</small></h1>
            <p>{market.bio}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`button ${reactions.userReaction === 'like' ? 'button-primary' : 'button-light'}`}
            onClick={() => toggleReaction('like')}
            title="Like this market"
            disabled={!authToken}
          >
            <ThumbsUp size={14} /> {reactions.likes}
          </button>
          <button
            className={`button ${reactions.userReaction === 'dislike' ? 'button-outline' : 'button-light'}`}
            onClick={() => toggleReaction('dislike')}
            title="Dislike this market"
            disabled={!authToken}
          >
            <ThumbsDown size={14} /> {reactions.dislikes}
          </button>
          <button className="button button-light"><Bell size={15} /> Watch market</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="asset-stats">
        <Stat label="Current price" value={formatCurrency(market.price)} note={`${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}% today`} positive={market.change >= 0} />
        <Stat label="Reserve balance" value={formatCurrency(Number(market.reserve_balance || market.marketCap || 0))} note="HBAR in curve" />
        <Stat label="24h volume" value={formatCurrency(Number(market.total_volume || market.volume || 0))} note="Across all trades" />
        <Stat label="Holders" value={Number(market.holder_count ?? market.holders ?? 0).toLocaleString()} note="Unique wallets" />
      </div>

      {/* Main grid: chart + trade + creator */}
      <div className="asset-grid-3">
        {/* Chart */}
        <div className="chart-panel">
          <div className="panel-head">
            <div><h2>Price history</h2><span>Market price in USD</span></div>
            <div className="chart-controls">
              {['1D', '5D', '1M', '1Y', 'YTD', 'ALL'].map((tf) => (
                <button
                  key={tf}
                  className={timeframe === tf ? 'selected' : ''}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <CandleChart ticks={ticks} timeframe={timeframe} basePrice={market.base_price} />
        </div>

        {/* Trade panel */}
        <TradePanel market={market} wallet={wallet} authToken={authToken} signOut={signOut} onMarketUpdated={handleMarketUpdated} />

        {/* Creator panel */}
        <CreatorPanel creator={creator} market={market} />
      </div>

      {/* Updates feed */}
      <UpdatesFeed marketId={id} authToken={authToken} isCreator={isCreator} marketUserId={market.user_id} />

      {/* Discussion / Comments Section */}
      <CommentsSection marketId={id} authToken={authToken} userId={userId} />
    </section>
  )
}

/* ─── Trade Panel ───────────────────────────────────────────────── */
function TradePanel({ market, wallet, authToken, signOut, onMarketUpdated }) {
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('10')
  const [quote, setQuote] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/v1/markets/${market.id}/quote/${side}?amount=${amount}`)
        if (res.ok) setQuote(await res.json())
      } catch { setQuote(null) }
    }, 250)
    return () => clearTimeout(timer)
  }, [amount, market.id, side])

  async function refreshMarket() {
    try {
      const res = await fetch(`${API_URL}/v1/markets/${market.id}`)
      if (!res.ok) return
      const payload = await res.json()
      const m = payload.market
      const updated = {
        ...market,
        price: Number(m.current_price || 0),
        marketCap: m.reserve_balance || '—',
        volume: m.total_volume || '0',
        holders: Number(m.holder_count || 0),
        current_price: m.current_price,
        circulating_supply: m.circulating_supply,
        reserve_balance: m.reserve_balance,
        total_volume: m.total_volume,
        holder_count: m.holder_count,
      }
      onMarketUpdated(updated)
    } catch { /* non-critical */ }
  }

  async function prepareTrade() {
    if (submitting) return
    setSubmitting(true)
    setMessage('Preparing your order...')
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.')
      if (side === 'buy') {
        setMessage('Checking Hedera token association...')
        const associated = await ensureHederaTokenAssociated(wallet, market.token_id)
        if (associated) setMessage('Token association confirmed. Fetching a live buy quote...')
      }
      const res = await fetch(`${API_URL}/v1/markets/${market.id}/trades/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ tradeType: side, tokenAmount: amount, maxSlippageBps: 100 }),
      })
      const result = await res.json()
      if (res.status === 401 || result.error === 'invalid_or_expired_token' || result.error === 'authentication_required') {
        if (signOut) signOut()
        throw new Error('Your authentication session expired. Please connect wallet again to re-authenticate.')
      }
      if (!res.ok) throw new Error(result.message || result.error || 'Unable to prepare trade')
      if (side === 'sell') {
        const tokenAddress = tokenIdToAddress(result.market.tokenId || market.token_id)
        const approvalData = new Interface(['function approve(address spender,uint256 amount)']).encodeFunctionData('approve', [result.transaction.to, parseUnits(amount, Number(result.market.tokenDecimals || 8))])
        setMessage('Approve token spending in MetaMask...')
        await sendHederaTransaction({ from: wallet, to: tokenAddress, data: approvalData, value: '0x0', gas: result.transaction.gas || HEDERA_TX_GAS })
      }
      setMessage(`Confirm the ${side} transaction in MetaMask...`)
      const txId = await sendHederaTransaction({ from: wallet, to: result.transaction.to, data: result.transaction.data, value: result.transaction.value, gas: result.transaction.gas || HEDERA_TX_GAS })
      const confirmRes = await fetch(`${API_URL}/v1/markets/${market.id}/trades/${result.trade.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ transactionId: txId, status: 'confirmed' }),
      })
      if (!confirmRes.ok) throw new Error('Transaction submitted, but confirmation could not be recorded.')
      setMessage(`✓ Trade confirmed: ${txId.slice(0, 10)}...`)
      await refreshMarket()
    } catch (err) {
      setMessage(err.code === 4001 ? 'Transaction rejected in MetaMask.' : err.message)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="trade-panel">
      <div className="trade-tabs">
        <button className={side === 'buy' ? 'selected' : ''} onClick={() => setSide('buy')} disabled={submitting}>
          Buy {market.symbol}
        </button>
        <button className={side === 'sell' ? 'selected sell-tab' : ''} onClick={() => setSide('sell')} disabled={submitting}>
          Sell {market.symbol}
        </button>
      </div>
      <div className="trade-body">
        <div className="trade-balance">
          <span>Wallet</span>
          <strong>{wallet.slice(0, 6)}...{wallet.slice(-4)}</strong>
        </div>
        <label className="input-label">Token amount <span>{market.symbol}</span></label>
        <div className="trade-input">
          <input
            value={amount}
            disabled={submitting}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          <span>{market.symbol}</span>
        </div>
        <div className="quick-values">
          {['1', '10', '25', '100'].map((v) => (
            <button key={v} disabled={submitting} onClick={() => setAmount(v)}>{v}</button>
          ))}
        </div>
        <div className="trade-receipt">
          <div><span>Settlement estimate</span><strong>{quote ? `${quote.settlementAmount} HBAR` : 'Loading...'}</strong></div>
          <div><span>Price before</span><span>{quote?.priceBefore || '—'}</span></div>
          <div><span>Price after</span><span>{quote?.priceAfter || '—'}</span></div>
        </div>
        <button
          className={`button full-button ${side === 'buy' ? 'button-primary' : 'button-outline'}`}
          onClick={prepareTrade}
          disabled={submitting}
        >
          {submitting ? 'Awaiting wallet...' : side === 'buy' ? 'Buy token' : 'Prepare sell'} <ArrowUpRight size={16} />
        </button>
        {message && <small className="trade-note">{message}</small>}
        <small className="trade-note">
          <ShieldCheck size={13} /> A first buy may require one separate Hedera token-association transaction.
        </small>
      </div>
    </div>
  )
}

/* ─── Creator Panel ─────────────────────────────────────────────── */
function CreatorPanel({ creator, market }) {
  if (!creator && !market) return null
  const name = creator?.display_name || market?.name || 'Creator'
  const username = creator?.username || market?.username
  const bio = creator?.bio || market?.bio
  const headline = creator?.headline || creator?.category
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="creator-panel panel">
      <div className="creator-panel-head">
        <span className="mini-label">About the creator</span>
      </div>
      <div className="creator-identity">
        <div className={`avatar avatar-${market?.accent || 'cyan'} avatar-lg`}>{initials}</div>
        <div>
          <strong className="creator-name">{name}</strong>
          {username && <span className="creator-handle">@{username}</span>}
          {headline && <span className="creator-headline">{headline}</span>}
        </div>
      </div>
      {bio && <p className="creator-bio">{bio}</p>}
      {creator && (
        <div className="creator-links">
          {creator.website_url && <a href={creator.website_url} target="_blank" rel="noreferrer" className="creator-link"><Globe size={14} /> Website</a>}
          {creator.twitter_url && <a href={creator.twitter_url} target="_blank" rel="noreferrer" className="creator-link"><IconTwitter /> Twitter</a>}
          {creator.github_url && <a href={creator.github_url} target="_blank" rel="noreferrer" className="creator-link"><IconGithub /> GitHub</a>}
          {creator.linkedin_url && <a href={creator.linkedin_url} target="_blank" rel="noreferrer" className="creator-link"><IconLinkedin /> LinkedIn</a>}
        </div>
      )}
    </div>
  )
}

/* ─── Updates Feed ──────────────────────────────────────────────── */
const UPDATE_TYPE_META = {
  general: { label: 'Update', icon: Info, color: 'update-general' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'update-announcement' },
  milestone: { label: 'Milestone', icon: TrendingUp, color: 'update-milestone' },
  warning: { label: 'Warning', icon: AlertTriangle, color: 'update-warning' },
}

function UpdatesFeed({ marketId, authToken, isCreator }) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', update_type: 'general' })
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function loadUpdates() {
    try {
      const res = await fetch(`${API_URL}/v1/markets/${marketId}/updates`)
      if (res.ok) { const d = await res.json(); setUpdates(d.updates || []) }
    } catch { setUpdates([]) }
    setLoading(false)
  }

  useEffect(() => { loadUpdates() }, [marketId])

  async function postUpdate(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) { setFormError('Title and body are required.'); return }
    setPosting(true)
    setFormError('')
    try {
      const res = await fetch(`${API_URL}/v1/markets/${marketId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed to post update') }
      setForm({ title: '', body: '', update_type: 'general' })
      setShowForm(false)
      await loadUpdates()
    } catch (err) { setFormError(err.message) }
    setPosting(false)
  }

  const visibleUpdates = expanded ? updates : updates.slice(0, 3)
  const fourthUpdate = (!expanded && updates.length > 3) ? updates[3] : null

  function renderUpdateItem(update) {
    const meta = UPDATE_TYPE_META[update.update_type] || UPDATE_TYPE_META.general
    const Icon = meta.icon
    return (
      <div key={update.id} className={`update-item ${meta.color}`}>
        <div className="update-item-head">
          <div className={`update-badge ${meta.color}`}>
            <Icon size={11} /> {meta.label}
          </div>
          <time className="update-time">
            {new Date(update.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </time>
        </div>
        <h3 className="update-title">{update.title}</h3>
        <p className="update-body">{update.body}</p>
      </div>
    )
  }

  return (
    <div className="updates-section">
      <div className="section-title" style={{ marginTop: '2.5rem' }}>
        <div>
          <h2>Creator updates <span className="count">{updates.length}</span></h2>
          <p>The founder posts progress, milestones, and announcements here.</p>
        </div>
        {isCreator && (
          <button className="button button-light" onClick={() => setShowForm((v) => !v)}>
            <Send size={15} /> {showForm ? 'Cancel' : 'Post update'}
          </button>
        )}
      </div>

      {isCreator && showForm && (
        <form className="update-compose" onSubmit={postUpdate}>
          <div className="update-compose-row">
            <select
              className="update-type-select"
              value={form.update_type}
              onChange={(e) => setForm((f) => ({ ...f, update_type: e.target.value }))}
            >
              <option value="general">General update</option>
              <option value="milestone">Milestone reached</option>
              <option value="announcement">Announcement</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <input
            className="update-title-input"
            placeholder="Update title..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            className="update-body-input"
            placeholder="What's happening? Share progress, milestones, or important news with your backers..."
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows="4"
            required
          />
          {formError && <div className="form-error">{formError}</div>}
          <div className="update-compose-actions">
            <button type="submit" className="button button-primary" disabled={posting}>
              {posting ? 'Posting...' : 'Publish update'} <Send size={14} />
            </button>
          </div>
        </form>
      )}

      {loading && <p className="muted" style={{ padding: '1rem 0' }}>Loading updates...</p>}

      {!loading && updates.length === 0 && (
        <div className="updates-empty">
          <div className="updates-empty-icon"><Megaphone size={22} /></div>
          <p>No updates yet. The creator hasn't posted any news.</p>
        </div>
      )}

      {!loading && updates.length > 0 && (
        <div className="updates-feed" style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {visibleUpdates.map((u) => renderUpdateItem(u))}
          {fourthUpdate && (
            <div style={{ position: 'relative', height: '65px', overflow: 'hidden', borderRadius: '4px' }}>
              {renderUpdateItem(fourthUpdate)}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 0%, rgba(14,17,21,0.95) 90%)',
                pointerEvents: 'none',
              }} />
            </div>
          )}
        </div>
      )}

      {!loading && updates.length > 3 && (
        <button
          className="button button-light"
          style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show more updates (${updates.length - 3} remaining)`}
        </button>
      )}
    </div>
  )
}

/* ─── Comments Section ─────────────────────────────────────────── */
function CommentsSection({ marketId, authToken, userId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function loadComments() {
    try {
      const res = await fetch(`${API_URL}/v1/markets/${marketId}/comments`)
      if (res.ok) {
        const d = await res.json()
        setComments(d.comments || [])
      }
    } catch { setComments([]) }
    setLoading(false)
  }

  useEffect(() => { loadComments() }, [marketId])

  async function handlePostComment(e) {
    e.preventDefault()
    if (!content.trim()) return
    if (!authToken) { setError('Please connect your wallet to post a comment.'); return }
    setPosting(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/v1/markets/${marketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || 'Unable to post comment.')
      }
      setContent('')
      await loadComments()
    } catch (err) { setError(err.message) }
    setPosting(false)
  }

  async function handleDeleteComment(commentId) {
    try {
      const res = await fetch(`${API_URL}/v1/markets/${marketId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) await loadComments()
    } catch { /* ignore */ }
  }

  const visibleComments = expanded ? comments : comments.slice(0, 3)
  const fourthComment = (!expanded && comments.length > 3) ? comments[3] : null

  function renderCommentCard(c) {
    const name = c.display_name || c.username || 'Backer'
    const handle = c.username ? `@${c.username}` : ''
    const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    const isMine = c.user_id === userId
    return (
      <div key={c.id} className="comment-card panel" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="avatar avatar-cyan avatar-sm">{initials}</div>
            <div>
              <strong style={{ fontSize: '14px', color: '#fff' }}>{name}</strong>
              {handle && <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>{handle}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <time style={{ fontSize: '12px', color: '#64748b' }}>
              {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time>
            {isMine && (
              <button
                className="icon-button"
                style={{ color: '#ef4444', padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => handleDeleteComment(c.id)}
                title="Delete comment"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: '#cbd5e1' }}>{c.content}</p>
      </div>
    )
  }

  return (
    <div className="comments-section" style={{ marginTop: '3rem' }}>
      <div className="section-title">
        <div>
          <h2>Market Discussion <span className="count">{comments.length}</span></h2>
          <p>Community insights, feedback, and discussion for this market.</p>
        </div>
      </div>

      <form className="update-compose" onSubmit={handlePostComment} style={{ marginBottom: '24px' }}>
        <textarea
          className="update-body-input"
          placeholder={authToken ? "Share your conviction, question, or feedback..." : "Connect wallet to post a comment..."}
          value={content}
          disabled={!authToken || posting}
          onChange={(e) => setContent(e.target.value)}
          rows="3"
          required
        />
        {error && <div className="form-error" style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>{error}</div>}
        <div className="update-compose-actions" style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="button button-primary" disabled={!authToken || posting || !content.trim()}>
            {posting ? 'Posting...' : 'Post Comment'} <Send size={14} />
          </button>
        </div>
      </form>

      {loading && <p className="muted" style={{ padding: '1rem 0' }}>Loading discussion...</p>}

      {!loading && comments.length === 0 && (
        <div className="updates-empty" style={{ textAlign: 'center', padding: '32px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="updates-empty-icon" style={{ marginBottom: '8px', color: '#64748b' }}><MessageSquare size={22} /></div>
          <p className="muted" style={{ margin: 0 }}>No comments yet. Be the first to start the conversation!</p>
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div className="comments-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {visibleComments.map((c) => renderCommentCard(c))}
          {fourthComment && (
            <div style={{ position: 'relative', height: '55px', overflow: 'hidden', borderRadius: '12px' }}>
              {renderCommentCard(fourthComment)}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 0%, rgba(14,17,21,0.95) 90%)',
                pointerEvents: 'none',
              }} />
            </div>
          )}
        </div>
      )}

      {!loading && comments.length > 3 && (
        <button
          className="button button-light"
          style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show more comments (${comments.length - 3} remaining)`}
        </button>
      )}
    </div>
  )
}

