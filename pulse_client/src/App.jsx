import { useEffect, useState } from 'react'
import { Interface, parseUnits } from 'ethers'
import { ArrowDownRight, ArrowUpRight, BarChart3, Bell, Check, ChevronDown, CircleDollarSign, Copy, Flame, LayoutGrid, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, UserRound, Wallet, X, Zap } from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const HEDERA_TX_GAS = '0x2DC6C0'

function tokenIdToAddress(tokenId) {
  if (!tokenId) throw new Error('This market has no Hedera token ID yet.')
  if (String(tokenId).startsWith('0x')) return tokenId
  const num = String(tokenId).split('.')[2] ?? String(tokenId)
  return `0x${BigInt(num).toString(16).padStart(40, '0')}`
}

async function waitForHederaReceipt(hash) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] })
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('The Hedera transaction reverted.')
      return receipt
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('Timed out waiting for Hedera to confirm the transaction.')
}

async function sendHederaTransaction(params) {
  const hash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ gas: params.gas || HEDERA_TX_GAS, ...params }]
  })
  await waitForHederaReceipt(hash)
  return hash
}

async function ensureHederaTokenAssociated(wallet, tokenId) {
  const tokenAddress = tokenIdToAddress(tokenId)
  const iface = new Interface(['function isAssociated() view returns (bool)', 'function associate()'])
  try {
    const associated = await window.ethereum.request({
      method: 'eth_call',
      params: [{ from: wallet, to: tokenAddress, data: iface.encodeFunctionData('isAssociated') }, 'latest']
    })
    if (associated && BigInt(associated) !== 0n) return false
  } catch {
    throw new Error('Unable to verify whether this wallet is associated with the Hedera token.')
  }
  await sendHederaTransaction({ from: wallet, to: tokenAddress, data: iface.encodeFunctionData('associate'), value: '0x0' })
  return true
}
const navItems = [{ id: 'marketplace', label: 'Marketplace', icon: LayoutGrid }, { id: 'portfolio', label: 'Portfolio', icon: BarChart3 }, { id: 'create', label: 'Create token', icon: Plus }, { id: 'profile', label: 'Profile', icon: UserRound }]
const formatCurrency = (value) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function App() {
  const [view, setView] = useState('landing')
  const [consoleView, setConsoleView] = useState('marketplace')
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [markets, setMarkets] = useState([])
  const [wallet, setWallet] = useState(() => localStorage.getItem('pulse_wallet') || '')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pulse_token') || '')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => {
    async function loadMarkets() {
      try {
        const response = await fetch(`${API_URL}/v1/markets`)
        if (!response.ok) return
        const payload = await response.json()
        setMarkets((payload.markets || []).map((market) => ({ ...market, handle: market.username ? `@${market.username}` : 'Pulse market', category: market.category || 'Market', price: Number(market.current_price || 0), change: Number(market.change || 0), marketCap: market.market_cap || '—', volume: market.total_volume || '0', holders: market.holder_count || 0, bio: market.bio || 'A live market on Pulse.', accent: 'cyan' })))
      } catch { setMarkets([]) }
    }
    if (view === 'console') loadMarkets()
  }, [view])
  const enterConsole = () => setView(wallet ? 'console' : 'auth')
  const openMarket = (market) => { setSelectedMarket(market); setConsoleView('asset') }
  const handleConnect = (address, token) => { setWallet(address); setAuthToken(token); localStorage.setItem('pulse_wallet', address); localStorage.setItem('pulse_token', token); setView('console') }
  const signOut = () => { localStorage.removeItem('pulse_wallet'); localStorage.removeItem('pulse_token'); setWallet(''); setAuthToken(''); setView('auth'); setConsoleView('marketplace') }
  if (view === 'landing') return <Landing onEnter={enterConsole} />
  if (view === 'auth') return <AuthV2 onConnected={handleConnect} onBack={() => setView('landing')} />
  const navigate = (next) => { setConsoleView(next); setSelectedMarket(null) }
  const handleMarketUpdated = (updatedMarket) => {
    setSelectedMarket(updatedMarket)
    setMarkets((current) => current.map((m) => m.id === updatedMarket.id ? { ...m, ...updatedMarket } : m))
  }
  return <div className="app-shell min-h-screen bg-[#08090b] text-white antialiased"><TopBar wallet={wallet} onSignOut={signOut} onOpenMobile={() => setMobileNavOpen(true)} /><div className="console-layout"><Sidebar active={consoleView} onChange={navigate} />{mobileNavOpen && <MobileMenu active={consoleView} onChange={(next) => { navigate(next); setMobileNavOpen(false) }} onClose={() => setMobileNavOpen(false)} />}<main className="console-main">{consoleView === 'marketplace' && <Marketplace markets={markets} onOpenMarket={openMarket} />}{consoleView === 'asset' && selectedMarket && <AssetDetailLive market={selectedMarket} authToken={authToken} wallet={wallet} onBack={() => setConsoleView('marketplace')} onMarketUpdated={handleMarketUpdated} />}{consoleView === 'portfolio' && <Portfolio authToken={authToken} markets={markets} onOpenMarket={openMarket} />}{consoleView === 'create' && <CreateTokenLive authToken={authToken} onCreated={(market) => { setMarkets((current) => [market, ...current]); setConsoleView('marketplace') }} />}{consoleView === 'profile' && <ProfileLive wallet={wallet} authToken={authToken} />}</main></div></div>
}

