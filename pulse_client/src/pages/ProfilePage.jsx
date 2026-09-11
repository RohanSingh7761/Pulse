import { useState, useEffect } from 'react'
import { Check, Copy, Settings2, Wallet } from 'lucide-react'
import { API_URL } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { wallet, authToken } = useAuth()
  const [form, setForm] = useState({
    displayName: '', username: '', bio: '', headline: '', category: '', location: '', websiteUrl: '',
    twitterUrl: '', githubUrl: '', linkedinUrl: '',
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/users/me`, { headers: { Authorization: `Bearer ${authToken}` } })
        if (!res.ok) return
        const { user } = await res.json()
        if (user) setForm((f) => ({
          ...f, ...user,
          displayName: user.display_name || '',
          websiteUrl: user.website_url || '',
          twitterUrl: user.twitter_url || '',
          githubUrl: user.github_url || '',
          linkedinUrl: user.linkedin_url || '',
        }))
      } catch { /* ignore */ }
    }
    load()
  }, [authToken])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function save() {
    setSaving(true)
    setMessage('Saving...')
    try {
      const res = await fetch(`${API_URL}/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form),
      })
      setMessage(res.ok ? '✓ Profile saved.' : 'Unable to save profile.')
    } catch { setMessage('Network error.') }
    setSaving(false)
  }

  function copyWallet() {
    navigator.clipboard.writeText(wallet).catch(() => {})
  }

  return (
    <section className="page-section narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your identity</span>
          <h1>Make your signal legible.</h1>
          <p>This is how you show up across Pulse.</p>
        </div>
        <button className="button button-light"><Settings2 size={16} /> Settings</button>
      </div>

      <div className="profile-layout">
        <div className="profile-card panel">
          <div className="profile-cover" />
          <div className="profile-card-body">
            <div className="avatar avatar-xl avatar-cyan profile-avatar">
              {(form.displayName || 'YU').slice(0, 2).toUpperCase()}
            </div>
            <span className="verified"><Check size={12} /> Wallet connected</span>
            <h2>Your Pulse profile</h2>
            <p className="muted">Tell the market what you are building and why it matters.</p>

            <div className="form-row">
              <label className="input-label">
                Display name
                <input value={form.displayName} onChange={update('displayName')} placeholder="Your name" />
              </label>
              <label className="input-label">
                Username
                <input value={form.username} onChange={update('username')} placeholder="yourhandle" />
              </label>
            </div>
            <label className="input-label">
              Bio
              <textarea value={form.bio} onChange={update('bio')} rows="3" placeholder="A short signal about your trajectory." />
            </label>
            <div className="form-row">
              <label className="input-label">
                Headline
                <input value={form.headline} onChange={update('headline')} placeholder="Founder / Climate tech" />
              </label>
              <label className="input-label">
                Category
                <input value={form.category} onChange={update('category')} placeholder="Technology" />
              </label>
            </div>
            <label className="input-label">
              Location
              <input value={form.location} onChange={update('location')} placeholder="San Francisco, CA" />
            </label>

            <div className="profile-section-label">Social links</div>
            <div className="form-row">
              <label className="input-label">
                Website
                <input value={form.websiteUrl} onChange={update('websiteUrl')} placeholder="https://yoursite.com" />
              </label>
              <label className="input-label">
                Twitter / X
                <input value={form.twitterUrl} onChange={update('twitterUrl')} placeholder="https://x.com/you" />
              </label>
            </div>
            <div className="form-row">
              <label className="input-label">
                GitHub
                <input value={form.githubUrl} onChange={update('githubUrl')} placeholder="https://github.com/you" />
              </label>
              <label className="input-label">
                LinkedIn
                <input value={form.linkedinUrl} onChange={update('linkedinUrl')} placeholder="https://linkedin.com/in/you" />
              </label>
            </div>

            <button className="button button-primary" onClick={save} disabled={saving}>
              Save profile <Check size={15} />
            </button>
            {message && <small className="trade-note" style={{ marginTop: '12px', display: 'block' }}>{message}</small>}
          </div>
        </div>

        <div className="wallet-panel panel">
          <div className="panel-head">
            <div><h2>Wallet</h2><span>Your non-custodial identity</span></div>
            <Wallet size={18} />
          </div>
          <div className="wallet-address">
            <span className="wallet-dot" />
            {wallet}
            <button className="icon-button" onClick={copyWallet} title="Copy address"><Copy size={14} /></button>
          </div>
          <div className="wallet-meta">
            <span>Network</span><strong>Hedera testnet</strong>
            <span>Connection</span><strong className="positive">Active</strong>
          </div>

          <div className="profile-completeness">
            <span className="mini-label" style={{ marginBottom: '12px', display: 'block' }}>Profile completeness</span>
            <div className="completeness-bar">
              <div
                className="completeness-fill"
                style={{ width: `${getCompleteness(form)}%` }}
              />
            </div>
            <span className="completeness-label">{getCompleteness(form)}% complete</span>
            {getCompleteness(form) < 100 && (
              <p className="completeness-hint">
                Complete your profile to unlock token creation and improve discoverability.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function getCompleteness(form) {
  const fields = ['displayName', 'username', 'bio', 'headline', 'category', 'location', 'websiteUrl']
  const filled = fields.filter((k) => form[k] && String(form[k]).trim()).length
  return Math.round((filled / fields.length) * 100)
}
