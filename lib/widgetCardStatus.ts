import type { WidgetId } from '@/lib/constants'
import { BASELINE_REQUEST_RATE } from '@/lib/mockData'
import type { MetricsData, Service } from '@/lib/types'
import { averageError, mergeMetrics, sliceByRange } from '@/lib/graphUtils'
import {
  anomalyScoreFromStore,
  deriveSparkSeries,
  gaugeValue,
  generateStackedConnections,
} from '@/lib/widgetMockData'
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

export function requestRateStatus(value: number, baseline = BASELINE_REQUEST_RATE): CardStatus {
  const d = Math.abs(value - baseline) / Math.max(baseline, 1e-9)
  if (d <= 0.2) return 'healthy'
  if (d <= 0.4) return 'watch'
  return 'critical'
}

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

export function connectionsPoolStatus(total: number, max = 1000): CardStatus {
  const ratio = total / max
  if (ratio < 0.8) return 'healthy'
  if (ratio <= 0.9) return 'watch'
  return 'critical'
}

export function anomalyScoreStatus(score: number): CardStatus {
  if (score < 0.3) return 'healthy'
  if (score <= 0.7) return 'watch'
  return 'critical'
}

export function serviceMapStatus(services: Service[]): CardStatus {
  if (services.some((s) => s.status === 'down')) return 'critical'
  if (services.some((s) => s.status === 'degraded')) return 'watch'
  return 'healthy'
}

export function incidentTimelineStatus(count: number): CardStatus {
  if (count === 0) return 'healthy'
  if (count <= 2) return 'watch'
  return 'critical'
}

export function queueDepthStatus(msgs: number): CardStatus {
  if (msgs < 40) return 'healthy'
  if (msgs <= 70) return 'watch'
  return 'critical'
}

export function saturationPercentStatus(pct: number): CardStatus {
  if (pct < 65) return 'healthy'
  if (pct <= 85) return 'watch'
  return 'critical'
}

export function diskIoStatus(mbps: number): CardStatus {
  if (mbps < 400) return 'healthy'
  if (mbps <= 650) return 'watch'
  return 'critical'
}

export function networkInStatus(mbps: number): CardStatus {
  if (mbps < 700) return 'healthy'
  if (mbps <= 1100) return 'watch'
  return 'critical'
}

export function gcPauseStatus(ms: number): CardStatus {
  if (ms < 3) return 'healthy'
  if (ms <= 8) return 'watch'
  return 'critical'
}

export function cacheHitStatus(pct: number): CardStatus {
  if (pct > 90) return 'healthy'
  if (pct >= 80) return 'watch'
  return 'critical'
}

export function dbConnectionsStatus(count: number, poolMax = 180): CardStatus {
  const ratio = count / poolMax
  if (ratio < 0.8) return 'healthy'
  if (ratio <= 0.9) return 'watch'
  return 'critical'
}

export function throughputBudgetStatus(avgErrorPct: number): CardStatus {
  return errorPercentStatus(avgErrorPct)
}

function derivedLatest(
  metrics: MetricsData,
  seed: number,
  base: number,
  amplitude: number,
  opts?: { min?: number; max?: number },
): number {
  const series = deriveSparkSeries(metrics.requestRate, seed, base, amplitude, opts)
  return series[series.length - 1]?.value ?? base
}

type WidgetCtx = {
  metrics: MetricsData
  services: Service[]
  anomalyCount: number
  isSimulatingFailure: boolean
  incidentCount: number
  gaugePulse: number
}

