import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Marquee from '../components/Marquee'
import ChromeScene from '../components/ChromeScene'

const TOOLS = [
  { n: '01', label: 'transcrever', desc: 'áudio e vídeo, upload ou link', to: '/transcrever' },
  { n: '02', label: 'baixar', desc: 'vídeos, fotos e carrosséis das redes sociais', to: '/downloads' },
  { n: '03', label: 'analisar', desc: 'o que a imagem ou o vídeo mostra e transmite', to: '/analyze' },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-16">
        <div className="space-y-4 relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 -z-10 opacity-50 scale-75 w-[240px]
              min-[900px]:left-auto min-[900px]:right-[-190px] min-[900px]:translate-x-0 min-[900px]:z-0 min-[900px]:opacity-100 min-[900px]:scale-100"
          >
            <ChromeScene shape="cubes" height={240} />
          </div>
          <p className="mono-label relative z-10">transcrição, tradução e download com IA</p>
          <h1 className="!font-mono uppercase font-medium leading-[0.95] tracking-[0.01em] hero-line relative z-10" style={{ fontSize: 'clamp(38px, 7vw, 84px)' }}>
            transcript<span className="text-gray">.ai</span>
          </h1>
          <p className="text-gray text-sm max-w-md hero-subtitle relative z-10">
            áudio, vídeo, fotos e carrosséis das redes sociais, transcritos, traduzidos e
            analisados por IA. acesso disponível para contas do plano pro.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/transcrever" className="btn">começar</Link>
          {user
            ? <Link to="/dashboard" className="btn-ghost">minhas transcrições</Link>
            : <Link to="/login" className="btn-ghost">entrar</Link>}
        </div>
      </div>

      <div className="mt-10">
        <Marquee />
      </div>

      <div>
        {TOOLS.map(t => (
          <Link key={t.n} to={t.to}
            className="group flex items-center justify-between gap-4 py-5 border-b border-hairline">
            <div className="flex items-baseline gap-4 min-w-0">
              <span className="editorial-index shrink-0 px-1 transition-colors duration-200 group-hover:bg-ink group-hover:text-paper">{t.n}</span>
              <span className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.03em]">{t.label}</span>
            </div>
            <span className="font-mono text-xs text-gray hidden sm:inline text-right">{t.desc}</span>
            <span className="font-mono text-sm shrink-0 inline-block transition-transform duration-200 group-hover:translate-x-[6px]">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
