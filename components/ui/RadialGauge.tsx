'use client'

import { cn } from '@/lib/utils'

export function RadialGauge({
  value,
  label,
  sublabel,
  size = 'lg',
}: {
  value: number
  label: string
  sublabel?: string
  size?: 'md' | 'lg'
}) {
  const v = Math.max(0, Math.min(100, value))
  const stroke =
    v < 50 ? 'var(--accent-green)' : v < 80 ? 'var(--accent-amber)' : 'var(--accent-red)'

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full',
          size === 'md' ? 'h-[96px] w-[96px] p-[6px]' : 'h-[112px] w-[112px] p-[7px]'
        )}
        style={{
          background: `conic-gradient(from 210deg, ${stroke} ${v * 2.7}deg, rgba(255,255,255,0.07) 0)`,
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black text-center">
          <span className={cn('font-numeric-dial text-[var(--text-primary)]', size === 'md' ? 'text-xl' : 'text-2xl')}>
            {Math.round(v)}%
          </span>
          {sublabel && <span className="font-numeric-dial text-[10px] text-[var(--text-tertiary)]">{sublabel}</span>}
        </div>
      </div>
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</span>
      ) : null}
    </div>
  )
}
