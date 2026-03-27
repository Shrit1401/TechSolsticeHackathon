'use client'

import { motion } from 'framer-motion'
import type { WidgetId } from '@/lib/constants'
import { subScoreToColorHex } from '@/lib/healthScore'
import { cn } from '@/lib/utils'

const ITEMS: {
  key: keyof Breakdown
  label: string
  widgetId: WidgetId
}[] = [
  { key: 'latency', label: 'Latency', widgetId: 'latency' },
  { key: 'errors', label: 'Errors', widgetId: 'error-rate' },
  { key: 'throughput', label: 'Throughput', widgetId: 'throughput' },
  { key: 'cpu', label: 'CPU', widgetId: 'cpu' },
  { key: 'memory', label: 'Memory', widgetId: 'memory' },
  { key: 'anomaly', label: 'Anomaly', widgetId: 'anomaly' },
]

type Breakdown = {
  latency: number
  errors: number
  throughput: number
  cpu: number
  memory: number
  anomaly: number
}

type RawPreview = {
  latency: string
  errors: string
  throughput: string
  cpu: string
  memory: string
  anomaly: string
}

export function SubScorePills({
  breakdown,
  rawPreview,
  onPillClick,
  disabled,
}: {
  breakdown: Breakdown
  rawPreview: RawPreview
  onPillClick: (widgetId: WidgetId) => void
  disabled?: boolean
}) {
  return (
    <div className="grid w-full max-w-lg grid-cols-2 justify-items-stretch gap-2 md:max-w-none md:flex md:flex-wrap md:justify-center md:gap-2">
      {ITEMS.map((item, i) => {
        const v = breakdown[item.key]
        const dot = subScoreToColorHex(v)
        return (
          <motion.button
            key={item.key}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
            disabled={disabled}
            onClick={() => onPillClick(item.widgetId)}
            title={rawPreview[item.key]}
            className={cn(
              'inline-flex min-w-0 items-center gap-2 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-left text-[12px] font-medium transition-colors',
              'bg-white/[0.04] hover:bg-white/[0.08]',
              disabled && 'pointer-events-none opacity-40'
            )}
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
            <span className="truncate text-white/70">{item.label}</span>
            <span className="ml-auto tabular-nums text-white/90">{Math.round(v)}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
