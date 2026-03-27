'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ChartPoint, TimeRange } from '@/lib/graphUtils'
import { GraphMainChart } from './GraphMainChart'

type GraphFocusModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ChartPoint[]
  range: TimeRange
  gradientId: string
}

export function GraphFocusModal({
  open,
  onOpenChange,
  data,
  range,
  gradientId,
}: GraphFocusModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/80 backdrop-blur-md transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Popup className="pointer-events-auto flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0a0a]/95 p-6 shadow-2xl outline-none backdrop-blur-2xl md:p-10 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Focus
                </Dialog.Title>
                <p className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">Traffic & errors</p>
                <Dialog.Description className="sr-only">
                  Fullscreen chart view. Press Escape or use the close control to exit.
                </Dialog.Description>
              </div>
              <Dialog.Close
                type="button"
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-white/45 transition-colors hover:border-white/20 hover:text-white"
                aria-label="Close"
              >
                <X className="size-5" strokeWidth={1.75} />
              </Dialog.Close>
            </div>
            <div className="mt-8 min-h-[min(52vh,420px)] w-full flex-1">
              <GraphMainChart
                data={data}
                range={range}
                height={420}
                gradientId={`${gradientId}-focus`}
                isFocus
              />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
