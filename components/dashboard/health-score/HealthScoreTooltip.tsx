'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HEALTH_WEIGHTS, scoreToColorHex } from '@/lib/healthScore'
import { cn } from '@/lib/utils'

const ROWS: { key: keyof typeof HEALTH_WEIGHTS; label: string }[] = [
  { key: 'latency', label: 'Latency' },
  { key: 'errors', label: 'Errors' },
  { key: 'throughput', label: 'Throughput' },
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'anomaly', label: 'Anomaly' },
]

type Breakdown = Record<(typeof ROWS)[number]['key'], number>

export function HealthScoreTooltip({
  breakdown,
  lastUpdated,
  className,
}: {
  breakdown: Breakdown
  lastUpdated: number | null
  className?: string
}) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null)
  useEffect(() => {
    if (lastUpdated == null) {
      const id = requestAnimationFrame(() => setSecondsAgo(null))
      return () => cancelAnimationFrame(id)
    }
    let intervalId: ReturnType<typeof setInterval>
    const frameId = requestAnimationFrame(() => {
      setSecondsAgo(Math.max(1, Math.round((Date.now() - lastUpdated) / 1000)))
      intervalId = window.setInterval(() => {
        setSecondsAgo(Math.max(1, Math.round((Date.now() - lastUpdated) / 1000)))
      }, 1000)
    })
    return () => {
      cancelAnimationFrame(frameId)
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [lastUpdated])
  const ago = lastUpdated == null ? '—' : secondsAgo == null ? '…' : `${secondsAgo}s ago`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'pointer-events-none absolute left-1/2 top-full z-30 mt-4 w-[min(100vw-2rem,320px)] -translate-x-1/2 rounded-2xl border border-white/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
        'bg-[rgba(17,24,32,0.95)] backdrop-blur-[16px]',
        className
      )}
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">Health score breakdown</p>
      <ul className="mt-4 space-y-2.5">
        {ROWS.map(({ key, label }) => {
          const v = breakdown[key]
          const w = HEALTH_WEIGHTS[key]
          const pct = Math.round(w * 100)
          const fill = scoreToColorHex(v)
          return (
            <li key={key} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-white/55">{label}</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${v}%`, backgroundColor: fill }} />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-white/90">{Math.round(v)}</span>
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/35">{pct}%</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-[11px] text-white/40">Right column: blend weight · Updated {ago}</p>
    </motion.div>
  )
}
