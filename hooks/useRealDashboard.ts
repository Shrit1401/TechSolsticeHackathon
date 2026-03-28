'use client'

import { useEffect, useRef } from 'react'
import { useDashboardStore } from '@/store/dashboardStore'
import type { MetricPoint, Anomaly, RootCause, RemediationAction, IncidentEvent, Service } from '@/lib/types'
import type { WidgetId } from '@/lib/constants'
import type {
  PrometheusRangeResponse,
  ChartsPresetsResponse,
  DetectorDetectResponse,
  JaegerServicesResponse,
  ChartPreset,
  LokiQueryRangeResponse,
  LogLine,
} from '@/lib/backendTypes'

const DETECTOR_POLL_MS = 5_000
const PROMETHEUS_POLL_MS = 10_000
const JAEGER_POLL_MS = 30_000
const LOKI_POLL_MS = 10_000
const MAX_POINTS = 30
const MAX_LOG_LINES = 200
const RANGE_SECONDS = 300 // 5-minute window
const STEP_SECONDS = 10  // 10s steps → 30 points

let _idSeq = 0
function newId(): string {
  return `${Date.now()}-${++_idSeq}`
}

/** Parse a Prometheus range-query matrix response into MetricPoint[]. Sums across series. */
function parseMatrix(res: PrometheusRangeResponse): MetricPoint[] {
  if (res.status !== 'success') return []
  const result = res.data?.result ?? []
  if (result.length === 0) return []

  const byTs = new Map<number, number>()
  for (const series of result) {
    for (const [ts, val] of series.values) {
      const v = parseFloat(val)
      if (isFinite(v)) byTs.set(ts, (byTs.get(ts) ?? 0) + v)
    }
  }

  return Array.from(byTs.entries())
    .sort(([a], [b]) => a - b)
    .slice(-MAX_POINTS)
    .map(([ts, value]) => ({ timestamp: ts * 1000, value }))
}

/** Build the /api/prometheus/query_range URL for a 5-minute window. */
function promRangeUrl(query: string): string {
  const now = Math.floor(Date.now() / 1000)
  const p = new URLSearchParams({
    query,
    start: String(now - RANGE_SECONDS),
    end: String(now),
    step: String(STEP_SECONDS),
  })
  return `/api/prometheus/query_range?${p}`
}

/** Convert a snake_case / kebab-case service name to a display name. */
function toDisplayName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/** Port → canonical service name (matches backend setup) */
const PORT_TO_SERVICE: Record<string, string> = {
  '8000': 'api-gateway',
  '8001': 'user-service',
  '8002': 'payment-service',
  '8004': 'order-service',
  '8005': 'inventory-service',
  '8006': 'notification-service',
  '8007': 'auth-service',
}

/** Extract service name from a Prometheus instance label like "172.19.0.4:8000" or "api-gateway:8000". */
function instanceToName(instance: string): string | null {
  const parts = instance.split(':')
  const port = parts[parts.length - 1] ?? ''
  if (PORT_TO_SERVICE[port]) return PORT_TO_SERVICE[port]!
  // If instance is already a hostname like "api-gateway:8000"
  const host = parts[0] ?? ''
  if (host && !host.match(/^\d+\.\d+/)) return host
  return null
}

/** Map a preset array by id for quick lookup. */
function presetMap(presets: ChartPreset[]): Map<string, string> {
  return new Map(presets.map(p => [p.id, p.promql]))
}

