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
import { adaptiveMetricsFreezeRef } from '@/lib/adaptiveMetricsFreeze'

const ADAPTIVE_ENABLED_KEY = 'aiops-adaptive-enabled'
const GRACE_MS = 30_000
const HEALTH_SCORE_EXIT_THRESHOLD = 75
const HEALTH_EXIT_ENGAGE_GRACE_MS = 2_000
const ADAPTIVE_GAUGE_PULSE_MS = 5_000
const STATUS_RESORT_DEBOUNCE_MS = 5_000
const RESORT_ANIM_MS = 800
const RESTORE_APPLY_ORDER_MS = 600
const RESTORE_LAYOUT_SETTLE_MS = 700

export type AdaptivePhase = 'disabled' | 'watching' | 'engaged' | 'restoring'

export type UseAdaptiveModeArgs = {
  order: WidgetId[]
  setOrder: (next: WidgetId[], options?: { persist?: boolean }) => void
  hydrated: boolean
  editMode: boolean
  setEditMode: (v: boolean) => void
  pushToast: (message: string, ms?: number) => void
}

export type UseAdaptiveModeReturn = {
  isEnabled: boolean
  isEngaged: boolean
  isAnimating: boolean
  isRestoring: boolean
  phase: AdaptivePhase
  issues: IssueRow[]
  issueCount: number
  sortedTileOrder: WidgetId[]
  toggle: () => void
  getTileStatus: (id: WidgetId) => 'critical' | 'watch' | 'healthy'
  showAdaptiveChrome: boolean
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

function statusFingerprint(
  snapshots: { id: WidgetId; status: 'healthy' | 'watch' | 'critical' }[],
): string {
  return DEFAULT_WIDGET_ORDER.map((id) => snapshots.find((s) => s.id === id)?.status ?? 'healthy').join(
    '|',
  )
}

export function useAdaptiveMode({
  order,
  setOrder,
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
  const [healthExitGateEpoch, setHealthExitGateEpoch] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const [gaugePulse, setGaugePulse] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setGaugePulse((p) => p + 1), ADAPTIVE_GAUGE_PULSE_MS)
    return () => window.clearInterval(id)
  }, [enabled])

  useEffect(() => {
    adaptiveMetricsFreezeRef.current = isAnimating
  }, [isAnimating])

  useEffect(() => {
    const f = requestAnimationFrame(() => {
      setEnabled(loadEnabled())
      setAdaptiveHydrated(true)
    })
    return () => cancelAnimationFrame(f)
  }, [])

  const prevSimulatingFailureRef = useRef(false)
  const savedAdaptiveEnabledRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (!adaptiveHydrated || !hydrated) return
    const was = prevSimulatingFailureRef.current
    prevSimulatingFailureRef.current = isSimulatingFailure
    if (isSimulatingFailure && !was) {
      savedAdaptiveEnabledRef.current = loadEnabled()
      queueMicrotask(() => {
        setEnabled(true)
        persistEnabled(true)
      })
    }
  }, [isSimulatingFailure, adaptiveHydrated, hydrated])

  const hysteresisPrevRef = useRef<Partial<Record<WidgetId, 'healthy' | 'watch' | 'critical'>>>({})

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
    () => buildAllWidgetSnapshots(DEFAULT_WIDGET_ORDER, snapshotCtx, hysteresisPrevRef.current),
    [snapshotCtx],
  )

  useLayoutEffect(() => {
    for (const s of snapshots) {
      hysteresisPrevRef.current[s.id] = s.status
    }
  }, [snapshots])

  const snapshotsRef = useRef(snapshots)
  useLayoutEffect(() => {
    snapshotsRef.current = snapshots
  }, [snapshots])

  const sortedOrder = useMemo(() => getSortedTileOrder(snapshots), [snapshots])
  const issue = hasAnyIssue(snapshots)
  const issues = useMemo(
    () => buildIssues(snapshots, (id) => widgetMeta(id).title),
    [snapshots],
  )
  const issueCount = issues.length

  const savedOrderRef = useRef<WidgetId[] | null>(null)
  const graceTimerRef = useRef<number | null>(null)
  const engagedRef = useRef(false)
  const restoringRef = useRef(false)
  const firedHealthBasedRestoreRef = useRef(false)
  const healthExitAllowedAfterRef = useRef(0)
  const lastSortFingerprintRef = useRef<string>('')
  const resortDebounceTimerRef = useRef<number | null>(null)
  /** Fingerprint we’re waiting on for debounced resort; only reset timer when this changes. */
  const debounceTargetFpRef = useRef<string | null>(null)

  const orderRef = useRef(order)
  const sortedRef = useRef(sortedOrder)
  const editModeRef = useRef(editMode)
  const issueCountRef = useRef(issueCount)

  useLayoutEffect(() => {
    orderRef.current = order
    sortedRef.current = sortedOrder
    editModeRef.current = editMode
    issueCountRef.current = issueCount
  }, [order, sortedOrder, editMode, issueCount])

  const clearGrace = useCallback(() => {
    if (graceTimerRef.current != null) {
      clearTimeout(graceTimerRef.current)
      graceTimerRef.current = null
    }
  }, [])

  const clearResortDebounce = useCallback(() => {
    if (resortDebounceTimerRef.current != null) {
      clearTimeout(resortDebounceTimerRef.current)
      resortDebounceTimerRef.current = null
    }
  }, [])

  const applyResortedOrder = useCallback(
    (next: WidgetId[]) => {
      if (orderEquals(orderRef.current, next)) return
      setIsAnimating(true)
      setOrder(next, { persist: false })
      window.setTimeout(() => setIsAnimating(false), RESORT_ANIM_MS)
    },
    [setOrder],
  )

  const runRestore = useCallback(() => {
    const saved = savedOrderRef.current
    if (saved) {
      setOrder([...saved])
    }
    savedOrderRef.current = null
    engagedRef.current = false
    setEngaged(false)
    const pref = savedAdaptiveEnabledRef.current
    savedAdaptiveEnabledRef.current = null
    if (pref !== null) {
      queueMicrotask(() => {
        setEnabled(pref)
        persistEnabled(pref)
      })
    }
    lastSortFingerprintRef.current = ''
    clearResortDebounce()
  }, [setOrder, clearResortDebounce])

  const beginRestoreSequence = useCallback(
    (_reason: 'grace' | 'health' = 'grace') => {
      clearGrace()
      clearResortDebounce()
      debounceTargetFpRef.current = null
      setRestoring(true)
      restoringRef.current = true
      window.setTimeout(() => {
        runRestore()
        pushToast('✓ Layout restored', 2000)
        window.setTimeout(() => {
          setRestoring(false)
          restoringRef.current = false
        }, RESTORE_LAYOUT_SETTLE_MS)
      }, RESTORE_APPLY_ORDER_MS)
    },
    [clearGrace, clearResortDebounce, pushToast, runRestore],
  )

  const enterEngage = useCallback(() => {
    if (engagedRef.current || restoringRef.current) return
    engagedRef.current = true
    firedHealthBasedRestoreRef.current = false
    if (savedAdaptiveEnabledRef.current === null) {
      savedAdaptiveEnabledRef.current = true
    }

    const o = orderRef.current
    const so = sortedRef.current
    const em = editModeRef.current
    const ic = issueCountRef.current
    const snap = snapshotsRef.current

    savedOrderRef.current = [...o]
    if (!orderEquals(o, so)) {
      applyResortedOrder(so)
    }
    lastSortFingerprintRef.current = statusFingerprint(snap)

    setEngaged(true)
    if (em) {
      setEditMode(false)
      pushToast('Customize mode exited — adaptive mode engaged', 3200)
    }
    pushToast(`⚡ Adaptive mode engaged — ${ic} issue${ic === 1 ? '' : 's'} detected`, 2800)
    healthExitAllowedAfterRef.current = Date.now() + HEALTH_EXIT_ENGAGE_GRACE_MS
    window.setTimeout(() => setHealthExitGateEpoch((e) => e + 1), HEALTH_EXIT_ENGAGE_GRACE_MS)
  }, [setEditMode, pushToast, applyResortedOrder])

  /* eslint-disable react-hooks/set-state-in-effect -- adaptive state machine */
  useEffect(() => {
    if (!hydrated || !adaptiveHydrated || !enabled) {
      clearGrace()
      clearResortDebounce()
      return
    }
    if (restoringRef.current) return

    if (
      engagedRef.current &&
      healthHasData &&
      healthScore >= HEALTH_SCORE_EXIT_THRESHOLD &&
      !firedHealthBasedRestoreRef.current &&
      Date.now() >= healthExitAllowedAfterRef.current
    ) {
      firedHealthBasedRestoreRef.current = true
      clearGrace()
      clearResortDebounce()
      beginRestoreSequence('health')
      return
    }

    if (issue) {
      clearGrace()
      if (!engagedRef.current) {
        enterEngage()
      } else {
        const fp = statusFingerprint(snapshots)
        if (fp === lastSortFingerprintRef.current) {
          clearResortDebounce()
          debounceTargetFpRef.current = null
        } else if (debounceTargetFpRef.current !== fp) {
          debounceTargetFpRef.current = fp
          clearResortDebounce()
          resortDebounceTimerRef.current = window.setTimeout(() => {
            resortDebounceTimerRef.current = null
            debounceTargetFpRef.current = null
            const latest = snapshotsRef.current
            const fpDone = statusFingerprint(latest)
            if (fpDone === lastSortFingerprintRef.current) return
            lastSortFingerprintRef.current = fpDone
            applyResortedOrder(getSortedTileOrder(latest))
          }, STATUS_RESORT_DEBOUNCE_MS)
        }
      }
      return
    }

    clearResortDebounce()
    debounceTargetFpRef.current = null
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
    enterEngage,
    clearGrace,
    clearResortDebounce,
    beginRestoreSequence,
    healthScore,
    healthHasData,
    healthExitGateEpoch,
    applyResortedOrder,
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
    clearResortDebounce()
    savedAdaptiveEnabledRef.current = null
    if (engagedRef.current) {
      const saved = savedOrderRef.current
      if (saved) {
        setOrder([...saved])
      }
      savedOrderRef.current = null
      engagedRef.current = false
      setEngaged(false)
    }
    lastSortFingerprintRef.current = ''
    debounceTargetFpRef.current = null
  }, [enabled, setOrder, clearGrace, clearResortDebounce])

  const getTileStatus = useCallback(
    (id: WidgetId): 'critical' | 'watch' | 'healthy' => {
      const s = snapshots.find((x) => x.id === id)
      return s?.status ?? 'healthy'
    },
    [snapshots],
  )

  const showAdaptiveChrome = engaged && !restoring

  const phase: AdaptivePhase = !enabled
    ? 'disabled'
    : restoring
      ? 'restoring'
      : engaged
        ? 'engaged'
        : 'watching'

  const layoutTransition = useMemo(() => {
    if (restoring) {
      return { duration: RESTORE_LAYOUT_SETTLE_MS / 1000, ease: [0.16, 1, 0.3, 1] as number[] }
    }
    if (isAnimating || (engaged && issue)) {
      return { duration: 0.6, ease: [0.25, 1, 0.5, 1] as number[] }
    }
    return { duration: 0.5, ease: [0.4, 0, 0.2, 1] as number[] }
  }, [restoring, isAnimating, engaged, issue])

  return {
    isEnabled: adaptiveHydrated && enabled,
    isEngaged: engaged,
    isAnimating,
    isRestoring: restoring,
    phase,
    issues,
    issueCount,
    sortedTileOrder: order,
    toggle,
    getTileStatus,
    showAdaptiveChrome,
    adaptiveLayoutTransition: layoutTransition,
  }
}
