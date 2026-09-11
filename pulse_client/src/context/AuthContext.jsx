import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [wallet, setWallet] = useState(() => localStorage.getItem('pulse_wallet') || '')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pulse_token') || '')
  const [userId, setUserId] = useState(() => localStorage.getItem('pulse_user_id') || '')

  const signIn = (address, token, uid) => {
    setWallet(address)
    setAuthToken(token)
    if (uid) setUserId(uid)
    localStorage.setItem('pulse_wallet', address)
    localStorage.setItem('pulse_token', token)
    if (uid) localStorage.setItem('pulse_user_id', uid)
  }

  const signOut = () => {
    setWallet('')
    setAuthToken('')
    setUserId('')
    localStorage.removeItem('pulse_wallet')
    localStorage.removeItem('pulse_token')
    localStorage.removeItem('pulse_user_id')
  }

  return (
    <AuthContext.Provider value={{ wallet, authToken, userId, isAuthenticated: !!wallet && !!authToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
