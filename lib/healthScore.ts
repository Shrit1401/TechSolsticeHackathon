/** Infrastructure health score — aggregates dashboard metrics into 0–100 */

export type HealthLabel = 'Excellent' | 'Healthy' | 'Degraded' | 'Warning' | 'Critical'

export interface MetricInput {
  requestRate: number
  requestRateBaseline: number
  errorRate: number
  latencyP99: number
  cpuUtilization: number
  memoryUtilization: number
  anomalyScore: number
}

export interface HealthScoreResult {
  overall: number
  breakdown: {
    latency: number
    errors: number
    throughput: number
    cpu: number
    memory: number
    anomaly: number
  }
  label: HealthLabel
}

export const HEALTH_WEIGHTS = {
  latency: 0.25,
  errors: 0.25,
  throughput: 0.15,
  cpu: 0.12,
  memory: 0.1,
  anomaly: 0.13,
} as const

const WEIGHTS = HEALTH_WEIGHTS

/** Piecewise linear through (x,y) control points, x ascending */
function piecewiseLinear(x: number, points: readonly [number, number][]): number {
  if (points.length === 0) return 0
  if (x <= points[0]![0]) return points[0]![1]
  const last = points[points.length - 1]!
  if (x >= last[0]) return last[1]
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[i + 1]!
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return last[1]
}

export function scoreLatency(latencyMs: number): number {
  return piecewiseLinear(latencyMs, [
    [80, 100],
    [150, 80],
    [300, 50],
    [500, 20],
    [1000, 0],
  ])
}

export function scoreErrors(errorPct: number): number {
  return piecewiseLinear(errorPct, [
    [0.1, 100],
    [1, 85],
    [3, 60],
    [5, 30],
    [10, 0],
  ])
}

export function scoreThroughputStability(current: number, baseline: number): number {
  if (baseline <= 0) return 50
  const dev = Math.abs(current - baseline) / baseline
  const devPct = dev * 100
  return piecewiseLinear(devPct, [
    [5, 100],
    [15, 80],
    [30, 50],
    [50, 20],
    [80, 0],
  ])
}

export function scoreCpu(cpuPct: number): number {
  return piecewiseLinear(cpuPct, [
    [40, 100],
    [60, 85],
    [75, 60],
    [85, 30],
    [95, 0],
  ])
}

export function scoreMemory(memPct: number): number {
  return piecewiseLinear(memPct, [
    [50, 100],
    [65, 85],
    [75, 60],
    [85, 30],
    [95, 0],
  ])
}

/** anomaly 0..1, lower is better */
export function scoreAnomaly(anomaly: number): number {
  return piecewiseLinear(anomaly, [
    [0.1, 100],
    [0.3, 80],
    [0.5, 50],
    [0.7, 20],
    [0.9, 0],
  ])
}

function labelFromScore(overall: number): HealthLabel {
  if (overall >= 90) return 'Excellent'
  if (overall >= 75) return 'Healthy'
  if (overall >= 60) return 'Degraded'
  if (overall >= 40) return 'Warning'
  return 'Critical'
}

export function computeHealthScore(input: MetricInput): HealthScoreResult {
  const latency = scoreLatency(input.latencyP99)
  const errors = scoreErrors(input.errorRate)
  const throughput = scoreThroughputStability(input.requestRate, input.requestRateBaseline)
  const cpu = scoreCpu(input.cpuUtilization)
  const memory = scoreMemory(input.memoryUtilization)
  const anomaly = scoreAnomaly(input.anomalyScore)

  const breakdown = { latency, errors, throughput, cpu, memory, anomaly }

  let overall =
    latency * WEIGHTS.latency +
    errors * WEIGHTS.errors +
    throughput * WEIGHTS.throughput +
    cpu * WEIGHTS.cpu +
    memory * WEIGHTS.memory +
    anomaly * WEIGHTS.anomaly

  const minSub = Math.min(latency, errors, throughput, cpu, memory, anomaly)
  if (minSub < 20) overall = Math.min(overall, 45)

  overall = Math.max(0, Math.min(100, Math.round(overall)))

  return {
    overall,
    breakdown,
    label: labelFromScore(overall),
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Anchor scores (high to low) with brand hex */
const COLOR_STOPS: { score: number; hex: string }[] = [
  { score: 100, hex: '#00E676' },
  { score: 90, hex: '#00E676' },
  { score: 75, hex: '#00E5FF' },
  { score: 60, hex: '#FFB020' },
  { score: 40, hex: '#FF6D00' },
  { score: 0, hex: '#FF1744' },
]

/** Smooth RGB interpolation between stops (mimics HSL blend for adjacent ranges) */
export function scoreToColorHex(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i]!
    const b = COLOR_STOPS[i + 1]!
    if (s <= a.score && s >= b.score) {
      const t = a.score === b.score ? 0 : (s - b.score) / (a.score - b.score)
      const ca = hexToRgb(a.hex)
      const cb = hexToRgb(b.hex)
      return rgbToHex(
        cb.r + t * (ca.r - cb.r),
        cb.g + t * (ca.g - cb.g),
        cb.b + t * (ca.b - cb.b)
      )
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1]!.hex
}

export function subScoreToColorHex(sub: number): string {
  return scoreToColorHex(sub)
}
