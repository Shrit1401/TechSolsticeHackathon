'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'
import type { CardStatus } from '@/lib/widgetCardStatus'
import { widgetCardStatusWithPrev } from '@/lib/widgetCardStatus'

const GAUGE_MS_NORMAL = 2_000
const GAUGE_MS_ADAPTIVE = 5_000

export function useWidgetCardStatus(id: WidgetId, opts?: { adaptiveEnabled?: boolean }) {
  const adaptiveEnabled = opts?.adaptiveEnabled ?? false
  const metrics = useDashboardStore((s) => s.metrics)
  const services = useDashboardStore((s) => s.services)
  const anomalyCount = useDashboardStore((s) => s.anomalies.length)
  const isSimulatingFailure = useDashboardStore((s) => s.isSimulatingFailure)
  const incidentCount = useDashboardStore((s) => s.incidentTimeline.length)

  const [gaugePulse, setGaugePulse] = useState(0)
  useEffect(() => {
    if (id !== 'cpu' && id !== 'memory') return
    const ms = adaptiveEnabled ? GAUGE_MS_ADAPTIVE : GAUGE_MS_NORMAL
    const t = window.setInterval(() => setGaugePulse((p) => p + 1), ms)
    return () => window.clearInterval(t)
  }, [id, adaptiveEnabled])

  const prevRef = useRef<CardStatus>('healthy')
  const status = useMemo(
    () =>
      widgetCardStatusWithPrev(
        id,
        {
          metrics,
          services,
          anomalyCount,
          isSimulatingFailure,
          incidentCount,
          gaugePulse,
        },
        prevRef.current,
      ),
    [id, metrics, services, anomalyCount, isSimulatingFailure, incidentCount, gaugePulse],
  )
  useLayoutEffect(() => {
    prevRef.current = status
  }, [status])

  return status
}
