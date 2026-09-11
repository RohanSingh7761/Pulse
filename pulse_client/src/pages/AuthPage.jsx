import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowUpRight, Check, ShieldCheck, TrendingUp, Wallet, Zap, X } from 'lucide-react'
import Brand from '../components/ui/Brand'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../lib/api'

export default function AuthPage() {
  const [mode, setMode] = useState('signup')
  const navigate = useNavigate()
  const { signIn } = useAuth()

  function switchMode(next) {
    setMode(next)
  }

  return (
    <div className="auth-page">
      <div className="grid-bg" />
      <header className="auth-nav">
        <Brand />
        <Link to="/" className="text-button"><X size={16} /> Back to home</Link>
      </header>
      <main className="auth-layout">
        <AuthLeft mode={mode} />
        <div className="auth-right">
          <div className="auth-card-v2">
            <div className="auth-mode-tabs">
              <button className={mode === 'signup' ? 'selected' : ''} onClick={() => switchMode('signup')}>
                Create account
              </button>
              <button className={mode === 'signin' ? 'selected' : ''} onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </div>
            {mode === 'signup'
              ? <SignupForm onSuccess={(addr, token, uid) => { signIn(addr, token, uid); navigate('/app') }} />
              : <SigninForm onSuccess={(addr, token, uid) => { signIn(addr, token, uid); navigate('/app') }} />
            }
          </div>
        </div>
      </main>
    </div>
  )
}

function AuthLeft({ mode }) {
  return (
    <div className="auth-left">
      <div className="auth-left-inner">
        <span className="eyebrow">Pulse identity</span>
        <h1>
          {mode === 'signup' ? <>Your market<br />starts here.</> : <>Welcome<br />back.</>}
        </h1>
        <p>
          {mode === 'signup'
            ? 'Create your profile once. Your wallet becomes your key — no passwords, no custody.'
            : 'Connect the wallet you used to create your Pulse account. One click to continue.'}
        </p>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon"><ShieldCheck size={16} /></div>
            <div>
              <strong>Non-custodial identity</strong>
              <span>Your keys never leave your device</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Zap size={16} /></div>
            <div>
              <strong>Sign in instantly</strong>
              <span>One MetaMask signature, done</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><TrendingUp size={16} /></div>
            <div>
              <strong>Trade with conviction</strong>
              <span>Back founders, earn as they grow</span>
            </div>
          </div>
        </div>
        <div className="auth-network">
          <i className="auth-net-dot" /> Running on Hedera testnet
        </div>
      </div>
    </div>
  )
}

function SignupForm({ onSuccess }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ displayName: '', username: '', bio: '' })
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function validateStep1() {
    if (!form.displayName.trim()) return 'Please enter your display name.'
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username))
      return 'Username must be 3–30 characters: letters, numbers, underscores only.'
    return null
  }

  function goToStep2() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  async function connectAndSign() {
    setConnecting(true)
    setError('')
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.')
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      const challengeRes = await fetch(`${API_URL}/v1/auth/wallet/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, username: form.username, displayName: form.displayName, bio: form.bio }),
      })
      const challenge = await challengeRes.json()
      if (!challengeRes.ok) throw new Error(challenge.message || challenge.error || 'Authentication challenge failed.')
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [challenge.message, address] })
      const verifyRes = await fetch(`${API_URL}/v1/auth/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, signature }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(result.message || result.error || 'Signature verification failed.')
      onSuccess(address, result.token, result.user?.id)
    } catch (err) {
      setError(err.code === 4001 ? 'You rejected the MetaMask request.' : err.message)
      setStep(1)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="auth-form">
      {step === 1 && (
        <>
          <div className="auth-form-header">
            <span className="step-badge">Step 1 of 2 — Your profile</span>
            <h2>Tell us who you are</h2>
            <p>Only your name and username are required. You can fill in more details later.</p>
          </div>

          <label className="input-label" htmlFor="displayName">
            Display name <span className="req-star">*</span>
            <input
              id="displayName"
              value={form.displayName}
              onChange={update('displayName')}
              placeholder="Alex Chen"
              autoComplete="name"
            />
          </label>
          <label className="input-label" htmlFor="username">
            Username <span className="req-star">*</span>
            <input
              id="username"
              value={form.username}
              onChange={update('username')}
              placeholder="alexchen"
              autoComplete="username"
            />
            <span className="input-hint">Letters, numbers, underscores · 3–30 chars</span>
          </label>
          <label className="input-label" htmlFor="bio">
            Bio <span className="optional-tag">optional</span>
            <textarea
              id="bio"
              value={form.bio}
              onChange={update('bio')}
              placeholder="What are you building?"
              rows="3"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="button button-primary full-button" onClick={goToStep2}>
            Continue <ArrowUpRight size={16} />
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="auth-form-header">
            <span className="step-badge">Step 2 of 2 — Connect wallet</span>
            <h2>Sign with MetaMask</h2>
            <p>
              You'll be asked to sign a one-time message to prove ownership of your wallet.
              No funds will be moved.
            </p>
          </div>

          <div className="auth-preview-profile">
            <div className="avatar avatar-cyan">
              {form.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{form.displayName}</strong>
              <span>@{form.username}</span>
            </div>
            <button className="text-button" onClick={() => setStep(1)}>Edit</button>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            className="button button-primary full-button"
            onClick={connectAndSign}
            disabled={connecting}
          >
            {connecting
              ? <><span className="spinner" /> Waiting for MetaMask...</>
              : <><Wallet size={16} /> Create account with MetaMask</>
            }
          </button>

          <div className="auth-secure-note">
            <ShieldCheck size={13} /> Signing is free and does not send a transaction
          </div>
        </>
      )}
    </div>
  )
}

function SigninForm({ onSuccess }) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  async function connect() {
    setConnecting(true)
    setError('')
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed in this browser.')
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts[0]
      const challengeRes = await fetch(`${API_URL}/v1/auth/wallet/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      const challenge = await challengeRes.json()
      if (!challengeRes.ok) throw new Error(challenge.message || challenge.error || 'No account found for this wallet. Please create an account first.')
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [challenge.message, address] })
      const verifyRes = await fetch(`${API_URL}/v1/auth/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, signature }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(result.message || result.error || 'Signature verification failed.')
      onSuccess(address, result.token, result.user?.id)
    } catch (err) {
      setError(err.code === 4001 ? 'You rejected the MetaMask request.' : err.message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-form-header">
        <h2>Welcome back</h2>
        <p>Connect the wallet you used when creating your Pulse account.</p>
      </div>

      <div className="signin-steps">
        <div className="signin-step">
          <div className="signin-step-num">1</div>
          <span>MetaMask opens automatically</span>
        </div>
        <div className="signin-step">
          <div className="signin-step-num">2</div>
          <span>Sign the one-time authentication message</span>
        </div>
        <div className="signin-step">
          <div className="signin-step-num">3</div>
          <span>You're in — no password needed</span>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button className="button button-primary full-button" onClick={connect} disabled={connecting}>
        {connecting
          ? <><span className="spinner" /> Waiting for MetaMask...</>
          : <><Wallet size={16} /> Connect with MetaMask</>
        }
      </button>
      <div className="auth-secure-note">
        <ShieldCheck size={13} /> Signing is free and does not send a transaction
      </div>
      <div className="auth-no-account">
        Don't have an account?{' '}
        <button className="text-button inline" onClick={() => { /* handled by parent tab switch */ }}>
          Create one above
        </button>
      </div>
    </div>
  )
}
