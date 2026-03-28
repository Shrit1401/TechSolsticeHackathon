'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'
import { widgetCardStatus } from '@/lib/widgetCardStatus'

export function useWidgetCardStatus(id: WidgetId) {
  const metrics = useDashboardStore((s) => s.metrics)
  const services = useDashboardStore((s) => s.services)
  const anomalyCount = useDashboardStore((s) => s.anomalies.length)
  const isSimulatingFailure = useDashboardStore((s) => s.isSimulatingFailure)
  const incidentCount = useDashboardStore((s) => s.incidentTimeline.length)

  const [gaugePulse, setGaugePulse] = useState(0)
  useEffect(() => {
    if (id !== 'cpu' && id !== 'memory') return
    const t = window.setInterval(() => setGaugePulse((p) => p + 1), 2000)
    return () => window.clearInterval(t)
  }, [id])

  return useMemo(
    () =>
      widgetCardStatus(id, {
        metrics,
        services,
        anomalyCount,
        isSimulatingFailure,
        incidentCount,
        gaugePulse,
      }),
    [
      id,
      metrics,
      services,
      anomalyCount,
      isSimulatingFailure,
      incidentCount,
      gaugePulse,
    ],
  )
}
