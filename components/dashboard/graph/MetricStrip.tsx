'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MetricPoint } from '@/lib/types'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { metricState, type HealthState } from '@/lib/graphUtils'
import { cn } from '@/lib/utils'

type Key = 'requestRate' | 'errorRate' | 'latency'

const ITEMS: {
  key: Key
  label: string
  format: (v: number) => string
  deltaFmt: (d: number) => string
  accent: 'cyan' | 'rose' | 'neutral'
}[] = [
  {
    key: 'requestRate',
    label: 'Request rate',
    format: v => `${Math.round(v)}`,
    deltaFmt: d => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))}`,
    accent: 'cyan',
  },
  {
    key: 'errorRate',
    label: 'Error rate',
    format: v => `${v.toFixed(1)}%`,
    deltaFmt: d => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`,
    accent: 'rose',
  },
  {
    key: 'latency',
    label: 'Latency (P99)',
    format: v => `${Math.round(v)}`,
    deltaFmt: d => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))}ms`,
    accent: 'neutral',
  },
]

function MetricCard({
  metric,
  label,
  format,
  deltaFmt,
  accent,
  data,
  unit,
}: {
  metric: Key
  label: string
  format: (v: number) => string
  deltaFmt: (d: number) => string
  accent: 'cyan' | 'rose' | 'neutral'
  data: MetricPoint[]
  unit?: string
}) {
  const latest = data[data.length - 1]?.value ?? 0
  const prev = data[data.length - 3]?.value ?? latest
  const delta = latest - prev
  const animated = useAnimatedNumber(latest, 400)

  const valueStr = useMemo(() => format(animated), [animated, format])
  const state = metricState(metric, latest)

  const accentClass = valueColor(accent, state)

  const deltaClass =
    accent === 'rose' && delta > 0 ? 'text-rose-300/75' : 'text-white/35'

  return (
    <motion.article
      className={cn(
        'relative overflow-hidden rounded-[22px] border border-white/[0.1] bg-black p-6 md:p-7',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.35)]',
        'backdrop-blur-xl'
      )}
      initial={false}
      whileHover={{ y: -3, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            accent === 'cyan'
              ? 'radial-gradient(ellipse 80% 60% at 10% 0%, rgba(56,189,248,0.12), transparent 60%)'
              : accent === 'rose'
                ? 'radial-gradient(ellipse 80% 60% at 90% 0%, rgba(251,113,133,0.1), transparent 55%)'
                : 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.06), transparent 55%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]">
        <div className={cn('h-full w-full', stateBar(state))} />
      </div>
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">{label}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-black px-2.5 py-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', stateDot(state))} />
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{stateText(state)}</span>
        </div>
        <p className={cn('mt-3 font-numeric-dial text-4xl tracking-tight md:text-[2.75rem]', accentClass)}>
          {valueStr}
          {unit ? <span className="ml-1.5 text-lg font-medium text-white/30 md:text-xl">{unit}</span> : null}
        </p>
        <p className={cn('mt-2 font-numeric-dial text-[13px]', deltaClass)} aria-live="polite">
          {deltaFmt(delta)} <span className="text-white/25">vs prior</span>
        </p>
      </div>
    </motion.article>
  )
}

export function MetricStrip({
  requestRate,
  errorRate,
  latency,
}: {
  requestRate: MetricPoint[]
  errorRate: MetricPoint[]
  latency: MetricPoint[]
}) {
  const series = { requestRate, errorRate, latency }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
      {ITEMS.map(item => (
        <MetricCard
          key={item.key}
          metric={item.key}
          label={item.label}
          format={item.format}
          deltaFmt={item.deltaFmt}
          accent={item.accent}
          data={series[item.key]}
          unit={item.key === 'requestRate' ? 'req/s' : item.key === 'latency' ? 'ms' : undefined}
        />
      ))}
    </div>
  )
}

function stateText(state: HealthState): string {
  if (state === 'healthy') return 'healthy'
  if (state === 'elevated') return 'watch'
  return 'critical'
}

function stateDot(state: HealthState): string {
  if (state === 'healthy') return 'bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.65)]'
  if (state === 'elevated') return 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]'
  return 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.65)]'
}

function stateBar(state: HealthState): string {
  if (state === 'healthy') return 'bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-emerald-400/0'
  if (state === 'elevated') return 'bg-gradient-to-r from-sky-400/0 via-sky-400/70 to-sky-400/0'
  return 'bg-gradient-to-r from-rose-400/0 via-rose-400/70 to-rose-400/0'
}

function valueColor(accent: 'cyan' | 'rose' | 'neutral', state: HealthState): string {
  if (accent === 'rose') {
    return state === 'critical' ? 'text-rose-300' : state === 'elevated' ? 'text-sky-300' : 'text-emerald-300'
  }
  if (accent === 'cyan') {
    return state === 'critical' ? 'text-rose-300' : state === 'elevated' ? 'text-sky-300' : 'text-emerald-300'
  }
  return state === 'critical' ? 'text-rose-200' : 'text-white'
}
