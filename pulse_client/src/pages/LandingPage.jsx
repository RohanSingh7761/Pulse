import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, CircleDollarSign, ShieldCheck, TrendingUp } from 'lucide-react'
import Brand from '../components/ui/Brand'
import Sparkline from '../components/ui/Sparkline'
import Stat from '../components/ui/Stat'
import { useAuth } from '../context/AuthContext'

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  function enter() {
    navigate(isAuthenticated ? '/app' : '/auth')
  }

  return (
    <div className="landing-page">
      <div className="grid-bg" />
      <header className="landing-nav">
        <Brand />
        <div className="landing-links">
          <span>Markets</span>
          <span>How it works</span>
          <span>Protocol</span>
        </div>
        <button className="button button-ghost" onClick={enter}>
          Launch console <ArrowUpRight size={15} />
        </button>
      </header>

      <main className="hero-content">
        <div className="eyebrow"><span className="live-dot" /> A new market for human potential</div>
        <h1>Trade the <em>signal</em><br />behind the story.</h1>
        <p className="hero-copy">
          Pulse turns conviction into a living market. Back founders and builders with real capital,
          watch them hit milestones, and earn as their momentum compounds on-chain.
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
          <Stat label="Markets live" value="2,481" />
          <Stat label="Volume, 24h" value="$1.84M" />
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
            <div className="avatar avatar-lg">AC</div>
            <div>
              <span className="mini-label">Trending market</span>
              <strong>Alex Chen <small>· ALEX</small></strong>
              <span className="terminal-role">Founder / climate systems</span>
            </div>
          </div>
          <div className="terminal-price">
            <span className="mini-label">Current price</span>
            <strong>$4.82</strong>
            <span className="gain"><ArrowUpRight size={13} /> +18.6%</span>
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
