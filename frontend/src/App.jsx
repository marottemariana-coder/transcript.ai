import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import TranscriptPage from './pages/Transcript'
import Login from './pages/Login'
import Batch from './pages/Batch'
import Downloads from './pages/Downloads'
import Analyze from './pages/Analyze'

export default function App() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-mono text-sm tracking-[0.08em] uppercase text-ink">transcript<span className="text-gray">.ai</span></Link>
          <nav className="flex items-center gap-5">
            {user ? (
              <>
                <Link to="/transcrever" className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors">transcrever</Link>
                <Link to="/dashboard" className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors">minhas transcrições</Link>
                <Link to="/downloads" className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors">downloads</Link>
                <Link to="/analyze" className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors">analisar</Link>
                {user.plan === 'pro' ? (
                  <span className="pill pill-active" title="plano pro, sem limite de minutos">pro</span>
                ) : (
                  <span className="hidden sm:inline font-mono text-xs text-gray opacity-40 hover:opacity-100 transition-opacity cursor-default"
                    title={`${user.minutes_used} de ${user.minutes_limit} minutos usados este mês`}>
                    {user.minutes_used}/{user.minutes_limit} min
                  </span>
                )}
                <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors" onClick={() => { logout(); nav('/') }}>sair</button>
              </>
            ) : (
              <Link to="/login" className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors">entrar</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-16">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/transcrever" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/t/:id" element={<TranscriptPage />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/analyze" element={<Analyze />} />
        </Routes>
      </main>
    </div>
  )
}
