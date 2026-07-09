const LABELS = {
  queued: ['na fila', 'busy'], downloading: ['baixando', 'busy'],
  extracting: ['extraindo áudio', 'busy'], transcribing: ['transcrevendo', 'busy'],
  translating: ['traduzindo', 'busy'], done: ['concluído', 'done'], error: ['erro', 'err'],
}

export default function StatusBadge({ status }) {
  const [label, tone] = LABELS[status] || [status, 'busy']
  const isErr = tone === 'err'
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1 rounded-full border border-ink transition-colors duration-[180ms]
      ${isErr ? 'bg-ink text-paper' : 'bg-transparent text-ink'}
      ${tone === 'busy' ? 'status-pulse' : ''}`}>
      {label}
    </span>
  )
}
