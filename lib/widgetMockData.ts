import type { ChartPoint } from '@/lib/graphUtils'
import type { MetricPoint } from '@/lib/types'

export type ExpandedTimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d'

/** Mulberry32 PRNG */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Sparkline series aligned to live metric timestamps (updates with simulation tick). */
export function deriveSparkSeries(
  template: MetricPoint[],
  seed: number,
  base: number,
  amplitude: number,
  opts?: { min?: number; max?: number }
): MetricPoint[] {
  const rand = mulberry32(seed)
  const min = opts?.min ?? 0
  const max = opts?.max ?? Number.POSITIVE_INFINITY
  return template.map((p, i) => {
    let v =
      base + Math.sin(i * 0.35 + seed * 0.01) * amplitude + (rand() - 0.5) * amplitude * 0.3
    v = Math.max(min, Math.min(max, v))
    return { timestamp: p.timestamp, value: v }
  })
}

function rangeMs(r: ExpandedTimeRange): number {
  switch (r) {
    case '5m':
      return 5 * 60 * 1000
    case '15m':
      return 15 * 60 * 1000
    case '1h':
      return 60 * 60 * 1000
    case '6h':
      return 6 * 60 * 60 * 1000
    case '24h':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
  }
}

function stepMs(r: ExpandedTimeRange): number {
  switch (r) {
    case '5m':
      return 10_000
    case '15m':
      return 30_000
    case '1h':
      return 60_000
    case '6h':
      return 5 * 60_000
    case '24h':
      return 15 * 60_000
    case '7d':
      return 4 * 60 * 60_000
  }
}

/** Synthetic correlated throughput + error + latency for expanded modal / long windows */
export function generateSyntheticChartPoints(range: ExpandedTimeRange, seed = 42): ChartPoint[] {
  const now = Date.now()
  const total = rangeMs(range)
  const dt = stepMs(range)
  const count = Math.min(200, Math.max(20, Math.floor(total / dt)))
  const rand = mulberry32(seed)
  const points: ChartPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? now : now - total + (i / (count - 1)) * total
    const phase = (i / count) * Math.PI * 2
    const rr = 420 + Math.sin(phase * 1.5) * 60 + (rand() - 0.5) * 40
    const spike = i > count * 0.6 && i < count * 0.65 ? 8 : 0
    const er = Math.max(0, 2 + Math.sin(phase) * 0.8 + spike + (rand() - 0.5) * 0.6)
    const lat = 110 + er * 12 + (rand() - 0.5) * 20
    points.push({ t, rr: Math.max(0, rr), er, lat: Math.max(0, lat) })
  }
  return points
}

export function formatExpandedAxisTime(ts: number, range: ExpandedTimeRange): string {
  const d = new Date(ts)
  if (range === '7d' || range === '24h') {
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export type StackedConnPoint = { t: number; h1: number; h2: number; ws: number }

export function generateStackedConnections(range: ExpandedTimeRange, seed = 7): StackedConnPoint[] {
  const base = generateSyntheticChartPoints(range, seed)
  return base.map((p, i) => {
    const total = 900 + Math.sin(i / 5) * 200 + (mulberry32(seed + i)() - 0.5) * 80
    const h1 = total * 0.4
    const h2 = total * 0.5
    const ws = total * 0.1
    return { t: p.t, h1, h2, ws }
  })
}

export function gaugeValue(seed: number, label: 'cpu' | 'mem'): number {
  const t = Date.now() / 8000
  const r = mulberry32(seed + Math.floor(t))()
  const base = label === 'cpu' ? 48 + Math.sin(t) * 12 : 62 + Math.cos(t * 0.9) * 8
  return Math.max(0, Math.min(100, base + (r - 0.5) * 6))
}

export function memoryGb(percent: number): { used: number; total: number } {
  const total = 32
  const used = (percent / 100) * total
  return { used, total }
}

export function anomalyScoreFromStore(anomalyCount: number, isFailure: boolean): number {
  if (isFailure) return Math.min(0.95, 0.72 + anomalyCount * 0.04)
  if (anomalyCount > 0) return Math.min(0.85, 0.32 + anomalyCount * 0.14)
  return 0.1
}