/** Status with per-tile hysteresis (use previous output status as `prev`). */
export function widgetCardStatusWithPrev(id: WidgetId, ctx: WidgetCtx, prev: CardStatus): CardStatus {
  const { metrics, services, anomalyCount, isSimulatingFailure, incidentCount, gaugePulse } = ctx

  switch (id) {
    case 'request-rate': {
      const v = metrics.requestRate[metrics.requestRate.length - 1]?.value ?? 0
      const baseline =
        metrics.requestRate.reduce((a, p) => a + p.value, 0) / Math.max(metrics.requestRate.length, 1) ||
        BASELINE_REQUEST_RATE
      const d = Math.abs(v - baseline) / Math.max(baseline, 1e-9)
      return hysteresisRequestRateDeviation(d, prev)
    }
    case 'error-rate': {
      const v = metrics.errorRate[metrics.errorRate.length - 1]?.value ?? 0
      return hysteresisErrorRate(v, prev)
    }
    case 'latency': {
      const v = metrics.latency[metrics.latency.length - 1]?.value ?? 0
      return hysteresisLatency(v, prev)
    }
    case 'throughput': {
      const merged = mergeMetrics(metrics.requestRate, metrics.errorRate, metrics.latency)
      const slice = sliceByRange(merged, '5m')
      const avg = averageError(slice)
      return throughputBudgetStatus(avg)
    }
    case 'cpu':
      return hysteresisCpu(gaugeValue(Date.now() + gaugePulse, 'cpu'), prev)
    case 'memory':
      return hysteresisMemory(gaugeValue(Date.now() + 99 + gaugePulse, 'mem'), prev)
    case 'connections': {
      const data = generateStackedConnections('5m')
      const last = data[data.length - 1]
      if (!last) return 'healthy'
      const total = last.h1 + last.h2 + last.ws
      return hysteresisConnectionsRatio(total / 1000, prev)
    }
    case 'anomaly': {
      const score = anomalyScoreFromStore(anomalyCount, isSimulatingFailure)
      return hysteresisAnomalyScore(score, prev)
    }
    case 'service-map':
      return serviceMapStatus(services)
    case 'incident-timeline':
      return incidentTimelineStatus(incidentCount)
    case 'queue-depth':
      return queueDepthStatus(derivedLatest(metrics, 101, 48, 18))
    case 'saturation':
      return saturationPercentStatus(
        derivedLatest(metrics, 102, 62, 8, { min: 0, max: 100 }),
      )
    case 'disk-io':
      return diskIoStatus(derivedLatest(metrics, 103, 320, 45))
    case 'network-in':
      return networkInStatus(derivedLatest(metrics, 104, 840, 120))
    case 'gc-pause':
      return gcPauseStatus(derivedLatest(metrics, 105, 2.4, 0.85))
    case 'cache-hit':
      return cacheHitStatus(derivedLatest(metrics, 106, 94, 2, { min: 88, max: 100 }))
    case 'thread-pool':
      return cpuPercentStatus(derivedLatest(metrics, 107, 71, 9, { min: 0, max: 100 }))
    case 'db-connections':
      return dbConnectionsStatus(derivedLatest(metrics, 108, 128, 22))
    default:
      return widgetCardStatus(id, ctx)
  }
}

export function widgetCardStatus(
  id: WidgetId,
  ctx: WidgetCtx,
): CardStatus {
  const { metrics, services, anomalyCount, isSimulatingFailure, incidentCount, gaugePulse } = ctx

  switch (id) {
    case 'request-rate': {
      const v = metrics.requestRate[metrics.requestRate.length - 1]?.value ?? 0
      return requestRateStatus(v)
    }
    case 'error-rate': {
      const v = metrics.errorRate[metrics.errorRate.length - 1]?.value ?? 0
      return errorPercentStatus(v)
    }
    case 'latency': {
      const v = metrics.latency[metrics.latency.length - 1]?.value ?? 0
      return latencyStatus(v)
    }
    case 'throughput': {
      const merged = mergeMetrics(metrics.requestRate, metrics.errorRate, metrics.latency)
      const slice = sliceByRange(merged, '5m')
      const avg = averageError(slice)
      return throughputBudgetStatus(avg)
    }
    case 'cpu':
      return cpuPercentStatus(gaugeValue(Date.now() + gaugePulse, 'cpu'))
    case 'memory':
      return memoryPercentStatus(gaugeValue(Date.now() + 99 + gaugePulse, 'mem'))
    case 'connections': {
      const data = generateStackedConnections('5m')
      const last = data[data.length - 1]
      if (!last) return 'healthy'
      const total = last.h1 + last.h2 + last.ws
      return connectionsPoolStatus(total)
    }
    case 'anomaly': {
      const score = anomalyScoreFromStore(anomalyCount, isSimulatingFailure)
      return anomalyScoreStatus(score)
    }
    case 'service-map':
      return serviceMapStatus(services)
    case 'incident-timeline':
      return incidentTimelineStatus(incidentCount)
    case 'queue-depth':
      return queueDepthStatus(derivedLatest(metrics, 101, 48, 18))
    case 'saturation':
      return saturationPercentStatus(
        derivedLatest(metrics, 102, 62, 8, { min: 0, max: 100 }),
      )
    case 'disk-io':
      return diskIoStatus(derivedLatest(metrics, 103, 320, 45))
    case 'network-in':
      return networkInStatus(derivedLatest(metrics, 104, 840, 120))
    case 'gc-pause':
      return gcPauseStatus(derivedLatest(metrics, 105, 2.4, 0.85))
    case 'cache-hit':
      return cacheHitStatus(derivedLatest(metrics, 106, 94, 2, { min: 88, max: 100 }))
    case 'thread-pool':
      return cpuPercentStatus(derivedLatest(metrics, 107, 71, 9, { min: 0, max: 100 }))
    case 'db-connections':
      return dbConnectionsStatus(derivedLatest(metrics, 108, 128, 22))
    default:
      return 'healthy'
  }
}
