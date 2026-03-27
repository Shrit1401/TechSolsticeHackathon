'use client'

import { summaryStats } from '@/lib/stats'

export function StatsSummaryBar({ values, unit, decimals = 0 }: { values: number[]; unit: string; decimals?: number }) {
  const s = summaryStats(values)
  const fmt = (n: number) => (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString())
  const items = [
    { label: 'Min', v: s.min },
    { label: 'Max', v: s.max },
    { label: 'Avg', v: s.avg },
    { label: 'p50', v: s.p50 },
    { label: 'p95', v: s.p95 },
    { label: 'p99', v: s.p99 },
  ]
  return (
    <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4 text-[12px] text-[var(--text-secondary)]">
      {items.map(({ label, v }) => (
        <div key={label} className="min-w-[72px]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
          <p className="font-numeric-dial mt-0.5 text-[var(--text-primary)]">
            {fmt(v)}
            {unit}
          </p>
        </div>
      ))}
    </div>
  )
}
