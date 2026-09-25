// Auth state for the whole app. Holds the current user decoded from the JWT and provides
// login, register, and logout. On startup it also picks up a token from the URL hash,
// which is how the LinkedIn callback hands the token to the app.
import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)

function decodeUser(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return { id: payload.sub, role: payload.role, name: payload.name }
  } catch {
    return null
  }
}

function tokenFromHash() {
  const match = /[#&]token=([^&]+)/.exec(window.location.hash || '')
  return match ? match[1] : null
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    const fromHash = tokenFromHash()
    if (fromHash) setToken(fromHash)
    const token = fromHash || getToken()
    return token ? decodeUser(token) : null
  })

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (tokenFromHash()) {
      window.history.replaceState(null, '', window.location.pathname)
      navigate('/jobs', { replace: true })
    }
  }, [])

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setToken(data.token)
    setUser(decodeUser(data.token))
  }

  async function register(fields) {
    const data = await api('/auth/register', { method: 'POST', body: fields })
    setToken(data.token)
    setUser(decodeUser(data.token))
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