function Landing({ onEnter }) { return <div className="landing-page"><div className="grid-bg" /><header className="landing-nav"><Brand /><div className="landing-links"><span>Markets</span><span>How it works</span><span>Protocol</span></div><button className="button button-ghost" onClick={onEnter}>Launch console <ArrowUpRight size={15} /></button></header><main className="hero-content"><div className="eyebrow"><span className="live-dot" /> A new market for human potential</div><h1>Trade the <em>signal</em><br />behind the story.</h1><p className="hero-copy">Pulse turns conviction into a living market. Discover people with momentum, back their trajectory, and watch belief compound in real time.</p><div className="hero-actions"><button className="button button-primary" onClick={onEnter}>Enter Pulse <ArrowUpRight size={17} /></button><button className="text-button" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>See how it works <ChevronDown size={16} /></button></div><div className="hero-stats"><Stat label="Markets live" value="2,481" /><Stat label="Volume, 24h" value="$1.84M" /><Stat label="Network" value="Hedera" /></div></main><section className="hero-terminal" id="how-it-works"><div className="terminal-head"><span><i /><i /><i /></span><span>pulse / market overview</span><span className="terminal-status">â— live</span></div><div className="terminal-content"><div className="terminal-profile"><div className="avatar avatar-lg">AC</div><div><span className="mini-label">Trending market</span><strong>Alex Chen <small>Â· ALEX</small></strong><span className="terminal-role">Founder / climate systems</span></div></div><div className="terminal-price"><span className="mini-label">Current price</span><strong>$4.82</strong><span className="gain"><ArrowUpRight size={13} /> +18.6%</span></div><Sparkline /></div></section><LandingSignals /><footer className="landing-footer"><Brand compact /><span>Built for people with somewhere to go.</span><span>Â© 2026 PULSE NETWORK</span></footer></div> }

function LandingSignals() { return <section className="landing-signals"><div className="signal-intro"><span className="eyebrow">The Pulse thesis</span><h2>Markets should feel<br /><em>human.</em></h2><p>One place to discover momentum, understand context, and participate in the trajectories you believe in.</p></div><div className="signal-cards"><article><div className="signal-icon"><TrendingUp size={17} /></div><span className="mini-label">01 / Discover</span><h3>Find the early signal.</h3><p>Scan a living map of builders, creators, and thinkers before the world catches up.</p></article><article><div className="signal-icon"><CircleDollarSign size={17} /></div><span className="mini-label">02 / Back</span><h3>Put conviction to work.</h3><p>Buy into a person’s market through transparent, always-on liquidity.</p></article><article><div className="signal-icon"><ShieldCheck size={17} /></div><span className="mini-label">03 / Own</span><h3>Keep control by design.</h3><p>Your wallet stays yours. Every transaction is explicit, on-chain, and visible.</p></article></div></section> }

