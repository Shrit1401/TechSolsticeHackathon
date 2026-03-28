'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { LayoutGrid, LayoutPanelTop } from 'lucide-react'
import { useSimulation } from '@/hooks/useSimulation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { StatusBar } from '@/components/dashboard/StatusBar'
import { MetricsGrid } from '@/components/dashboard/MetricsGrid'
import { AdaptiveModeButton } from '@/components/dashboard/AdaptiveModeButton'
import { HealthScoreProvider } from '@/hooks/useHealthScore'
import { ExpandedModal } from '@/components/dashboard/expanded/ExpandedModal'
import { Toast } from '@/components/ui/Toast'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'
import { cn } from '@/lib/utils'
import { useGridLayout } from '@/hooks/useGridLayout'
import { useAdaptiveMode } from '@/hooks/useAdaptiveMode'

const COMPACT_MODE_KEY = 'aiops-compact-mode'

export default function DashboardClient() {
  return (
    <HealthScoreProvider>
      <DashboardClientInner />
    </HealthScoreProvider>
  )
}

function DashboardClientInner() {
  const { simulateFailure, toggleAutoRemediation } = useSimulation()
  const { connected, lastEvent } = useWebSocket()
  const systemStatus = useDashboardStore(s => s.systemStatus)

  const { order, setOrder, sizes, toggleSize, hydrated: gridHydrated } = useGridLayout()

  const [editMode, setEditMode] = useState(false)
  const [expandedId, setExpandedId] = useState<WidgetId | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimerRef = useRef<number | null>(null)
  const [compactMode, setCompactMode] = useState(false)
  const [compactHydrated, setCompactHydrated] = useState(false)

  const pushToast = useCallback((message: string, ms = 2800) => {
    if (toastTimerRef.current != null) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToastMessage(message)
    setToastOpen(true)
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false)
      toastTimerRef.current = null
    }, ms)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(COMPACT_MODE_KEY) === '1') {
          setCompactMode(true)
        }
      } catch {
        /* ignore */
      }
      setCompactHydrated(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!compactHydrated) return
    try {
      localStorage.setItem(COMPACT_MODE_KEY, compactMode ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [compactMode, compactHydrated])

  const adaptive = useAdaptiveMode({
    order,
    setOrder,
    hydrated: gridHydrated && compactHydrated,
    editMode,
    setEditMode,
    pushToast,
  })

  const statusLabel =
    systemStatus === 'healthy' ? 'System healthy' : systemStatus === 'anomaly' ? 'Attention needed' : 'Recovering'

  const exitCustomizeMode = useCallback(() => {
    setEditMode(false)
    pushToast('Layout saved', 2000)
  }, [pushToast])

  return (
    <>
      {editMode && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Exit layout customization"
          onClick={exitCustomizeMode}
        />
      )}
      <div className="relative z-50 flex min-h-screen flex-col">
        <StatusBar
          connected={connected}
          lastEvent={lastEvent}
          onSimulateFailure={simulateFailure}
          onToggleAutoRemediation={toggleAutoRemediation}
        />

        <main
          className={
            compactMode
              ? 'mx-auto w-full max-w-[1920px] flex-1 px-5 pb-20 pt-6 md:px-6 md:pt-10'
              : 'mx-auto w-full max-w-[1440px] flex-1 px-5 pb-20 pt-6 md:px-6 md:pt-10'
          }
        >
          <header className="mb-6 md:mb-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
              <div className="min-w-0 max-w-5xl">
                <h1 className="text-4xl font-normal leading-[1.08] tracking-[0.06em] text-white [font-family:var(--font-hero-display)] sm:text-5xl md:text-6xl">
                  Distributed system observability
                </h1>
                <p className="mt-4 max-w-xl text-[0.875rem] leading-[1.6] text-[#9ca3af]">
                  Digital twin monitoring, anomaly detection, and auto-remediation.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--bg-card)]/80 px-3 py-1.5 [font-family:var(--font-ui)]">
                  <span
                    className={
                      systemStatus === 'healthy'
                        ? 'h-2 w-2 rounded-full bg-[var(--accent-green)] shadow-[0_0_10px_rgba(0,200,83,0.5)]'
                        : systemStatus === 'anomaly'
                          ? 'h-2 w-2 rounded-full bg-[var(--accent-red)]'
                          : 'h-2 w-2 rounded-full bg-[var(--accent-amber)]'
                    }
                  />
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">{statusLabel}</span>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col items-end lg:w-auto">
                <div className="mt-6 flex w-[min(100%,280px)] flex-col gap-2 lg:mt-0">
                  <AdaptiveModeButton
                    enabled={adaptive.isEnabled}
                    engaged={adaptive.isEngaged}
                    restoring={adaptive.isRestoring}
                    onClick={adaptive.toggle}
                  />
                  <button
                    type="button"
                    onClick={() => setCompactMode(!compactMode)}
                    className={cn(
                      'inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full border px-5 py-3 text-[0.9375rem] font-medium shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors [font-family:var(--font-ui)]',
                      compactMode
                        ? 'border-white/[0.22] bg-white/[0.08] text-white hover:border-white/[0.28] hover:bg-white/[0.12]'
                        : 'border-white/[0.1] bg-black text-[#e5e7eb] hover:border-white/[0.18] hover:bg-black',
                    )}
                    aria-pressed={compactMode}
                  >
                    <LayoutPanelTop className="size-[1.125rem] opacity-90" strokeWidth={1.75} aria-hidden />
                    Compact mode
                  </button>
                  <button
                    type="button"
                    disabled={adaptive.isEngaged}
                    onClick={() => {
                      if (adaptive.isEngaged) {
                        pushToast('Disable adaptive mode to customize layout', 3200)
                        return
                      }
                      if (editMode) {
                        exitCustomizeMode()
                      } else {
                        setEditMode(true)
                      }
                    }}
                    className={cn(
                      'inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-black px-5 py-3 text-[0.9375rem] font-medium text-[#e5e7eb] shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors hover:border-white/[0.18] hover:bg-black [font-family:var(--font-ui)]',
                      adaptive.isEngaged && 'cursor-not-allowed opacity-45 hover:border-white/[0.1] hover:bg-black',
                    )}
                  >
                    <LayoutGrid className="size-[1.125rem] opacity-90" strokeWidth={1.75} aria-hidden />
                    {editMode ? 'Done' : 'Customize'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <LayoutGroup id="dashboard-widgets">
            <MetricsGrid
              order={order}
              setOrder={setOrder}
              sizes={sizes}
              toggleSize={toggleSize}
              hydrated={gridHydrated}
              editMode={editMode}
              expandedId={expandedId}
              compactMode={compactMode}
              onExpandedChange={setExpandedId}
              adaptiveEngaged={adaptive.isEngaged}
              adaptiveRestoring={adaptive.isRestoring}
              adaptiveEnabled={adaptive.isEnabled}
              showAdaptiveChrome={adaptive.showAdaptiveChrome}
              getTileAdaptiveStatus={adaptive.getTileStatus}
              adaptiveLayoutTransition={adaptive.adaptiveLayoutTransition}
              issues={adaptive.issues}
            />
            <ExpandedModal
              widgetId={expandedId}
              open={expandedId !== null}
              onOpenChange={o => {
                if (!o) setExpandedId(null)
              }}
            />
          </LayoutGroup>

          <footer className="mt-14 flex flex-col gap-2 border-t border-white/[0.1] pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[11px] text-[#4b5563]">AI Observability · simulation</p>
            <p className="font-mono text-[11px] text-[#4b5563]">Refresh 2s</p>
          </footer>
        </main>

        <Toast open={toastOpen} message={toastMessage} />
      </div>
    </>
  )
}
