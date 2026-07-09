const LABELS = {
  queued: ['na fila', 'busy'], downloading: ['baixando', 'busy'],
  extracting: ['extraindo audio', 'busy'], transcribing: ['transcrevendo', 'busy'],
  translating: ['traduzindo', 'busy'], done: ['concluido', 'ok'], error: ['erro', 'err'],
}
const COLOR = { ok: 'text-ok border-ok', busy: 'text-gray border-hairline', err: 'text-err border-err' }

export default function StatusBadge({ status }) {
  const [label, tone] = LABELS[status] || [status, 'busy']
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1 border rounded-full ${COLOR[tone]}`}>
      {label}
    </span>
  )
}
