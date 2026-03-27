'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_WIDGET_ORDER,
  DEFAULT_WIDGET_SIZES,
  isWidgetSize,
  LAYOUT_STORAGE_KEY,
  nextWidgetSize,
  type StoredLayout,
  type WidgetId,
  type WidgetSize,
} from '@/lib/constants'

function isWidgetId(s: string): s is WidgetId {
  return DEFAULT_WIDGET_ORDER.includes(s as WidgetId)
}

function loadLayout(): StoredLayout {
  if (typeof window === 'undefined') {
    return { v: 1, order: [...DEFAULT_WIDGET_ORDER], sizes: { ...DEFAULT_WIDGET_SIZES } }
  }
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as StoredLayout
    if (parsed.v !== 1 || !Array.isArray(parsed.order)) throw new Error('bad')
    const order = parsed.order.filter(isWidgetId)
    const missing = DEFAULT_WIDGET_ORDER.filter(id => !order.includes(id))
    const merged = [...order, ...missing] as WidgetId[]
    const sizes = { ...DEFAULT_WIDGET_SIZES, ...parsed.sizes }
    for (const id of DEFAULT_WIDGET_ORDER) {
      const v = sizes[id]
      if (!v || !isWidgetSize(v)) sizes[id] = DEFAULT_WIDGET_SIZES[id]
    }
    return { v: 1, order: merged, sizes }
  } catch {
    return { v: 1, order: [...DEFAULT_WIDGET_ORDER], sizes: { ...DEFAULT_WIDGET_SIZES } }
  }
}

export function useGridLayout() {
  const [order, setOrderState] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER)
  const [sizes, setSizesState] = useState<Record<WidgetId, WidgetSize>>(() => ({ ...DEFAULT_WIDGET_SIZES }))
  const [hydrated, setHydrated] = useState(false)

  const orderRef = useRef(order)
  const sizesRef = useRef(sizes)

  useEffect(() => {
    orderRef.current = order
  }, [order])
  useEffect(() => {
    sizesRef.current = sizes
  }, [sizes])

  const persist = useCallback((o: WidgetId[], s: Record<WidgetId, WidgetSize>) => {
    const payload: StoredLayout = { v: 1, order: o, sizes: s }
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [])

  /* Hydrate persisted layout from localStorage once on client (cannot read window during SSR). */
  /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydration */
  useEffect(() => {
    const l = loadLayout()
    orderRef.current = l.order
    sizesRef.current = l.sizes
    setOrderState(l.order)
    setSizesState(l.sizes)
    setHydrated(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const setOrder = useCallback(
    (next: WidgetId[]) => {
      setOrderState(next)
      orderRef.current = next
      persist(next, sizesRef.current)
    },
    [persist]
  )

  const toggleSize = useCallback(
    (id: WidgetId) => {
      setSizesState(prev => {
        const next = { ...prev, [id]: nextWidgetSize(prev[id] ?? '1x1') }
        sizesRef.current = next
        persist(orderRef.current, next)
        return next
      })
    },
    [persist]
  )

  const saveSnapshot = useCallback(() => {
    persist(orderRef.current, sizesRef.current)
  }, [persist])

  return {
    order,
    hydrated,
    sizes,
    setOrder,
    toggleSize,
    saveSnapshot,
  }
}
