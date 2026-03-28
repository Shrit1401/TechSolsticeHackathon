'use client'

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={10}
      height={10}
      viewBox="0 0 10 10"
      aria-hidden
    >
      <path d="M5 2L8 7H2L5 2Z" fill="currentColor" />
    </svg>
  )
}

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={10}
      height={10}
      viewBox="0 0 10 10"
      aria-hidden
    >
      <path d="M5 8L2 3H8L5 8Z" fill="currentColor" />
    </svg>
  )
}

export interface DeltaIndicatorProps {
  current: number
  previous: number
  unit?: string
  timeframe?: string
  invertColors?: boolean
  decimals?: number
}

function formatDiff(n: number, decimals: number) {
  if (decimals > 0) return n.toFixed(decimals)
  return Math.round(n).toString()
}

export function DeltaIndicator({
  current,
  previous,
  unit = '',
  timeframe = '5m ago',
  invertColors = false,
  decimals = 0,
}: DeltaIndicatorProps) {
  const denom = Math.max(Math.abs(previous), 1e-9)
  const rel = Math.abs(current - previous) / denom
  const stable = rel < 0.01

  if (stable) {
    return (
      <p
        className="mt-2 text-[12px] font-medium leading-none text-[#4A5568] [font-family:var(--font-ui)]"
        aria-label="Stable vs baseline"
      >
        — stable
      </p>
    )
  }

  const up = current > previous
  const Arrow = up ? ArrowUp : ArrowDown
  const rawDiff = Math.abs(current - previous)
  const diffStr = formatDiff(rawDiff, decimals)
  const unitSuffix = unit ? ` ${unit}` : ''

  let directionColor: string
  if (invertColors) {
    directionColor = up ? '#FF4D6A' : '#00C853'
  } else {
    directionColor = up ? '#00C853' : '#FF4D6A'
  }

  const sign = up ? '+' : '−'

  return (
    <p
      className="mt-2 flex flex-wrap items-center gap-1 text-[12px] font-medium leading-none [font-family:var(--font-ui)]"
      style={{ color: directionColor }}
    >
      <Arrow className="shrink-0" />
      <span className="ml-1">
        {sign}
        {diffStr}
        {unitSuffix}
      </span>
      <span className="ml-1.5 text-[#4A5568]">
        vs {timeframe}
      </span>
    </p>
  )
}
