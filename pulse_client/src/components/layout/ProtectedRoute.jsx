import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AppShell from './AppShell'

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
