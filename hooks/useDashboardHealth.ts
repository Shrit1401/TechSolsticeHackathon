'use client'

import { useEffect, useState } from 'react'
import { dashboardApiPaths } from '@/lib/dashboardApi'

export type DashboardHealthPayload = {
  status: string
  backends?: Record<string, string>
}

export function useDashboardHealth(pollMs = 20000) {
  const [data, setData] = useState<DashboardHealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const r = await fetch(dashboardApiPaths.health, { cache: 'no-store' })
        if (!cancelled) {
          if (!r.ok) {
            setData(null)
            setError(`HTTP ${r.status}`)
            return
          }
          const j = (await r.json()) as DashboardHealthPayload
          setData(j)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setData(null)
          setError(e instanceof Error ? e.message : 'fetch failed')
        }
      }
    }
    void run()
    const t = window.setInterval(run, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [pollMs])

  return { data, error }
}
