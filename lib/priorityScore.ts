import type { WidgetId } from '@/lib/constants'
import { DEFAULT_WIDGET_ORDER } from '@/lib/constants'
import type { CardStatus } from '@/lib/widgetCardStatus'
import type { TileMetricSnapshot, TileSeverityCategory } from '@/lib/widgetMetricSnapshot'

export type TilePriority = {
  id: WidgetId
  score: number
  status: CardStatus
  severity: number
}

export function normalizeDepth(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value * max)))
}

function calculateSeverityDepth(tile: TileMetricSnapshot): number {
  const { status, category, value, baseline } = tile
  if (status === 'healthy') return 0

  switch (category) {
    case 'error-rate': {
      if (status === 'critical') return normalizeDepth((value - 5) / 5, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 2) / 3, 0, 20)
      return 0
    }
    case 'latency': {
      if (status === 'critical') return normalizeDepth((value - 300) / 200, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 150) / 150, 0, 20)
      return 0
    }
    case 'cpu': {
      if (status === 'critical') return normalizeDepth((value - 85) / 15, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 65) / 20, 0, 20)
      return 0
    }
    case 'memory': {
      if (status === 'critical') return normalizeDepth((value - 85) / 15, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 70) / 15, 0, 20)
      return 0
    }
    case 'request-rate': {
      const b = baseline ?? 450
      const deviation = Math.abs(value - b) / Math.max(b, 1e-9)
      if (status === 'critical') return normalizeDepth(deviation - 0.4, 0, 20)
      if (status === 'watch') return normalizeDepth(deviation - 0.2, 0, 20)
      return 0
    }
    case 'anomaly': {
      if (status === 'critical') return normalizeDepth((value - 0.7) / 0.3, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 0.3) / 0.4, 0, 20)
      return 0
    }
    case 'connections': {
      const max = baseline ?? 1000
      const ratio = value / max
      if (status === 'critical') return normalizeDepth((ratio - 0.9) / 0.1, 0, 20)
      if (status === 'watch') return normalizeDepth((ratio - 0.8) / 0.1, 0, 20)
      return 0
    }
    case 'incidents': {
      if (status === 'critical') return normalizeDepth((value - 2) / 2, 0, 20)
      if (status === 'watch') return normalizeDepth((value - 0) / 2, 0, 20)
      return 0
    }
    case 'service-health': {
      if (status === 'critical') return normalizeDepth(value / 4, 0, 20)
      if (status === 'watch') return normalizeDepth(value / 3, 0, 20)
      return 0
    }
    default:
      return genericSeverity(category, value, status)
  }
}

function genericSeverity(
  category: TileSeverityCategory,
  value: number,
  status: CardStatus,
): number {
  if (status === 'critical') {
    switch (category) {
      case 'queue-depth':
        return normalizeDepth((value - 70) / 40, 0, 20)
      case 'saturation':
      case 'thread-pool':
        return normalizeDepth((value - 85) / 15, 0, 20)
      case 'disk-io':
        return normalizeDepth((value - 650) / 200, 0, 20)
      case 'network-in':
        return normalizeDepth((value - 1100) / 400, 0, 20)
      case 'gc-pause':
        return normalizeDepth((value - 8) / 8, 0, 20)
      case 'cache-hit':
        return normalizeDepth((80 - value) / 12, 0, 20)
      case 'db-connections': {
        return normalizeDepth((value - 162) / 36, 0, 20)
      }
      default:
        return 10
    }
  }
  if (status === 'watch') {
    switch (category) {
      case 'queue-depth':
        return normalizeDepth((value - 40) / 30, 0, 20)
      case 'saturation':
      case 'thread-pool':
        return normalizeDepth((value - 65) / 20, 0, 20)
      case 'disk-io':
        return normalizeDepth((value - 400) / 250, 0, 20)
      case 'network-in':
        return normalizeDepth((value - 700) / 400, 0, 20)
      case 'gc-pause':
        return normalizeDepth((value - 3) / 5, 0, 20)
      case 'cache-hit':
        return normalizeDepth((90 - value) / 10, 0, 20)
      case 'db-connections':
        return normalizeDepth((value - 144) / 36, 0, 20)
      default:
        return 6
    }
  }
  return 0
}

