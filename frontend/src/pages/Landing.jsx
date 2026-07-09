import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TOOLS = [
  { n: '01', label: 'transcrever', desc: 'áudio e vídeo, upload ou link', to: '/transcrever' },
  { n: '02', label: 'baixar', desc: 'vídeos, fotos e carrosséis das redes sociais', to: '/downloads' },
  { n: '03', label: 'analisar', desc: 'o que a imagem ou o vídeo mostra e transmite', to: '/analyze' },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-16">
      <div className="space-y-4">
        <p className="mono-label">transcrição, tradução e download com IA</p>
        <h1 className="!font-mono uppercase font-medium leading-[0.95] tracking-[0.01em]" style={{ fontSize: 'clamp(38px, 7vw, 84px)' }}>
          transcript<span className="text-gray">.ai</span>
        </h1>
        <p className="text-gray text-sm max-w-md">
          áudio, vídeo, fotos e carrosséis das redes sociais — transcritos, traduzidos e
          analisados por IA. a primeira transcrição não exige conta.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/transcrever" className="btn">começar</Link>
        {user
          ? <Link to="/dashboard" className="btn-ghost">minhas transcrições</Link>
          : <Link to="/login" className="btn-ghost">entrar</Link>}
      </div>

      <div className="border-t border-hairline">
        {TOOLS.map(t => (
          <Link key={t.n} to={t.to}
            className="group flex items-center justify-between gap-4 py-5 border-b border-hairline hover:opacity-50 transition-opacity">
            <div className="flex items-baseline gap-4 min-w-0">
              <span className="editorial-index shrink-0">{t.n}</span>
              <span className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.03em]">{t.label}</span>
            </div>
            <span className="font-mono text-xs text-gray hidden sm:inline text-right">{t.desc}</span>
            <span className="font-mono text-sm shrink-0">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