// Legacy auth implementation retained for reference; AuthV2 is the active flow.
// eslint-disable-next-line no-unused-vars
function Auth({ onConnected, onBack }) { const [username, setUsername] = useState(''); const [displayName, setDisplayName] = useState(''); const [bio, setBio] = useState(''); const [connecting, setConnecting] = useState(false); const [error, setError] = useState(''); async function connectWallet() { setError(''); if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) { setError('Choose a username with 3-30 letters, numbers, or underscores.'); return } if (!displayName.trim()) { setError('Add your display name before connecting.'); return } setConnecting(true); try { if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.'); const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }); if (!accounts[0]) throw new Error('No wallet account was selected.'); const address = accounts[0]; const challengeResponse = await fetch(`${API_URL}/v1/auth/wallet/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address, username, displayName, bio }) }); const challenge = await challengeResponse.json(); if (!challengeResponse.ok) throw new Error(challenge.message || 'Unable to start wallet authentication.'); const signature = await window.ethereum.request({ method: 'personal_sign', params: [challenge.message, address] }); const verifyResponse = await fetch(`${API_URL}/v1/auth/wallet/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address, signature }) }); const result = await verifyResponse.json(); if (!verifyResponse.ok) throw new Error(result.message || 'Wallet signature verification failed.'); onConnected(address, result.token) } catch (connectError) { setError(connectError.message) } finally { setConnecting(false) } } return <div className="auth-page"><div className="grid-bg" /><header className="auth-nav"><Brand /><button className="text-button" onClick={onBack}><X size={16} /> Back to home</button></header><main className="auth-card-wrap"><div className="auth-card"><div className="auth-mark"><Wallet size={20} /></div><span className="eyebrow">Your key to the market</span><h1>Join the signal.</h1><p>Create your profile first, then connect and sign with MetaMask.</p><label className="input-label auth-username">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" autoComplete="name" /></label><label className="input-label auth-username">Username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="yourhandle" autoComplete="username" /></label><label className="input-label auth-username">Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="What are you building?" rows="3" /></label><button className="button button-primary full-button" onClick={connectWallet} disabled={connecting}>{connecting ? 'Signing in...' : 'Create profile with MetaMask'} <ArrowUpRight size={16} /></button>{error && <div className="form-error">{error}</div>}<div className="auth-divider"><span>one-time setup</span></div><div className="auth-points"><div><ShieldCheck size={16} /><span>Wallet-native identity</span></div><div><Zap size={16} /><span>Sign in in seconds</span></div><div><CircleDollarSign size={16} /><span>Trade with full control</span></div></div></div></main></div> }

function AuthV2({ onConnected, onBack }) {
  const [mode, setMode] = useState('signup')
  const [form, setForm] = useState({ username: '', displayName: '', bio: '' })
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  async function authenticate() {
    setError('')
    if (mode === 'signup' && (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username) || !form.displayName.trim())) { setError('Add a display name and a valid username before continuing.'); return }
    setConnecting(true)
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.')
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      const payload = mode === 'signup' ? { walletAddress: address, ...form } : { walletAddress: address }
      const challengeResponse = await fetch(`${API_URL}/v1/auth/wallet/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const challenge = await challengeResponse.json()
      if (!challengeResponse.ok) throw new Error(challenge.message || challenge.error || 'Unable to start authentication.')
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [challenge.message, address] })
      const verifyResponse = await fetch(`${API_URL}/v1/auth/wallet/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address, signature }) })
      const result = await verifyResponse.json()
      if (!verifyResponse.ok) throw new Error(result.message || result.error || 'Wallet signature verification failed.')
      onConnected(address, result.token)
    } catch (connectError) { setError(connectError.message) } finally { setConnecting(false) }
  }
  return <div className="auth-page"><div className="grid-bg" /><header className="auth-nav"><Brand /><button className="text-button" onClick={onBack}><X size={16} /> Back to home</button></header><main className="auth-card-wrap"><div className="auth-card auth-card-polished"><div className="auth-mark"><Wallet size={20} /></div><span className="eyebrow">Pulse identity</span><h1>{mode === 'signup' ? 'Start your signal.' : 'Welcome back.'}</h1><p>{mode === 'signup' ? 'Create your profile once, then use your wallet as your key.' : 'Connect the wallet you used to create your Pulse profile.'}</p><div className="auth-mode-tabs"><button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError('') }}>Create account</button><button className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setError('') }}>Sign in</button></div>{mode === 'signup' && <><label className="input-label auth-username">Display name<input value={form.displayName} onChange={update('displayName')} placeholder="Your name" autoComplete="name" /></label><label className="input-label auth-username">Username<input value={form.username} onChange={update('username')} placeholder="yourhandle" autoComplete="username" /></label><label className="input-label auth-username">Bio<textarea value={form.bio} onChange={update('bio')} placeholder="What are you building?" rows="3" /></label></>}<button className="button button-primary full-button" onClick={authenticate} disabled={connecting}>{connecting ? 'Waiting for wallet...' : mode === 'signup' ? 'Create account with MetaMask' : 'Sign in with MetaMask'} <ArrowUpRight size={16} /></button>{error && <div className="form-error">{error}</div>}<div className="auth-divider"><span>secure wallet access</span></div><div className="auth-points"><div><ShieldCheck size={16} /><span>Your keys never leave your wallet</span></div><div><Zap size={16} /><span>One signature to continue</span></div></div></div></main></div>
}

