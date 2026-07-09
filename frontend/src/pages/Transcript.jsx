import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, exportUrl } from '../lib/api'
import Marquee from '../components/Marquee'

const FORMATS = ['txt', 'docx', 'pdf', 'srt', 'vtt', 'json', 'html', 'fcpxml']
const LANGS = [['pt-br', 'português'], ['en', 'inglês'], ['es', 'espanhol'], ['fr', 'francês'], ['de', 'alemão'], ['it', 'italiano'], ['ja', 'japonês']]

const ts = s => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function TranscriptPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const highlight = params.get('hl') || ''
  const [t, setT] = useState(null)
  const [translation, setTranslation] = useState(null)
  const [targetLang, setTargetLang] = useState('pt-br')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [ai, setAi] = useState(null)
  const [caption, setCaption] = useState(null)
  const [captionStyle, setCaptionStyle] = useState('instagram')
  const [customStyle, setCustomStyle] = useState('')
  const [captionBusy, setCaptionBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { api(`/transcripts/${id}`).then(setT).catch(e => setError(e.message)) }, [id])

  const speakers = useMemo(() =>
    [...new Set((t?.segments || []).map(s => s.speaker).filter(Boolean))], [t])

  const translate = async () => {
    setBusy('traduzindo…'); setError('')
    try { setTranslation(await api(`/transcripts/${id}/translate`, { method: 'POST', body: JSON.stringify({ target_language: targetLang }) })) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }

  const saveSegment = async (index, text) => {
    await api(`/transcripts/${id}/segments`, { method: 'PATCH', body: JSON.stringify({ index, text }) })
    setT({ ...t, segments: t.segments.map((s, i) => i === index ? { ...s, text } : s) })
    setEditing(null)
  }

  const renameSpeaker = async (old) => {
    const name = prompt(`Novo nome para "${old}" (sera salvo na sua biblioteca de vozes):`)
    if (!name) return
    try {
      const res = await api(`/transcripts/${id}/speakers/rename`, {
        method: 'POST', body: JSON.stringify({ old_label: old, new_name: name }),
      })
      setT({ ...t, segments: t.segments.map(s => s.speaker === old ? { ...s, speaker: name } : s) })
      if (res.note) setError(res.note)
    } catch (e) { setError(e.message) }
  }

  const runAi = async (feature) => {
    setBusy('gerando…'); setError('')
    try { const r = await api(`/transcripts/${id}/ai/${feature}`, { method: 'POST', body: JSON.stringify({ question: '', history: [] }) }); setAi({ feature, text: r.result }) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }

  const generateCaption = async () => {
    setCaptionBusy(true); setError(''); setCaption(null)
    try {
      const r = await api(`/transcripts/${id}/ai/caption`, {
        method: 'POST',
        body: JSON.stringify({ question: '', history: [], style: captionStyle, custom_style: customStyle }),
      })
      setCaption(r.result)
    } catch (e) { setError(e.message) } finally { setCaptionBusy(false) }
  }

  const copyCaption = () => {
    navigator.clipboard.writeText(caption || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!t) return <p className="font-mono text-xs text-gray">{error || '( carregando… )'}</p>

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="font-display font-semibold leading-[0.92] tracking-[-0.03em] truncate hero-line" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)' }}>
            {t.filename || `transcrição ${t.id}`}
          </h1>
          <p className="mono-label hero-subtitle">idioma detectado: {t.language || 'auto'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <a key={f} className="pill" href={exportUrl(t.id, f, translation?.id)}>{f}</a>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 py-4 border-y border-hairline">
        <span className="mono-label">traduzir para</span>
        <select className="input w-auto py-1" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-ghost text-[10px] px-3 py-1.5" onClick={translate}>traduzir</button>
        <span className="border-l border-hairline pl-4 mono-label">ia</span>
        {['summary', 'quotes', 'mindmap', 'script'].map(f => (
          <button key={f} className="btn-ghost text-[10px] px-3 py-1.5" onClick={() => runAi(f)}>
            {{ summary: 'resumo', quotes: 'citações', mindmap: 'mapa mental', script: 'roteiro' }[f]}
          </button>
        ))}
        {speakers.length > 0 && (
          <>
            <span className="border-l border-hairline pl-4 mono-label">locutores</span>
            {speakers.map(sp => (
              <button key={sp} className="btn-ghost text-[10px] px-3 py-1.5" onClick={() => renameSpeaker(sp)}>{sp} · renomear</button>
            ))}
          </>
        )}
        {busy && <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink">( {busy} )</span>}
      </div>

      {error && <p className="text-err text-sm">{error}</p>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="mono-label">gerar legenda</span>
          <select className="input w-auto py-1 text-sm" value={captionStyle} onChange={e => setCaptionStyle(e.target.value)}>
            <option value="instagram">Instagram / Reels</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="curta">Curta (Reels / Stories)</option>
            <option value="outro">Outro…</option>
          </select>
          {captionStyle === 'outro' && (
            <input className="input w-56" placeholder="descreva o estilo desejado…"
              value={customStyle} onChange={e => setCustomStyle(e.target.value)} />
          )}
          <button className="btn text-[10px] px-4 py-1.5" onClick={generateCaption} disabled={captionBusy}>
            {captionBusy ? 'gerando…' : 'gerar'}
          </button>
          {caption && (
            <button className="btn-ghost text-[10px] px-3 py-1.5" onClick={copyCaption}>
              {copied ? 'copiado!' : 'copiar tudo'}
            </button>
          )}
          {caption && (
            <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors" onClick={() => setCaption(null)}>fechar</button>
          )}
        </div>
        {caption && (
          <pre className="whitespace-pre-wrap text-sm font-body leading-relaxed border-t border-hairline pt-4">{caption}</pre>
        )}
      </div>

      {ai && (
        <div className="space-y-2 pt-4 hr">
          <div className="flex justify-between">
            <span className="mono-label">{{ summary: 'resumo', quotes: 'citações', mindmap: 'mapa mental', script: 'roteiro' }[ai.feature]}</span>
            <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray hover:text-ink transition-colors" onClick={() => setAi(null)}>fechar</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm font-body leading-relaxed">{ai.text}</pre>
        </div>
      )}

      <div className={`grid gap-8 ${translation ? 'md:grid-cols-2' : ''}`}>
        <section className="space-y-0">
          <p className="mono-label pb-3">original</p>
          {t.segments.map((s, i) => (
            <Segment key={i} s={s} highlight={highlight}
              editing={editing === i}
              onEdit={() => setEditing(i)}
              onSave={text => saveSegment(i, text)}
              onCancel={() => setEditing(null)} />
          ))}
        </section>
        {translation && (
          <section className="space-y-0">
            <p className="mono-label pb-3">tradução · {translation.lang}</p>
            {translation.segments.map((s, i) => <Segment key={i} s={s} />)}
          </section>
        )}
      </div>

      <Chat id={t.id} />
      <Marquee />
    </div>
  )
}

function Segment({ s, highlight, editing, onEdit, onSave, onCancel }) {
  const [val, setVal] = useState(s.text)
  const isHit = highlight && s.text.toLowerCase().includes(highlight.toLowerCase())
  useEffect(() => { setVal(s.text) }, [s.text])
  return (
    <div className={`group flex gap-4 py-2 border-b border-hairline ${isHit ? 'border-l-2 border-l-ink pl-3 -ml-[calc(0.75rem+2px)]' : ''}`}
      ref={el => { if (isHit && el) el.scrollIntoView({ block: 'center' }) }}>
      <span className="font-mono text-xs text-gray pt-0.5 shrink-0 w-12">{ts(s.start)}</span>
      <div className="flex-1 text-sm">
        {s.speaker && <span className="font-mono text-xs uppercase tracking-[0.08em] text-gray mr-2">{s.speaker}</span>}
        {editing ? (
          <span className="flex gap-3 items-baseline">
            <input className="input py-1 text-sm" value={val} onChange={e => setVal(e.target.value)} autoFocus />
            <button className="font-mono text-xs uppercase tracking-[0.08em] text-ink" onClick={() => onSave(val)}>salvar</button>
            <button className="font-mono text-xs uppercase tracking-[0.08em] text-gray" onClick={onCancel}>cancelar</button>
          </span>
        ) : (
          <span onDoubleClick={onEdit} title={onEdit ? 'duplo clique para editar' : undefined} className="font-body">
            {isHit ? <Mark text={s.text} q={highlight} /> : s.text}
          </span>
        )}
      </div>
    </div>
  )
}

function Mark({ text, q }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return <>{text.slice(0, i)}<strong className="font-semibold underline">{text.slice(i, i + q.length)}</strong>{text.slice(i + q.length)}</>
}

function Chat({ id }) {
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!q.trim()) return
    const history = msgs.map(m => ({ role: m.role, content: m.text }))
    setMsgs(m => [...m, { role: 'user', text: q }])
    setQ(''); setBusy(true)
    try {
      const r = await api(`/transcripts/${id}/ai/chat`, { method: 'POST', body: JSON.stringify({ question: q, history }) })
      setMsgs(m => [...m, { role: 'assistant', text: r.result }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: `Erro: ${e.message}` }])
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4 pt-6 hr">
      <p className="mono-label">chat com o vídeo: respostas baseadas só nesta transcrição</p>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {msgs.map((m, i) => (
          <p key={i} className={`text-sm ${m.role === 'user' ? 'text-ink' : 'text-gray'}`}>
            <span className="font-mono text-xs uppercase tracking-[0.08em] mr-2">{m.role === 'user' ? 'você' : 'ia'}</span>{m.text}
          </p>
        ))}
      </div>
      <div className="flex gap-3">
        <input className="input" placeholder="pergunte algo sobre o conteúdo…" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="btn shrink-0" disabled={busy} onClick={send}>{busy ? '…' : 'enviar'}</button>
      </div>
    </div>
  )
}
