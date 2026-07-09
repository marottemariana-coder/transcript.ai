import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function useJob(jobId) {
  const [job, setJob] = useState(null)
  useEffect(() => {
    if (!jobId) return
    let active = true
    const poll = async () => {
      try {
        const j = await api(`/jobs/${jobId}`)
        if (!active) return
        setJob(j)
        if (j.status !== 'done' && j.status !== 'error') setTimeout(poll, 2000)
      } catch { /* job pode ainda nao existir */ }
    }
    poll()
    return () => { active = false }
  }, [jobId])
  return job
}
