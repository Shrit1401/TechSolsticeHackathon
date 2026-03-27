'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, Loader2 } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { formatRelativeTime } from '@/lib/utils'
import type { RemediationAction, RemediationStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<RemediationStatus, { label: string }> = {
  queued: { label: 'Queued' },
  'in-progress': { label: 'In progress' },
  completed: { label: 'Done' },
  failed: { label: 'Failed' },
}

interface RemediationPanelProps {
  variant?: 'default' | 'embedded'
}

function ActionCard({ action }: { action: RemediationAction }) {
  const status = statusConfig[action.status]
  const isInProgress = action.status === 'in-progress'
  const isCompleted = action.status === 'completed'

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl px-4 py-3 border border-white/[0.1] glass-l1 transition-all duration-200 ease-out',
        'hover:border-[#00d4ff]/20',
        isInProgress && 'border-[#00d4ff]/35 shadow-[0_0_12px_rgba(0,212,255,0.12)]',
        isCompleted && 'opacity-75'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[0.875rem] leading-snug',
            isCompleted ? 'text-[#4b5563] line-through' : 'text-[#9ca3af]'
          )}>
            {action.action}
          </p>
          <p className="text-[11px] text-[#4b5563] mt-0.5">{formatRelativeTime(action.timestamp)}</p>
        </div>

        <div className={cn(
          'text-[10px] font-medium tabular-nums flex-shrink-0 text-[#4b5563]',
          isInProgress && 'text-[#00d4ff]',
          isCompleted && 'text-emerald-400/80',
          action.status === 'failed' && 'text-red-400/90'
        )}>
          {isInProgress ? (
            <Loader2 className="w-3 h-3 animate-spin opacity-70" />
          ) : (
            <span>{status.label}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function RemediationPanel({ variant = 'default' }: RemediationPanelProps) {
  const remediationActions = useDashboardStore(s => s.remediationActions)
  const autoRemediation = useDashboardStore(s => s.autoRemediation)

  const completed = remediationActions.filter(a => a.status === 'completed').length
  const total = remediationActions.length

  const inner = (
    <>
      {variant === 'default' && (
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-[#4b5563]" />
          <h2 className="text-sm font-semibold text-white">Auto-remediation</h2>
          <div className={cn(
            'ml-auto flex items-center gap-1.5 text-[10px] font-mono text-[#4b5563]'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              autoRemediation ? 'bg-[#00d4ff]' : 'bg-[#4b5563]'
            )} />
            {autoRemediation ? 'Auto' : 'Manual'}
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#00d4ff]/60"
              animate={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] text-[#4b5563] font-mono tabular-nums">{completed}/{total}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[260px] scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {remediationActions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-5 text-center"
            >
              <p className="text-[0.875rem] text-[#9ca3af]">No actions yet</p>
              <p className="text-[0.875rem] text-[#4b5563] mt-1 leading-[1.6]">
                {autoRemediation ? 'Auto-heal runs when anomalies are detected' : 'Manual mode'}
              </p>
            </motion.div>
          ) : (
            remediationActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  )

  if (variant === 'embedded') {
    return <div className="flex flex-col">{inner}</div>
  }

  return (
    <section className="glass-l2 p-6 md:p-8 flex flex-col gap-3">
      {inner}
    </section>
  )
}
