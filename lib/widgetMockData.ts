import type { ChartPoint } from '@/lib/graphUtils'

export type ExpandedTimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d'

/** Mulberry32 PRNG — deterministic seed → float in [0, 1). */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A ±7.5% synthetic "previous" value — used only for cosmetic delta indicators
 * where historical data isn't available (e.g. service-map healthy %, incident count).
 */
export function syntheticPreviousValue(current: number, seed: number): number {
  const r = mulberry32(seed)()
  return current + (r - 0.5) * Math.max(Math.abs(current), 1e-6) * 0.15
}

function rangeMs(r: ExpandedTimeRange): number {
  switch (r) {
    case '5m': return 5 * 60 * 1000
    case '15m': return 15 * 60 * 1000
    case '1h': return 60 * 60 * 1000
    case '6h': return 6 * 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
  }
}

function stepMs(r: ExpandedTimeRange): number {
  switch (r) {
    case '5m': return 10_000
    case '15m': return 30_000
    case '1h': return 60_000
    case '6h': return 5 * 60_000
    case '24h': return 15 * 60_000
    case '7d': return 4 * 60 * 60_000
  }
}

/**
 * Generates correlated throughput + error + latency points for the expanded
 * modal chart when a specific time range is requested.
 * Used only by the ExpandedModal (not by inline widget tiles).
 */
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

/** Convert a memory utilization percentage to a { used, total } GB pair (assumes 32 GB host). */
export function memoryGb(percent: number): { used: number; total: number } {
  const total = 32
  const used = (percent / 100) * total
  return { used, total }
}
