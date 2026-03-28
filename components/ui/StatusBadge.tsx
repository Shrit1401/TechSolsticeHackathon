'use client'

import { cn } from '@/lib/utils'

export type Status = 'healthy' | 'watch' | 'critical'

export interface StatusBadgeProps {
  status: Status
}

const styles: Record<
  Status,
  { bg: string; color: string; border: string; label: string }
> = {
  healthy: {
    bg: 'rgba(0, 200, 83, 0.08)',
    color: '#00C853',
    border: '1px solid rgba(0, 200, 83, 0.15)',
    label: 'Healthy',
  },
  watch: {
    bg: 'rgba(255, 176, 32, 0.08)',
    color: '#FFB020',
    border: '1px solid rgba(255, 176, 32, 0.15)',
    label: 'Watch',
  },
  critical: {
    bg: 'rgba(255, 23, 68, 0.08)',
    color: '#FF1744',
    border: '1px solid rgba(255, 23, 68, 0.15)',
    label: 'Critical',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = styles[status]
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-3 py-1',
        'text-[11px] font-semibold uppercase tracking-[0.08em] [font-family:var(--font-ui)]',
      )}
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
      }}
    >
      <span
        className={cn(
          'status-badge-dot',
          status === 'critical' && 'status-badge-dot--urgent',
        )}
        aria-hidden
      />
      {s.label}
    </span>
  )
}
