'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { WidgetId } from '@/lib/constants'
import { GraphMainChart } from '@/components/dashboard/graph/GraphMainChart'
import { widgetMeta, WidgetBody } from '@/components/dashboard/widgets/widgetContents'
import { TimeRangeSelector } from './TimeRangeSelector'
import { StatsSummaryBar } from './StatsSummaryBar'
import { generateSyntheticChartPoints, formatExpandedAxisTime, type ExpandedTimeRange } from '@/lib/widgetMockData'
import { useId } from 'react'

type ExpandedModalProps = {
  widgetId: WidgetId | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExpandedModal({ widgetId, open, onOpenChange }: ExpandedModalProps) {
  const [range, setRange] = useState<ExpandedTimeRange>('1h')
  const uid = useId().replace(/:/g, '')
  const chartData = useMemo(() => generateSyntheticChartPoints(range, 42), [range])

  const showChart =
    widgetId === 'throughput' ||
    widgetId === 'request-rate' ||
    widgetId === 'error-rate' ||
    widgetId === 'latency'

  const meta = widgetId ? widgetMeta(widgetId) : { title: '' }

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
                    {meta.subtitle && <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">{meta.subtitle}</p>}
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
                  {showChart ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <TimeRangeSelector value={range} onChange={setRange} />
                      </div>
                      <div className="min-h-[320px] w-full">
                        <GraphMainChart
                          data={chartData}
                          range="1h"
                          height={320}
                          gradientId={`exp-${uid}`}
                          isFocus
                          tickFormatter={ts => formatExpandedAxisTime(ts, range)}
                        />
                      </div>
                      <div className="mt-4">
                        <StatsSummaryBar values={chartData.map(d => d.rr)} unit=" req/s" />
                      </div>
                    </>
                  ) : (
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
