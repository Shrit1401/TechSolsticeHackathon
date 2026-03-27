'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Wifi, WifiOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useDashboardStore } from '@/store/dashboardStore'
import { formatUptime } from '@/lib/utils'
import type { SystemStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StatusBarProps {
  connected: boolean
  lastEvent: string | null
  onSimulateFailure: () => void
  onToggleAutoRemediation: () => void
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

function MetricCell({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'group relative min-w-0 rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-200',
        'hover:border-[var(--accent-cyan)]/25 hover:shadow-[0_0_24px_rgba(0,212,255,0.08)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-cyan)]/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)] xl:text-[0.6875rem]">
        {label}
      </span>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  )
}

export function StatusBar({
  connected,
  lastEvent,
  onSimulateFailure,
  onToggleAutoRemediation,
}: StatusBarProps) {
  const systemStatus = useDashboardStore(s => s.systemStatus)
  const autoRemediation = useDashboardStore(s => s.autoRemediation)
  const systemStartTime = useDashboardStore(s => s.systemStartTime)
  const lastIncidentTime = useDashboardStore(s => s.lastIncidentTime)
  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)

  const [uptime, setUptime] = useState('')
  const [barHidden, setBarHidden] = useState(false)
  const [barHeight, setBarHeight] = useState(112)
  const headerRef = useRef<HTMLElement>(null)
  const lastScrollY = useRef(0)
  const scrollRaf = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => setUptime(formatUptime(systemStartTime))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [systemStartTime])

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setBarHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    lastScrollY.current = window.scrollY

    const applyScroll = () => {
      scrollRaf.current = null
      const y = window.scrollY
      const delta = y - lastScrollY.current
      lastScrollY.current = y

      if (y < 40) {
        setBarHidden(false)
        return
      }
      if (delta >= 6) setBarHidden(true)
      else if (delta <= -6) setBarHidden(false)
    }

    const onScroll = () => {
      if (scrollRaf.current != null) return
      scrollRaf.current = window.requestAnimationFrame(applyScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollRaf.current != null) window.cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  const cfg = statusConfig[systemStatus]
  const spacerH = Math.max(barHeight, 64)

  return (
    <>
      <div aria-hidden className="shrink-0" style={{ height: spacerH }} />
      <header
        ref={headerRef}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 border-b border-white/[0.07]',
          'bg-[linear-gradient(180deg,rgba(6,8,12,0.92)_0%,rgba(0,0,0,0.88)_48%,rgba(0,0,0,0.94)_100%)]',
          'shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)]',
          'backdrop-blur-2xl backdrop-saturate-[1.35]',
          'transition-[transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent-cyan)]/45 before:to-transparent',
          barHidden && '-translate-y-full pointer-events-none'
        )}
      >
        <div className="relative mx-auto flex max-w-[1600px] min-w-0 flex-nowrap items-center justify-between gap-3 px-4 py-3 md:gap-5 md:px-6 md:py-3.5">
          {/* Brand */}
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-black/50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:gap-3 sm:px-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-cyan)]/12 ring-1 ring-[var(--accent-cyan)]/30">
                <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgba(0,212,255,0.35),transparent_55%)]" />
                <Activity className="relative h-5 w-5 text-[var(--accent-cyan)] sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 leading-none">
                <span className="block text-[1.0625rem] font-semibold tracking-tight text-white sm:text-[1.125rem]">
                  RecoX
                </span>
                <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Control
                </span>
              </div>
            </div>

            <div
              className={cn(
                'flex min-w-0 max-w-[min(100%,11rem)] items-center gap-2 rounded-full border px-2.5 py-1.5 sm:max-w-[14rem] sm:px-3 sm:py-2 md:max-w-[18rem] md:gap-2.5 md:px-3.5',
                cfg.ringClass
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', cfg.dotClass)} aria-hidden />
              <AnimatePresence mode="wait">
                <motion.span
                  key={systemStatus}
                  className={cn('truncate text-[0.8125rem] font-medium leading-snug md:text-[0.9375rem]', cfg.textClass)}
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

          {/* Metrics strip */}
          <div className="hidden min-h-0 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-1 lg:flex xl:gap-3">
            <MetricCell label="Uptime">
              <span className="text-base font-semibold tabular-nums tracking-tight text-white [font-family:var(--font-ui)] xl:text-lg">
                {uptime}
              </span>
            </MetricCell>
            <div
              className="hidden h-11 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block"
              aria-hidden
            />
            <MetricCell label="Last incident">
              <span
                className={cn(
                  'text-base font-semibold tabular-nums tracking-tight [font-family:var(--font-ui)] xl:text-lg',
                  lastIncidentTime ? 'text-red-400' : 'text-[var(--text-secondary)]'
                )}
              >
                {lastIncidentTime ? new Date(lastIncidentTime).toLocaleTimeString() : 'None'}
              </span>
            </MetricCell>
            <div
              className="hidden h-11 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block"
              aria-hidden
            />
            <MetricCell label="Feed" className="max-w-[min(100%,220px)] flex-1 xl:max-w-[260px]">
              <div className="flex items-center gap-2">
                {connected ? (
                  <Wifi className="h-4 w-4 shrink-0 text-[var(--accent-cyan)]" strokeWidth={2} />
                ) : (
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-500/90" strokeWidth={2} />
                )}
                <AnimatePresence mode="wait">
                  {lastEvent && (
                    <motion.span
                      key={lastEvent}
                      className={cn(
                        'truncate text-[0.8125rem] leading-snug [font-family:var(--font-ui)] xl:text-[0.875rem]',
                        isSimulatingFailure ? 'text-red-400' : 'text-[var(--text-secondary)]'
                      )}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {lastEvent}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </MetricCell>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] py-1.5 pl-3 pr-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:gap-2.5 md:pl-3.5 md:pr-2.5">
              <span className="hidden text-[0.8125rem] text-[var(--text-secondary)] sm:inline">Auto-heal</span>
              <Switch
                checked={autoRemediation}
                onCheckedChange={onToggleAutoRemediation}
                className="scale-105 data-[state=checked]:bg-[var(--accent-cyan)] data-[state=unchecked]:bg-white/10"
              />
            </div>
            <Button
              variant="destructive"
              size="default"
              onClick={onSimulateFailure}
              disabled={isSimulatingFailure}
              className={cn(
                'h-10 gap-2 rounded-full border border-red-500/35 px-4 text-[0.8125rem] font-medium',
                'bg-gradient-to-b from-red-500/25 to-red-950/40 text-red-100',
                'shadow-[0_0_24px_rgba(239,68,68,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
                'backdrop-blur-sm hover:from-red-500/35 hover:to-red-950/50 hover:border-red-400/40',
                'transition-all duration-200 active:scale-[0.97]'
              )}
            >
              <Zap className="h-4 w-4 opacity-95" />
              <span className="hidden sm:inline">{isSimulatingFailure ? 'Active' : 'Simulate failure'}</span>
              <span className="sm:hidden">{isSimulatingFailure ? 'On' : 'Fail'}</span>
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
