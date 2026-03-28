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
import type { CardStatus } from '@/lib/widgetCardStatus'
import { widgetCardStatus, widgetCardStatusWithPrev } from '@/lib/widgetCardStatus'

export type TileSeverityCategory =
  | 'error-rate'
  | 'latency'
  | 'cpu'
  | 'memory'
  | 'request-rate'
  | 'anomaly'
  | 'connections'
  | 'incidents'
  | 'service-health'
  | 'queue-depth'
  | 'saturation'
  | 'disk-io'
  | 'network-in'
  | 'gc-pause'
  | 'cache-hit'
  | 'thread-pool'
  | 'db-connections'

export type TileMetricSnapshot = {
  id: WidgetId
  status: CardStatus
  category: TileSeverityCategory
  value: number
  baseline?: number
}

export type MetricSnapshotCtx = {
  metrics: MetricsData
  services: Service[]
  anomalyCount: number
  isSimulatingFailure: boolean
  incidentCount: number
  gaugePulse: number
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

const ctxBase = (c: MetricSnapshotCtx) => ({
  metrics: c.metrics,
  services: c.services,
  anomalyCount: c.anomalyCount,
  isSimulatingFailure: c.isSimulatingFailure,
  incidentCount: c.incidentCount,
  gaugePulse: c.gaugePulse,
})

export function getWidgetMetricSnapshot(
  id: WidgetId,
  c: MetricSnapshotCtx,
  prevStatus?: CardStatus,
): TileMetricSnapshot {
  const ctx = ctxBase(c)
  const status =
    prevStatus !== undefined ? widgetCardStatusWithPrev(id, ctx, prevStatus) : widgetCardStatus(id, ctx)

  switch (id) {
    case 'request-rate': {
      const v = c.metrics.requestRate[c.metrics.requestRate.length - 1]?.value ?? 0
      return { id, status, category: 'request-rate', value: v, baseline: BASELINE_REQUEST_RATE }
    }
    case 'error-rate': {
      const v = c.metrics.errorRate[c.metrics.errorRate.length - 1]?.value ?? 0
      return { id, status, category: 'error-rate', value: v }
    }
    case 'latency': {
      const v = c.metrics.latency[c.metrics.latency.length - 1]?.value ?? 0
      return { id, status, category: 'latency', value: v }
    }
    case 'throughput': {
      const merged = mergeMetrics(c.metrics.requestRate, c.metrics.errorRate, c.metrics.latency)
      const slice = sliceByRange(merged, '5m')
      const avg = averageError(slice)
      return { id, status, category: 'error-rate', value: avg }
    }
    case 'cpu': {
      const v = gaugeValue(Date.now() + c.gaugePulse, 'cpu')
      return { id, status, category: 'cpu', value: v }
    }
    case 'memory': {
      const v = gaugeValue(Date.now() + 99 + c.gaugePulse, 'mem')
      return { id, status, category: 'memory', value: v }
    }
    case 'connections': {
      const data = generateStackedConnections('5m')
      const last = data[data.length - 1]
      const total = last ? last.h1 + last.h2 + last.ws : 0
      return { id, status, category: 'connections', value: total, baseline: 1000 }
    }
    case 'anomaly': {
      const score = anomalyScoreFromStore(c.anomalyCount, c.isSimulatingFailure)
      return { id, status, category: 'anomaly', value: score }
    }
    case 'service-map': {
      const down = c.services.filter((s) => s.status === 'down').length
      const degraded = c.services.filter((s) => s.status === 'degraded').length
      return { id, status, category: 'service-health', value: down * 2 + degraded }
    }
    case 'incident-timeline':
      return {
        id,
        status,
        category: 'incidents',
        value: c.incidentCount,
      }
    case 'queue-depth':
      return {
        id,
        status,
        category: 'queue-depth',
        value: derivedLatest(c.metrics, 101, 48, 18),
      }
    case 'saturation':
      return {
        id,
        status,
        category: 'saturation',
        value: derivedLatest(c.metrics, 102, 62, 8, { min: 0, max: 100 }),
      }
    case 'disk-io':
      return {
        id,
        status,
        category: 'disk-io',
        value: derivedLatest(c.metrics, 103, 320, 45),
      }
    case 'network-in':
      return {
        id,
        status,
        category: 'network-in',
        value: derivedLatest(c.metrics, 104, 840, 120),
      }
    case 'gc-pause':
      return {
        id,
        status,
        category: 'gc-pause',
        value: derivedLatest(c.metrics, 105, 2.4, 0.85),
      }
    case 'cache-hit':
      return {
        id,
        status,
        category: 'cache-hit',
        value: derivedLatest(c.metrics, 106, 94, 2, { min: 88, max: 100 }),
      }
    case 'thread-pool':
      return {
        id,
        status,
        category: 'thread-pool',
        value: derivedLatest(c.metrics, 107, 71, 9, { min: 0, max: 100 }),
      }
    case 'db-connections':
      return {
        id,
        status,
        category: 'db-connections',
        value: derivedLatest(c.metrics, 108, 128, 22),
        baseline: 180,
      }
    default:
      return {
        id,
        status: 'healthy',
        category: 'queue-depth',
        value: 0,
      }
  }
}

export function buildAllWidgetSnapshots(
  ids: readonly WidgetId[],
  ctx: MetricSnapshotCtx,
  prevById?: Partial<Record<WidgetId, CardStatus>>,
): TileMetricSnapshot[] {
  return ids.map((id) => getWidgetMetricSnapshot(id, ctx, prevById?.[id]))
}