export function useRealDashboard(): void {
  const prevStatus = useRef<'healthy' | 'anomaly' | 'healing'>('healthy')
  const presets = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false

    /** Return the PromQL from presets if available, otherwise the fallback. */
    function q(id: string, fallback: string): string {
      return presets.current.get(id) ?? fallback
    }

    // ── Fetch presets once ────────────────────────────────────────────────
    async function fetchPresets() {
      try {
        const res = await fetch('/api/charts/presets')
        if (!res.ok || cancelled) return
        const data: ChartsPresetsResponse = await res.json()
        presets.current = presetMap(data.presets ?? [])
      } catch { /* silent — fallback queries used */ }
    }

    // ── Detector polling ──────────────────────────────────────────────────
    async function pollDetector() {
      try {
        const res = await fetch('/api/detector/detect')
        if (!res.ok || cancelled) return
        const data: DetectorDetectResponse = await res.json()
        if (cancelled) return

        // Support both actual backend format (anomaly/score) and legacy format (is_anomalous/anomaly_score)
        const score = typeof data.score === 'number' ? data.score
          : typeof data.anomaly_score === 'number' ? data.anomaly_score
          : data.confidence ?? 0
        const threshold = data.threshold ?? 0.5
        const isAnomalous = data.anomaly ?? data.is_anomalous ?? score > threshold

        // strong_signals = count of independent signals (log + metric + trace anomalies)
        // Use this for more stable status transitions
        const strongSignals = data.strong_signals ?? 0
        // Only show 'healing' when we were previously in 'anomaly' and are now recovering.
        // Never show healing when system has been healthy all along.
        const newStatus: 'healthy' | 'anomaly' | 'healing' =
          isAnomalous ? 'anomaly'
          : prevStatus.current === 'anomaly' ? 'healing'
          : 'healthy'

        // Map anomaly list
        const anomalies: Anomaly[] = (data.anomalies ?? []).map((a, i) => ({
          id: a.id ?? `det-${Date.now()}-${i}`,
          timestamp: a.timestamp ? a.timestamp * 1000 : Date.now(),
          severity: (['low', 'medium', 'high', 'critical'].includes(a.severity ?? '')
            ? (a.severity as Anomaly['severity'])
            : score > 0.7 ? 'critical' : score > 0.4 ? 'high' : 'medium'),
          message: a.message ?? `Anomaly detected (score: ${(score * 100).toFixed(0)}%)`,
          service: a.service ?? data.root_cause?.service ?? 'system',
        }))

        // Derive a single synthetic anomaly if detector says anomalous but gave no list
        if (isAnomalous && anomalies.length === 0) {
          const signals: string[] = []
          if (data.log_anomaly) signals.push('log anomaly')
          if (data.metric_anomaly) signals.push('metric anomaly')
          if (data.trace_anomaly) signals.push('trace anomaly')
          const sigStr = signals.length > 0 ? ` [${signals.join(', ')}]` : ''
          anomalies.push({
            id: `det-${Date.now()}`,
            timestamp: Date.now(),
            severity: score > 0.7 ? 'critical' : 'high',
            message: `Anomaly detected (score: ${(score * 100).toFixed(0)}%${sigStr})`,
            service: data.root_cause?.service ?? data.source ?? 'system',
          })
        }

        // Root cause
        let rootCause: RootCause | null = null
        if (data.root_cause && isAnomalous) {
          rootCause = {
            service: data.root_cause.service ?? 'system',
            reasons: Array.isArray(data.root_cause.reasons)
              ? (data.root_cause.reasons as string[])
              : [`Anomaly confidence: ${(score * 100).toFixed(0)}%`],
            dependencies: [],
          }
        }

        // Remediation actions
        const remediationActions: RemediationAction[] = (
          data.remediation?.actions ?? []
        ).map((a, i) => ({
          id: `rem-${Date.now()}-${i}`,
          action: a.action,
          type: (['restart', 'scale', 'rollback', 'reroute'].includes(a.type ?? '')
            ? (a.type as RemediationAction['type'])
            : 'restart'),
          status: 'queued',
          timestamp: Date.now(),
        }))

        // Incident timeline events
        const was = prevStatus.current
        if (isAnomalous && was === 'healthy') {
          const ev: IncidentEvent = {
            id: newId(),
            type: 'anomaly-detected',
            timestamp: Date.now(),
            description: `Anomaly detected — ${data.root_cause?.service ?? 'system'} (confidence: ${(score * 100).toFixed(0)}%)`,
          }
          useDashboardStore.getState().appendIncidentEvent(ev)
        } else if (!isAnomalous && was === 'anomaly') {
          const ev: IncidentEvent = {
            id: newId(),
            type: 'recovery',
            timestamp: Date.now(),
            description: 'System recovered: anomaly cleared',
          }
          useDashboardStore.getState().appendIncidentEvent(ev)
        }
        prevStatus.current = newStatus

        useDashboardStore.setState({
          systemStatus: newStatus,
          anomalies,
          anomalyScore: score,  // 0..1 from detector
          rootCause,
          remediationActions,
          isSimulatingFailure: isAnomalous,
          isLoading: false,
        })
      } catch {
        if (!cancelled) useDashboardStore.setState({ isLoading: false })
      }
    }

    // ── Prometheus polling ────────────────────────────────────────────────
    async function pollPrometheus() {
      type CoreKey = 'requestRate' | 'errorRate' | 'latency'

      const coreQueries: Array<{ key: CoreKey; query: string }> = [
        {
          key: 'requestRate',
          query: q('request-rate', 'sum(rate(request_count_total[1m]))'),
        },
        {
          key: 'errorRate',
          // Backend exposes error_count_total separately (no status_code label on request_count_total)
          query: q(
            'error-rate',
            '(sum(rate(error_count_total[1m])) or vector(0)) / (sum(rate(request_count_total[1m])) or vector(1)) * 100',
          ),
        },
        {
          key: 'latency',
          query: q(
            'latency',
            'histogram_quantile(0.99, sum(rate(request_latency_seconds_bucket[5m])) by (le)) * 1000',
          ),
        },
      ]

      const extQueries: Array<{ id: WidgetId; query: string }> = [
        {
          id: 'cpu',
          query: q('cpu', '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        },
        {
          id: 'memory',
          query: q(
            'memory',
            '100 * (1 - avg(node_memory_MemAvailable_bytes) / avg(node_memory_MemTotal_bytes))',
          ),
        },
        {
          id: 'connections',
          query: q('connections', 'sum(node_netstat_Tcp_CurrEstab)'),
        },
        {
          id: 'disk-io',
          query: q(
            'disk-io',
            '(sum(rate(node_disk_read_bytes_total[1m])) + sum(rate(node_disk_written_bytes_total[1m]))) / 1048576',
          ),
        },
        {
          id: 'network-in',
          query: q('network-in', 'sum(rate(node_network_receive_bytes_total[1m])) * 8 / 1048576'),
        },
        {
          id: 'queue-depth',
          query: q('queue-depth', 'sum(queue_length)'),
        },
        {
          id: 'saturation',
          query: q(
            'saturation',
            '100 * (1 - sum(node_memory_MemFree_bytes) / sum(node_memory_MemTotal_bytes))',
          ),
        },
        {
          id: 'gc-pause',
          query: q(
            'gc-pause',
            'histogram_quantile(0.99, sum(rate(jvm_gc_pause_seconds_bucket[5m])) by (le)) * 1000',
          ),
        },
        {
          id: 'cache-hit',
          query: q(
            'cache-hit',
            '100 * sum(rate(cache_hit_total[5m])) / (sum(rate(cache_hit_total[5m])) + sum(rate(cache_miss_total[5m])))',
          ),
        },
        {
          id: 'thread-pool',
          query: q(
            'thread-pool',
            '100 * sum(executor_active_threads_count) / sum(executor_pool_max_threads_count)',
          ),
        },
        {
          id: 'db-connections',
          query: q('db-connections', 'sum(pg_stat_activity_count{state="active"})'),
        },
        {
          id: 'throughput',
          query: q('throughput', 'sum(rate(request_count_total[1m]))'),
        },
      ]

      await Promise.allSettled([
        ...coreQueries.map(async ({ key, query }) => {
          try {
            const res = await fetch(promRangeUrl(query))
            if (!res.ok || cancelled) return
            const data: PrometheusRangeResponse = await res.json()
            const pts = parseMatrix(data)
            if (pts.length > 0) useDashboardStore.getState().setMetricRange(key, pts)
          } catch { /* silent */ }
        }),
        ...extQueries.map(async ({ id, query }) => {
          try {
            const res = await fetch(promRangeUrl(query))
            if (!res.ok || cancelled) return
            const data: PrometheusRangeResponse = await res.json()
            const pts = parseMatrix(data)
            if (pts.length > 0) useDashboardStore.getState().setExtendedMetric(id, pts)
          } catch { /* silent */ }
        }),
      ])
    }

    // ── Jaeger services polling ───────────────────────────────────────────
    async function pollJaeger() {
      try {
        const res = await fetch('/api/jaeger/services')
        if (!res.ok || cancelled) return
        const data: JaegerServicesResponse = await res.json()
        if (cancelled) return

        const names: string[] = Array.isArray(data.data) ? data.data : []
        if (names.length === 0) return

        // Start with all healthy; enriched in pollServiceMetrics
        const services: Service[] = names.map(name => ({
          id: name,
          name,
          displayName: toDisplayName(name),
          status: 'healthy',
          latency: 0,
          requestCount: 0,
          errorRate: 0,
          icon: 'Activity',
        }))

        useDashboardStore.getState().setServices(services)
        // Immediately enrich with Prometheus data
        void pollServiceMetrics()
      } catch { /* silent */ }
    }

    // ── Per-service Prometheus enrichment ────────────────────────────────
    async function pollServiceMetrics() {
      try {
        const [errRes, latRes, rrRes] = await Promise.all([
          fetch(promRangeUrl('(sum by (instance) (rate(error_count_total[1m])) or vector(0)) / (sum by (instance) (rate(request_count_total[1m])) or vector(1)) * 100')),
          fetch(promRangeUrl('histogram_quantile(0.95, sum by (instance, le) (rate(request_latency_seconds_bucket[1m]))) * 1000')),
          fetch(promRangeUrl('sum by (instance) (rate(request_count_total[1m]))')),
        ])
        if (cancelled) return
        const [errData, latData, rrData]: PrometheusRangeResponse[] = await Promise.all([
          errRes.ok ? errRes.json() : Promise.resolve({ status: 'error', data: { resultType: 'matrix', result: [] } }),
          latRes.ok ? latRes.json() : Promise.resolve({ status: 'error', data: { resultType: 'matrix', result: [] } }),
          rrRes.ok ? rrRes.json() : Promise.resolve({ status: 'error', data: { resultType: 'matrix', result: [] } }),
        ])
        if (cancelled) return

        // Build maps: serviceName → latest value, using port/hostname mapping
        function latestByService(data: PrometheusRangeResponse): Map<string, number> {
          const m = new Map<string, number>()
          if (data.status !== 'success') return m
          for (const series of data.data?.result ?? []) {
            const instance = series.metric['instance'] ?? series.metric['job'] ?? ''
            const svcName = instanceToName(instance) ?? instance.split(':')[0] ?? instance
            const vals = series.values
            if (vals.length === 0) continue
            const v = parseFloat(vals[vals.length - 1]![1])
            if (isFinite(v)) {
              // Keep highest rr, average for error/latency across instances
              const existing = m.get(svcName) ?? 0
              m.set(svcName, Math.max(existing, v))
            }
          }
          return m
        }

        const errMap = latestByService(errData)
        const latMap = latestByService(latData)
        const rrMap = latestByService(rrData)

        // Collect all known service names from Prometheus instance data
        const discoveredNames = new Set<string>([...rrMap.keys(), ...latMap.keys(), ...errMap.keys()])

        // Get current services (may be empty or just Jaeger)
        const current = useDashboardStore.getState().services
        const usefulServices = current.filter(s => s.name !== 'jaeger-all-in-one' && s.name !== 'jaeger')

        // Build service map from current useful services
        const byName = new Map<string, Service>(usefulServices.map(s => [s.name, s]))

        // Add any newly discovered services from Prometheus
        for (const name of discoveredNames) {
          if (!byName.has(name)) {
            byName.set(name, {
              id: name,
              name,
              displayName: toDisplayName(name),
              status: 'healthy',
              latency: 0,
              requestCount: 0,
              errorRate: 0,
              icon: 'Activity',
            })
          }
        }

        if (byName.size === 0) return

        // Enrich each service with Prometheus data
        const enriched: Service[] = Array.from(byName.values()).map(svc => {
          const err = errMap.get(svc.name) ?? 0
          const lat = latMap.get(svc.name) ?? 0
          const rr = rrMap.get(svc.name) ?? 0
          const status: Service['status'] = err > 10 ? 'down' : err > 2 ? 'degraded' : 'healthy'
          return { ...svc, errorRate: err, latency: lat, requestCount: rr, status }
        })

        // Sort: down first, then degraded, then healthy; alphabetical within group
        enriched.sort((a, b) => {
          const rank = { down: 0, degraded: 1, healthy: 2 }
          const r = rank[a.status] - rank[b.status]
          return r !== 0 ? r : a.name.localeCompare(b.name)
        })

        useDashboardStore.getState().setServices(enriched)
      } catch { /* silent */ }
    }

    // ── Loki log polling ─────────────────────────────────────────────────
    async function pollLoki() {
      try {
        const now = Math.floor(Date.now() / 1000)
        const p = new URLSearchParams({
          query: '{job="docker"}',
          start: String(now - 120),   // last 2 minutes
          end: String(now),
          limit: '100',
          direction: 'backward',
        })
        const res = await fetch(`/api/loki/query_range?${p}`)
        if (!res.ok || cancelled) return
        const data: LokiQueryRangeResponse = await res.json()
        if (cancelled || data.status !== 'success') return

        const lines: LogLine[] = []
        for (const stream of data.data?.result ?? []) {
          const service = stream.stream['service'] ?? stream.stream['container_name'] ?? stream.stream['job'] ?? 'system'
          for (const [tsNs, msg] of stream.values) {
            // Skip noisy/internal log lines
            if (msg.includes('GET /metrics HTTP') && msg.includes('200')) continue
            // Skip Loki's own structured internal logs (very long, component=frontend etc.)
            if (msg.startsWith('level=') && msg.includes(' caller=') && msg.includes(' component=')) continue
            // Skip very long lines (>400 chars) — typically internal trace/metric dumps
            if (msg.length > 400) continue

            const timestamp = Math.floor(Number(tsNs) / 1_000_000)
            const lower = msg.toLowerCase()
            const level: LogLine['level'] =
              lower.includes('error') || lower.includes('err ') || lower.includes('exception')
              || lower.includes('critical') || lower.includes('fail') ? 'error'
              : lower.includes('warn') ? 'warn'
              : lower.includes('debug') ? 'debug'
              : lower.includes('info') ? 'info'
              : 'unknown'
            lines.push({ timestamp, level, service, message: msg })
          }
        }

        // Sort newest first, deduplicate, cap at MAX_LOG_LINES
        lines.sort((a, b) => b.timestamp - a.timestamp)
        const seen = new Set<string>()
        const deduped: LogLine[] = []
        for (const l of lines) {
          const key = `${l.timestamp}:${l.message}`
          if (!seen.has(key)) { seen.add(key); deduped.push(l) }
          if (deduped.length >= MAX_LOG_LINES) break
        }

        useDashboardStore.getState().setLogs(deduped)
      } catch { /* silent */ }
    }

    // ── Kick off ──────────────────────────────────────────────────────────
    fetchPresets().then(() => {
      if (cancelled) return
      void pollDetector()
      void pollPrometheus()
      void pollJaeger()
      void pollLoki()
    })

    const timers = [
      setInterval(() => { if (!cancelled) void pollDetector() }, DETECTOR_POLL_MS),
      setInterval(() => { if (!cancelled) void pollPrometheus() }, PROMETHEUS_POLL_MS),
      setInterval(() => { if (!cancelled) void pollJaeger() }, JAEGER_POLL_MS),
      setInterval(() => { if (!cancelled) void pollLoki() }, LOKI_POLL_MS),
      setInterval(() => { if (!cancelled) void pollServiceMetrics() }, PROMETHEUS_POLL_MS),
    ]

    return () => {
      cancelled = true
      timers.forEach(clearInterval)
    }
  }, [])
}