function TopBar({ wallet, onSignOut, onOpenMobile }) { const [walletMenuOpen, setWalletMenuOpen] = useState(false); return <header className="topbar"><Brand /><div className="topbar-actions"><button className="icon-button"><Bell size={17} /></button><div className="wallet-menu-wrap"><button className="wallet-chip" onClick={() => setWalletMenuOpen((open) => !open)} aria-expanded={walletMenuOpen}><span className="wallet-dot" />{wallet.slice(0, 6)}...{wallet.slice(-4)}<ChevronDown size={13} /></button>{walletMenuOpen && <div className="wallet-menu"><span className="wallet-menu-label">Connected wallet</span><strong>{wallet}</strong><button onClick={onSignOut}><LogOut size={14} /> Log out</button></div>}</div><button className="icon-button mobile-menu-trigger" onClick={onOpenMobile}><Menu size={18} /></button></div></header> }
function Sidebar({ active, onChange }) { return <aside className="sidebar"><span className="side-label">Workspace</span>{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onChange(id)} className={active === id ? 'active' : ''}><Icon size={17} /><span>{label}</span>{id === 'create' && <span className="new-badge">new</span>}</button>)}<div className="sidebar-bottom"><span className="side-label">Your account</span><button onClick={() => onChange('profile')} className={active === 'profile' ? 'active' : ''}><Settings2 size={17} /><span>Settings</span></button><div className="network-status"><i /> Hedera testnet <span>â€¢</span></div></div></aside> }
function MobileMenu({ active, onChange, onClose }) { return <div className="mobile-overlay" onClick={onClose}><div className="mobile-panel" onClick={(event) => event.stopPropagation()}><div className="mobile-panel-head"><Brand /><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => onChange(id)}><Icon size={17} />{label}</button>)}</div></div> }

function Marketplace({ markets, onOpenMarket }) { const [query, setQuery] = useState(''); const visibleMarkets = markets.filter((market) => `${market.name} ${market.symbol} ${market.category}`.toLowerCase().includes(query.toLowerCase())); return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">The marketplace</span><h1>Find your next conviction.</h1><p>Live markets for people building the future.</p></div><button className="button button-light"><Plus size={16} /> Create market</button></div><MarketTicker markets={markets} /><div className="market-toolbar"><div className="tabs"><button className="selected">All markets</button><button>Trending</button><button>Newly listed</button></div><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets" /></label></div><div className="section-title"><div><h2>Markets in motion <span className="count">{visibleMarkets.length}</span></h2><p>Ranked by momentum over the last 24 hours.</p></div><button className="filter-button"><Settings2 size={15} /> Filters</button></div><div className="market-grid">{visibleMarkets.map((market) => <MarketCard key={market.id} market={market} onClick={() => onOpenMarket(market)} />)}</div></section> }
function MarketTicker({ markets }) { return <div className="ticker-row"><div className="ticker-intro"><Flame size={16} /><span>Market pulse</span></div>{markets.slice(0, 4).map((market) => <div className="ticker-item" key={market.id}><span>{market.symbol}</span><strong>{formatCurrency(market.price)}</strong><small className={market.change >= 0 ? 'positive' : 'negative'}>{market.change >= 0 ? '+' : ''}{market.change}%</small></div>)}<div className="ticker-end"><TrendingUp size={15} /> Live</div></div> }
function MarketCard({ market, onClick }) { return <button className="market-card" onClick={onClick}><div className="market-card-top"><div className={`avatar avatar-${market.accent}`}>{market.name.split(' ').map((part) => part[0]).join('')}</div><div className="market-card-name"><strong>{market.name}</strong><span>{market.handle} Â· {market.category}</span></div><span className={market.change >= 0 ? 'change-pill positive-bg' : 'change-pill negative-bg'}>{market.change >= 0 ? '+' : ''}{market.change}%</span></div><div className="market-card-middle"><div><span className="mini-label">Price</span><strong>{formatCurrency(market.price)}</strong></div><Sparkline accent={market.accent} down={market.change < 0} /></div><div className="market-card-footer"><span><small>Market cap</small>{market.marketCap}</span><span><small>24h volume</small>{market.volume}</span><span><small>Holders</small>{market.holders.toLocaleString()}</span><ArrowUpRight size={15} /></div></button> }

