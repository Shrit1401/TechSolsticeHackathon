'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { WidgetSize } from '@/lib/constants'

const WidgetSizeContext = createContext<WidgetSize>('1x1')

export function WidgetSizeProvider({ size, children }: { size: WidgetSize; children: ReactNode }) {
  return <WidgetSizeContext.Provider value={size}>{children}</WidgetSizeContext.Provider>
}

export function useWidgetSize(): WidgetSize {
  return useContext(WidgetSizeContext)
}
