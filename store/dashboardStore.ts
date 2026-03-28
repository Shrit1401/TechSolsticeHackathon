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
  MetricPoint,
} from '@/lib/types'
import type { LogLine } from '@/lib/backendTypes'
import type { WidgetId } from '@/lib/constants'

export { shallow } from 'zustand/shallow'

interface DashboardState {
  systemStatus: SystemStatus
  services: Service[]
  metrics: MetricsData
  /** Per-widget metric series populated by Prometheus queries */
  extendedMetrics: Partial<Record<WidgetId, MetricPoint[]>>
  anomalies: Anomaly[]
  /** Fused anomaly score 0–1 from the detector */
  anomalyScore: number
  rootCause: RootCause | null
  remediationActions: RemediationAction[]
  incidentTimeline: IncidentEvent[]
  autoRemediation: boolean
  /** True when the detector reports an active anomaly */
  isSimulatingFailure: boolean
  systemStartTime: number
  lastIncidentTime: number | null
  isLoading: boolean
  logs: LogLine[]
}

interface DashboardActions {
  setMetricRange: (key: keyof MetricsData, points: MetricPoint[]) => void
  setExtendedMetric: (widgetId: WidgetId, points: MetricPoint[]) => void
  setSystemStatus: (status: SystemStatus) => void
  setAnomalies: (anomalies: Anomaly[]) => void
  setAnomalyScore: (score: number) => void
  setRootCause: (rc: RootCause | null) => void
  setServices: (services: Service[]) => void
  setRemediationActions: (actions: RemediationAction[]) => void
  appendIncidentEvent: (event: IncidentEvent) => void
  setLoading: (loading: boolean) => void
  toggleAutoRemediation: () => void
  completeRemediationAction: (id: string) => void
  setLogs: (logs: LogLine[]) => void
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  systemStatus: 'healthy',
  services: [],
  metrics: { requestRate: [], errorRate: [], latency: [] },
  extendedMetrics: {},
  anomalies: [],
  anomalyScore: 0,
  rootCause: null,
  remediationActions: [],
  incidentTimeline: [],
  autoRemediation: true,
  isSimulatingFailure: false,
  systemStartTime: Date.now(),
  lastIncidentTime: null,
  isLoading: true,
  logs: [],

  setMetricRange: (key, points) =>
    set(s => ({ metrics: { ...s.metrics, [key]: points } })),

  setExtendedMetric: (widgetId, points) =>
    set(s => ({ extendedMetrics: { ...s.extendedMetrics, [widgetId]: points } })),

  setSystemStatus: (status) => set({ systemStatus: status }),
  setAnomalies: (anomalies) => set({ anomalies }),
  setAnomalyScore: (score) => set({ anomalyScore: score }),
  setRootCause: (rc) => set({ rootCause: rc }),
  setServices: (services) => set({ services }),
  setRemediationActions: (actions) => set({ remediationActions: actions }),

  appendIncidentEvent: (event) =>
    set(s => ({
      incidentTimeline: [...s.incidentTimeline, event],
      lastIncidentTime:
        event.type === 'failure' || event.type === 'anomaly-detected'
          ? event.timestamp
          : s.lastIncidentTime,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  toggleAutoRemediation: () => set(s => ({ autoRemediation: !s.autoRemediation })),

  completeRemediationAction: (id) =>
    set(s => ({
      remediationActions: s.remediationActions.map(a =>
        a.id === id ? { ...a, status: 'completed' as const } : a,
      ),
    })),

  setLogs: (logs) => set({ logs }),
}))
