export const dashboardApiPaths = {
  health: "/api/health",
  chartsPresets: "/api/charts/presets",
  prometheusQuery: "/api/prometheus/query",
  prometheusQueryRange: "/api/prometheus/query_range",
  lokiQuery: "/api/loki/query",
  lokiQueryRange: "/api/loki/query_range",
  jaegerTraces: "/api/jaeger/traces",
  jaegerServices: "/api/jaeger/services",
  detectorDetect: "/api/detector/detect",
  detectorTraces: "/api/detector/traces",
  detectorLogs: "/api/detector/logs",
  simulateAttack: "/api/simulate/attack",
  simulateStatus: (runId: string) =>
    `/api/simulate/status/${encodeURIComponent(runId)}`,
  simulateStop: (runId: string) =>
    `/api/simulate/stop/${encodeURIComponent(runId)}`,
  grafana: (subpath: string) => {
    const s = subpath.replace(/^\//, "")
    return s ? `/api/grafana/${s}` : "/api/grafana"
  },
} as const
