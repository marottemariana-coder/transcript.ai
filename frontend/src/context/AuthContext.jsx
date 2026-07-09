import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (localStorage.getItem('token'))
      api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token'))
  }, [])

  const login = async (path, email, password) => {
    const data = await api(`/auth/${path}`, { method: 'POST', body: JSON.stringify({ email, password }) })
    localStorage.setItem('token', data.token)
    setUser(await api('/auth/me'))
  }
  const logout = () => { localStorage.removeItem('token'); setUser(null) }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>
}
