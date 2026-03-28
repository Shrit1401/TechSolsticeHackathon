import type { WidgetId } from '@/lib/constants'
import type { MetricsData, Service, MetricPoint } from '@/lib/types'
import { averageError, mergeMetrics, sliceByRange } from '@/lib/graphUtils'
import type { CardStatus } from '@/lib/widgetCardStatus'
import { widgetCardStatusWithPrev } from '@/lib/widgetCardStatus'

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
  extendedMetrics: Partial<Record<WidgetId, MetricPoint[]>>
  anomalyScore: number
  services: Service[]
  anomalyCount: number
  isSimulatingFailure: boolean
  incidentCount: number
}

function latest(series: MetricPoint[] | undefined, fallback = 0): number {
  return series?.length ? series[series.length - 1]!.value : fallback
}

export function getWidgetMetricSnapshot(
  id: WidgetId,
  c: MetricSnapshotCtx,
  prevStatus: CardStatus = 'healthy',
): TileMetricSnapshot {
  const { metrics, extendedMetrics, anomalyScore, services, incidentCount } = c

  const status = widgetCardStatusWithPrev(
    id,
    { metrics, extendedMetrics, anomalyScore, services, anomalyCount: c.anomalyCount, isSimulatingFailure: c.isSimulatingFailure, incidentCount },
    prevStatus,
  )

  switch (id) {
    case 'request-rate':
      return { id, status, category: 'request-rate', value: latest(metrics.requestRate) }
    case 'error-rate':
      return { id, status, category: 'error-rate', value: latest(metrics.errorRate) }
    case 'latency':
      return { id, status, category: 'latency', value: latest(metrics.latency) }
    case 'throughput': {
      const merged = mergeMetrics(metrics.requestRate, metrics.errorRate, metrics.latency)
      return { id, status, category: 'error-rate', value: averageError(sliceByRange(merged, '5m')) }
    }
    case 'cpu':
      return { id, status, category: 'cpu', value: latest(extendedMetrics['cpu']) }
    case 'memory':
      return { id, status, category: 'memory', value: latest(extendedMetrics['memory']) }
    case 'connections':
      return { id, status, category: 'connections', value: latest(extendedMetrics['connections']), baseline: 1000 }
    case 'anomaly':
      return { id, status, category: 'anomaly', value: anomalyScore }
    case 'service-map': {
      const down = services.filter(s => s.status === 'down').length
      const degraded = services.filter(s => s.status === 'degraded').length
      return { id, status, category: 'service-health', value: down * 2 + degraded }
    }
    case 'incident-timeline':
      return { id, status, category: 'incidents', value: incidentCount }
    case 'queue-depth':
      return { id, status, category: 'queue-depth', value: latest(extendedMetrics['queue-depth']) }
    case 'saturation':
      return { id, status, category: 'saturation', value: latest(extendedMetrics['saturation']) }
    case 'disk-io':
      return { id, status, category: 'disk-io', value: latest(extendedMetrics['disk-io']) }
    case 'network-in':
      return { id, status, category: 'network-in', value: latest(extendedMetrics['network-in']) }
    case 'gc-pause':
      return { id, status, category: 'gc-pause', value: latest(extendedMetrics['gc-pause']) }
    case 'cache-hit':
      return { id, status, category: 'cache-hit', value: latest(extendedMetrics['cache-hit']) }
    case 'thread-pool':
      return { id, status, category: 'thread-pool', value: latest(extendedMetrics['thread-pool']) }
    case 'db-connections':
      return { id, status, category: 'db-connections', value: latest(extendedMetrics['db-connections']), baseline: 180 }
    default:
      return { id, status: 'healthy', category: 'queue-depth', value: 0 }
  }
}

export function buildAllWidgetSnapshots(
  ids: readonly WidgetId[],
  ctx: MetricSnapshotCtx,
  prevById?: Partial<Record<WidgetId, CardStatus>>,
): TileMetricSnapshot[] {
  return ids.map(id => getWidgetMetricSnapshot(id, ctx, prevById?.[id]))
}