function AssetDetailLive({ market: initialMarket, authToken, wallet, onBack, onMarketUpdated }) {
  const [market, setMarket] = useState(initialMarket)
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('10')
  const [quote, setQuote] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function refreshMarket() {
    try {
      const response = await fetch(`${API_URL}/v1/markets/${market.id}`)
      if (!response.ok) return
      const payload = await response.json()
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
      setMarket(updated)
      if (onMarketUpdated) onMarketUpdated(updated)
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/v1/markets/${market.id}/quote/${side}?amount=${amount}`)
        if (response.ok) setQuote(await response.json())
      } catch { setQuote(null) }
    }, 250)
    return () => clearTimeout(timer)
  }, [amount, market.id, side])

  async function prepareTrade() {
    if (submitting) return
    setSubmitting(true)
    setMessage('Preparing your order...')
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.')
      if (side === 'buy') {
        setMessage('Checking Hedera token association...')
        const associatedNow = await ensureHederaTokenAssociated(wallet, market.token_id)
        if (associatedNow) setMessage('Token association confirmed. Fetching a live buy quote...')
      }
      const response = await fetch(`${API_URL}/v1/markets/${market.id}/trades/prepare`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ tradeType: side, tokenAmount: amount, maxSlippageBps: 100 }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || result.error || 'Unable to prepare trade')
      if (side === 'sell') {
        const tokenAddress = tokenIdToAddress(result.market.tokenId || market.token_id)
        const approvalData = new Interface(['function approve(address spender,uint256 amount)']).encodeFunctionData('approve', [result.transaction.to, parseUnits(amount, Number(result.market.tokenDecimals || 8))])
        setMessage('Approve token spending in MetaMask...')
        await sendHederaTransaction({ from: wallet, to: tokenAddress, data: approvalData, value: '0x0', gas: result.transaction.gas || HEDERA_TX_GAS })
      }
      setMessage(`Confirm the ${side} transaction in MetaMask...`)
      const transactionId = await sendHederaTransaction({ from: wallet, to: result.transaction.to, data: result.transaction.data, value: result.transaction.value, gas: result.transaction.gas || HEDERA_TX_GAS })
      const confirmResponse = await fetch(`${API_URL}/v1/markets/${market.id}/trades/${result.trade.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ transactionId, status: 'confirmed' }) })
      if (!confirmResponse.ok) throw new Error('Transaction was submitted, but confirmation could not be recorded.')
      setMessage(`✓ Trade confirmed: ${transactionId.slice(0, 10)}...`)
      await refreshMarket()
    } catch (error) { setMessage(error.code === 4001 ? 'Transaction rejected in MetaMask.' : error.message) } finally { setSubmitting(false) }
  }
  return <section className="page-section asset-page"><button className="back-link" onClick={onBack}><ArrowDownRight size={15} /> Back to marketplace</button><div className="asset-head"><div className="asset-identity"><div className={`avatar avatar-${market.accent} avatar-xl`}>{market.name.split(' ').map((part) => part[0]).join('')}</div><div><span className="eyebrow">{market.category} market</span><h1>{market.name} <small>{market.symbol}</small></h1><p>{market.bio}</p></div></div><button className="button button-light"><Bell size={15} /> Watch market</button></div><div className="asset-stats"><Stat label="Current price" value={formatCurrency(market.price)} note={`${market.change >= 0 ? '+' : ''}${market.change}% today`} positive={market.change >= 0} /><Stat label="Reserve balance" value={formatCurrency(Number(market.reserve_balance || market.marketCap || 0))} note="HBAR in curve" /><Stat label="24h volume" value={formatCurrency(Number(market.total_volume || market.volume || 0))} note="Across all trades" /><Stat label="Holders" value={Number(market.holder_count ?? market.holders ?? 0).toLocaleString()} note="Unique wallets" /></div><div className="asset-grid"><div className="chart-panel"><div className="panel-head"><div><h2>Price history</h2><span>Market price in USD</span></div><div className="chart-controls"><button className="selected">Candles</button><button>Line</button><button>1D</button><button>1W</button><button>1M</button></div></div><CandleChart /></div><div className="trade-panel"><div className="trade-tabs"><button className={side === 'buy' ? 'selected' : ''} onClick={() => setSide('buy')} disabled={submitting}>Buy {market.symbol}</button><button className={side === 'sell' ? 'selected sell-tab' : ''} onClick={() => setSide('sell')} disabled={submitting}>Sell {market.symbol}</button></div><div className="trade-body"><div className="trade-balance"><span>Wallet</span><strong>{wallet.slice(0, 6)}...{wallet.slice(-4)}</strong></div><label className="input-label">Token amount <span>{market.symbol}</span></label><div className="trade-input"><input value={amount} disabled={submitting} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} /><span>{market.symbol}</span></div><div className="quick-values"><button disabled={submitting} onClick={() => setAmount('1')}>1</button><button disabled={submitting} onClick={() => setAmount('10')}>10</button><button disabled={submitting} onClick={() => setAmount('25')}>25</button><button disabled={submitting} onClick={() => setAmount('100')}>100</button></div><div className="trade-receipt"><div><span>Settlement estimate</span><strong>{quote ? `${quote.settlementAmount} HBAR` : 'Loading...'}</strong></div><div><span>Price before</span><span>{quote?.priceBefore || '—'}</span></div><div><span>Price after</span><span>{quote?.priceAfter || '—'}</span></div></div><button className={`button full-button ${side === 'buy' ? 'button-primary' : 'button-outline'}`} onClick={prepareTrade} disabled={submitting}>{submitting ? 'Awaiting wallet...' : side === 'buy' ? 'Buy token' : 'Prepare sell'} <ArrowUpRight size={16} /></button>{message && <small className="trade-note">{message}</small>}<small className="trade-note"><ShieldCheck size={13} /> A first buy may require one separate Hedera token-association transaction. The buy itself is a second transaction.</small></div></div></div></section>
}

