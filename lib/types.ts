export type SystemStatus = 'healthy' | 'anomaly' | 'healing'

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export interface Service {
  id: string
  name: string
  displayName: string
  status: ServiceStatus
  latency: number
  requestCount: number
  errorRate: number
  icon: string
}

export interface MetricPoint {
  timestamp: number
  value: number
}

export interface MetricsData {
  requestRate: MetricPoint[]
  errorRate: MetricPoint[]
  latency: MetricPoint[]
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Anomaly {
  id: string
  timestamp: number
  severity: AnomalySeverity
  message: string
  service: string
}

export interface DependencyEdge {
  from: string
  to: string
  affected: boolean
}

export interface RootCause {
  service: string
  reasons: string[]
  dependencies: DependencyEdge[]
}

export type RemediationActionType = 'restart' | 'scale' | 'rollback' | 'reroute'
export type RemediationStatus = 'queued' | 'in-progress' | 'completed' | 'failed'

export interface RemediationAction {
  id: string
  action: string
  type: RemediationActionType
  status: RemediationStatus
  timestamp: number
}

export type IncidentEventType =
  | 'failure'
  | 'anomaly-detected'
  | 'rca-complete'
  | 'remediation-started'
  | 'recovery'

export interface IncidentEvent {
  id: string
  type: IncidentEventType
  timestamp: number
  description: string
}
