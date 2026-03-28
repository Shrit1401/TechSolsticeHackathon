import { proxyToDashboard } from "@/lib/dashboardUpstream"

export async function GET(request: Request) {
  return proxyToDashboard("/api/jaeger/traces", request)
}
