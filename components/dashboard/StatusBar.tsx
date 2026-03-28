'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import type { SystemStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { TaskbarHealthScore } from '@/components/dashboard/health-score/TaskbarHealthScore'
import { useScrolled } from '@/hooks/useScrolled'

interface StatusBarProps {
  connected: boolean
}

const statusConfig: Record<SystemStatus, { label: string; textClass: string; dotClass: string; ringClass: string }> = {
  healthy: {
    label: 'All systems operational',
    textClass: 'text-emerald-200/90',
    dotClass: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]',
    ringClass: 'border-emerald-500/25 bg-emerald-500/[0.07]',
  },
  anomaly: {
    label: 'Anomaly detected',
    textClass: 'text-red-300',
    dotClass: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
    ringClass: 'border-red-500/30 bg-red-500/[0.08]',
  },
  healing: {
    label: 'Auto-healing',
    textClass: 'text-amber-300/95',
    dotClass: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]',
    ringClass: 'border-amber-500/30 bg-amber-500/[0.08]',
  },
}

export function StatusBar({ connected }: StatusBarProps) {
  const systemStatus = useDashboardStore(s => s.systemStatus)
  const scrolled = useScrolled(50)
  const cfg = statusConfig[systemStatus]

  return (
    <header
      className={cn(
        'sticky top-0 z-50 overflow-visible border-b transition-[background-color,border-color,backdrop-filter] duration-300',
        'backdrop-blur-[16px] backdrop-saturate-[1.2] [-webkit-backdrop-filter:blur(16px)_saturate(1.2)]',
        'min-h-14 px-4 py-2.5 md:px-6 md:py-3',
        scrolled
          ? 'border-white/[0.08] bg-[rgba(5,10,18,0.9)]'
          : 'border-white/[0.03] bg-[rgba(5,10,18,0.6)]',
        'shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent-cyan)]/45 before:to-transparent',
      )}
    >
      <div className="relative mx-auto flex max-w-[1600px] min-h-[56px] min-w-0 items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-black/50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-cyan)]/12 ring-1 ring-[var(--accent-cyan)]/30">
              <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgba(0,212,255,0.35),transparent_55%)]" />
              <Activity className="relative h-4 w-4 text-[var(--accent-cyan)]" strokeWidth={2} aria-hidden />
            </div>
            <span className="text-[1rem] font-semibold tracking-tight text-white">RecoX</span>
          </div>

          {/* Status badge */}
          <div
            className={cn(
              'hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5',
              cfg.ringClass
            )}
          >
            <span className={cn('size-2 shrink-0 rounded-full', cfg.dotClass)} aria-hidden />
            <AnimatePresence mode="wait">
              <motion.span
                key={systemStatus}
                className={cn('text-[0.8125rem] font-medium leading-snug', cfg.textClass)}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {cfg.label}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Right: health score + connection */}
        <div className="flex items-center gap-3">
          <TaskbarHealthScore />
          <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
            {connected ? (
              <Wifi className="h-3.5 w-3.5 text-[var(--accent-cyan)]" strokeWidth={2} />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-500/90" strokeWidth={2} />
            )}
            <span className="hidden text-[0.75rem] text-[var(--text-tertiary)] sm:block">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
