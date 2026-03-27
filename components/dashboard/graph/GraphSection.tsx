'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { Maximize2 } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { averageError, healthLabel, healthStateFromError, mergeMetrics, sliceByRange, type TimeRange } from '@/lib/graphUtils'
import { useRelativeAgo } from '@/hooks/useRelativeAgo'
import { MetricStrip } from './MetricStrip'
import { GraphMainChart } from './GraphMainChart'
import { GraphFocusModal } from './GraphFocusModal'

const RANGES: { id: TimeRange; label: string }[] = [
  { id: '5m', label: '5m' },
  { id: '1h', label: '1h' },
  { id: '24h', label: '24h' },
]

export function GraphSection() {
  const requestRate = useDashboardStore(s => s.metrics.requestRate)
  const errorRate = useDashboardStore(s => s.metrics.errorRate)
  const latency = useDashboardStore(s => s.metrics.latency)

  const lastUpdateMs = requestRate.length > 0 ? requestRate[requestRate.length - 1]!.timestamp : 0
  const ago = useRelativeAgo(lastUpdateMs)

  const [range, setRange] = useState<TimeRange>('5m')
  const [focusOpen, setFocusOpen] = useState(false)

  const merged = useMemo(
    () => mergeMetrics(requestRate, errorRate, latency),
    [requestRate, errorRate, latency]
  )
  const chartData = useMemo(() => sliceByRange(merged, range), [merged, range])
  const healthState = useMemo(() => healthStateFromError(averageError(chartData)), [chartData])

  const uid = useId().replace(/:/g, '')
  const gradientId = `graph-grad-${uid}`

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      animate(mx, px * -3.5, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
      animate(my, py * 3.5, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
    },
    [mx, my]
  )
  const onLeave = useCallback(() => {
    animate(mx, 0, { duration: 0.5, ease: [0.22, 1, 0.36, 1] })
    animate(my, 0, { duration: 0.5, ease: [0.22, 1, 0.36, 1] })
  }, [mx, my])

  return (
    <section aria-labelledby="metrics-section-title" className="[font-family:var(--font-ui)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="metrics-section-title" className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Key metrics
          </h2>
          <p className="mt-1 text-[13px] text-white/30">Updated {ago}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${healthDotClass(healthState)}`} />
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">{healthLabel(healthState)}</span>
        </div>
      </div>

      <div className="mt-6">
        <MetricStrip requestRate={requestRate} errorRate={errorRate} latency={latency} />
      </div>

      <motion.div
        className="relative mt-8 overflow-hidden rounded-[22px] border border-white/20 bg-black shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        style={{ perspective: 960, rotateX: my, rotateY: mx, transformStyle: 'preserve-3d' }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        role="button"
        tabIndex={0}
        aria-label="Open chart in focus mode"
        onClick={() => setFocusOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFocusOpen(true)
          }
        }}
      >
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-70"
          aria-hidden
          animate={{
            backgroundPosition: ['0% 0%, 100% 100%', '100% 30%, 0% 60%', '0% 0%, 100% 100%'],
          }}
          transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
          style={{
            backgroundImage:
              'radial-gradient(ellipse 100% 80% at 15% 20%, rgba(56,189,248,0.12), transparent 55%), radial-gradient(ellipse 90% 70% at 85% 80%, rgba(124,58,237,0.08), transparent 55%)',
            backgroundSize: '140% 140%, 120% 120%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <div className="relative flex flex-col gap-4 border-b border-white/[0.05] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7 md:py-5">
          <div>
            <p className="text-[13px] font-medium text-white/85">Throughput & error budget</p>
            <p className="mt-0.5 text-[12px] text-white/35">Request rate with error overlay · natural scale</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-full border border-white/[0.1] bg-black p-0.5"
              role="group"
              aria-label="Time range"
            >
              {RANGES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setRange(r.id)
                  }}
                  className={
                    range === r.id
                      ? 'rounded-full bg-white/[0.1] px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm'
                      : 'rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white/40 transition-colors hover:text-white/65'
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setFocusOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-black px-3.5 py-2 text-[12px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-black hover:text-white"
            >
              <Maximize2 className="size-3.5 opacity-70" strokeWidth={1.75} />
              Focus
            </button>
          </div>
        </div>

        <div className="relative px-3 pb-5 pt-2 md:px-6 md:pb-7">
          <GraphMainChart data={chartData} range={range} height={320} gradientId={gradientId} />
        </div>
      </motion.div>

      <GraphFocusModal
        open={focusOpen}
        onOpenChange={setFocusOpen}
        data={chartData}
        range={range}
        gradientId={gradientId}
      />
    </section>
  )
}

function healthDotClass(state: 'healthy' | 'elevated' | 'critical'): string {
  if (state === 'healthy') return 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]'
  if (state === 'elevated') return 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
  return 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.7)]'
}
