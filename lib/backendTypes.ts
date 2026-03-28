// Prometheus API response types
export interface PrometheusMatrixEntry {
  metric: Record<string, string>
  values: [number, string][]
}

export interface PrometheusRangeResponse {
  status: 'success' | 'error'
  data: {
    resultType: 'matrix'
    result: PrometheusMatrixEntry[]
  }
  errorType?: string
  error?: string
}

// Charts presets
export interface ChartPreset {
  id: string
  title: string
  promql: string
}

export interface ChartsPresetsResponse {
  presets: ChartPreset[]
}

// Detector /detect response
export interface DetectorDetectResponse {
  // Primary fields (actual backend)
  anomaly?: boolean
  score?: number
  threshold?: number
  confidence?: number
  error_rate?: number
  log_anomaly?: boolean
  metric_anomaly?: boolean
  trace_anomaly?: boolean
  strong_signals?: number
  source?: string
  // Legacy / alternate field names (kept for compatibility)
  is_anomalous?: boolean
  anomaly_score?: number
  signals?: Record<string, unknown>
  root_cause?: {
    service?: string
    reasons?: string[]
    [key: string]: unknown
  }
  remediation?: {
    recommended?: boolean
    actions?: Array<{ action: string; type?: string }>
  }
  anomalies?: Array<{
    id?: string
    service?: string
    message?: string
    severity?: string
    timestamp?: number
  }>
}

// Jaeger /api/services response
export interface JaegerServicesResponse {
  data: string[]
  total?: number
  limit?: number
  offset?: number
  errors?: unknown
}

// Loki log stream response
export interface LokiStreamValue {
  /** [nanosecond_timestamp_string, log_line_string] */
  values: [string, string][]
  stream: Record<string, string>
}

export interface LokiQueryRangeResponse {
  status: 'success' | 'error'
  data: {
    resultType: 'streams'
    result: LokiStreamValue[]
  }
}

export interface LogLine {
  timestamp: number  // ms
  level: 'info' | 'warn' | 'error' | 'debug' | 'unknown'
  service: string
  message: string
}
