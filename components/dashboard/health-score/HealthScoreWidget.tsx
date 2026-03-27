'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHealthScore } from '@/hooks/useHealthScore'
import { useDashboardStore } from '@/store/dashboardStore'
import type { WidgetId } from '@/lib/constants'
import { anomalyScoreFromStore, gaugeValue } from '@/lib/widgetMockData'
import { cn } from '@/lib/utils'
import { ScoreRing } from './ScoreRing'
import { ScoreLabel } from './ScoreLabel'
import { SubScorePills } from './SubScorePills'
import { HealthScoreTooltip } from './HealthScoreTooltip'
import { HealthScoreExpanded } from './HealthScoreExpanded'

function useRingSize() {
  const [size, setSize] = useState(220)
  useEffect(() => {
    const read = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1280
      if (w < 768) setSize(180)
      else if (w < 1280) setSize(220)
      else setSize(280)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return size
}

function scrollToWidget(id: WidgetId) {
  const el = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('ring-2', 'ring-[var(--accent-cyan)]/50', 'ring-offset-2', 'ring-offset-black')
  window.setTimeout(() => {
    el.classList.remove('ring-2', 'ring-[var(--accent-cyan)]/50', 'ring-offset-2', 'ring-offset-black')
  }, 1600)
}

export function HealthScoreWidget() {
  const ringSize = useRingSize()
  const { score, breakdown, label, color, trend, history, lastUpdated, stale, hasData } = useHealthScore()
  const metrics = useDashboardStore(s => s.metrics)
  const anomalies = useDashboardStore(s => s.anomalies)
  const isSimulatingFailure = useDashboardStore(s => s.isSimulatingFailure)

  const [hover, setHover] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState(false)

  const cold = !hasData

  useEffect(() => {
    const onSharp = () => {
      setFlash(true)
      window.setTimeout(() => setFlash(false), 520)
    }
    window.addEventListener('health-score-sharp-drop', onSharp)
    return () => window.removeEventListener('health-score-sharp-drop', onSharp)
  }, [])

  const metricTime = useMemo(() => {
    let m = 0
    for (const p of metrics.requestRate) m = Math.max(m, p.timestamp)
    for (const p of metrics.errorRate) m = Math.max(m, p.timestamp)
    for (const p of metrics.latency) m = Math.max(m, p.timestamp)
    return m
  }, [metrics])

  const rawPreview = useMemo(() => {
    const t = metricTime
    const rr = metrics.requestRate
    const er = metrics.errorRate
    const lat = metrics.latency
    const requestRate = rr.length ? rr[rr.length - 1]!.value : 0
    const errorRate = er.length ? er[er.length - 1]!.value : 0
    const latencyP99 = lat.length ? lat[lat.length - 1]!.value : 0
    const baseline =
      rr.length > 0 ? rr.reduce((a, p) => a + p.value, 0) / rr.length : requestRate || 1
    const devPct = baseline > 0 ? (Math.abs(requestRate - baseline) / baseline) * 100 : 0
    const cpu = gaugeValue(t, 'cpu')
    const mem = gaugeValue(t + 99, 'mem')
    const an = anomalyScoreFromStore(anomalies.length, isSimulatingFailure)
    return {
      latency: `P99 ${Math.round(latencyP99)} ms`,
      errors: `Error rate ${errorRate.toFixed(2)}%`,
      throughput: `Req/s ${requestRate.toFixed(0)} · ${devPct.toFixed(1)}% deviation vs baseline`,
      cpu: `CPU ${cpu.toFixed(1)}%`,
      memory: `Memory ${mem.toFixed(1)}%`,
      anomaly: `Anomaly signal ${(an * 100).toFixed(0)}%`,
    }
  }, [metrics, metricTime, anomalies.length, isSimulatingFailure])

  const onPillClick = useCallback((id: WidgetId) => scrollToWidget(id), [])

  const glowRgb = useMemo(() => {
    const h = color.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `${r},${g},${b}`
  }, [color])

  const interactive = !cold

  return (
    <section
      className="relative flex flex-col items-center py-12 md:py-16 [font-family:var(--font-ui)]"
      aria-label="Infrastructure health score"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(100vw,400px)] w-[min(100vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-100 blur-3xl"
        style={{ background: `radial-gradient(circle, rgba(${glowRgb},0.06) 0%, transparent 70%)` }}
      />

      <div
        className={cn(
          'relative rounded-full transition-shadow duration-300',
          flash && 'motion-safe:animate-[health-score-flash_0.5s_ease-out_forwards]'
        )}
        onMouseEnter={() => interactive && setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <motion.div layoutId="health-score-orb" className="relative inline-block rounded-full">
          <button
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setExpanded(true)}
            className={cn(
              'relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/40',
              !interactive && 'cursor-default'
            )}
            aria-label={interactive ? 'Open health score details' : undefined}
          >
            <div className="relative" style={{ width: ringSize, height: ringSize }}>
              {score >= 100 && !cold && (
                <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
                  {[0, 1, 2, 3].map(i => {
                    const deg = (i / 4) * 360
                    return (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${ringSize * 0.48}px)`,
                        }}
                      >
                        <motion.span
                          className="block size-1.5 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                          animate={{ opacity: [0.2, 0.95, 0.2], scale: [0.85, 1.12, 0.85] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.22 }}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
              <ScoreRing
                size={ringSize}
                score={cold ? 0 : score}
                color={color}
                cold={cold}
                stale={stale}
                pulseCritical={!cold && score < 40}
                className="relative z-[1]"
              />
              <ScoreLabel score={score} label={label} color={color} trend={trend} cold={cold} stale={stale} />
            </div>
          </button>
        </motion.div>

        <AnimatePresence>
          {hover && interactive && (
            <HealthScoreTooltip breakdown={breakdown} lastUpdated={lastUpdated} />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 w-full max-w-4xl px-2">
        <SubScorePills
          breakdown={breakdown}
          rawPreview={rawPreview}
          onPillClick={onPillClick}
          disabled={cold}
        />
      </div>

      <HealthScoreExpanded
        open={expanded}
        onOpenChange={setExpanded}
        score={score}
        color={color}
        breakdown={breakdown}
        history={history}
        lastUpdated={lastUpdated}
      />
    </section>
  )
}
