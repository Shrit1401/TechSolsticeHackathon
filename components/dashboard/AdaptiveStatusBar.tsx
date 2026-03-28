'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import type { IssueRow } from '@/lib/priorityScore'
import { cn } from '@/lib/utils'

type Props = {
  visible: boolean
  issues: IssueRow[]
}

function issueSummary(i: IssueRow): string {
  return `${i.tileName} ${i.status}`
}

export function AdaptiveStatusBar({ visible, issues }: Props) {
  const show = visible && issues.length > 0
  const line = issues.map(issueSummary).join('  ·  ')

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="adaptive-status-bar"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 36, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="mb-3 overflow-hidden [font-family:var(--font-ui)]"
        >
          <div
            className={cn(
              'flex h-9 items-center gap-2 rounded-[10px] pl-4 pr-3',
              'bg-[rgba(255,77,106,0.04)]',
            )}
            role="status"
          >
            <Zap className="size-3.5 shrink-0 text-[#ff4d6a]" strokeWidth={2} aria-hidden />
            <p className="min-w-0 truncate text-[12px] font-medium leading-none">
              <span className="text-[#ff4d6a]">
                {issues.length} issue{issues.length === 1 ? '' : 's'} sorted to top
              </span>
              <span className="text-[#5a6b80]">  ·  </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={line}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[#5a6b80]"
                >
                  {line}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
