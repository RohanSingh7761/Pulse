import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react'
import Sparkline from '../components/ui/Sparkline'
import { API_URL } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/constants'

export default function CreateTokenPage() {
  const { authToken } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', symbol: '', basePrice: '0.01', slope: '0.00001', maxSupply: '1000000',
  })
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function createMarket() {
    setCreating(true)
    setMessage('Creating the HTS token and registering the market on Hedera...')
    try {
      const res = await fetch(`${API_URL}/v1/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || result.error || 'Market creation failed')
      if (result.partial) {
        setCreated(true)
        setMessage(`${result.message} Token ID: ${result.token.tokenId}`)
        return
      }
      setMessage('✓ Market created successfully! Redirecting...')
      setTimeout(() => navigate('/app'), 1500)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="page-section narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Launch a market</span>
          <h1>Put your trajectory on-chain.</h1>
          <p>Create a token that represents your next chapter.</p>
        </div>
        <div className="step-indicator">
          <span className="active">01</span><i /><span>02</span><i /><span>03</span>
        </div>
      </div>

      <div className="create-layout">
        <div className="create-form panel">
          <div className="panel-head">
            <div>
              <h2>Market details</h2>
              <span>HTS token plus a bonding curve on Hedera.</span>
            </div>
            <Sparkles size={18} />
          </div>

          <label className="input-label">
            Market name
            <input value={form.name} onChange={update('name')} placeholder="e.g. Alex Chen Potential" />
          </label>
          <label className="input-label">
            Ticker symbol
            <div className="input-with-prefix">
              <span>$</span>
              <input value={form.symbol} onChange={update('symbol')} placeholder="ALEX" maxLength="20" />
            </div>
          </label>
          <div className="form-row">
            <label className="input-label">
              Starting price
              <div className="input-with-prefix"><span>$</span><input value={form.basePrice} onChange={update('basePrice')} /></div>
            </label>
            <label className="input-label">
              Supply cap
              <input value={form.maxSupply} onChange={update('maxSupply')} />
            </label>
          </div>
          <label className="input-label">
            Curve slope
            <input value={form.slope} onChange={update('slope')} />
          </label>

          <button
            className="button button-primary full-button"
            onClick={createMarket}
            disabled={creating || created || !form.name || !form.symbol}
          >
            {creating ? 'Creating on Hedera...' : created ? 'Token created' : 'Create market'} <ArrowUpRight size={16} />
          </button>
          {message && <small className="trade-note" style={{ marginTop: '14px', display: 'block' }}>{message}</small>}
        </div>

        <div className="preview-panel">
          <span className="mini-label">Live preview</span>
          <div className="preview-market">
            <div className="avatar avatar-cyan avatar-lg">{(form.symbol || 'AC').slice(0, 2)}</div>
            <span className="eyebrow">Builder market</span>
            <h2>{form.name || 'Your market'} <small>${form.symbol || 'TOKEN'}</small></h2>
            <p>Created on Hedera with transparent supply and market rules.</p>
            <div className="preview-price">
              <span>{formatCurrency(Number(form.basePrice) || 0.01)}</span>
              <strong>+0.0%</strong>
            </div>
            <Sparkline />
          </div>
          <div className="preview-note">
            <ShieldCheck size={16} />
            <span>Token creation requires your configured Hedera operator and deployed factory contract.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
