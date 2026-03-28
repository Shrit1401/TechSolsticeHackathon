import { proxyToDashboard } from "@/lib/dashboardUpstream"

type Params = { params: Promise<{ runId: string }> }

export async function GET(request: Request, ctx: Params) {
  const { runId } = await ctx.params
  return proxyToDashboard(
    `/api/simulate/status/${encodeURIComponent(runId)}`,
    request,
  )
}
