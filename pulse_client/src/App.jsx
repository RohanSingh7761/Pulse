import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import MarketplacePage from './pages/MarketplacePage'
import TokenDetailPage from './pages/TokenDetailPage'
import PortfolioPage from './pages/PortfolioPage'
import TradeHistoryPage from './pages/TradeHistoryPage'
import CreateTokenPage from './pages/CreateTokenPage'
import ProfilePage from './pages/ProfilePage'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/app" element={<ProtectedRoute />}>
            <Route index element={<MarketplacePage />} />
            <Route path="market/:id" element={<TokenDetailPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="trades" element={<TradeHistoryPage />} />
            <Route path="create" element={<CreateTokenPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
