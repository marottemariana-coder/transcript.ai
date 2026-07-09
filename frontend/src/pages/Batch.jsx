import { useState } from 'react'
import { api } from '../lib/api'
import { useJob } from '../hooks/useJob'
import StatusBadge from '../components/StatusBadge'
import { Link } from 'react-router-dom'

export default function Batch() {
  const [text, setText] = useState('')
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      const urls = text.split('\n').map(s => s.trim()).filter(Boolean)
      const res = await api('/jobs/batch', { method: 'POST', body: JSON.stringify({ urls }) })
      setJobs(res.jobs)
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="space-y-2">
        <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em]" style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}>
          importação em lote
        </h1>
        <p className="text-gray text-sm">cole até 50 links, um por linha. cada um vira um job independente.</p>
      </div>
      <textarea className="input h-48 font-mono text-xs" placeholder={'https://youtube.com/...\nhttps://instagram.com/...'}
        value={text} onChange={e => setText(e.target.value)} />
      {error && <p className="text-err text-sm">{error}</p>}
      <button className="btn" onClick={submit}>processar lote</button>
      <div className="border-t border-hairline">
        {jobs.map((j, i) => <BatchRow key={j.id} id={j.id} index={i} />)}
      </div>
    </div>
  )
}

function BatchRow({ id, index }) {
  const job = useJob(id)
  if (!job) return null
  return (
    <div className="py-3 border-b border-hairline flex items-center justify-between gap-3">
      <div className="flex items-center gap-4 min-w-0">
        <span className="editorial-index shrink-0">{String(index + 1).padStart(3, '0')}</span>
        <p className="text-sm truncate">{job.filename || job.source_url}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-xs text-gray">{job.progress}%</span>
        <StatusBadge status={job.status} />
        {job.transcript_id && <Link className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors" to={`/t/${job.transcript_id}`}>abrir</Link>}
      </div>
    </div>
  )
}
