import { useEffect, useState } from 'react'
import { api, fetchThumbnail, triggerDownload } from '../lib/api'
import { useJob } from '../hooks/useJob'
import Progress from '../components/Progress'
import StatusBadge from '../components/StatusBadge'
import { TrashIcon } from '../components/icons'
import Marquee from '../components/Marquee'
import TopProgressBar from '../components/TopProgressBar'
import ChromeScene from '../components/ChromeScene'

function JobThumbnail({ jobId, hasThumbnail, className }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!hasThumbnail) { setSrc(null); return }
    let objUrl = null
    let cancelled = false
    fetchThumbnail(jobId).then(url => {
      if (cancelled) { if (url) URL.revokeObjectURL(url); return }
      objUrl = url
      setSrc(url)
    })
    return () => {
      cancelled = true
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [jobId, hasThumbnail])
  if (!src) return null
  return <img src={src} alt="" className={className} />
}

export default function Downloads() {
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState('video')
  const [quality, setQuality] = useState('best')
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState([])
  const [previewing, setPreviewing] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [selectedHistory, setSelectedHistory] = useState([])
  const job = useJob(jobId)

  useEffect(() => {
    api('/jobs/downloads').then(setHistory).catch(() => {})
  }, [])

  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'error') {
      api('/jobs/downloads').then(setHistory).catch(() => {})
    }
  }, [job?.status])

  const removeHistoryItem = async (id) => {
    if (!confirm('Apagar este download? Essa ação não pode ser desfeita.')) return
    try {
      await api(`/jobs/${id}`, { method: 'DELETE' })
      setHistory(h => h.filter(j => j.id !== id))
      setSelectedHistory(s => s.filter(i => i !== id))
    } catch (e) { setError(e.message) }
  }

  const toggleHistory = (id) => setSelectedHistory(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  const toggleAllHistory = () => setSelectedHistory(s => s.length === history.length ? [] : history.map(j => j.id))

  const removeSelectedHistory = async () => {
    if (!confirm(`Apagar ${selectedHistory.length} downloads selecionados? Essa ação não pode ser desfeita.`)) return
    try {
      await Promise.all(selectedHistory.map(id => api(`/jobs/${id}`, { method: 'DELETE' })))
      setHistory(h => h.filter(j => !selectedHistory.includes(j.id)))
      setSelectedHistory([])
    } catch (e) { setError(e.message) }
  }

  const inspect = async () => {
    if (!url.trim()) return
    setError(''); setPreview(null); setSelected([])
    setPreviewing(true)
    try {
      const p = await api('/jobs/preview', { method: 'POST', body: JSON.stringify({ url: url.trim() }) })
      setPreview(p)
      setSelected(p.items.map(i => i.index))
    } catch (e) { setError(e.message) }
    finally { setPreviewing(false) }
  }

  const toggleItem = (idx) =>
    setSelected(s => s.includes(idx) ? s.filter(i => i !== idx) : [...s, idx])

  const submit = async () => {
    if (!url.trim()) return
    setError('')
    // For single-video URLs (preview has 1 item), send empty items so backend doesn't use playlist_items
    const chosenItems = preview
      ? (preview.items.length === 1 ? [] : selected)
      : []
    // Se o usuario escolheu explicitamente "Foto / Carrossel" ou "Audio (MP3)", respeita isso.
    // Senao, deduz do preview: se todos os itens selecionados sao foto → foto, senao video.
    const chosenType = mediaType === 'photo' || mediaType === 'audio'
      ? mediaType
      : (preview
        ? (preview.items.filter(i => selected.includes(i.index)).every(i => i.type === 'photo') ? 'photo' : 'video')
        : 'video')
    try {
      const j = await api('/jobs/download', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), media_type: chosenType, items: chosenItems, quality }),
      })
      setJobId(j.id); setUrl(''); setPreview(null); setSelected([])
    } catch (e) { setError(e.message) }
  }

  const allVideos = preview?.items.filter(i => selected.includes(i.index)).every(i => i.type === 'video')
  const allPhotos = preview?.items.filter(i => selected.includes(i.index)).every(i => i.type === 'photo')

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <TopProgressBar progress={job && job.status !== 'done' && job.status !== 'error' ? job.progress : null} />
      <div className="space-y-3 relative">
        <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-0 w-[160px] hidden sm:block">
          <ChromeScene shape="octahedron" height={220} />
        </div>
        <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em] relative z-10" style={{ fontSize: 'clamp(40px, 7vw, 80px)' }}>
          <span className="hero-line">baixar</span>
          <span className="hero-line">conteúdo</span>
        </h1>
        <p className="text-gray text-sm max-w-md hero-subtitle relative z-10">salve vídeos, fotos e carrosséis das redes sociais</p>
      </div>

      {/* Seletor de tipo — só aparece sem preview */}
      {!preview && (
        <div className="grid grid-cols-3 gap-px bg-hairline">
          {[
            { key: 'video', label: 'Vídeo', desc: 'YouTube, Reels, TikTok, Facebook, Pinterest' },
            { key: 'audio', label: 'Áudio (MP3)', desc: 'Só o som, sem vídeo' },
            { key: 'photo', label: 'Foto / Carrossel', desc: 'Instagram (perfil público)' },
          ].map(t => (
            <button key={t.key} onClick={() => setMediaType(t.key)}
              className={`bg-paper text-left space-y-1 p-5 border transition-colors ${mediaType === t.key ? 'border-ink' : 'border-transparent'}`}>
              <p className="font-mono text-xs uppercase tracking-[0.08em]">{t.label}</p>
              <p className="font-mono text-xs text-gray">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Seletor de qualidade — só para vídeo */}
      {!preview && mediaType === 'video' && (
        <div className="space-y-2">
          <p className="mono-label">qualidade</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'best', label: 'Melhor disponível' },
              { key: '1080p', label: '1080p' },
              { key: '720p', label: '720p' },
              { key: '480p', label: '480p' },
            ].map(q => (
              <button key={q.key} onClick={() => setQuality(q.key)}
                className={`font-mono text-xs uppercase tracking-[0.08em] px-3 py-1.5 rounded-full border transition-colors ${quality === q.key ? 'border-ink bg-ink text-paper' : 'border-hairline text-gray hover:text-ink'}`}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <p className="mono-label">link do conteúdo</p>
        <input className="input" placeholder="https://www.instagram.com/p/..."
          value={url} onChange={e => { setUrl(e.target.value); setPreview(null); setSelected([]) }}
          onKeyDown={e => e.key === 'Enter' && inspect()} />

        {/* Preview do carrossel */}
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="mono-label">{preview.title} · {preview.items.length} {preview.items.length === 1 ? 'item' : 'itens'}</p>
              <div className="flex gap-4">
                <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors"
                  onClick={() => setSelected(preview.items.map(i => i.index))}>todos</button>
                <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors"
                  onClick={() => setSelected(preview.items.filter(i => i.type === 'video').map(i => i.index))}>só vídeos</button>
                <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors"
                  onClick={() => setSelected(preview.items.filter(i => i.type === 'photo').map(i => i.index))}>só fotos</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-hairline">
              {preview.items.map(item => (
                <button key={item.index} onClick={() => toggleItem(item.index)}
                  className={`relative text-left transition-opacity ${selected.includes(item.index) ? '' : 'opacity-40'}`}>
                  {item.thumbnail
                    ? <img src={item.thumbnail} alt={item.title} className="w-full aspect-square object-cover" />
                    : <div className="w-full aspect-square bg-card flex items-center justify-center">
                        <span className="editorial-index">{String(item.index).padStart(3, '0')}</span>
                      </div>
                  }
                  <div className="absolute top-1.5 left-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-ink bg-paper text-ink">
                      {item.type === 'video' ? 'vídeo' : 'foto'}
                    </span>
                  </div>
                  {selected.includes(item.index) && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-ink rounded-full flex items-center justify-center">
                      <span className="text-paper text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="font-mono text-xs text-gray">
              {selected.length} de {preview.items.length} selecionados
              {allVideos ? ' · vídeos' : allPhotos ? ' · fotos' : ' · misto'}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={inspect} disabled={previewing || !url.trim()}>
            {previewing ? 'inspecionando…' : 'ver itens'}
          </button>
          <button className="btn flex-1" onClick={submit}
            disabled={preview ? selected.length === 0 : !url.trim()}>
            baixar {preview ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>

      {error && <p className="text-err text-sm">{error}</p>}

      {job && (
        <div className="space-y-4 pt-6 hr">
          <div className="flex items-center gap-4">
            <JobThumbnail jobId={job.id} hasThumbnail={job.has_thumbnail}
              className="w-14 h-14 object-cover shrink-0 border border-hairline" />
            <div className="flex-1 min-w-0">
              <Progress job={job} />
            </div>
          </div>
          {job.status === 'done' && job.has_original && (
            <button className="btn w-full" onClick={() => triggerDownload(job.id)}>
              salvar arquivo
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-2">
            <p className="mono-label">histórico</p>
            {selectedHistory.length > 0 && (
              <button className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-err"
                onClick={removeSelectedHistory}><TrashIcon /> apagar ( {selectedHistory.length} )</button>
            )}
          </div>
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-gray pb-2">
            <input type="checkbox" checked={selectedHistory.length === history.length} onChange={toggleAllHistory} />
            selecionar todos
          </label>
          <div className="border-t border-hairline">
            {history.map((j, i) => (
              <div key={j.id} className="py-4 border-b border-hairline flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <input type="checkbox" className="shrink-0" checked={selectedHistory.includes(j.id)} onChange={() => toggleHistory(j.id)} />
                  <span className="editorial-index shrink-0 hidden sm:inline">{String(history.length - i).padStart(3, '0')}</span>
                  <JobThumbnail jobId={j.id} hasThumbnail={j.has_thumbnail}
                    className="w-10 h-10 object-cover shrink-0 border border-hairline" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm truncate">{j.filename || j.source_url}</p>
                    <p className="font-mono text-xs text-gray">{new Date(j.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <StatusBadge status={j.status} />
                  {j.status === 'done' && j.has_original && (
                    <button className="btn-ghost text-[10px] px-3 py-1.5" onClick={() => triggerDownload(j.id)}>salvar</button>
                  )}
                  <button className="text-gray hover:text-err transition-colors" title="apagar" aria-label="apagar"
                    onClick={() => removeHistoryItem(j.id)}><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Marquee />
    </div>
  )
}
