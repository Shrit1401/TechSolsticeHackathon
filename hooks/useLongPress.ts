'use client'

import { useCallback, useRef } from 'react'

export function useLongPress(
  onLongPress: () => void,
  ms = 300
): {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      clear()
      timer.current = setTimeout(() => {
        timer.current = null
        onLongPress()
      }, ms)
    },
    [clear, ms, onLongPress]
  )

  const onPointerUp = useCallback(() => {
    clear()
  }, [clear])

  const onPointerCancel = useCallback(() => {
    clear()
  }, [clear])

  return { onPointerDown, onPointerUp, onPointerCancel }
}
