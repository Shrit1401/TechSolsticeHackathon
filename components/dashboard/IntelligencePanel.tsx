'use client'

import { useDashboardStore } from '@/store/dashboardStore'
import { RootCausePanel } from '@/components/dashboard/RootCausePanel'
import { RemediationPanel } from '@/components/dashboard/RemediationPanel'

/** Merged intelligence layer: root cause + remediation in one glass surface. */
export function IntelligencePanel() {
  const autoRemediation = useDashboardStore(s => s.autoRemediation)

  return (
    <section className="glass-l2 glass-l2-interactive p-6 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-12">
        <div className="min-w-0">
          <h2 className="section-label mb-6">Root cause</h2>
          <RootCausePanel variant="embedded" />
        </div>
        <div className="min-w-0 lg:border-l lg:border-[#1f2937] lg:pl-10">
          <div className="flex items-baseline justify-between gap-3 mb-6">
            <h2 className="section-label">Remediation</h2>
            <span className="text-[11px] font-mono text-[#4b5563] tabular-nums">
              {autoRemediation ? 'Auto' : 'Manual'}
            </span>
          </div>
          <RemediationPanel variant="embedded" />
        </div>
      </div>
    </section>
  )
}
