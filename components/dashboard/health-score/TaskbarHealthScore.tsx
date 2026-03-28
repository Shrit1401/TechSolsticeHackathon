'use client'

import { useHealthScore } from '@/hooks/useHealthScore'
import { cn } from '@/lib/utils'
import { HealthScoreBreakdownCard } from './HealthScoreBreakdownCard'

export function TaskbarHealthScore() {
  const { score, breakdown, label, color, trend, lastUpdated, stale, hasData } = useHealthScore()
  const cold = !hasData

  return (
    <div className="group relative shrink-0 overflow-visible">
      <button
        type="button"
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-200',
          'hover:border-[var(--accent-cyan)]/30 hover:shadow-[0_0_20px_rgba(0,212,255,0.12)]',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/40'
        )}
        aria-label={cold ? 'Health score, calculating' : `Health score ${score}, ${label}. Hover or focus for breakdown.`}
      >
        <div className="min-w-0 text-left leading-none">
          <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Health
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            {cold ? (
              <span className="font-numeric-dial text-base tabular-nums text-[var(--text-tertiary)] xl:text-lg">
                …
              </span>
            ) : (
              <>
                <span
                  className="font-numeric-dial text-base tabular-nums leading-none xl:text-lg"
                  style={{ color }}
                >
                  {score}
                </span>
                <span className="hidden max-w-[5.5rem] truncate text-[0.6875rem] font-medium sm:block" style={{ color, opacity: 0.75 }}>
                  {label}
                </span>
              </>
            )}
          </div>
          {!cold && (
            <p className="mt-1 hidden text-[0.625rem] leading-tight text-[var(--text-tertiary)] md:block">
              {trend.direction === 'stable' ? (
                <span>— stable</span>
              ) : (
                <>
                  <span className={trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}>
                    {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.delta)}
                  </span>
                  <span className="text-[var(--text-tertiary)]"> vs 1h</span>
                </>
              )}
            </p>
          )}
        </div>
        {stale && !cold && (
          <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-400">
            Stale
          </span>
        )}
      </button>

      {/* Hover / focus-within panel — descendant hover keeps parent .group:hover true */}
      <div
        className={cn(
          'pointer-events-none absolute left-0 top-full z-[70] pt-2',
          'w-[min(calc(100vw-2rem),320px)] max-w-[min(calc(100vw-2rem),320px)]',
          'origin-top scale-95 opacity-0 transition-[opacity,transform] duration-200 ease-out',
          'group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100',
          'group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100'
        )}
      >
        {cold ? (
          <div className="rounded-2xl border border-white/10 bg-[rgba(17,24,32,0.95)] p-5 text-center text-[13px] text-white/55 backdrop-blur-[16px]">
            Waiting for live metrics…
          </div>
        ) : (
          <HealthScoreBreakdownCard breakdown={breakdown} lastUpdated={lastUpdated} />
        )}
      </div>
    </div>
  )
}
