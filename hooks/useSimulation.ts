'use client'

import { useEffect } from 'react'
import { adaptiveMetricsFreezeRef } from '@/lib/adaptiveMetricsFreeze'
import { useDashboardStore } from '@/store/dashboardStore'

export function useSimulation() {
  useEffect(() => {
    const id = setInterval(() => {
      if (adaptiveMetricsFreezeRef.current) return
      useDashboardStore.getState().tickMetrics()
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const simulateFailure = useDashboardStore(s => s.simulateFailure)
  const toggleAutoRemediation = useDashboardStore(s => s.toggleAutoRemediation)
  const autoRemediation = useDashboardStore(s => s.autoRemediation)
  const triggerAutoRemediation = useDashboardStore(s => s.triggerAutoRemediation)

  return { simulateFailure, toggleAutoRemediation, autoRemediation, triggerAutoRemediation }
}
