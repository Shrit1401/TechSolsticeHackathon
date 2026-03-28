import { proxyToDashboard } from "@/lib/dashboardUpstream"

type Params = { params: Promise<{ path?: string[] }> }

async function forward(
  request: Request,
  ctx: Params,
): Promise<Response> {
  const { path: segments } = await ctx.params
  const suffix = (segments?.length ? segments.join("/") : "") || ""
  const upstreamPath = `/api/grafana/${suffix}`
  return proxyToDashboard(upstreamPath, request)
}

export async function GET(request: Request, ctx: Params) {
  return forward(request, ctx)
}

export async function POST(request: Request, ctx: Params) {
  return forward(request, ctx)
}

export async function PUT(request: Request, ctx: Params) {
  return forward(request, ctx)
}

export async function PATCH(request: Request, ctx: Params) {
  return forward(request, ctx)
}

export async function DELETE(request: Request, ctx: Params) {
  return forward(request, ctx)
}
