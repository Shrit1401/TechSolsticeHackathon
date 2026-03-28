'use client'

import { useEffect, useState } from 'react'

export function useCountUp(target: number, duration = 600, delay = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let raf = 0
    const timeout = window.setTimeout(() => {
      const start = performance.now()
      const step = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        setValue(target * eased)
        if (progress < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])

  return value
}
