import { useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Brand from '../ui/Brand'
import { useAuth } from '../../context/AuthContext'

export default function TopBar({ onOpenMobile }) {
  const { wallet, signOut } = useAuth()
  const navigate = useNavigate()
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)

  function handleSignOut() {
    signOut()
    navigate('/auth')
  }

  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
        <div className="wallet-menu-wrap">
          <button
            className="wallet-chip"
            onClick={() => setWalletMenuOpen((o) => !o)}
            aria-expanded={walletMenuOpen}
          >
            <span className="wallet-dot" />
            {wallet.slice(0, 6)}...{wallet.slice(-4)}
            <ChevronDown size={13} />
          </button>
          {walletMenuOpen && (
            <div className="wallet-menu">
              <span className="wallet-menu-label">Connected wallet</span>
              <strong>{wallet}</strong>
              <button onClick={handleSignOut}><LogOut size={14} /> Log out</button>
            </div>
          )}
        </div>
        <button className="icon-button mobile-menu-trigger" onClick={onOpenMobile} aria-label="Open menu">
          <Menu size={18} />
        </button>
      </div>
    </header>
  )
}