function Portfolio({ authToken, markets, onOpenMarket }) {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function loadHoldings() {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/v1/users/me/holdings`, { headers: { Authorization: `Bearer ${authToken}` } })
        if (response.ok) { const payload = await response.json(); setHoldings(payload.holdings || []) }
      } catch { setHoldings([]) }
      setLoading(false)
    }
    loadHoldings()
  }, [authToken])
  const totalValue = holdings.reduce((sum, h) => sum + Number(h.token_balance) * Number(h.current_price || 0), 0)
  const totalInvested = holdings.reduce((sum, h) => sum + Number(h.total_invested || 0), 0)
  const totalPnl = totalValue - totalInvested
  const pnlPositive = totalPnl >= 0
  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow">Your portfolio</span><h1>Track your conviction.</h1><p>Everything you own, in one clear view.</p></div></div>
      <div className="portfolio-overview">
        <div>
          <span className="mini-label">Total portfolio value</span>
          <strong>{formatCurrency(totalValue)}</strong>
          <span className={pnlPositive ? 'positive' : 'negative'}>{pnlPositive ? '+' : ''}{formatCurrency(totalPnl)} all time P&amp;L</span>
        </div>
        <div className="portfolio-mini-chart"><Sparkline down={!pnlPositive} /></div>
      </div>
      <div className="section-title"><div><h2>Your positions <span className="count">{holdings.length}</span></h2><p>Tokens you currently hold.</p></div></div>
      {loading && <p className="muted" style={{ padding: '1rem' }}>Loading positions...</p>}
      {!loading && holdings.length === 0 && <div className="watchlist"><p className="muted" style={{ padding: '1.5rem 0' }}>No positions yet. Buy a token to get started.</p></div>}
      {!loading && holdings.length > 0 && (
        <div className="watchlist">
          {holdings.map((h) => {
            const currentValue = Number(h.token_balance) * Number(h.current_price || 0)
            const pnl = currentValue - Number(h.total_invested || 0)
            const isPnlPositive = pnl >= 0
            const md = markets.find((m) => m.id === h.id) || {}
            return (
              <button className="watch-row" key={h.id} onClick={() => onOpenMarket({ ...md, ...h, price: Number(h.current_price || 0), holders: Number(h.holder_count || 0), accent: md.accent || 'cyan', handle: md.handle || 'Pulse market', category: md.category || 'Market', change: md.change || 0, bio: md.bio || 'A live market on Pulse.' })}>
                <div className={`avatar avatar-${md.accent || 'cyan'}`}>{(h.symbol || '??').slice(0, 2)}</div>
                <div className="watch-name"><strong>{h.name}</strong><span>{h.symbol} &middot; {Number(h.token_balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</span></div>
                <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  <strong>{formatCurrency(currentValue)}</strong>
                  <span className={isPnlPositive ? 'positive' : 'negative'} style={{ display: 'block', fontSize: '0.78rem' }}>{isPnlPositive ? '+' : ''}{formatCurrency(pnl)}</span>
                </div>
                <span className="mini-label" style={{ fontSize: '0.72rem' }}>avg {formatCurrency(Number(h.average_entry_price || 0))}</span>
                <ArrowUpRight size={15} />
              </button>
            )
          })}
        </div>
      )}
      {markets.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: '2rem' }}><div><h2>Explore more <span className="count">{markets.length}</span></h2><p>Markets you might want to follow.</p></div></div>
          <div className="watchlist">{markets.slice(0, 4).map((market) => (<button className="watch-row" key={market.id} onClick={() => onOpenMarket(market)}><div className={`avatar avatar-${market.accent}`}>{market.symbol.slice(0, 2)}</div><div className="watch-name"><strong>{market.name}</strong><span>{market.symbol} &middot; {market.category}</span></div><Sparkline accent={market.accent} down={market.change < 0} /><strong>{formatCurrency(market.price)}</strong><span className={market.change >= 0 ? 'positive' : 'negative'}>{market.change >= 0 ? '+' : ''}{market.change}%</span><ArrowUpRight size={15} /></button>))}</div>
        </>
      )}
    </section>
  )
}
function CreateTokenLive({ authToken, onCreated }) {
  const [form, setForm] = useState({ name: '', symbol: '', basePrice: '0.01', slope: '0.00001', maxSupply: '1000000' })
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  async function createMarket() {
    setCreating(true)
    setMessage('Creating the HTS token and registering the market on Hedera...')
    try {
      const response = await fetch(`${API_URL}/v1/markets`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || result.error || 'Market creation failed')
      if (result.partial) { setCreated(true); setMessage(`${result.message} Token ID: ${result.token.tokenId}`); return }
      onCreated({ ...result.market, name: form.name, symbol: form.symbol, price: Number(form.basePrice), change: 0, marketCap: '—', volume: '0', holders: 0, category: 'New market', accent: 'cyan', bio: 'A new market on Pulse.' })
    } catch (error) { setMessage(error.message) } finally { setCreating(false) }
  }
  return <section className="page-section narrow-page"><div className="page-heading"><div><span className="eyebrow">Launch a market</span><h1>Put your trajectory on-chain.</h1><p>Create a token that represents your next chapter.</p></div><div className="step-indicator"><span className="active">01</span><i /><span>02</span><i /><span>03</span></div></div><div className="create-layout"><div className="create-form panel"><div className="panel-head"><div><h2>Market details</h2><span>HTS token plus a shared bonding curve.</span></div><Sparkles size={18} /></div><label className="input-label">Market name<input value={form.name} onChange={update('name')} placeholder="e.g. Alex Chen Potential" /></label><label className="input-label">Ticker symbol<div className="input-with-prefix"><span>$</span><input value={form.symbol} onChange={update('symbol')} placeholder="ALEX" maxLength="20" /></div></label><div className="form-row"><label className="input-label">Starting price<div className="input-with-prefix"><span>$</span><input value={form.basePrice} onChange={update('basePrice')} /></div></label><label className="input-label">Supply cap<input value={form.maxSupply} onChange={update('maxSupply')} /></label></div><label className="input-label">Curve slope<input value={form.slope} onChange={update('slope')} /></label><button className="button button-primary full-button" onClick={createMarket} disabled={creating || created || !form.name || !form.symbol}>{creating ? 'Creating on Hedera...' : created ? 'Token created' : 'Create market'} <ArrowUpRight size={16} /></button>{message && <small className="trade-note">{message}</small>}</div><div className="preview-panel"><span className="mini-label">Live preview</span><div className="preview-market"><div className="avatar avatar-cyan avatar-lg">{(form.symbol || 'AC').slice(0, 2)}</div><span className="eyebrow">Builder market</span><h2>{form.name || 'Your market'} <small>${form.symbol || 'TOKEN'}</small></h2><p>Created on Hedera with transparent supply and market rules.</p><div className="preview-price"><span>${form.basePrice || '0.01'}</span><strong>+0.0%</strong></div><Sparkline /></div><div className="preview-note"><ShieldCheck size={16} /><span>Token creation requires your configured Hedera operator and deployed factory.</span></div></div></div></section>
}
function ProfileLive({ wallet, authToken }) {
  const [form, setForm] = useState({ displayName: '', username: '', bio: '', headline: '', category: '', location: '', websiteUrl: '' })
  const [message, setMessage] = useState('')
  useEffect(() => { fetch(`${API_URL}/v1/users/me`, { headers: { Authorization: `Bearer ${authToken}` } }).then((response) => response.ok ? response.json() : null).then((result) => { if (result?.user) setForm((current) => ({ ...current, ...result.user, displayName: result.user.display_name || '', websiteUrl: result.user.website_url || '' })) }).catch(() => {}) }, [authToken])
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  async function saveProfile() { setMessage('Saving...'); const response = await fetch(`${API_URL}/v1/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify(form) }); setMessage(response.ok ? 'Profile saved.' : 'Unable to save profile.') }
  return <section className="page-section narrow-page"><div className="page-heading"><div><span className="eyebrow">Your identity</span><h1>Make your signal legible.</h1><p>This is how you show up across Pulse.</p></div><button className="button button-light"><Settings2 size={16} /> Settings</button></div><div className="profile-layout"><div className="profile-card panel"><div className="profile-cover" /><div className="profile-card-body"><div className="avatar avatar-xl avatar-cyan profile-avatar">{(form.displayName || 'YU').slice(0, 2).toUpperCase()}</div><span className="verified"><Check size={12} /> Wallet connected</span><h2>Your Pulse profile</h2><p className="muted">Tell the market what you are building and why it matters.</p><label className="input-label">Display name<input value={form.displayName} onChange={update('displayName')} placeholder="Your name" /></label><label className="input-label">Username<input value={form.username} onChange={update('username')} placeholder="yourhandle" /></label><label className="input-label">Bio<textarea value={form.bio} onChange={update('bio')} rows="3" placeholder="A short signal about your trajectory." /></label><button className="button button-primary" onClick={saveProfile}>Save profile <Check size={15} /></button>{message && <small className="trade-note">{message}</small>}</div></div><div className="wallet-panel panel"><div className="panel-head"><div><h2>Wallet</h2><span>Your non-custodial identity</span></div><Wallet size={18} /></div><div className="wallet-address"><span className="wallet-dot" />{wallet}<button className="icon-button"><Copy size={14} /></button></div><div className="wallet-meta"><span>Network</span><strong>Hedera testnet</strong><span>Connection</span><strong className="positive">Active</strong></div></div></div></section>
}

