'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { formatRelativeTime } from '@/lib/utils'
import type { AnomalySeverity } from '@/lib/types'

const severityLabel: Record<AnomalySeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function AnomalyPanel() {
  const anomalies = useDashboardStore(s => s.anomalies)
  const hasIssues = anomalies.length > 0

  return (
    <div className="relative">
      {!hasIssues ? (
        <div className="glass-l1 rounded-2xl px-6 py-10 text-center border border-white/[0.1]">
          <Check className="w-5 h-5 text-[#00d4ff]/80 mx-auto mb-3" strokeWidth={1.75} aria-hidden />
          <p className="text-[0.875rem] text-[#9ca3af]">No anomalies</p>
          <p className="text-[0.875rem] leading-[1.6] text-[#4b5563] mt-2 max-w-[220px] mx-auto">
            Operating within thresholds
          </p>
        </div>
      ) : (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="glass-l2 rounded-2xl p-6 border border-red-500/35"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="section-label !text-red-400/90">Anomalies</h3>
            <span className="text-[11px] font-mono text-red-400/80 tabular-nums">{anomalies.length}</span>
          </div>
          <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {anomalies.map(anomaly => (
                <motion.div
                  key={anomaly.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-white/[0.1] glass-l1 px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/90">
                      {severityLabel[anomaly.severity]}
                    </span>
                    <span className="ml-auto text-[10px] text-[#4b5563] font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(anomaly.timestamp)}
                    </span>
                  </div>
                  <p className="text-[0.875rem] text-[#9ca3af] leading-snug">{anomaly.message}</p>
                  <p className="text-[11px] text-[#4b5563] font-mono mt-1.5">{anomaly.service}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </div>
  )
}
