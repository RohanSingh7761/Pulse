import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import Brand from '../ui/Brand'
import { navItems } from '../../lib/constants'

export default function MobileMenu({ onClose }) {
  const navigate = useNavigate()

  function go(path) {
    navigate(path)
    onClose()
  }

  return (
    <div className="mobile-overlay" onClick={onClose}>
      <div className="mobile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-panel-head">
          <Brand />
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        {navItems.map(({ id, label, icon: Icon, path }) => (
          <button key={id} onClick={() => go(path)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>
    </div>
  )
}
