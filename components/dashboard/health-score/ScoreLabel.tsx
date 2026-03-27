'use client'

import type { HealthLabel } from '@/lib/healthScore'
type Trend = { delta: number; direction: 'up' | 'down' | 'stable' }

export function ScoreLabel({
  score,
  label,
  color,
  trend,
  cold,
  stale,
}: {
  score: number
  label: HealthLabel
  color: string
  trend: Trend
  cold?: boolean
  stale?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      {stale && (
        <span className="absolute top-[14%] rounded-full bg-[var(--accent-amber)]/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--accent-amber)]">
          ⚠ Stale
        </span>
      )}
      <span
        className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#7A8BA0]"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        System score
      </span>
      {cold ? (
        <p className="mt-2 text-lg font-medium text-[#7A8BA0]">Calculating…</p>
      ) : (
        <>
          <p
            className="mt-1 text-[52px] font-extrabold leading-none sm:text-[64px] xl:text-[72px]"
            style={{ color, fontFamily: 'var(--font-ui)', fontWeight: 800 }}
          >
            {score}
          </p>
          <p
            className="mt-2 text-base font-medium"
            style={{ color, opacity: 0.72, fontFamily: 'var(--font-ui)' }}
          >
            {label}
          </p>
          <p className="mt-2 flex items-center gap-1 text-xs" style={{ fontFamily: 'var(--font-ui)' }}>
            {trend.direction === 'stable' ? (
              <span className="text-[#7A8BA0]">— stable</span>
            ) : (
              <>
                <span className={trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}>
                  {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.delta)}
                </span>
                <span className="text-[#7A8BA0]">vs 1h ago</span>
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}
