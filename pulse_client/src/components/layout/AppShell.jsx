import { useState } from 'react'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import MobileMenu from './MobileMenu'

export default function AppShell({ children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar onOpenMobile={() => setMobileNavOpen(true)} />
      <div className="console-layout">
        <Sidebar />
        {mobileNavOpen && <MobileMenu onClose={() => setMobileNavOpen(false)} />}
        <main className="console-main">{children}</main>
      </div>
    </div>
  )
}
