const BASE = '/api'

function anonId() {
  let id = localStorage.getItem('anon_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('anon_id', id) }
  return id
}

export function headers(extra = {}) {
  const h = { 'X-Anon-Id': anonId(), ...extra }
  const token = localStorage.getItem('token')
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: headers(opts.body instanceof FormData ? opts.headers : { 'Content-Type': 'application/json', ...opts.headers }),
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail
    throw new Error(detail || `Erro ${res.status}`)
  }
  return res.json()
}

function tokenParam() {
  const t = localStorage.getItem('token')
  return t ? `token=${encodeURIComponent(t)}` : ''
}

export const exportUrl = (tid, fmt, translationId) => {
  const params = new URLSearchParams()
  const t = localStorage.getItem('token')
  if (t) params.set('token', t)
  if (translationId) params.set('translation_id', translationId)
  const qs = params.toString()
  return `${BASE}/transcripts/${tid}/export/${fmt}${qs ? `?${qs}` : ''}`
}

export const downloadUrl = (jobId) => {
  const t = localStorage.getItem('token')
  return `${BASE}/jobs/${jobId}/original${t ? `?token=${encodeURIComponent(t)}` : ''}`
}

export async function fetchThumbnail(jobId) {
  const res = await fetch(`${BASE}/jobs/${jobId}/thumbnail`, { headers: headers() })
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function triggerDownload(jobId) {
  const url = downloadUrl(jobId)
  try {
    const r = await fetch(url)
    if (!r.ok) { window.open(url); return }
    const blob = await r.blob()
    const cd = r.headers.get('content-disposition') || ''
    const m = cd.match(/filename="([^"]+)"/)
    const fname = m ? m[1] : 'arquivo'
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj; a.download = fname
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(obj)
  } catch { window.open(url) }
}
