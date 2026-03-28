function dashboardBaseUrl(): string {
  const raw = process.env.DASHBOARD_API_URL ?? "http://localhost:8010"
  return raw.replace(/\/$/, "")
}

export function getDashboardBaseUrl(): string {
  return dashboardBaseUrl()
}

export async function proxyToDashboard(
  upstreamPath: string,
  request: Request,
): Promise<Response> {
  const base = dashboardBaseUrl()
  const u = new URL(base + upstreamPath)
  u.search = new URL(request.url).search
  const headers = new Headers()
  const ct = request.headers.get("content-type")
  if (ct) headers.set("content-type", ct)
  const accept = request.headers.get("accept")
  if (accept) headers.set("accept", accept)

  let body: ArrayBuffer | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer()
  }

  try {
    const res = await fetch(u.toString(), {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    })

    const outHeaders = new Headers()
    const resCt = res.headers.get("content-type")
    if (resCt) outHeaders.set("content-type", resCt)

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    })
  } catch {
    return Response.json(
      { detail: "dashboard upstream unreachable", upstream: u.origin },
      { status: 502 },
    )
  }
}
