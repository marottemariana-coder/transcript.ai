import { useRef, useState } from 'react'
import { api } from '../lib/api'

const TABS = [
  { key: 'upload', label: 'enviar arquivo' },
  { key: 'link',   label: 'colar link'    },
]

export default function Analyze() {
  const [tab, setTab] = useState('upload')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState(null)

  const reset = () => { setResult(''); setError('') }

  const analyzeUpload = async () => {
    const file = fileRef.current?.files[0]
    if (!file) { setError('Escolha um arquivo'); return }
    setBusy(true); reset()
    const fd = new FormData()
    fd.append('file', file)
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    try {
      const r = await api('/analyze/upload', { method: 'POST', body: fd, headers: {} })
      setResult(r.result)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const analyzeLink = async () => {
    if (!url.trim()) { setError('Cole um link'); return }
    setBusy(true); reset(); setPreview(null)
    try {
      const r = await api('/analyze/link', { method: 'POST', body: JSON.stringify({ url: url.trim() }) })
      setResult(r.result)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const copy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Renderiza markdown simples (negrito com **)
  const renderResult = (text) =>
    text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="mono-label mt-5 mb-1 text-ink">{line.replace(/\*\*/g, '')}</p>
      }
      if (line.trim() === '') return <br key={i} />
      return <p key={i} className="text-sm font-body leading-relaxed">{line}</p>
    })

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div className="space-y-3">
        <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em]" style={{ fontSize: 'clamp(40px, 7vw, 80px)' }}>
          analisar<br />conteúdo
        </h1>
        <p className="text-gray text-sm max-w-md">
          a IA olha sua foto ou vídeo e te diz o que mostra, o que representa e o sentimento que transmite
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); reset() }} className={`pill ${tab === t.key ? 'pill-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'upload' && (
          <>
            <div className="border border-ink p-10 text-center space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-gray">( solte o arquivo )</p>
              <input ref={fileRef} type="file"
                accept="image/*,video/mp4,video/mov,video/webm,video/quicktime"
                className="input text-center border-0" onChange={() => {
                  reset()
                  const f = fileRef.current?.files[0]
                  setPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
                }} />
            </div>
            <p className="mono-label">foto ou vídeo (até 50 mb) · jpg, png, gif, webp, mp4, mov, webm</p>
            {preview && (
              <img src={preview} alt="preview" className="max-h-48 object-contain mx-auto" />
            )}
            <button className="btn w-full" onClick={analyzeUpload} disabled={busy}>
              {busy ? 'analisando… pode levar 30s' : 'analisar'}
            </button>
          </>
        )}

        {tab === 'link' && (
          <>
            <p className="mono-label">link do conteúdo · youtube, instagram, tiktok, facebook</p>
            <input className="input" placeholder="https://www.instagram.com/p/..."
              value={url} onChange={e => { setUrl(e.target.value); reset() }}
              onKeyDown={e => e.key === 'Enter' && analyzeLink()} />
            <button className="btn w-full" onClick={analyzeLink} disabled={busy}>
              {busy ? 'baixando e analisando… pode levar 1min' : 'analisar'}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-err text-sm">{error}</p>}

      {busy && (
        <div className="space-y-3 pt-6 hr">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-gray">a ia está analisando o conteúdo…</p>
          <div className="h-px bg-hairline overflow-hidden">
            <div className="bg-ink animate-pulse w-full" style={{ height: '2px', marginTop: '-1px' }} />
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4 pt-6 hr">
          <div className="flex items-center justify-between">
            <p className="mono-label">análise</p>
            <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors" onClick={copy}>
              {copied ? 'copiado!' : 'copiar'}
            </button>
          </div>
          <div className="space-y-1">
            {renderResult(result)}
          </div>
        </div>
      )}
    </div>
  )
}