export function calculateTilePriority(tile: TileMetricSnapshot): TilePriority {
  const { status, id } = tile
  let baseScore: number
  switch (status) {
    case 'critical':
      baseScore = 80
      break
    case 'watch':
      baseScore = 40
      break
    default:
      baseScore = 0
  }
  const severity = calculateSeverityDepth(tile)
  return {
    id,
    score: Math.min(baseScore + severity, 100),
    status,
    severity,
  }
}

export function getSortedTileOrder(snapshots: TileMetricSnapshot[]): WidgetId[] {
  return snapshots
    .map(calculateTilePriority)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.id.localeCompare(b.id)
    })
    .map((p) => p.id)
}

export function orderEquals(a: WidgetId[], b: WidgetId[]): boolean {
  if (a.length !== b.length) return false
  return a.every((id, i) => id === b[i])
}

export type IssueRow = {
  tileId: WidgetId
  tileName: string
  status: 'watch' | 'critical'
  metricName: string
  currentValue: string
  threshold: string
}

function formatSnapshotValue(tile: TileMetricSnapshot): { current: string; threshold: string; metric: string } {
  switch (tile.category) {
    case 'error-rate':
      return {
        current: `${tile.value.toFixed(1)}%`,
        threshold: tile.status === 'critical' ? '>5%' : '>2%',
        metric: 'Error rate',
      }
    case 'latency':
      return {
        current: `${Math.round(tile.value)}ms`,
        threshold: tile.status === 'critical' ? '>300ms' : '>150ms',
        metric: 'Latency',
      }
    case 'cpu':
      return {
        current: `${Math.round(tile.value)}%`,
        threshold: tile.status === 'critical' ? '>85%' : '>65%',
        metric: 'CPU',
      }
    case 'memory':
      return {
        current: `${Math.round(tile.value)}%`,
        threshold: tile.status === 'critical' ? '>85%' : '>70%',
        metric: 'Memory',
      }
    case 'request-rate':
      return {
        current: `${Math.round(tile.value)} req/s`,
        threshold: '±baseline',
        metric: 'Request rate',
      }
    case 'anomaly':
      return {
        current: tile.value.toFixed(2),
        threshold: tile.status === 'critical' ? '>0.7' : '>0.3',
        metric: 'Anomaly',
      }
    case 'connections':
      return {
        current: `${Math.round(tile.value)}`,
        threshold: '>90% pool',
        metric: 'Connections',
      }
    case 'incidents':
      return {
        current: `${Math.round(tile.value)}`,
        threshold: tile.status === 'critical' ? '≥3' : '≥1',
        metric: 'Incidents',
      }
    case 'service-health':
      return {
        current: `${Math.round(tile.value)} svc`,
        threshold: 'degraded/down',
        metric: 'Services',
      }
    case 'cache-hit':
      return {
        current: `${tile.value.toFixed(1)}%`,
        threshold: '<80% / <90%',
        metric: 'Cache hit',
      }
    case 'gc-pause':
      return {
        current: `${tile.value.toFixed(2)}ms`,
        threshold: '>8ms / >3ms',
        metric: 'GC pause',
      }
    case 'db-connections':
      return {
        current: `${Math.round(tile.value)}`,
        threshold: '>90% pool',
        metric: 'DB conns',
      }
    default:
      return {
        current: `${Math.round(tile.value * 10) / 10}`,
        threshold: 'threshold',
        metric: 'Metric',
      }
  }
}

export function buildIssues(
  snapshots: TileMetricSnapshot[],
  titleById: (id: WidgetId) => string,
): IssueRow[] {
  const out: IssueRow[] = []
  for (const s of snapshots) {
    if (s.status === 'healthy') continue
    const fmt = formatSnapshotValue(s)
    out.push({
      tileId: s.id,
      tileName: titleById(s.id),
      status: s.status,
      metricName: fmt.metric,
      currentValue: fmt.current,
      threshold: fmt.threshold,
    })
  }
  return out
}

export function hasAnyIssue(snapshots: TileMetricSnapshot[]): boolean {
  return snapshots.some((s) => s.status === 'watch' || s.status === 'critical')
}

export function defaultWidgetIds(): WidgetId[] {
  return [...DEFAULT_WIDGET_ORDER]
}
