'use client'

import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/store/dashboardStore'

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<string | null>(null)

  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)
  const systemStatus = useDashboardStore(s => s.systemStatus)

  useEffect(() => {
    // Simulate WebSocket connection on mount
    const connectTimeout = setTimeout(() => setConnected(true), 800)

    return () => clearTimeout(connectTimeout)
  }, [])

  useEffect(() => {
    if (!connected) return

    const events = [
      'metrics.push: requestRate updated',
      'heartbeat: server alive',
      'metrics.push: latency updated',
      'telemetry: trace batch received',
      'metrics.push: errorRate updated',
    ]

    const id = setInterval(() => {
      if (isSimulatingFailure) {
        const failureEvents = [
          'alert: payment-service health check failed',
          'alert: circuit breaker OPEN on payment-service',
          'event: anomaly threshold exceeded',
          'alert: error budget exhausted — SLO breach imminent',
        ]
        setLastEvent(failureEvents[Math.floor(Math.random() * failureEvents.length)])
      } else if (systemStatus === 'healing') {
        setLastEvent('event: remediation in progress — monitoring recovery')
      } else {
        setLastEvent(events[Math.floor(Math.random() * events.length)])
      }
    }, 3500)

    return () => clearInterval(id)
  }, [connected, isSimulatingFailure, systemStatus])

  return { connected, lastEvent }
}
