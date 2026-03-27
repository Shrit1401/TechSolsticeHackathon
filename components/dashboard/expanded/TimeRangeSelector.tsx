'use client'

import type { ExpandedTimeRange } from '@/lib/widgetMockData'
import { cn } from '@/lib/utils'

const RANGES: ExpandedTimeRange[] = ['5m', '15m', '1h', '6h', '24h', '7d']

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: ExpandedTimeRange
  onChange: (r: ExpandedTimeRange) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-white/[0.1] bg-black p-0.5" role="group" aria-label="Time range">
      {RANGES.map(r => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
            value === r ? 'bg-white/12 text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
