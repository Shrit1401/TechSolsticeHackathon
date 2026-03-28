'use client'

import { useMemo, useId } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WidgetId } from '@/lib/constants'
import { GraphMainChart } from '@/components/dashboard/graph/GraphMainChart'
import { widgetMeta, WidgetBody } from '@/components/dashboard/widgets/widgetContents'
import { StatsSummaryBar } from './StatsSummaryBar'
import { formatAxisTime } from '@/lib/graphUtils'
import { useDashboardStore } from '@/store/dashboardStore'
import type { MetricPoint } from '@/lib/types'

const CORE_CHART_IDS: readonly WidgetId[] = ['request-rate', 'error-rate', 'latency']
const EXT_CHART_IDS: readonly WidgetId[] = [
  'cpu', 'memory', 'connections', 'disk-io', 'network-in',
  'queue-depth', 'saturation', 'gc-pause', 'cache-hit', 'thread-pool', 'db-connections',
  'throughput',
]
const BODY_IDS: readonly WidgetId[] = ['service-map', 'incident-timeline', 'anomaly']

const EMPTY: MetricPoint[] = []

function ExtMetricChart({ data, label, unit, gradientId }: {
  data: MetricPoint[]
  label: string
  unit: string
  gradientId: string
}) {
  const latest = data.length ? data[data.length - 1]!.value : null
  const chartData = data.map(p => ({ t: p.timestamp, v: p.value }))

  return (
    <div>
      {latest !== null && (
        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-numeric-dial text-3xl tabular-nums text-white">
            {latest % 1 === 0 ? latest.toFixed(0) : latest.toFixed(2)}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">{unit}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={ts => formatAxisTime(ts, '1h')}
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)' }}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={v => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(17,24,32,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              color: '#fff',
            }}
            labelFormatter={ts => formatAxisTime(Number(ts), '1h')}
            formatter={(v) => typeof v === 'number' ? [`${v.toFixed(2)} ${unit}`, label] : [String(v), label]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--accent-cyan)"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

type ExpandedModalProps = {
  widgetId: WidgetId | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExpandedModal({ widgetId, open, onOpenChange }: ExpandedModalProps) {
  const uid = useId().replace(/:/g, '')

  const metrics = useDashboardStore(s => s.metrics)
  const extendedMetrics = useDashboardStore(s => s.extendedMetrics)

  // Core metrics chart — build from requestRate, pad missing series with 0
  // (don't use mergeMetrics which requires min-length across all three)
  const coreChartData = useMemo(() => {
    const rr = metrics.requestRate
    if (rr.length === 0) return []
    const er = metrics.errorRate
    const lat = metrics.latency
    return rr.map((pt, i) => ({
      t: pt.timestamp,
      rr: pt.value,
      er: er[i]?.value ?? 0,
      lat: lat[i]?.value ?? 0,
    }))
  }, [metrics])

  // Extended metric series for this widget
  const extSeries = widgetId ? (extendedMetrics[widgetId as keyof typeof extendedMetrics] ?? EMPTY) : EMPTY

  const isCoreChart = widgetId !== null && (CORE_CHART_IDS as readonly string[]).includes(widgetId)
  const isExtChart = widgetId !== null && (EXT_CHART_IDS as readonly string[]).includes(widgetId) && !isCoreChart
  const isBody = widgetId !== null && ((BODY_IDS as readonly string[]).includes(widgetId) || (!isCoreChart && !isExtChart))

  const meta = widgetId ? widgetMeta(widgetId) : { title: '', subtitle: '' }

  // Widget unit labels for extended metrics
  const extUnit: Partial<Record<WidgetId, string>> = {
    cpu: '%', memory: '%', connections: 'conn', 'disk-io': 'MB/s',
    'network-in': 'Mbps', 'queue-depth': 'msgs', saturation: '%',
    'gc-pause': 'ms', 'cache-hit': '%', 'thread-pool': '%',
    'db-connections': 'conn', throughput: 'req/s',
  }

  return (
    <Dialog.Root open={open && !!widgetId} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/70 backdrop-blur-[8px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Popup className="pointer-events-auto relative flex max-h-[min(92vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-black p-6 shadow-2xl outline-none md:p-8 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 [font-family:var(--font-ui)]">
            {widgetId && (
              <motion.div layoutId={`widget-card-${widgetId}`} className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                      {meta.title}
                    </Dialog.Title>
                    {'subtitle' in meta && meta.subtitle && (
                      <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">{meta.subtitle}</p>
                    )}
                    <Dialog.Description className="sr-only">Expanded widget detail. Escape to close.</Dialog.Description>
                  </div>
                  <Dialog.Close
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent-cyan)]/40 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="size-4" strokeWidth={1.75} />
                  </Dialog.Close>
                </div>

                <div className="mt-6 min-h-[200px] flex-1 overflow-y-auto">
                  {isCoreChart && (
                    <>
                      {coreChartData.length > 0 ? (
                        <>
                          <div className="min-h-[320px] w-full">
                            <GraphMainChart
                              data={coreChartData}
                              range="1h"
                              height={320}
                              gradientId={`exp-${uid}`}
                              isFocus
                              tickFormatter={ts => formatAxisTime(ts, '1h')}
                            />
                          </div>
                          <div className="mt-4">
                            <StatsSummaryBar values={coreChartData.map(d => d.rr)} unit=" req/s" />
                          </div>
                        </>
                      ) : (
                        <div className="flex h-64 items-center justify-center text-[13px] text-[var(--text-tertiary)]">
                          Waiting for Prometheus data…
                        </div>
                      )}
                    </>
                  )}

                  {isExtChart && !isCoreChart && (
                    <>
                      {extSeries.length > 0 ? (
                        <ExtMetricChart
                          data={extSeries}
                          label={meta.title}
                          unit={extUnit[widgetId] ?? ''}
                          gradientId={`ext-${uid}`}
                        />
                      ) : (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                          <span className="text-[13px] text-[var(--text-tertiary)]">No data yet</span>
                          <span className="font-mono text-[11px] text-[#374151]">
                            Prometheus metric not available for this widget
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {isBody && (
                    <div className="py-2">
                      <WidgetBody id={widgetId} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
