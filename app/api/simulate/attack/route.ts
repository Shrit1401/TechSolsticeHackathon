import { proxyToDashboard } from "@/lib/dashboardUpstream"

export async function POST(request: Request) {
  return proxyToDashboard("/api/simulate/attack", request)
}
