'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WidgetId } from '@/lib/constants'
import { DEFAULT_WIDGET_ORDER } from '@/lib/constants'
import {
  buildIssues,
  getSortedTileOrder,
  hasAnyIssue,
  orderEquals,
  type IssueRow,
} from '@/lib/priorityScore'
import { buildAllWidgetSnapshots, type MetricSnapshotCtx } from '@/lib/widgetMetricSnapshot'
import { useDashboardStore } from '@/store/dashboardStore'
import { useHealthScore } from '@/hooks/useHealthScore'
import { widgetMeta } from '@/components/dashboard/widgets/widgetContents'

const ADAPTIVE_ENABLED_KEY = 'aiops-adaptive-enabled'
const GRACE_MS = 15_000
/** Exit engaged adaptive layout when dashboard health score (animated) reaches this. */
const HEALTH_SCORE_EXIT_THRESHOLD = 75

export type AdaptivePhase = 'disabled' | 'watching' | 'engaged' | 'restoring'

export type UseAdaptiveModeArgs = {
  order: WidgetId[]
  setOrder: (next: WidgetId[]) => void
  compactMode: boolean
  setCompactMode: (v: boolean) => void
  hydrated: boolean
  editMode: boolean
  setEditMode: (v: boolean) => void
  pushToast: (message: string, ms?: number) => void
}

export type UseAdaptiveModeReturn = {
  isEnabled: boolean
  isEngaged: boolean
  isRestoring: boolean
  phase: AdaptivePhase
  issues: IssueRow[]
  issueCount: number
  toggle: () => void
  getTileClassName: (id: WidgetId) => string
  bannerDismissed: boolean
  dismissBanner: () => void
  notifyManualCompactToggle: (willBeCompact: boolean) => void
  adaptiveLayoutTransition: { duration: number; ease: number[] }
}

function loadEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(ADAPTIVE_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function persistEnabled(on: boolean) {
  try {
    localStorage.setItem(ADAPTIVE_ENABLED_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function useAdaptiveMode({
  order,
  setOrder,
  compactMode,
  setCompactMode,
  hydrated,
  editMode,
  setEditMode,
  pushToast,
}: UseAdaptiveModeArgs): UseAdaptiveModeReturn {
  const { score: healthScore, hasData: healthHasData } = useHealthScore()

  const metrics = useDashboardStore((s) => s.metrics)
  const services = useDashboardStore((s) => s.services)
  const anomalyCount = useDashboardStore((s) => s.anomalies.length)
  const isSimulatingFailure = useDashboardStore((s) => s.isSimulatingFailure)
  const incidentCount = useDashboardStore((s) => s.incidentTimeline.length)

  const [adaptiveHydrated, setAdaptiveHydrated] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const [gaugePulse, setGaugePulse] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setGaugePulse((p) => p + 1), 2000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const f = requestAnimationFrame(() => {
      setEnabled(loadEnabled())
      setAdaptiveHydrated(true)
    })
    return () => cancelAnimationFrame(f)
  }, [])

  const prevSimulatingFailureRef = useRef(false)

  /** Simulate failure → turn adaptive on automatically (same as toggling the button on). */
  useEffect(() => {
    if (!adaptiveHydrated || !hydrated) return
    const was = prevSimulatingFailureRef.current
    prevSimulatingFailureRef.current = isSimulatingFailure
    if (isSimulatingFailure && !was) {
      queueMicrotask(() => {
        setEnabled(true)
        persistEnabled(true)
      })
    }
  }, [isSimulatingFailure, adaptiveHydrated, hydrated])

  const snapshotCtx: MetricSnapshotCtx = useMemo(
    () => ({
      metrics,
      services,
      anomalyCount,
      isSimulatingFailure,
      incidentCount,
      gaugePulse,
    }),
    [metrics, services, anomalyCount, isSimulatingFailure, incidentCount, gaugePulse],
  )

  const snapshots = useMemo(
    () => buildAllWidgetSnapshots(DEFAULT_WIDGET_ORDER, snapshotCtx),
    [snapshotCtx],
  )

  const sortedOrder = useMemo(() => getSortedTileOrder(snapshots), [snapshots])
  const issue = hasAnyIssue(snapshots)
  const issues = useMemo(
    () => buildIssues(snapshots, (id) => widgetMeta(id).title),
    [snapshots],
  )
  const issueCount = issues.length

  const savedOrderRef = useRef<WidgetId[] | null>(null)
  const preEngageCompactRef = useRef(false)
  const adaptiveForcedCompactRef = useRef(false)
  const graceTimerRef = useRef<number | null>(null)
  const engagedRef = useRef(false)
  const restoringRef = useRef(false)
  const userOverrodeCompactRef = useRef(false)
  const firedHealthBasedRestoreRef = useRef(false)

  const orderRef = useRef(order)
  const sortedRef = useRef(sortedOrder)
  const compactRef = useRef(compactMode)
  const editModeRef = useRef(editMode)
  const issueCountRef = useRef(issueCount)

  useLayoutEffect(() => {
    orderRef.current = order
    sortedRef.current = sortedOrder
    compactRef.current = compactMode
    editModeRef.current = editMode
    issueCountRef.current = issueCount
  }, [order, sortedOrder, compactMode, editMode, issueCount])

  const clearGrace = useCallback(() => {
    if (graceTimerRef.current != null) {
      clearTimeout(graceTimerRef.current)
      graceTimerRef.current = null
    }
  }, [])

  const runRestore = useCallback(() => {
      const saved = savedOrderRef.current
      if (saved) {
        setOrder([...saved])
      }
      if (adaptiveForcedCompactRef.current && !userOverrodeCompactRef.current) {
        setCompactMode(preEngageCompactRef.current)
      }
      savedOrderRef.current = null
      adaptiveForcedCompactRef.current = false
      userOverrodeCompactRef.current = false
      engagedRef.current = false
      setEngaged(false)
      setBannerDismissed(false)
      pushToast('✓ Layout restored', 2000)
  }, [setOrder, setCompactMode, pushToast])

  const beginRestoreSequence = useCallback(
    (reason: 'grace' | 'health' = 'grace') => {
      clearGrace()
      setRestoring(true)
      restoringRef.current = true
      pushToast(
        reason === 'health'
          ? 'Health score ≥75 — restoring your layout'
          : '✓ All systems recovered — restoring layout',
        2800,
      )
      window.setTimeout(() => {
        runRestore()
      }, 300)
      window.setTimeout(() => {
        setRestoring(false)
        restoringRef.current = false
      }, 900)
    },
    [clearGrace, pushToast, runRestore],
  )

  const enterEngage = useCallback(() => {
    if (engagedRef.current || restoringRef.current) return
    engagedRef.current = true
    firedHealthBasedRestoreRef.current = false

    const o = orderRef.current
    const so = sortedRef.current
    const cm = compactRef.current
    const em = editModeRef.current
    const ic = issueCountRef.current

    savedOrderRef.current = [...o]
    preEngageCompactRef.current = cm
    userOverrodeCompactRef.current = false
    if (!cm) {
      setCompactMode(true)
      adaptiveForcedCompactRef.current = true
    } else {
      adaptiveForcedCompactRef.current = false
    }
    if (!orderEquals(o, so)) {
      setOrder(so)
    }
    setEngaged(true)
    setBannerDismissed(false)
    if (em) {
      setEditMode(false)
      pushToast('Customize mode exited — adaptive mode engaged', 3200)
    }
    pushToast(`⚡ Adaptive mode engaged — ${ic} issue${ic === 1 ? '' : 's'} detected`, 3000)
  }, [setCompactMode, setOrder, setEditMode, pushToast])

  /* Reactive engagement from live metrics — intentional batched layout updates */
  /* eslint-disable react-hooks/set-state-in-effect -- adaptive war-room state machine */
  useEffect(() => {
    if (!hydrated || !adaptiveHydrated || !enabled) {
      clearGrace()
      return
    }
    if (restoringRef.current) return

    if (
      engagedRef.current &&
      healthHasData &&
      healthScore >= HEALTH_SCORE_EXIT_THRESHOLD &&
      !firedHealthBasedRestoreRef.current
    ) {
      firedHealthBasedRestoreRef.current = true
      clearGrace()
      beginRestoreSequence('health')
      return
    }

    if (issue) {
      clearGrace()
      if (!engagedRef.current) {
        enterEngage()
      } else {
        const cur = orderRef.current
        const next = sortedRef.current
        if (!orderEquals(cur, next)) {
          setOrder(next)
        }
      }
      return
    }

    if (engagedRef.current) {
      if (graceTimerRef.current == null) {
        graceTimerRef.current = window.setTimeout(() => {
          graceTimerRef.current = null
          beginRestoreSequence('grace')
        }, GRACE_MS)
      }
    }
  }, [
    hydrated,
    adaptiveHydrated,
    enabled,
    issue,
    snapshots,
    sortedOrder,
    order,
    setOrder,
    enterEngage,
    clearGrace,
    beginRestoreSequence,
    healthScore,
    healthHasData,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = useCallback(() => {
    if (!enabled) {
      setEnabled(true)
      persistEnabled(true)
      savedOrderRef.current = [...orderRef.current]
      return
    }
    setEnabled(false)
    persistEnabled(false)
    clearGrace()
    if (engagedRef.current) {
      const saved = savedOrderRef.current
      if (saved) {
        setOrder([...saved])
      }
      if (adaptiveForcedCompactRef.current && !userOverrodeCompactRef.current) {
        setCompactMode(preEngageCompactRef.current)
      }
      savedOrderRef.current = null
      adaptiveForcedCompactRef.current = false
      userOverrodeCompactRef.current = false
      engagedRef.current = false
      setEngaged(false)
    }
    setBannerDismissed(false)
  }, [enabled, setOrder, setCompactMode, clearGrace])

  const getTileClassName = useCallback(
    (id: WidgetId): string => {
      if (!engaged || restoring) return ''
      const s = snapshots.find((x) => x.id === id)
      if (!s || s.status === 'healthy') return 'adaptive-tile-healthy-dimmed'
      if (s.status === 'critical') return 'adaptive-tile-critical'
      return 'adaptive-tile-watch'
    },
    [engaged, restoring, snapshots],
  )

  const dismissBanner = useCallback(() => setBannerDismissed(true), [])

  const notifyManualCompactToggle = useCallback((willBeCompact: boolean) => {
    if (!engagedRef.current) return
    userOverrodeCompactRef.current = true
    if (!willBeCompact) {
      adaptiveForcedCompactRef.current = false
    }
  }, [])

  const phase: AdaptivePhase = !enabled
    ? 'disabled'
    : restoring
      ? 'restoring'
      : engaged
        ? 'engaged'
        : 'watching'

  const layoutTransition = useMemo(() => {
    if (restoring) return { duration: 0.6, ease: [0.16, 1, 0.3, 1] as number[] }
    if (engaged && issue) return { duration: 0.4, ease: [0.4, 0, 0.2, 1] as number[] }
    return { duration: 0.5, ease: [0.4, 0, 0.2, 1] as number[] }
  }, [restoring, engaged, issue])

  return {
    isEnabled: adaptiveHydrated && enabled,
    isEngaged: engaged,
    isRestoring: restoring,
    phase,
    issues,
    issueCount,
    toggle,
    getTileClassName,
    bannerDismissed,
    dismissBanner,
    notifyManualCompactToggle,
    adaptiveLayoutTransition: layoutTransition,
  }
}
