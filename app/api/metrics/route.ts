import { initialMetrics } from '@/lib/mockData'

export async function GET() {
  const metrics = initialMetrics(30)
  return Response.json(metrics)
}
