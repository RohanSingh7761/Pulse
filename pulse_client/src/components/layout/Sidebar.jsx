import { useNavigate, useLocation } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { navItems } from '../../lib/constants'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(item) {
    if (item.path === '/app') return location.pathname === '/app'
    return location.pathname.startsWith(item.path)
  }

  return (
    <aside className="sidebar">
      <span className="side-label">Workspace</span>
      {navItems.map(({ id, label, icon: Icon, path }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={isActive({ path }) ? 'active' : ''}
        >
          <Icon size={17} />
          <span>{label}</span>
          {id === 'create' && <span className="new-badge">new</span>}
        </button>
      ))}
      <div className="sidebar-bottom">
        <span className="side-label">Your account</span>
        <button
          onClick={() => navigate('/app/profile')}
          className={location.pathname === '/app/profile' ? 'active' : ''}
        >
          <Settings2 size={17} />
          <span>Settings</span>
        </button>
        <div className="network-status"><i /> Hedera testnet <span>•</span></div>
      </div>
    </aside>
  )
}
