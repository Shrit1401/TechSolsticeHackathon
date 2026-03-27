'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const statusConfig: Record<SystemStatus, { label: string; textClass: string; dotClass: string }> = {
  healthy: {
    label: 'All systems operational',
    textClass: 'text-[#9ca3af]',
    dotClass: 'bg-[#22c55e]',
  },
  anomaly: {
    label: 'Anomaly detected',
    textClass: 'text-red-400/95',
    dotClass: 'bg-red-500',
  },
  healing: {
    label: 'Auto-healing',
    textClass: 'text-amber-400/90',
    dotClass: 'bg-amber-400',
  },
}

export function StatusBar({ connected, lastEvent, onSimulateFailure, onToggleAutoRemediation }: StatusBarProps) {
  const systemStatus = useDashboardStore(s => s.systemStatus)
  const autoRemediation = useDashboardStore(s => s.autoRemediation)
  const systemStartTime = useDashboardStore(s => s.systemStartTime)
  const lastIncidentTime = useDashboardStore(s => s.lastIncidentTime)
  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)

  const [uptime, setUptime] = useState('')
  const [barHidden, setBarHidden] = useState(false)
  const [barHeight, setBarHeight] = useState(96)
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

      if (y < 28) {
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
          'glass-header-strip fixed top-0 left-0 right-0 z-50',
          'transition-[transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none',
          barHidden && '-translate-y-full pointer-events-none'
        )}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <Activity className="w-[22px] h-[22px] text-[#00d4ff] shrink-0" strokeWidth={2} aria-hidden />
              <span className="font-semibold text-[15px] leading-none text-white tracking-tight">AIOps</span>
              <span className="text-[#4b5563] text-sm hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="text-[#9ca3af] text-[13px] font-medium hidden sm:inline">Control</span>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dotClass)} aria-hidden />
              <AnimatePresence mode="wait">
                <motion.span
                  key={systemStatus}
                  className={cn('text-sm font-medium truncate', cfg.textClass)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {cfg.label}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-[12px]">
            <div className="flex flex-col items-start">
              <span className="section-label">Uptime</span>
              <span className="font-mono text-[13px] text-white mt-1 tabular-nums">{uptime}</span>
            </div>
            <div className="w-px h-9 bg-[#1f2937]" />
            <div className="flex flex-col items-start">
              <span className="section-label">Last incident</span>
              <span
                className={cn(
                  'font-mono text-[13px] mt-1 tabular-nums',
                  lastIncidentTime ? 'text-red-400/90' : 'text-[#9ca3af]'
                )}
              >
                {lastIncidentTime ? new Date(lastIncidentTime).toLocaleTimeString() : 'None'}
              </span>
            </div>
            <div className="w-px h-9 bg-[#1f2937]" />
            <div className="flex flex-col items-start max-w-[220px]">
              <div className="flex items-center gap-2">
                {connected ? (
                  <Wifi className="w-4 h-4 text-[#00d4ff] shrink-0" strokeWidth={2} />
                ) : (
                  <WifiOff className="w-4 h-4 text-amber-500/90 shrink-0" strokeWidth={2} />
                )}
                <span className="section-label">Feed</span>
              </div>
              <AnimatePresence mode="wait">
                {lastEvent && (
                  <motion.span
                    key={lastEvent}
                    className={cn(
                      'font-mono text-[12px] mt-1 truncate max-w-[200px] text-[#9ca3af]',
                      isSimulatingFailure && 'text-red-400/90'
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
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9ca3af]">Auto-heal</span>
              <Switch
                checked={autoRemediation}
                onCheckedChange={onToggleAutoRemediation}
                className="data-[state=checked]:bg-[#00d4ff] data-[state=unchecked]:bg-white/10"
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={onSimulateFailure}
              disabled={isSimulatingFailure}
              className={cn(
                'gap-1.5 text-xs font-medium rounded-full border border-red-500/30',
                'bg-red-500/10 text-red-200/95 backdrop-blur-sm hover:bg-red-500/18',
                'active:scale-[0.97] transition-transform duration-150'
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              {isSimulatingFailure ? 'Active' : 'Simulate failure'}
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
