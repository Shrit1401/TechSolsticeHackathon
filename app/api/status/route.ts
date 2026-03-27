export async function GET() {
  return Response.json({
    status: 'healthy',
    uptime: 99.97,
    lastIncident: null,
    services: 4,
    version: '1.0.0',
  })
}
