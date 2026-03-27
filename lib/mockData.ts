import type {
  Service,
  MetricPoint,
  MetricsData,
  Anomaly,
  RootCause,
  RemediationAction,
  IncidentEvent,
} from './types'

export const BASELINE_REQUEST_RATE = 450
export const BASELINE_ERROR_RATE = 2.1
export const BASELINE_LATENCY = 118

export const FAILURE_REQUEST_RATE = 180
export const FAILURE_ERROR_RATE = 38.4
export const FAILURE_LATENCY = 1240

let idCounter = 0
export function generateId(): string {
  return `${Date.now()}-${++idCounter}`
}

export function generateMetricPoint(baseValue: number, variance: number): MetricPoint {
  const noise = (Math.random() - 0.5) * 2 * variance
  return {
    timestamp: Date.now(),
    value: Math.max(0, baseValue + noise),
  }
}

export function initialServices(): Service[] {
  return [
    {
      id: 'api-gateway',
      name: 'api-gateway',
      displayName: 'API Gateway',
      status: 'healthy',
      latency: 45 + Math.random() * 20,
      requestCount: 8420 + Math.floor(Math.random() * 500),
      errorRate: 0.4 + Math.random() * 0.3,
      icon: 'Network',
    },
    {
      id: 'user-service',
      name: 'user-service',
      displayName: 'User Service',
      status: 'healthy',
      latency: 72 + Math.random() * 15,
      requestCount: 5210 + Math.floor(Math.random() * 300),
      errorRate: 0.8 + Math.random() * 0.4,
      icon: 'User',
    },
    {
      id: 'payment-service',
      name: 'payment-service',
      displayName: 'Payment Service',
      status: 'healthy',
      latency: 95 + Math.random() * 25,
      requestCount: 2890 + Math.floor(Math.random() * 200),
      errorRate: 1.1 + Math.random() * 0.5,
      icon: 'CreditCard',
    },
    {
      id: 'auth-service',
      name: 'auth-service',
      displayName: 'Auth Service',
      status: 'healthy',
      latency: 38 + Math.random() * 12,
      requestCount: 9120 + Math.floor(Math.random() * 600),
      errorRate: 0.2 + Math.random() * 0.2,
      icon: 'ShieldCheck',
    },
  ]
}

function buildMetricHistory(baseValue: number, variance: number, count: number): MetricPoint[] {
  const points: MetricPoint[] = []
  const now = Date.now()
  for (let i = count; i >= 0; i--) {
    const noise = (Math.random() - 0.5) * 2 * variance
    points.push({
      timestamp: now - i * 2000,
      value: Math.max(0, baseValue + noise),
    })
  }
  return points
}

export function initialMetrics(count = 30): MetricsData {
  return {
    requestRate: buildMetricHistory(BASELINE_REQUEST_RATE, 40, count),
    errorRate: buildMetricHistory(BASELINE_ERROR_RATE, 0.5, count),
    latency: buildMetricHistory(BASELINE_LATENCY, 15, count),
  }
}

export function generateAnomaly(service: string): Anomaly {
  const messages: Record<string, string[]> = {
    'payment-service': [
      'High latency detected in payment-service — p99 > 1200ms',
      'Error rate spike in payment-service — 38% of requests failing',
      'Payment service connection pool exhausted',
    ],
    'api-gateway': [
      'API Gateway throughput degraded — circuit breaker tripped',
      'Upstream timeout cascade from api-gateway',
    ],
    'user-service': [
      'User service memory pressure — GC pauses > 800ms',
    ],
  }
  const msgs = messages[service] ?? [`Anomaly detected in ${service}`]
  return {
    id: generateId(),
    timestamp: Date.now(),
    severity: 'critical',
    message: msgs[Math.floor(Math.random() * msgs.length)],
    service,
  }
}

export function generateRootCause(affectedService: string): RootCause {
  return {
    service: affectedService,
    reasons: [
      'Error rate exceeded 35% threshold (current: 38.4%)',
      'P99 latency spike: 118ms → 1240ms in < 60s',
      'Connection pool saturation: 100% utilization',
      'Downstream cascade from upstream dependency failure',
    ],
    dependencies: [
      { from: 'client', to: 'api-gateway', affected: false },
      { from: 'api-gateway', to: 'user-service', affected: false },
      { from: 'api-gateway', to: 'payment-service', affected: true },
      { from: 'api-gateway', to: 'auth-service', affected: false },
    ],
  }
}

export function generateRemediationActions(service: string): RemediationAction[] {
  const now = Date.now()
  return [
    {
      id: generateId(),
      action: `Restart ${service} container (pod: ${service}-7d4b9)`,
      type: 'restart',
      status: 'in-progress',
      timestamp: now,
    },
    {
      id: generateId(),
      action: `Scale ${service} replicas: 2 → 4`,
      type: 'scale',
      status: 'queued',
      timestamp: now + 500,
    },
    {
      id: generateId(),
      action: `Reroute traffic away from ${service} (weight: 0%)`,
      type: 'reroute',
      status: 'queued',
      timestamp: now + 1000,
    },
  ]
}

export function generateIncidentTimeline(): IncidentEvent[] {
  return []
}
