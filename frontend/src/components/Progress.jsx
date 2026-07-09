const STEPS = [
  { key: 'queued',      label: 'na fila' },
  { key: 'downloading', label: 'baixando' },
  { key: 'extracting',  label: 'extraindo áudio' },
  { key: 'transcribing',label: 'transcrevendo' },
  { key: 'translating', label: 'traduzindo' },
  { key: 'done',        label: 'concluído' },
]

export default function Progress({ job }) {
  if (!job) return null
  const currentIdx = STEPS.findIndex(s => s.key === job.status)
  const currentStep = STEPS[currentIdx] || STEPS[0]

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink">
          {job.status === 'error' ? 'erro no processamento' : currentStep.label}
        </span>
        <span className="font-mono text-xs text-gray">{job.progress}%</span>
      </div>

      {/* Barra de progresso */}
      <div className="h-px bg-hairline overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            job.status === 'error' ? 'bg-err' :
            job.status === 'done'  ? 'bg-ink' : 'bg-ink'
          }`}
          style={{ width: `${job.progress}%`, height: '2px', marginTop: '-1px' }}
        />
      </div>

      {/* Passos */}
      {job.status !== 'done' && job.status !== 'error' && (
        <div className="flex justify-between">
          {STEPS.filter(s => s.key !== 'translating').map((s, i) => {
            const idx = STEPS.findIndex(x => x.key === s.key)
            const done = idx < currentIdx
            const active = idx === currentIdx
            return (
              <span key={s.key} className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                active ? 'text-ink font-medium' :
                done   ? 'text-gray' : 'text-hairline'
              }`}>
                {done ? '✓' : active ? '›' : '·'} {s.label}
              </span>
            )
          })}
        </div>
      )}

      {job.filename && (
        <p className="font-mono text-xs text-gray truncate">{job.filename}</p>
      )}
      {job.error && <p className="text-err text-sm">{job.error}</p>}
    </div>
  )
}
