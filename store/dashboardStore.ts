'use client'

import { create } from 'zustand'
import type {
  SystemStatus,
  Service,
  MetricsData,
  Anomaly,
  RootCause,
  RemediationAction,
  IncidentEvent,
} from '@/lib/types'
import {
  initialServices,
  initialMetrics,
  generateMetricPoint,
  generateAnomaly,
  generateRootCause,
  generateRemediationActions,
  generateId,
  BASELINE_REQUEST_RATE,
  BASELINE_ERROR_RATE,
  BASELINE_LATENCY,
  FAILURE_REQUEST_RATE,
  FAILURE_ERROR_RATE,
  FAILURE_LATENCY,
} from '@/lib/mockData'
import { clamp } from '@/lib/utils'

export { shallow } from 'zustand/shallow'

interface DashboardState {
  systemStatus: SystemStatus
  services: Service[]
  metrics: MetricsData
  anomalies: Anomaly[]
  rootCause: RootCause | null
  remediationActions: RemediationAction[]
  incidentTimeline: IncidentEvent[]
  autoRemediation: boolean
  isSimulatingFailure: boolean
  failureStartTime: number | null
  systemStartTime: number
  lastIncidentTime: number | null
}

interface DashboardActions {
  simulateFailure: () => void
  triggerAutoRemediation: () => void
  resetSystem: () => void
  toggleAutoRemediation: () => void
  tickMetrics: () => void
  completeRemediationAction: (id: string) => void
}

const MAX_METRIC_POINTS = 30
const FAILURE_SERVICE = 'payment-service'

