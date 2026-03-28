'use client'

import { createContext, useContext } from 'react'

export const MetricCardMotionContext = createContext<{ countUpDelayMs: number }>({
  countUpDelayMs: 0,
})

export function useMetricCardMotion() {
  return useContext(MetricCardMotionContext)
}
