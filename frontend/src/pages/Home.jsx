import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useJob } from '../hooks/useJob'
import Progress from '../components/Progress'
import StatusBadge from '../components/StatusBadge'
import Marquee from '../components/Marquee'
import TopProgressBar from '../components/TopProgressBar'
import ChromeScene from '../components/ChromeScene'

const LANGS = [['', 'sem tradução'], ['pt-br', 'português'], ['en', 'inglês'], ['es', 'espanhol'], ['fr', 'francês'], ['de', 'alemão'], ['it', 'italiano'], ['ja', 'japonês']]

export default function Home() {
  const [tab, setTab] = useState('upload')
  const [jobId, setJobId] = useState(null)
  const [error, setError] = useState('')
  const [diarize, setDiarize] = useState(false)
  const [translateTo, setTranslateTo] = useState('')
  const [preview, setPreview] = useState(null)
  const job = useJob(jobId)
  const nav = useNavigate()

  useEffect(() => {
    if (job?.status === 'done' && job?.transcript_id) {
      api(`/transcripts/${job.transcript_id}`).then(t => setPreview(t)).catch(() => {})
    }
  }, [job?.status, job?.transcript_id])

  const start = async (fn) => {
    setError('')
    try { const j = await fn(); setJobId(j.id) }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <TopProgressBar progress={job && job.status !== 'done' && job.status !== 'error' ? job.progress : null} />
      <div className="space-y-3 relative">
        <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-0 w-[160px] hidden sm:block">
          <ChromeScene shape="torus" height={220} />
        </div>
        <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em] relative z-10" style={{ fontSize: 'clamp(40px, 7vw, 80px)' }}>
          <span className="hero-line">áudio e vídeo</span>
          <span className="hero-line">em texto</span>
        </h1>
        <p className="text-gray text-sm max-w-md hero-subtitle relative z-10">envie um arquivo, cole um link ou grave direto. disponível para contas do plano pro.</p>
      </div>

      <div className="flex gap-2">
        {[['upload', 'enviar arquivo'], ['link', 'colar link'], ['record', 'gravar']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`pill ${tab === k ? 'pill-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab === 'upload' && <UploadTab start={start} diarize={diarize} translateTo={translateTo} />}
        {tab === 'link' && <LinkTab start={start} diarize={diarize} translateTo={translateTo} />}
        {tab === 'record' && <RecordTab start={start} diarize={diarize} translateTo={translateTo} />}

        <div className="flex flex-wrap items-center gap-6 pt-4 hr text-sm">
          <label className="flex items-center gap-2 text-gray">
            <input type="checkbox" checked={diarize} onChange={e => setDiarize(e.target.checked)} />
            identificar locutores
          </label>
          <label className="flex items-center gap-2 text-gray">
            <span className="mono-label">traduzir para</span>
            <select className="input w-auto py-1" value={translateTo} onChange={e => setTranslateTo(e.target.value)}>
              {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="text-err text-sm">{error}</p>}
      {job && (
        <div className="space-y-4 pt-6 hr">
          <div className="flex items-center justify-between">
            <span className="mono-label">progresso</span>
            <StatusBadge status={job.status} />
          </div>
          <Progress job={job} />
          {job.status === 'done' && job.transcript_id && (
            <>
              {preview && (
                <div className="border border-hairline p-4 space-y-2">
                  <p className="mono-label">prévia da transcrição</p>
                  <p className="text-sm font-body leading-relaxed line-clamp-6">
                    {preview.text?.slice(0, 600)}{preview.text?.length > 600 ? '…' : ''}
                  </p>
                </div>
              )}
              <button className="btn w-full" onClick={() => nav(`/t/${job.transcript_id}`)}>
                abrir transcrição completa
              </button>
            </>
          )}
        </div>
      )}
      <Marquee />
    </div>
  )
}

function UploadTab({ start, diarize, translateTo }) {
  const ref = useRef()
  const [fileName, setFileName] = useState(null)
  return (
    <div className="space-y-4">
      <div className="border border-ink p-10 text-center space-y-4 cursor-pointer" onClick={() => ref.current?.click()}>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-gray">( solte o arquivo )</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="pill pointer-events-none">escolher arquivo</span>
          <span className="font-mono text-xs text-gray">{fileName || '( nenhum arquivo )'}</span>
        </div>
        <input ref={ref} type="file" accept="video/*,audio/*" className="sr-only"
          onChange={e => setFileName(e.target.files[0]?.name || null)} />
      </div>
      <p className="mono-label">mp4, mov, mp3, wav, m4a, webm</p>
      <button className="btn w-full" onClick={() => start(async () => {
        const file = ref.current.files[0]
        if (!file) throw new Error('Escolha um arquivo')
        const fd = new FormData()
        fd.append('file', file)
        fd.append('diarize', diarize)
        if (translateTo) fd.append('translate_to', translateTo)
        return api('/jobs/upload', { method: 'POST', body: fd, headers: {} })
      })}>
        {translateTo ? 'transcrever e traduzir' : 'transcrever'}
      </button>
    </div>
  )
}

function LinkTab({ start, diarize, translateTo }) {
  const [url, setUrl] = useState('')
  const [keep, setKeep] = useState(false)
  return (
    <div className="space-y-4">
      <p className="mono-label">youtube, instagram, tiktok, facebook</p>
      <input className="input" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-gray">
        <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />
        guardar o arquivo original para download (uso pessoal)
      </label>
      <button className="btn w-full" onClick={() => start(() =>
        api('/jobs/link', { method: 'POST', body: JSON.stringify({ url, diarize, translate_to: translateTo || null, keep_original: keep }) })
      )}>
        {translateTo ? 'transcrever e traduzir' : 'transcrever'}
      </button>
    </div>
  )
}

function RecordTab({ start }) {
  const [rec, setRec] = useState(null)
  const [blob, setBlob] = useState(null)
  const chunks = useRef([])

  const toggle = async () => {
    if (rec) { rec.stop(); return }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const r = new MediaRecorder(stream)
    chunks.current = []
    r.ondataavailable = e => chunks.current.push(e.data)
    r.onstop = () => {
      setBlob(new Blob(chunks.current, { type: 'audio/webm' }))
      stream.getTracks().forEach(t => t.stop())
      setRec(null)
    }
    r.start(); setRec(r)
  }

  return (
    <div className="space-y-4">
      <p className="mono-label">gravação pelo microfone do dispositivo</p>
      <button className={rec ? 'btn-ghost w-full' : 'btn w-full'} onClick={toggle}>
        {rec ? 'parar gravação' : 'iniciar gravação'}
      </button>
      {rec && <p className="font-mono text-xs text-ink text-center">( gravando… )</p>}
      {blob && !rec && (
        <>
          <audio controls src={URL.createObjectURL(blob)} className="w-full" />
          <button className="btn w-full" onClick={() => start(async () => {
            const fd = new FormData()
            fd.append('file', new File([blob], 'gravacao.webm'))
            fd.append('source', 'recording')
            return api('/jobs/upload', { method: 'POST', body: fd, headers: {} })
          })}>transcrever gravação</button>
        </>
      )}
    </div>
  )
}
