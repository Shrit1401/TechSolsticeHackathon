'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { LayoutGroup } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRealDashboard } from '@/hooks/useRealDashboard'
import { useDashboardHealth } from '@/hooks/useDashboardHealth'
import { useWebSocket } from '@/hooks/useWebSocket'
import { StatusBar } from '@/components/dashboard/StatusBar'
import { MetricsGrid } from '@/components/dashboard/MetricsGrid'
import { HealthScoreProvider } from '@/hooks/useHealthScore'
import { ExpandedModal } from '@/components/dashboard/expanded/ExpandedModal'
import { LogsPanel } from '@/components/dashboard/LogsPanel'
import { SparkLine } from '@/components/ui/SparkLine'
import type { WidgetId } from '@/lib/constants'
import { useDashboardStore } from '@/store/dashboardStore'
import { useGridLayout } from '@/hooks/useGridLayout'
import type { MetricPoint } from '@/lib/types'

// ── Simulate Panel ───────────────────────────────────────────────────────────
type SimSettings = {
  duration: number
  errorRate: number
  targetService: string
  rps: number
}

function SimulatePanel() {
  const [open, setOpen] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [settings, setSettings] = useState<SimSettings>({ duration: 60, errorRate: 60, targetService: 'all', rps: 100 })
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const services = useDashboardStore(s => s.services)
  const running = runId !== null

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - (startTimeRef.current ?? Date.now())) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
      startTimeRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  async function startAttack() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/simulate/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: settings.duration,
          error_rate: settings.errorRate / 100,
          target_service: settings.targetService === 'all' ? null : settings.targetService,
          requests_per_second: settings.rps,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setRunId(data?.run_id ?? data?.runId ?? `sim-${Date.now()}`)
        setOpen(false)
      }
    } catch { /* silent */ } finally { setBusy(false) }
  }

  async function stopAttack() {
    if (!runId || busy) return
    setBusy(true)
    try { await fetch(`/api/simulate/stop/${encodeURIComponent(runId)}`, { method: 'POST' }) }
    catch { /* silent */ } finally { setRunId(null); setBusy(false) }
  }

  const remaining = Math.max(0, settings.duration - elapsed)

  return (
    <div className="relative">
      {running ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/[0.08] px-3.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[11px] text-red-400">SIM {remaining}s</span>
          </div>
          <button onClick={stopAttack} disabled={busy}
            className="rounded-full border border-red-500/30 px-3 py-1.5 font-mono text-[11px] text-red-400/80 hover:bg-red-500/10 disabled:opacity-40">
            ■ STOP
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/[0.06] px-3.5 py-1.5 font-mono text-[11px] text-amber-400/90 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          SIMULATE FAILURE
          <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      )}

      {open && !running && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-white/[0.1] bg-[#060a14] p-4 shadow-2xl backdrop-blur-[20px]">
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-[var(--accent-amber)]">// ATTACK SETTINGS</p>
          <div className="space-y-3">
            {[
              { label: 'Duration', key: 'duration' as const, min: 10, max: 300, step: 10, fmt: (v: number) => `${v}s`, accent: 'accent-amber-400' },
              { label: 'Error Rate', key: 'errorRate' as const, min: 5, max: 100, step: 5, fmt: (v: number) => `${v}%`, accent: 'accent-red-400' },
              { label: 'RPS', key: 'rps' as const, min: 10, max: 500, step: 10, fmt: (v: number) => `${v}`, accent: 'accent-cyan-400' },
            ].map(({ label, key, min, max, step, fmt, accent }) => (
              <div key={key}>
                <div className="mb-1 flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">{label}</span>
                  <span className={`font-mono text-[11px] text-${accent}`}>{fmt(settings[key])}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={settings[key]}
                  onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                  className={`h-0.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-${accent}`} />
              </div>
            ))}
            <div>
              <label className="mb-1 block font-mono text-[11px] text-[var(--text-secondary)]">Target</label>
              <select value={settings.targetService} onChange={e => setSettings(s => ({ ...s, targetService: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 font-mono text-[11px] text-[var(--text-primary)] focus:outline-none">
                <option value="all">ALL SERVICES</option>
                {services.map(svc => <option key={svc.id} value={svc.name}>{svc.name.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={startAttack} disabled={busy}
              className="flex-1 rounded-lg bg-red-500/80 py-2 font-mono text-[12px] font-semibold text-white hover:bg-red-500 disabled:opacity-40">
              {busy ? 'LAUNCHING…' : '▶ LAUNCH ATTACK'}
            </button>
            <button onClick={() => setOpen(false)}
              className="rounded-lg border border-white/[0.1] px-3 py-2 font-mono text-[11px] text-[var(--text-tertiary)] hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Anomaly score card ────────────────────────────────────────────────────────
function AnomalyScoreCard() {
  const score = useDashboardStore(s => s.anomalyScore)
  const systemStatus = useDashboardStore(s => s.systemStatus)
  const pct = Math.round(score * 100)
  const color = systemStatus === 'anomaly' ? 'var(--accent-red)' : systemStatus === 'healing' ? 'var(--accent-amber)' : 'var(--accent-green)'
  const label = systemStatus === 'anomaly' ? 'ANOMALOUS' : systemStatus === 'healing' ? 'HEALING' : 'NOMINAL'

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-card)] px-4 py-3.5"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.5)` }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--text-tertiary)]">ANOMALY SCORE</p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl tabular-nums" style={{ color, textShadow: `0 0 16px ${color}60` }}>{pct}</span>
            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">/100</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px]" style={{ color }}>{label}</p>
        </div>
        <div className="relative h-10 w-10 shrink-0">
          <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
            <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="20" cy="20" r="15" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 94.2} 94.2`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] tabular-nums" style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Hero KPI card ─────────────────────────────────────────────────────────────
const EMPTY: MetricPoint[] = []

function HeroCard({ label, series, unit, precision = 1, color }: {
  label: string; series: MetricPoint[]; unit: string; precision?: number; color: string
}) {
  const latest = series.length ? series[series.length - 1]!.value : null
  const prev = series.length > 5 ? series[series.length - 6]!.value : series.length > 1 ? series[0]!.value : null
  const delta = latest !== null && prev !== null ? latest - prev : null
  const up = delta !== null && delta > 0

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-card)] px-4 py-3.5"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.5)` }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--text-tertiary)]">{label.toUpperCase()}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          {latest !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl tabular-nums" style={{ color, textShadow: `0 0 16px ${color}55` }}>{latest.toFixed(precision)}</span>
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{unit}</span>
            </div>
          ) : (
            <span className="font-mono text-2xl text-[var(--text-tertiary)]">—</span>
          )}
          {delta !== null && (
            <p className={`mt-0.5 font-mono text-[10px] ${up ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
              {up ? '▲' : '▼'} {Math.abs(delta).toFixed(precision)}
            </p>
          )}
        </div>
        <div className="w-[90px] shrink-0">
          <SparkLine data={series.length > 0 ? series : EMPTY} color={color} />
        </div>
      </div>
    </div>
  )
}

// ── Live Observatory ──────────────────────────────────────────────────────────
function LiveChartCard({ label, series, unit, color, precision = 1 }: {
  label: string; series: MetricPoint[]; unit: string; color: string; precision?: number
}) {
  const uid = useId().replace(/:/g, '')
  const gradId = `obs-${uid}`
  const latest = series.length ? series[series.length - 1]!.value : null
  const chartData = series.map(p => ({ t: p.timestamp, v: p.value }))

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-card)]"
      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)' }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--text-tertiary)]">{label.toUpperCase()}</p>
          {latest !== null && (
            <p className="mt-0.5 font-mono text-lg tabular-nums" style={{ color, textShadow: `0 0 12px ${color}45` }}>
              {latest.toFixed(precision)}<span className="ml-1 text-[11px] text-[var(--text-tertiary)]">{unit}</span>
            </p>
          )}
        </div>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: color }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        </span>
      </div>
      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="65%" stopColor={color} stopOpacity={0.05} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="t" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#060a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'monospace', fontSize: 11 }}
              labelStyle={{ color: 'rgba(255,255,255,0.35)' }}
              formatter={(v: unknown) => typeof v === 'number' ? [`${v.toFixed(precision)} ${unit}`, label] : [String(v), label]}
              labelFormatter={(l: unknown) => typeof l === 'number' ? new Date(l).toLocaleTimeString() : ''}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LiveObservatorySection() {
  const requestRate = useDashboardStore(s => s.metrics.requestRate)
  const latency = useDashboardStore(s => s.metrics.latency)
  const errorRate = useDashboardStore(s => s.metrics.errorRate)
  if (requestRate.length === 0 && latency.length === 0) return null

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-mono text-[9px] tracking-[0.25em] text-[var(--text-tertiary)]">// LIVE METRIC STREAMS</p>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LiveChartCard label="Request Rate" series={requestRate} unit="req/s" color="var(--accent-cyan)" precision={2} />
        <LiveChartCard label="Latency P99" series={latency} unit="ms" color="#a78bfa" precision={0} />
        <LiveChartCard label="Error Rate" series={errorRate} unit="%" color="var(--accent-red)" precision={2} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DashboardClient() {
  return (
    <HealthScoreProvider>
      <DashboardClientInner />
    </HealthScoreProvider>
  )
}

function DashboardClientInner() {
  useRealDashboard()
  const { data: upstreamHealth, error: upstreamHealthError } = useDashboardHealth()
  const { connected } = useWebSocket()
  const systemStatus = useDashboardStore(s => s.systemStatus)
  const isLoading = useDashboardStore(s => s.isLoading)
  const hasMetrics = useDashboardStore(s => s.metrics.requestRate.length > 0)
  const requestRate = useDashboardStore(s => s.metrics.requestRate)
  const latency = useDashboardStore(s => s.metrics.latency)
  const errorRate = useDashboardStore(s => s.metrics.errorRate)
  const { order, setOrder, sizes, toggleSize, hydrated: gridHydrated } = useGridLayout()
  const [expandedId, setExpandedId] = useState<WidgetId | null>(null)

  const statusColor = systemStatus === 'healthy' ? 'var(--accent-green)' : systemStatus === 'anomaly' ? 'var(--accent-red)' : 'var(--accent-amber)'
  const statusText = systemStatus === 'healthy' ? 'ALL SYSTEMS NOMINAL' : systemStatus === 'anomaly' ? 'ANOMALY DETECTED' : 'RECOVERING'

  return (
    <div className="relative z-50 flex h-screen flex-col overflow-hidden">
      <StatusBar connected={connected} />

      {/* Full-height content row */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: scrollable main content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.08)_transparent] [scrollbar-width:thin]">
          <main className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-6 md:px-8 md:pt-8">

            {/* Page header */}
            <header className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.3em] text-[var(--accent-cyan)]/60">CONTROL CENTER / v2.0</p>
                  <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-white md:text-4xl">
                    RecoX<span className="text-[var(--accent-cyan)]">.</span>Observatory
                  </h1>
                  <p className="mt-1.5 font-mono text-[12px] text-[var(--text-tertiary)]">
                    real-time · anomaly detection · auto-remediation
                  </p>
                </div>
                {/* Status + simulate */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[var(--bg-card)] px-3 py-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: statusColor }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: statusColor }}>{statusText}</span>
                  </div>
                  <SimulatePanel />
                </div>
              </div>

              {/* Loading indicator */}
              {isLoading && !hasMetrics && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--accent-cyan)]/15 bg-[var(--accent-cyan)]/[0.04] px-4 py-2.5">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="h-1 w-1 rounded-full bg-[var(--accent-cyan)]"
                        style={{ animation: `pulse 1s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-[var(--accent-cyan)]/70">
                    CONNECTING · PROMETHEUS · LOKI · JAEGER
                  </span>
                </div>
              )}
            </header>

            {/* Hero KPI row */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <HeroCard label="Request Rate" series={requestRate} unit="req/s" precision={2} color="var(--accent-cyan)" />
              <HeroCard label="Latency P99" series={latency} unit="ms" precision={0} color="#a78bfa" />
              <HeroCard label="Error Rate" series={errorRate} unit="%" precision={2} color="var(--accent-red)" />
              <AnomalyScoreCard />
            </div>

            {/* Widget grid */}
            <LayoutGroup id="dashboard-widgets">
              <MetricsGrid
                order={order}
                setOrder={setOrder}
                sizes={sizes}
                toggleSize={toggleSize}
                hydrated={gridHydrated}
                editMode={false}
                expandedId={expandedId}
                onExpandedChange={setExpandedId}
              />
              <ExpandedModal
                widgetId={expandedId}
                open={expandedId !== null}
                onOpenChange={o => { if (!o) setExpandedId(null) }}
              />
            </LayoutGroup>

            {/* Live observatory */}
            <LiveObservatorySection />

            {/* Footer */}
            <footer className="mt-10 flex items-center justify-between border-t border-white/[0.05] pt-6">
              <p className="font-mono text-[9px] tracking-[0.15em] text-[var(--text-tertiary)]">RECOX OBSERVABILITY PLATFORM</p>
              <p className="font-mono text-[9px] text-[var(--text-tertiary)]">
                {upstreamHealthError ? `ERR: ${upstreamHealthError}` : upstreamHealth ? upstreamHealth.status.toUpperCase() : '…'} · REFRESH 10s
              </p>
            </footer>
          </main>
        </div>

        {/* ── Right: full-height logs sidebar ── */}
        <aside className="hidden w-[400px] shrink-0 border-l border-white/[0.05] xl:flex xl:flex-col">
          <LogsPanel />
        </aside>
      </div>

      {/* Logs panel on smaller screens (below content) */}
      <div className="xl:hidden">
        <div className="border-t border-white/[0.05]">
          <LogsPanel />
        </div>
      </div>
    </div>
  )
}
