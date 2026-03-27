'use client'

import { useId, useMemo } from 'react'
import { cn } from '@/lib/utils'

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const sweep = endDeg - startDeg
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

type ScoreRingProps = {
  size: number
  score: number
  color: string
  cold?: boolean
  stale?: boolean
  pulseCritical?: boolean
  className?: string
}

export function ScoreRing({
  size,
  score,
  color,
  cold,
  stale,
  pulseCritical,
  className,
}: ScoreRingProps) {
  const uid = useId().replace(/:/g, '')
  const stroke = 12
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const startDeg = 135
  const endDegFull = startDeg + 270
  const endDegFill = startDeg + (270 * Math.max(0, Math.min(100, score))) / 100

  const trackD = useMemo(() => arcPath(cx, cy, r, startDeg, endDegFull), [cx, cy, r, startDeg, endDegFull])
  const fillD = useMemo(() => arcPath(cx, cy, r, startDeg, endDegFill), [cx, cy, r, endDegFill])

  const gradId = `hs-grad-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0 overflow-visible', stale && 'opacity-60', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor={color} stopOpacity={0.75} />
        </linearGradient>
      </defs>
      <path
        d={trackD}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={cold ? '10 14' : undefined}
      />
      {!cold && (
        <path
          d={fillD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={pulseCritical ? 'motion-safe:animate-[health-ring-pulse_1.5s_ease-in-out_infinite]' : ''}
          style={
            pulseCritical
              ? undefined
              : {
                  filter: `drop-shadow(0 0 12px ${color}55)`,
                }
          }
        />
      )}
    </svg>
  )
}
