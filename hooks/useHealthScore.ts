'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { computeHealthScore, scoreToColorHex, type HealthLabel, type HealthScoreResult } from '@/lib/healthScore'
import { useDashboardStore } from '@/store/dashboardStore'
import { anomalyScoreFromStore, gaugeValue } from '@/lib/widgetMockData'

const HISTORY_MAX = 720
const ONE_H_MS = 60 * 60 * 1000
export const STALE_MS = 60_000

export type ScoreHistoryPoint = {
  score: number
  timestamp: number
  breakdown: HealthScoreResult['breakdown']
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function buildMetricInput(timeSeed: number) {
  const { metrics, anomalies, isSimulatingFailure } = useDashboardStore.getState()
  const rr = metrics.requestRate
  const er = metrics.errorRate
  const lat = metrics.latency

  const requestRate = rr.length ? rr[rr.length - 1]!.value : 0
  const errorRate = er.length ? er[er.length - 1]!.value : 0
  const latencyP99 = lat.length ? lat[lat.length - 1]!.value : 0
  const baseline = mean(rr.map(p => p.value)) || requestRate || 450

  return {
    requestRate,
    requestRateBaseline: baseline > 0 ? baseline : 1,
    errorRate,
    latencyP99,
    cpuUtilization: gaugeValue(timeSeed, 'cpu'),
    memoryUtilization: gaugeValue(timeSeed + 99, 'mem'),
    anomalyScore: anomalyScoreFromStore(anomalies.length, isSimulatingFailure),
  }
}

function latestMetricTimestamp(metrics: { requestRate: { timestamp: number }[]; errorRate: { timestamp: number }[]; latency: { timestamp: number }[] }) {
  let m = 0
  for (const p of metrics.requestRate) m = Math.max(m, p.timestamp)
  for (const p of metrics.errorRate) m = Math.max(m, p.timestamp)
  for (const p of metrics.latency) m = Math.max(m, p.timestamp)
  return m
}

export function useHealthScore() {
  const metrics = useDashboardStore(s => s.metrics)
  const anomalies = useDashboardStore(s => s.anomalies)
  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)

  const [displayScore, setDisplayScore] = useState(0)
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [targetOverall, setTargetOverall] = useState(0)
  const [stale, setStale] = useState(false)

  const displayRef = useRef(0)
  const firstAnimDoneRef = useRef(false)
  const smoothBufferRef = useRef<{ score: number; t: number }[]>([])
  const rafRef = useRef<number | null>(null)

  const hasData = metrics.requestRate.length > 0
  const metricTime = useMemo(() => latestMetricTimestamp(metrics), [metrics])

  const rawComputed = useMemo(() => {
    if (!hasData) return null
    void anomalies.length
    void isSimulatingFailure
    return computeHealthScore(buildMetricInput(metricTime))
  }, [hasData, metricTime, anomalies.length, isSimulatingFailure])

  useEffect(() => {
    if (!rawComputed || !hasData) return
    const now = Date.now()
    const buf = smoothBufferRef.current.filter(x => now - x.t < 10_000)
    buf.push({ score: rawComputed.overall, t: now })
    smoothBufferRef.current = buf.slice(-5)

    const last3 = buf.slice(-3).map(x => x.score)
    let next = rawComputed.overall
    if (last3.length >= 2) {
      const spread = Math.max(...last3) - Math.min(...last3)
      if (spread > 5) next = Math.round(mean(last3))
    }
    setTargetOverall(next)
    setHistory(h => {
      const pt: ScoreHistoryPoint = {
        score: next,
        timestamp: now,
        breakdown: rawComputed.breakdown,
      }
      const n = [...h, pt]
      return n.length > HISTORY_MAX ? n.slice(-HISTORY_MAX) : n
    })
    setLastUpdated(now)
  }, [rawComputed, hasData])

  useEffect(() => {
    const update = () => setStale(lastUpdated != null && Date.now() - lastUpdated > STALE_MS)
    let intervalId: ReturnType<typeof setInterval>
    const frameId = requestAnimationFrame(() => {
      update()
      intervalId = window.setInterval(update, 3000)
    })
    return () => {
      cancelAnimationFrame(frameId)
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [lastUpdated])

  const rawResult = rawComputed
    ? ({ ...rawComputed, overall: targetOverall } as HealthScoreResult)
    : null

  /* Animate displayScore toward targetOverall */
  useEffect(() => {
    if (!hasData || rawComputed == null) return

    const end = targetOverall
    const start = displayRef.current
    if (start === end && firstAnimDoneRef.current) return

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)

    const duration = firstAnimDoneRef.current ? 600 : 1200
    const t0 = performance.now()
    const easeOut = (t: number) => 1 - (1 - t) ** 3
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
    const ease = firstAnimDoneRef.current ? easeInOut : easeOut

    if (firstAnimDoneRef.current && start - end > 10) {
      window.dispatchEvent(new CustomEvent('health-score-sharp-drop', { detail: start - end }))
    }

    const tick = (frameNow: number) => {
      const elapsed = frameNow - t0
      const u = Math.min(1, elapsed / duration)
      const v = Math.round(start + (end - start) * ease(u))
      displayRef.current = v
      setDisplayScore(v)
      if (u < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        rafRef.current = null
        firstAnimDoneRef.current = true
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [targetOverall, hasData, rawComputed])

  const color = useMemo(() => scoreToColorHex(displayScore), [displayScore])

  const trend = useMemo(() => {
    if (!lastUpdated || history.length < 2) return { delta: 0, direction: 'stable' as const }
    const ago = lastUpdated - ONE_H_MS
    let past = history.filter(h => h.timestamp <= ago).pop()
    if (!past) past = history[0]
    if (!past) return { delta: 0, direction: 'stable' as const }
    const delta = displayScore - past.score
    if (Math.abs(delta) < 1) return { delta: 0, direction: 'stable' as const }
    return { delta, direction: delta > 0 ? ('up' as const) : ('down' as const) }
  }, [history, lastUpdated, displayScore])

  const label: HealthLabel = rawResult?.label ?? 'Healthy'

  return {
    score: displayScore,
    breakdown: rawResult?.breakdown ?? {
      latency: 0,
      errors: 0,
      throughput: 0,
      cpu: 0,
      memory: 0,
      anomaly: 0,
    },
    label,
    color,
    trend,
    history,
    lastUpdated,
    stale,
    hasData,
  }
}
