import type { WidgetId } from '@/lib/constants'
import type { MetricsData, Service, MetricPoint } from '@/lib/types'
import { averageError, mergeMetrics, sliceByRange } from '@/lib/graphUtils'
import {
  hysteresisAnomalyScore,
  hysteresisConnectionsRatio,
  hysteresisCpu,
  hysteresisErrorRate,
  hysteresisLatency,
  hysteresisMemory,
  hysteresisRequestRateDeviation,
} from '@/lib/statusHysteresis'

export type CardStatus = 'healthy' | 'watch' | 'critical'

export function errorPercentStatus(value: number): CardStatus {
  if (value < 2) return 'healthy'
  if (value <= 5) return 'watch'
  return 'critical'
}

export function latencyStatus(ms: number): CardStatus {
  if (ms < 150) return 'healthy'
  if (ms <= 300) return 'watch'
  return 'critical'
}

export function cpuPercentStatus(pct: number): CardStatus {
  if (pct < 65) return 'healthy'
  if (pct <= 85) return 'watch'
  return 'critical'
}

export function memoryPercentStatus(pct: number): CardStatus {
  if (pct < 70) return 'healthy'
  if (pct <= 85) return 'watch'
  return 'critical'
}

export function anomalyScoreStatus(score: number): CardStatus {
  if (score < 0.3) return 'healthy'
  if (score <= 0.7) return 'watch'
  return 'critical'
}

export function serviceMapStatus(services: Service[]): CardStatus {
  if (services.some(s => s.status === 'down')) return 'critical'
  if (services.some(s => s.status === 'degraded')) return 'watch'
  return 'healthy'
}

export function incidentTimelineStatus(count: number): CardStatus {
  if (count === 0) return 'healthy'
  if (count <= 2) return 'watch'
  return 'critical'
}

export function throughputBudgetStatus(avgErrorPct: number): CardStatus {
  return errorPercentStatus(avgErrorPct)
}

/** Last value in a MetricPoint series, or a default. */
function latest(series: MetricPoint[] | undefined, defaultVal: number): number {
  return series?.length ? series[series.length - 1]!.value : defaultVal
}

type WidgetCtx = {
  metrics: MetricsData
  extendedMetrics: Partial<Record<WidgetId, MetricPoint[]>>
  anomalyScore: number
  services: Service[]
  anomalyCount: number
  isSimulatingFailure: boolean
  incidentCount: number
}

/** Status with per-tile hysteresis. */
export function widgetCardStatusWithPrev(
  id: WidgetId,
  ctx: WidgetCtx,
  prev: CardStatus,
): CardStatus {
  const { metrics, extendedMetrics, anomalyScore, services, incidentCount } = ctx

  switch (id) {
    case 'request-rate': {
      const v = latest(metrics.requestRate, 0)
      // If request rate is effectively zero (no load), that's healthy — not a drop
      if (v < 0.01) return 'healthy'
      const baseline =
        metrics.requestRate.reduce((a, p) => a + p.value, 0) /
          Math.max(metrics.requestRate.length, 1) || v || 1
      const d = Math.abs(v - baseline) / Math.max(baseline, 1e-9)
      return hysteresisRequestRateDeviation(d, prev)
    }
    case 'error-rate':
      return hysteresisErrorRate(latest(metrics.errorRate, 0), prev)
    case 'latency':
      return hysteresisLatency(latest(metrics.latency, 0), prev)
    case 'throughput': {
      const merged = mergeMetrics(metrics.requestRate, metrics.errorRate, metrics.latency)
      return throughputBudgetStatus(averageError(sliceByRange(merged, '5m')))
    }
    case 'cpu':
      return hysteresisCpu(latest(extendedMetrics['cpu'], 0), prev)
    case 'memory':
      return hysteresisMemory(latest(extendedMetrics['memory'], 0), prev)
    case 'connections': {
      const total = latest(extendedMetrics['connections'], 0)
      return hysteresisConnectionsRatio(total / 1000, prev)
    }
    case 'anomaly':
      return hysteresisAnomalyScore(anomalyScore, prev)
    case 'service-map':
      return serviceMapStatus(services)
    case 'incident-timeline':
      return incidentTimelineStatus(incidentCount)
    case 'queue-depth': {
      const v = latest(extendedMetrics['queue-depth'], -1)
      if (v < 0) return 'healthy'
      return v < 40 ? 'healthy' : v <= 70 ? 'watch' : 'critical'
    }
    case 'saturation': {
      const v = latest(extendedMetrics['saturation'], -1)
      if (v < 0) return 'healthy'
      return v < 65 ? 'healthy' : v <= 85 ? 'watch' : 'critical'
    }
    case 'disk-io': {
      const v = latest(extendedMetrics['disk-io'], -1)
      if (v < 0) return 'healthy'
      return v < 400 ? 'healthy' : v <= 650 ? 'watch' : 'critical'
    }
    case 'network-in': {
      const v = latest(extendedMetrics['network-in'], -1)
      if (v < 0) return 'healthy'
      return v < 700 ? 'healthy' : v <= 1100 ? 'watch' : 'critical'
    }
    case 'gc-pause': {
      const v = latest(extendedMetrics['gc-pause'], -1)
      if (v < 0) return 'healthy'
      return v < 3 ? 'healthy' : v <= 8 ? 'watch' : 'critical'
    }
    case 'cache-hit': {
      const v = latest(extendedMetrics['cache-hit'], -1)
      if (v < 0) return 'healthy'
      return v > 90 ? 'healthy' : v >= 80 ? 'watch' : 'critical'
    }
    case 'thread-pool': {
      const v = latest(extendedMetrics['thread-pool'], -1)
      if (v < 0) return 'healthy'
      return v < 65 ? 'healthy' : v <= 85 ? 'watch' : 'critical'
    }
    case 'db-connections': {
      const v = latest(extendedMetrics['db-connections'], -1)
      if (v < 0) return 'healthy'
      const ratio = v / 180
      return ratio < 0.8 ? 'healthy' : ratio <= 0.9 ? 'watch' : 'critical'
    }
    default:
      return 'healthy'
  }
}
