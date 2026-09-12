import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, CircleDollarSign, ShieldCheck, TrendingUp } from 'lucide-react'
import Brand from '../components/ui/Brand'
import Sparkline from '../components/ui/Sparkline'
import Stat from '../components/ui/Stat'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../lib/api'
import { formatCurrency } from '../lib/constants'

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [stats, setStats] = useState({ count: 0, totalVolume: 0, topMarket: null })

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`${API_URL}/v1/markets`)
        if (!res.ok) return
        const payload = await res.json()
        const markets = payload.markets || []
        const count = markets.length
        const totalVolume = markets.reduce((acc, m) => acc + Number(m.total_volume || 0), 0)
        const topMarket = markets[0] || null
        setStats({ count, totalVolume, topMarket })
      } catch { /* ignore */ }
    }
    loadStats()
  }, [])

  function enter() {
    navigate(isAuthenticated ? '/app' : '/auth')
  }

  const topName = stats.topMarket?.name || 'Pulse Market'
  const topSymbol = stats.topMarket?.symbol || 'PULSE'
  const topPrice = Number(stats.topMarket?.current_price || 1.0)
  const topInitials = topName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="landing-page">
      <div className="grid-bg" />
      <header className="landing-nav">
        <Brand />
        <div className="landing-links">
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/app')}>Markets</span>
          <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works</span>
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/app')}>Protocol</span>
        </div>
        <button className="button button-ghost" onClick={enter}>
          Launch console <ArrowUpRight size={15} />
        </button>
      </header>

      <main className="hero-content">
        <div className="eyebrow"><span className="live-dot" /> A live market for human potential</div>
        <h1>Trade the <em>signal</em><br />behind the story.</h1>
        <p className="hero-copy">
          Pulse turns conviction into a living market. Back founders and builders with real capital,
          track their progress through verified updates, and participate on-chain.
        </p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={enter}>
            Enter Pulse <ArrowUpRight size={17} />
          </button>
          <button
            className="text-button"
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See how it works <ChevronDown size={16} />
          </button>
        </div>
        <div className="hero-stats">
          <Stat label="Markets live" value={stats.count ? stats.count.toString() : 'Live'} />
          <Stat label="Volume, 24h" value={formatCurrency(stats.totalVolume)} />
          <Stat label="Network" value="Hedera" />
        </div>
      </main>

      <section className="hero-terminal" id="how-it-works">
        <div className="terminal-head">
          <span><i /><i /><i /></span>
          <span>pulse / market overview</span>
          <span className="terminal-status">● live</span>
        </div>
        <div className="terminal-content">
          <div className="terminal-profile">
            <div className="avatar avatar-lg">{topInitials}</div>
            <div>
              <span className="mini-label">Featured market</span>
              <strong>{topName} <small>· {topSymbol}</small></strong>
              <span className="terminal-role">{stats.topMarket?.category || 'Builder market'}</span>
            </div>
          </div>
          <div className="terminal-price">
            <span className="mini-label">Current price</span>
            <strong>{formatCurrency(topPrice)}</strong>
            <span className="gain"><ArrowUpRight size={13} /> Active</span>
          </div>
          <Sparkline />
        </div>
      </section>

      <LandingSignals />

      <footer className="landing-footer">
        <Brand compact />
        <span>Built for people with somewhere to go.</span>
        <span>© 2026 PULSE NETWORK</span>
      </footer>
    </div>
  )
}

function LandingSignals() {
  return (
    <section className="landing-signals">
      <div className="signal-intro">
        <span className="eyebrow">The Pulse thesis</span>
        <h2>Markets should feel<br /><em>human.</em></h2>
        <p>One place to discover momentum, understand context, and participate in the trajectories you believe in.</p>
      </div>
      <div className="signal-cards">
        <article>
          <div className="signal-icon"><TrendingUp size={17} /></div>
          <span className="mini-label">01 / Discover</span>
          <h3>Find the early signal.</h3>
          <p>Scan a living map of builders, creators, and thinkers before the world catches up.</p>
        </article>
        <article>
          <div className="signal-icon"><CircleDollarSign size={17} /></div>
          <span className="mini-label">02 / Back</span>
          <h3>Put conviction to work.</h3>
          <p>Buy into a person's market through transparent, always-on liquidity.</p>
        </article>
        <article>
          <div className="signal-icon"><ShieldCheck size={17} /></div>
          <span className="mini-label">03 / Own</span>
          <h3>Keep control by design.</h3>
          <p>Your wallet stays yours. Every transaction is explicit, on-chain, and visible.</p>
        </article>
      </div>
    </section>
  )
}
