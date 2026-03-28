'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import type { IssueRow } from '@/lib/priorityScore'
import { cn } from '@/lib/utils'

type Props = {
  visible: boolean
  issues: IssueRow[]
  dismissed: boolean
  onDismiss: () => void
}

export function IncidentBanner({ visible, issues, dismissed, onDismiss }: Props) {
  const show = visible && !dismissed && issues.length > 0

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            'relative mb-5 rounded-2xl border px-6 py-4',
            'border-[rgba(255,23,68,0.15)] bg-[rgba(255,23,68,0.06)]',
            '[font-family:var(--font-ui)]',
          )}
          role="status"
        >
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 rounded-lg p-1 text-[#8A9AB0] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Dismiss banner"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <Zap className="mt-0.5 size-5 shrink-0 text-[#FF4D6A]" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FF4D6A]">
                Adaptive mode active
              </p>
              <p className="mt-1 text-[13px] text-[#8A9AB0]">
                {issues.length} issue{issues.length === 1 ? '' : 's'} detected — tiles sorted by severity
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {issues.map((i) => (
                  <li
                    key={i.tileId}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium',
                      i.status === 'critical'
                        ? 'border-[rgba(255,23,68,0.25)] bg-[rgba(255,23,68,0.08)] text-[#FF4D6A]'
                        : 'border-[rgba(255,176,32,0.25)] bg-[rgba(255,176,32,0.06)] text-[#FFB020]',
                    )}
                  >
                    <span className="opacity-80">●</span>
                    {i.tileName} {i.status} ({i.currentValue})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
