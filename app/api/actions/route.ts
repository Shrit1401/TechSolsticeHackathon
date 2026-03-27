import { generateId } from '@/lib/mockData'

export async function GET() {
  return Response.json([])
}

export async function POST(request: Request) {
  const body = await request.json() as { action: string; type: string }
  const action = {
    id: generateId(),
    action: body.action ?? 'Unknown action',
    type: body.type ?? 'restart',
    status: 'queued',
    timestamp: Date.now(),
  }
  return Response.json(action, { status: 201 })
}
