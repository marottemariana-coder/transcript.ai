import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Marquee from '../components/Marquee'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const nav = useNavigate()

  const submit = async () => {
    setError('')
    try { await login(mode === 'login' ? 'login' : 'register', email, password); nav('/dashboard') }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="max-w-sm mx-auto space-y-8">
      <h1 className="font-display text-4xl font-semibold leading-[0.92] hero-line">{mode === 'login' ? 'entrar' : 'criar conta'}</h1>
      <div className="space-y-6">
        <input className="input" type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="senha" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-err text-sm">{error}</p>}
      <button className="btn w-full" onClick={submit}>{mode === 'login' ? 'entrar' : 'criar conta grátis'}</button>
      <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors w-full text-center"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'não tenho conta ainda' : 'já tenho conta'}
      </button>
      <Marquee />
    </div>
  )
}
