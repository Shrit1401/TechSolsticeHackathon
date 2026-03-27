'use client'

import { useEffect, useState } from 'react'

/** Updates "Xs ago" string every second from a timestamp ref */
export function useRelativeAgo(lastUpdateMs: number): string {
  const [label, setLabel] = useState('just now')

  useEffect(() => {
    const fmt = () => {
      if (lastUpdateMs <= 0) {
        setLabel('—')
        return
      }
      const s = Math.max(0, Math.floor((Date.now() - lastUpdateMs) / 1000))
      if (s < 5) setLabel('just now')
      else if (s < 60) setLabel(`${s}s ago`)
      else if (s < 3600) setLabel(`${Math.floor(s / 60)}m ago`)
      else setLabel(`${Math.floor(s / 3600)}h ago`)
    }
    fmt()
    const id = setInterval(fmt, 1000)
    return () => clearInterval(id)
  }, [lastUpdateMs])

  return label
}
