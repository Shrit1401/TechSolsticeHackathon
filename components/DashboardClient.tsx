'use client'

import { useCallback, useEffect, useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { useSimulation } from '@/hooks/useSimulation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { StatusBar } from '@/components/dashboard/StatusBar'
import { MetricsGrid } from '@/components/dashboard/MetricsGrid'
import { ExpandedModal } from '@/components/dashboard/expanded/ExpandedModal'
import { Toast } from '@/components/ui/Toast'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'

const COMPACT_MODE_KEY = 'aiops-compact-mode'

export default function DashboardClient() {
  const { simulateFailure, toggleAutoRemediation } = useSimulation()
  const { connected, lastEvent } = useWebSocket()
  const systemStatus = useDashboardStore(s => s.systemStatus)

  const [editMode, setEditMode] = useState(false)
  const [expandedId, setExpandedId] = useState<WidgetId | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [compactHydrated, setCompactHydrated] = useState(false)

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(COMPACT_MODE_KEY) === '1') {
        setCompactMode(true)
      }
    } catch {
      /* ignore */
    }
    setCompactHydrated(true)
  }, [])

  useEffect(() => {
    if (!compactHydrated) return
    try {
      localStorage.setItem(COMPACT_MODE_KEY, compactMode ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [compactMode, compactHydrated])

  const statusLabel =
    systemStatus === 'healthy' ? 'System healthy' : systemStatus === 'anomaly' ? 'Attention needed' : 'Recovering'

  const exitCustomizeMode = useCallback(() => {
    setEditMode(false)
    setToastOpen(true)
    window.setTimeout(() => setToastOpen(false), 2000)
  }, [])

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
          <header className="mb-6 max-w-5xl md:mb-8">
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
          </header>

          <LayoutGroup id="dashboard-widgets">
            <MetricsGrid
              editMode={editMode}
              expandedId={expandedId}
              compactMode={compactMode}
              onCompactModeChange={setCompactMode}
              onExpandedChange={setExpandedId}
              onCustomize={() => setEditMode(true)}
              onDone={exitCustomizeMode}
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

        <Toast open={toastOpen} message="Layout saved" />
      </div>
    </>
  )
}