function appendMetric(arr: import('@/lib/types').MetricPoint[], point: import('@/lib/types').MetricPoint) {
  const next = [...arr, point]
  if (next.length > MAX_METRIC_POINTS) next.shift()
  return next
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  // Initial state
  systemStatus: 'healthy',
  services: initialServices(),
  metrics: initialMetrics(MAX_METRIC_POINTS),
  anomalies: [],
  rootCause: null,
  remediationActions: [],
  incidentTimeline: [],
  autoRemediation: true,
  isSimulatingFailure: false,
  failureStartTime: null,
  systemStartTime: Date.now(),
  lastIncidentTime: null,

  // Tick metrics — called every 2s by useSimulation hook
  tickMetrics: () => {
    const { isSimulatingFailure } = get()

    if (isSimulatingFailure) {
      // Spike metrics during failure
      set(state => ({
        metrics: {
          requestRate: appendMetric(
            state.metrics.requestRate,
            generateMetricPoint(FAILURE_REQUEST_RATE, 25)
          ),
          errorRate: appendMetric(
            state.metrics.errorRate,
            generateMetricPoint(FAILURE_ERROR_RATE, 3)
          ),
          latency: appendMetric(
            state.metrics.latency,
            generateMetricPoint(FAILURE_LATENCY, 120)
          ),
        },
        // Also jitter service latency during failure
        services: state.services.map(s =>
          s.id === FAILURE_SERVICE
            ? { ...s, latency: clamp(s.latency + (Math.random() - 0.3) * 200, 800, 2000), requestCount: s.requestCount + Math.floor(Math.random() * 5) }
            : { ...s, latency: clamp(s.latency + (Math.random() - 0.5) * 10, 30, 200), requestCount: s.requestCount + Math.floor(Math.random() * 15) }
        ),
      }))
    } else {
      // Healthy baseline
      set(state => ({
        metrics: {
          requestRate: appendMetric(
            state.metrics.requestRate,
            generateMetricPoint(BASELINE_REQUEST_RATE, 40)
          ),
          errorRate: appendMetric(
            state.metrics.errorRate,
            generateMetricPoint(BASELINE_ERROR_RATE, 0.5)
          ),
          latency: appendMetric(
            state.metrics.latency,
            generateMetricPoint(BASELINE_LATENCY, 15)
          ),
        },
        services: state.services.map(s => ({
          ...s,
          latency: clamp(s.latency + (Math.random() - 0.5) * 5, 30, 200),
          requestCount: s.requestCount + Math.floor(Math.random() * 20),
        })),
      }))
    }
  },

  simulateFailure: () => {
    const { isSimulatingFailure } = get()
    if (isSimulatingFailure) return

    const now = Date.now()
    const failureEvent: IncidentEvent = {
      id: generateId(),
      type: 'failure',
      timestamp: now,
      description: `Service crash detected: ${FAILURE_SERVICE} — container exited with code 137`,
    }

    set(state => ({
      isSimulatingFailure: true,
      failureStartTime: now,
      lastIncidentTime: now,
      systemStatus: 'anomaly',
      anomalies: [],
      rootCause: null,
      remediationActions: [],
      incidentTimeline: [failureEvent],
      services: state.services.map(s =>
        s.id === FAILURE_SERVICE
          ? { ...s, status: 'down', latency: 1240, errorRate: 38.4 }
          : s.id === 'api-gateway'
          ? { ...s, status: 'degraded', errorRate: 12.5 }
          : s
      ),
    }))

    // Step 2: detect anomaly after 1.5s
    setTimeout(() => {
      const anomaly = generateAnomaly(FAILURE_SERVICE)
      const anomalyEvent: IncidentEvent = {
        id: generateId(),
        type: 'anomaly-detected',
        timestamp: Date.now(),
        description: `Anomaly detected: ${anomaly.message}`,
      }
      set(state => ({
        anomalies: [anomaly, ...state.anomalies],
        incidentTimeline: [...state.incidentTimeline, anomalyEvent],
      }))
    }, 1500)

    // Step 3: RCA after 4s
    setTimeout(() => {
      const rca = generateRootCause(FAILURE_SERVICE)
      const rcaEvent: IncidentEvent = {
        id: generateId(),
        type: 'rca-complete',
        timestamp: Date.now(),
        description: `Root cause identified: ${FAILURE_SERVICE} — connection pool exhaustion + error rate spike`,
      }
      set(state => ({
        rootCause: rca,
        incidentTimeline: [...state.incidentTimeline, rcaEvent],
      }))

      // Step 4: auto-remediation if enabled
      if (get().autoRemediation) {
        setTimeout(() => {
          get().triggerAutoRemediation()
        }, 2000)
      }
    }, 4000)
  },

  triggerAutoRemediation: () => {
    const actions = generateRemediationActions(FAILURE_SERVICE)
    const remediationEvent: IncidentEvent = {
      id: generateId(),
      type: 'remediation-started',
      timestamp: Date.now(),
      description: `Auto-remediation initiated: restarting container, scaling replicas, rerouting traffic`,
    }

    set(state => ({
      systemStatus: 'healing',
      remediationActions: actions,
      incidentTimeline: [...state.incidentTimeline, remediationEvent],
    }))

    // Complete first action (restart) after 3s
    setTimeout(() => {
      set(state => ({
        remediationActions: state.remediationActions.map((a, i) =>
          i === 0 ? { ...a, status: 'completed' } : i === 1 ? { ...a, status: 'in-progress' } : a
        ),
        services: state.services.map(s =>
          s.id === FAILURE_SERVICE ? { ...s, status: 'degraded', latency: 420, errorRate: 12.1 } : s
        ),
      }))
    }, 3000)

    // Complete scale action after 6s
    setTimeout(() => {
      set(state => ({
        remediationActions: state.remediationActions.map((a, i) =>
          i <= 1 ? { ...a, status: 'completed' } : i === 2 ? { ...a, status: 'in-progress' } : a
        ),
      }))
    }, 6000)

    // Full recovery after 10s
    setTimeout(() => {
      get().resetSystem()
    }, 10000)
  },

  resetSystem: () => {
    const recoveryEvent: IncidentEvent = {
      id: generateId(),
      type: 'recovery',
      timestamp: Date.now(),
      description: `System recovered: all services healthy, metrics normalized`,
    }

    set(state => ({
      systemStatus: 'healthy',
      isSimulatingFailure: false,
      failureStartTime: null,
      services: state.services.map(s => ({
        ...s,
        status: 'healthy',
        latency: s.id === FAILURE_SERVICE ? 98 : s.latency,
        errorRate: s.id === FAILURE_SERVICE ? 1.1 : s.id === 'api-gateway' ? 0.4 : s.errorRate,
      })),
      remediationActions: state.remediationActions.map(a => ({ ...a, status: 'completed' })),
      incidentTimeline: [...state.incidentTimeline, recoveryEvent],
    }))
  },

  toggleAutoRemediation: () => {
    set(state => ({ autoRemediation: !state.autoRemediation }))
  },

  completeRemediationAction: (id: string) => {
    set(state => ({
      remediationActions: state.remediationActions.map(a =>
        a.id === id ? { ...a, status: 'completed' } : a
      ),
    }))
  },
}))
