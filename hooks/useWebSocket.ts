'use client'

import { useEffect, useState } from 'react'

/**
 * Reports live backend connectivity by polling the /api/health endpoint.
 * Returns `connected: true` when the backend responds OK.
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/health', {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        })
        if (!cancelled) setConnected(res.ok)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    void check()
    const id = setInterval(() => { if (!cancelled) void check() }, 20_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { connected }
}
