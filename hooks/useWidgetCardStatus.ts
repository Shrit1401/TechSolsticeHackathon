'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'
import type { CardStatus } from '@/lib/widgetCardStatus'
import { widgetCardStatusWithPrev } from '@/lib/widgetCardStatus'

export function useWidgetCardStatus(id: WidgetId) {
  const metrics = useDashboardStore(s => s.metrics)
  const extendedMetrics = useDashboardStore(s => s.extendedMetrics)
  const anomalyScore = useDashboardStore(s => s.anomalyScore)
  const services = useDashboardStore(s => s.services)
  const anomalyCount = useDashboardStore(s => s.anomalies.length)
  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)
  const incidentCount = useDashboardStore(s => s.incidentTimeline.length)

  const prevRef = useRef<CardStatus>('healthy')

  const status = useMemo(
    () =>
      widgetCardStatusWithPrev(
        id,
        { metrics, extendedMetrics, anomalyScore, services, anomalyCount, isSimulatingFailure, incidentCount },
        prevRef.current,
      ),
    [id, metrics, extendedMetrics, anomalyScore, services, anomalyCount, isSimulatingFailure, incidentCount],
  )

  useLayoutEffect(() => {
    prevRef.current = status
  }, [status])

  return status
}
