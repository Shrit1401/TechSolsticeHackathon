'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useDashboardStore } from '@/store/dashboardStore'
import type { IncidentEventType } from '@/lib/types'
import { cn } from '@/lib/utils'

const eventLabel: Record<IncidentEventType, string> = {
  failure: 'Failure',
  'anomaly-detected': 'Anomaly',
  'rca-complete': 'Root cause',
  'remediation-started': 'Remediation',
  recovery: 'Recovered',
}

function labelClass(type: IncidentEventType): string {
  if (type === 'failure') return 'text-red-400/90'
  if (type === 'recovery') return 'text-emerald-400/85'
  return 'text-[#9ca3af]'
}

export function IncidentTimeline() {
  const incidentTimeline = useDashboardStore(s => s.incidentTimeline)

  return (
    <section className="glass-l2 glass-l2-interactive p-6 md:p-8">
      {incidentTimeline.length === 0 ? (
        <p className="text-[0.875rem] leading-[1.6] text-[#4b5563] py-1">No incidents recorded.</p>
      ) : (
        <ul className="flex flex-col gap-0 divide-y divide-white/[0.08]">
          <AnimatePresence initial={false}>
            {incidentTimeline.map(ev => (
              <motion.li
                key={ev.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 py-4 first:pt-0 last:pb-0"
              >
                <span className={cn('text-[12px] font-semibold shrink-0 w-32', labelClass(ev.type))}>
                  {eventLabel[ev.type]}
                </span>
                <span className="text-[0.875rem] leading-[1.6] text-[#9ca3af] flex-1 min-w-0">{ev.description}</span>
                <time className="text-[11px] font-mono text-[#4b5563] shrink-0 tabular-nums sm:ml-auto">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </time>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
