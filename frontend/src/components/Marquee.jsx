const TEXT = 'transcrever · traduzir · baixar · analisar · '

export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <span className="marquee-item font-mono text-[11px] uppercase tracking-[0.08em] text-gray">{TEXT}</span>
        <span className="marquee-item font-mono text-[11px] uppercase tracking-[0.08em] text-gray">{TEXT}</span>
      </div>
    </div>
  )
}
