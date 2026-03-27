'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import type { ScoreHistoryPoint } from '@/hooks/useHealthScore'
import { useDashboardStore } from '@/store/dashboardStore'
import { scoreToColorHex, type HealthScoreResult } from '@/lib/healthScore'
import { ScoreRing } from './ScoreRing'

const DAY_MS = 24 * 60 * 60 * 1000

const SPARK_KEYS: { key: keyof HealthScoreResult['breakdown']; label: string }[] = [
  { key: 'latency', label: 'Latency' },
  { key: 'errors', label: 'Errors' },
  { key: 'throughput', label: 'Throughput' },
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'anomaly', label: 'Anomaly' },
]

function buildScoreLog(points: ScoreHistoryPoint[]): { id: string; t: number; message: string }[] {
  const out: { id: string; t: number; message: string }[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const drop = prev.score - cur.score
    if (drop >= 5) {
      const worst = (Object.entries(cur.breakdown) as [keyof HealthScoreResult['breakdown'], number][]).sort(
        (a, b) => a[1] - b[1]
      )[0]
      const hint = worst ? ` — ${worst[0]} sub-score ${Math.round(worst[1])}` : ''
      out.push({
        id: `${cur.timestamp}-${i}`,
        t: cur.timestamp,
        message: `Score dropped from ${prev.score} to ${cur.score}${hint}`,
      })
    }
  }
  return out.slice(-24).reverse()
}

function eventLabel(type: string): string {
  switch (type) {
    case 'failure':
      return 'Deploy / failure'
    case 'anomaly-detected':
      return 'Anomaly'
    case 'rca-complete':
      return 'RCA'
    case 'remediation-started':
      return 'Remediation'
    case 'recovery':
      return 'Recovery'
    default:
      return type
  }
}

type HealthScoreExpandedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  score: number
  color: string
  breakdown: HealthScoreResult['breakdown']
  history: ScoreHistoryPoint[]
  lastUpdated: number | null
}

export function HealthScoreExpanded({
  open,
  onOpenChange,
  score,
  color,
  breakdown,
  history,
  lastUpdated,
}: HealthScoreExpandedProps) {
  const incidentTimeline = useDashboardStore(s => s.incidentTimeline)

  const chartPoints = useMemo(() => {
    if (!history.length) return []
    const refT = history[history.length - 1]!.timestamp
    const windowStart = refT - DAY_MS
    return history
      .filter(h => h.timestamp >= windowStart)
      .map(h => ({
        t: h.timestamp,
        score: h.score,
        ...h.breakdown,
      }))
  }, [history])

  const scoreLog = useMemo(() => {
    if (!history.length) return []
    const refT = history[history.length - 1]!.timestamp
    const windowStart = refT - DAY_MS
    return buildScoreLog(history.filter(h => h.timestamp >= windowStart))
  }, [history])

  const eventLines = useMemo(() => {
    if (!history.length) return []
    const refT = history[history.length - 1]!.timestamp
    const windowStart = refT - DAY_MS
    return incidentTimeline
      .filter(e => e.timestamp >= windowStart)
      .map(e => ({
        x: e.timestamp,
        label: eventLabel(e.type),
      }))
  }, [incidentTimeline, history])

  const [agoSec, setAgoSec] = useState<number | null>(null)
  useEffect(() => {
    if (!open || lastUpdated == null) {
      const id = requestAnimationFrame(() => setAgoSec(null))
      return () => cancelAnimationFrame(id)
    }
    let intervalId: ReturnType<typeof setInterval>
    const frameId = requestAnimationFrame(() => {
      setAgoSec(Math.max(1, Math.round((Date.now() - lastUpdated) / 1000)))
      intervalId = window.setInterval(() => {
        setAgoSec(Math.max(1, Math.round((Date.now() - lastUpdated) / 1000)))
      }, 1000)
    })
    return () => {
      cancelAnimationFrame(frameId)
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [open, lastUpdated])

  const axisTick = { fill: 'rgba(156,163,175,0.45)', fontSize: 10, fontFamily: 'var(--font-ui)' } as const

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/70 backdrop-blur-[8px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Popup className="pointer-events-auto flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-black p-6 shadow-2xl outline-none md:p-8 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 [font-family:var(--font-ui)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-5">
                <motion.div layoutId="health-score-orb" className="relative shrink-0">
                  <ScoreRing size={96} score={score} color={color} />
                </motion.div>
                <div>
                  <Dialog.Title className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                    Infrastructure health
                  </Dialog.Title>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color }}>
                    {score}
                  </p>
                  <Dialog.Description className="sr-only">
                    Twenty-four hour score history, sub-score trends, incidents, and change log.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent-cyan)]/40 hover:text-white"
                aria-label="Close"
              >
                <X className="size-4" strokeWidth={1.75} />
              </Dialog.Close>
            </div>

            <div className="mt-6 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Overall score (24h)</h3>
                <div className="mt-3 h-[220px] w-full">
                  {chartPoints.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <ReferenceArea y1={90} y2={100} fill="rgba(0,230,118,0.08)" />
                        <ReferenceArea y1={60} y2={90} fill="rgba(0,229,255,0.05)" />
                        <ReferenceArea y1={40} y2={60} fill="rgba(255,176,32,0.06)" />
                        <ReferenceArea y1={0} y2={40} fill="rgba(255,23,68,0.07)" />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={v => new Date(v as number).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          tick={axisTick}
                          stroke="rgba(255,255,255,0.12)"
                        />
                        <YAxis domain={[0, 100]} tick={axisTick} stroke="rgba(255,255,255,0.12)" width={32} />
                        <RTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const p = payload[0].payload as (typeof chartPoints)[0]
                            return (
                              <div className="rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-[12px] shadow-xl">
                                <p className="text-white/50">{new Date(p.t).toLocaleString()}</p>
                                <p className="mt-1 font-semibold tabular-nums text-white">{p.score}</p>
                              </div>
                            )
                          }}
                        />
                        {eventLines.map((ev, i) => (
                          <ReferenceLine
                            key={`${ev.x}-${i}`}
                            x={ev.x}
                            stroke="rgba(255,255,255,0.25)"
                            strokeDasharray="4 4"
                            label={{ value: ev.label, position: 'top', fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
                          />
                        ))}
                        <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-[13px] text-white/40">Collecting history…</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Sub-score trends</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {SPARK_KEYS.map(({ key, label }) => {
                    const stroke = scoreToColorHex(breakdown[key])
                    const series = chartPoints.map(d => ({ t: d.t, v: d[key] as number }))
                    return (
                      <div key={key} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <p className="text-[11px] font-medium text-white/55">{label}</p>
                        <div className="mt-2 h-[56px] w-full">
                          {series.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                <XAxis dataKey="t" type="number" hide />
                                <YAxis domain={[0, 100]} hide />
                                <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-center text-[11px] text-white/30">—</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Score log</h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
                  <table className="w-full text-left text-[12px]">
                    <tbody>
                      {scoreLog.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-white/35">No major drops in this window.</td>
                        </tr>
                      ) : (
                        scoreLog.map(row => (
                          <tr key={row.id} className="border-t border-white/[0.06] first:border-t-0">
                            <td className="w-36 shrink-0 px-4 py-2.5 font-mono text-[11px] text-white/40">
                              {new Date(row.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="px-4 py-2.5 text-white/75">{row.message}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {lastUpdated != null && agoSec != null && (
                  <p className="mt-2 text-[11px] text-white/35">Last calculated {agoSec}s ago</p>
                )}
              </section>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
