'use client'

import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const d = useAnimatedNumber(value, 500)
  return (
    <span className="font-numeric-dial">{decimals > 0 ? d.toFixed(decimals) : Math.round(d).toString()}</span>
  )
}
