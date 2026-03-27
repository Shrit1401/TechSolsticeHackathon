'use client'

import { cn } from '@/lib/utils'
import type { HealthState } from '@/lib/graphUtils'

export function StatusBadge({ state }: { state: HealthState }) {
  const label =
    state === 'healthy' ? 'HEALTHY' : state === 'elevated' ? 'WATCH' : 'CRITICAL'
  const dot =
    state === 'healthy'
      ? 'bg-[var(--accent-green)]'
      : state === 'elevated'
        ? 'bg-[var(--accent-blue)]'
        : 'bg-[var(--accent-red)]'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1',
        'text-[11px] font-medium tracking-wide text-[var(--text-secondary)] [font-family:var(--font-ui)]'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {label}
    </span>
  )
}
