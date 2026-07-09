import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, triggerDownload } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import { TrashIcon } from '../components/icons'

export default function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState([])

  const load = (query = '') =>
    api(`/jobs${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(js => { setJobs(js); setSelected([]) }).catch(e => setError(e.message))

  useEffect(() => { load() }, [])

  const remove = async (id) => {
    if (!confirm('Apagar esta transcrição? Essa ação não pode ser desfeita.')) return
    try {
      await api(`/jobs/${id}`, { method: 'DELETE' })
      setJobs(js => js.filter(j => j.id !== id))
      setSelected(s => s.filter(i => i !== id))
    } catch (e) { setError(e.message) }
  }

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  const toggleAll = () => setSelected(s => s.length === jobs.length ? [] : jobs.map(j => j.id))

  const removeSelected = async () => {
    if (!confirm(`Apagar ${selected.length} transcrições selecionadas? Essa ação não pode ser desfeita.`)) return
    try {
      await Promise.all(selected.map(id => api(`/jobs/${id}`, { method: 'DELETE' })))
      setJobs(js => js.filter(j => !selected.includes(j.id)))
      setSelected([])
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em]" style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}>
          histórico
        </h1>
        <div className="flex gap-3 w-full sm:w-96">
          <input className="input" placeholder="buscar dentro das transcrições…"
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(q)} />
          <button className="btn-ghost shrink-0" onClick={() => load(q)}>buscar</button>
        </div>
      </div>
      {error && <p className="text-err text-sm">{error}</p>}
      {jobs.length > 0 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-gray">
            <input type="checkbox" checked={selected.length === jobs.length} onChange={toggleAll} />
            selecionar todos
          </label>
          {selected.length > 0 && (
            <button className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-err"
              onClick={removeSelected}><TrashIcon /> apagar ( {selected.length} )</button>
          )}
        </div>
      )}
      <div className="border-t border-hairline">
        {jobs.length === 0 && (
          <p className="py-8 text-sm">
            <span className="font-mono text-gray">( vazio )</span>{' '}
            <span className="text-gray">Nenhuma transcrição ainda. Envie um arquivo ou cole um link na página de transcrever.</span>
          </p>
        )}
        {jobs.map((j, i) => (
          <div key={j.id} className="py-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <input type="checkbox" className="shrink-0" checked={selected.includes(j.id)} onChange={() => toggle(j.id)} />
              <span className="editorial-index shrink-0">{String(jobs.length - i).padStart(3, '0')}</span>
              <div className="min-w-0">
                <p className="text-sm truncate">{j.filename || j.source_url || `job ${j.id}`}</p>
                <p className="font-mono text-xs text-gray">
                  {new Date(j.created_at).toLocaleString('pt-BR')}
                  {j.duration ? ` · ${Math.round(j.duration / 60)} min` : ''}
                  {j.language ? ` · ${j.language}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <StatusBadge status={j.status} />
              <div className="grid items-center gap-4" style={{ gridTemplateColumns: '44px 58px 16px' }}>
                <span>
                  {j.transcript_id && (
                    <Link className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors"
                      to={`/t/${j.transcript_id}${q ? `?hl=${encodeURIComponent(q)}` : ''}`}>abrir</Link>
                  )}
                </span>
                <span>
                  {j.has_original && (
                    <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors"
                      onClick={() => triggerDownload(j.id)}>original</button>
                  )}
                </span>
                <button className="text-gray hover:text-err transition-colors" title="apagar" aria-label="apagar"
                  onClick={() => remove(j.id)}><TrashIcon /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