function Brand({ compact = false }) { return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><span /><span /><span /></span><strong>PULSE</strong></div> }
function Stat({ label, value, note, positive }) { return <div className="stat"><span className="mini-label">{label}</span><strong>{value}</strong>{note && <span className={positive ? 'positive' : 'muted'}>{note}</span>}</div> }
function Sparkline({ accent = 'cyan', down = false }) { const points = down ? '0,14 12,8 24,12 36,7 48,15 60,11 72,17 84,13 96,21 108,18' : '0,22 12,17 24,19 36,11 48,16 60,7 72,12 84,4 96,8 108,1'; return <svg className={`sparkline spark-${accent}`} viewBox="0 0 108 24" preserveAspectRatio="none" aria-label="Price movement chart"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" /></svg> }
function CandleChart() { const candles = [16, 24, 20, 29, 19, 34, 26, 41, 32, 38, 44, 36, 48, 43, 53, 49, 62, 58, 67, 63, 71, 64, 77, 74]; return <div className="candle-chart"><div className="chart-y-axis"><span>$5.20</span><span>$4.80</span><span>$4.40</span><span>$4.00</span><span>$3.60</span></div><div className="chart-grid"><div className="grid-lines"><i /><i /><i /><i /><i /></div><div className="candles">{candles.map((height, index) => <span className={`candle ${index % 5 === 3 ? 'red' : ''}`} key={index} style={{ '--height': `${height}%`, '--delay': `${index * 0.03}s` }}><i /></span>)}</div><div className="chart-x-axis"><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span></div></div></div> }
export default App
