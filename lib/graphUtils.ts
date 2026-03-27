import type { MetricPoint } from '@/lib/types'

export type TimeRange = '5m' | '1h' | '24h'

export type ChartPoint = {
  t: number
  rr: number
  er: number
  lat: number
}

export type HealthState = 'healthy' | 'elevated' | 'critical'

export function mergeMetrics(
  requestRate: MetricPoint[],
  errorRate: MetricPoint[],
  latency: MetricPoint[]
): ChartPoint[] {
  const n = Math.min(requestRate.length, errorRate.length, latency.length)
  const out: ChartPoint[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      t: requestRate[i].timestamp,
      rr: requestRate[i].value,
      er: errorRate[i].value,
      lat: latency[i].value,
    })
  }
  return out
}

export function sliceByRange(points: ChartPoint[], range: TimeRange): ChartPoint[] {
  if (points.length === 0) return []
  const take =
    range === '5m' ? Math.min(12, points.length) : range === '1h' ? Math.min(24, points.length) : points.length
  return points.slice(-take)
}

export function averageError(points: ChartPoint[]): number {
  if (points.length === 0) return 0
  return points.reduce((a, p) => a + p.er, 0) / points.length
}

export function healthStateFromError(avgErr: number): HealthState {
  if (avgErr < 2.5) return 'healthy'
  if (avgErr < 8) return 'elevated'
  return 'critical'
}

export function healthLabel(state: HealthState): string {
  if (state === 'healthy') return 'System healthy'
  if (state === 'elevated') return 'Elevated risk'
  return 'Incident risk high'
}

/** 0 = healthy (green), 0.5 = elevated (blue), 1 = critical (red) */
export function healthT(avgErr: number): number {
  if (avgErr <= 2) return 0
  if (avgErr >= 12) return 1
  return (avgErr - 2) / 10
}

export function mixHealthColors(t: number): { stroke: string; top: string; mid: string } {
  const a = Math.max(0, Math.min(1, t))
  const green = { r: 74, g: 222, b: 128 }
  const blue = { r: 56, g: 189, b: 248 }
  const red = { r: 248, g: 113, b: 113 }

  let c1 = green
  let c2 = blue
  let u = a * 2
  if (a > 0.5) {
    c1 = blue
    c2 = red
    u = (a - 0.5) * 2
  }
  const l = (x: number, y: number) => Math.round(x + (y - x) * u)
  const stroke = `rgb(${l(c1.r, c2.r)}, ${l(c1.g, c2.g)}, ${l(c1.b, c2.b)})`
  const top = stroke
  const mid =
    a < 0.5
      ? `rgba(${l(green.r, blue.r)}, ${l(green.g, blue.g)}, ${l(green.b, blue.b)}, 0.55)`
      : `rgba(${l(blue.r, red.r)}, ${l(blue.g, red.g)}, ${l(blue.b, red.b)}, 0.55)`
  return { stroke, top, mid }
}

export function metricState(metric: 'requestRate' | 'errorRate' | 'latency', value: number): HealthState {
  if (metric === 'requestRate') {
    if (value >= 360) return 'healthy'
    if (value >= 240) return 'elevated'
    return 'critical'
  }
  if (metric === 'errorRate') {
    if (value < 2.5) return 'healthy'
    if (value < 8) return 'elevated'
    return 'critical'
  }
  if (value < 180) return 'healthy'
  if (value < 420) return 'elevated'
  return 'critical'
}

export function formatAxisTime(ts: number, range: TimeRange): string {
  const d = new Date(ts)
  if (range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
