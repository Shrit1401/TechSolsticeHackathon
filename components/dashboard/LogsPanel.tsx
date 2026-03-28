'use client'

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useDashboardStore } from '@/store/dashboardStore'
import type { LogLine } from '@/lib/backendTypes'

const LEVEL_STYLES: Record<LogLine['level'], { dot: string; text: string; badge: string }> = {
  error: {
    dot: 'bg-[var(--accent-red)] shadow-[0_0_6px_rgba(239,68,68,0.7)]',
    text: 'text-[#f87171]',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  warn: {
    dot: 'bg-[var(--accent-amber)]',
    text: 'text-[#fbbf24]',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  info: {
    dot: 'bg-[#60a5fa]',
    text: 'text-[#93c5fd]',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  debug: {
    dot: 'bg-[#6b7280]',
    text: 'text-[#9ca3af]',
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  },
  unknown: {
    dot: 'bg-[#374151]',
    text: 'text-[#6b7280]',
    badge: 'bg-gray-700/30 text-gray-500 border-gray-600/20',
  },
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function cleanMessage(msg: string): string {
  return msg
    .replace(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,\d]*\s*/i, '')
    .replace(/^(INFO|WARN|ERROR|DEBUG|CRITICAL)[\s:]+/i, '')
    .trim()
}

// ── Jaeger trace types ────────────────────────────────────────────────────────
type JaegerSpan = {
  traceID: string
  spanID: string
  operationName: string
  startTime: number  // microseconds
  duration: number   // microseconds
  tags?: { key: string; type?: string; value: unknown }[]
  process?: { serviceName: string }
  references?: { refType: string; traceID: string; spanID: string }[]
}

type JaegerTrace = {
  traceID: string
  spans: JaegerSpan[]
  processes?: Record<string, { serviceName: string }>
}

type TraceRow = {
  traceID: string
  service: string
  operation: string
  duration: number   // ms
  startTime: number  // ms
  status: 'ok' | 'error'
  spanCount: number
}

function parseTraces(data: { data?: JaegerTrace[] }): TraceRow[] {
  const rows: TraceRow[] = []
  for (const trace of data.data ?? []) {
    const rootSpan = trace.spans[0]
    if (!rootSpan) continue
    const service =
      rootSpan.process?.serviceName ??
      (trace.processes ? Object.values(trace.processes)[0]?.serviceName ?? 'unknown' : 'unknown')
    const hasError = trace.spans.some(s =>
      s.tags?.some(t => t.key === 'error' && t.value === true) ||
      s.tags?.some(t => t.key === 'http.status_code' && Number(t.value) >= 500)
    )
    rows.push({
      traceID: trace.traceID,
      service,
      operation: rootSpan.operationName,
      duration: rootSpan.duration / 1000,
      startTime: Math.round(rootSpan.startTime / 1000),
      status: hasError ? 'error' : 'ok',
      spanCount: trace.spans.length,
    })
  }
  return rows.sort((a, b) => b.startTime - a.startTime)
}

function TracesTab() {
  const services = useDashboardStore(s => s.services)
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedService, setSelectedService] = useState('all')

  const fetchTraces = useCallback(async (svc: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30', lookback: '1h' })
      if (svc !== 'all') params.set('service', svc)
      const res = await fetch(`/api/jaeger/traces?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setTraces(parseTraces(data))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void fetchTraces(selectedService)
    const id = setInterval(() => void fetchTraces(selectedService), 15_000)
    return () => clearInterval(id)
  }, [selectedService, fetchTraces])

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-4 py-2">
        <select
          value={selectedService}
          onChange={e => setSelectedService(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none [font-family:var(--font-ui)]"
        >
          <option value="all">All services</option>
          {services.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button
          onClick={() => void fetchTraces(selectedService)}
          className="rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] text-[var(--text-tertiary)] hover:text-white [font-family:var(--font-ui)]"
        >
          {loading ? '…' : '↻'}
        </button>
        <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{traces.length} traces</span>
      </div>

      {/* Trace rows */}
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.1)_transparent] [scrollbar-width:thin]">
        {traces.length === 0 && !loading && (
          <p className="py-10 text-center text-[13px] text-[var(--text-tertiary)]">
            No traces found · Check Jaeger is running
          </p>
        )}
        {traces.map(tr => (
          <div
            key={`${tr.traceID}-${tr.startTime}`}
            className="flex items-start gap-2.5 border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]"
          >
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tr.status === 'error' ? 'bg-red-500' : 'bg-[var(--accent-green)]'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[10px] text-[var(--accent-cyan)]">
                  {tr.traceID.slice(0, 8)}
                </span>
                <span className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                  {tr.service}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
                  {tr.duration.toFixed(1)}ms
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-secondary)]">
                {tr.operation}
              </p>
              <p className="mt-0.5 text-[9px] text-[#374151]">
                {formatTs(tr.startTime)} · {tr.spanCount} span{tr.spanCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main LogsPanel ────────────────────────────────────────────────────────────
type Tab = 'logs' | 'traces'
type LevelFilter = LogLine['level'] | 'all'

export function LogsPanel() {
  const logs = useDashboardStore(s => s.logs)
  const [tab, setTab] = useState<Tab>('logs')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  const filtered = useMemo(() => {
    if (levelFilter === 'all') return logs
    return logs.filter(l => l.level === levelFilter)
  }, [logs, levelFilter])

  const counts = useMemo(() => {
    const c = { error: 0, warn: 0, info: 0, debug: 0, unknown: 0 }
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1
    return c
  }, [logs])

  useEffect(() => {
    if (tab !== 'logs' || !autoScroll || logs.length === prevLenRef.current) return
    prevLenRef.current = logs.length
    if (listRef.current) listRef.current.scrollTop = 0
  }, [logs, autoScroll, tab])

  return (
    <div className="flex h-full flex-col bg-[var(--bg-card)]">
      {/* Header with tabs */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Live indicator */}
          <span className="relative mr-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-green)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-green)]" />
          </span>
          {/* Tabs */}
          {(['logs', 'traces'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors [font-family:var(--font-ui)] ${
                tab === t
                  ? 'bg-white/[0.08] text-white'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {t === 'logs' ? 'Loki Logs' : 'Jaeger Traces'}
            </button>
          ))}
        </div>

        {tab === 'logs' && (
          <div className="flex items-center gap-1.5">
            {(['error', 'warn', 'info'] as LevelFilter[]).map(lv => {
              const active = levelFilter === lv
              const style = LEVEL_STYLES[lv as LogLine['level']]
              const cnt = counts[lv as LogLine['level']] ?? 0
              return (
                <button
                  key={lv}
                  onClick={() => setLevelFilter(active ? 'all' : lv)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors [font-family:var(--font-ui)] ${
                    active ? `${style.badge}` : 'border-white/[0.06] text-[var(--text-tertiary)] hover:border-white/15'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {lv.toUpperCase()} {cnt}
                </button>
              )
            })}
            <button
              onClick={() => setAutoScroll(v => !v)}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors [font-family:var(--font-ui)] ${
                autoScroll
                  ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                  : 'border-white/[0.06] text-[var(--text-tertiary)]'
              }`}
            >
              {autoScroll ? 'Live' : 'Paused'}
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === 'traces' ? (
        <TracesTab />
      ) : (
        <>
          {logs.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-tertiary)]">
              Waiting for log stream…
            </p>
          ) : (
            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.1)_transparent] [scrollbar-width:thin]"
            >
              {filtered.map((line, i) => {
                const style = LEVEL_STYLES[line.level]
                const msg = cleanMessage(line.message)
                return (
                  <div
                    key={`${line.timestamp}-${i}`}
                    className="group flex items-start gap-2.5 border-b border-white/[0.035] px-4 py-2 hover:bg-white/[0.025] last:border-b-0"
                  >
                    <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[9.5px] tabular-nums text-[#374151]">
                          {formatTs(line.timestamp)}
                        </span>
                        <span className="shrink-0 max-w-[90px] truncate rounded bg-white/[0.05] px-1.5 py-[1px] font-mono text-[9px] text-[var(--accent-cyan)]/70">
                          {line.service}
                        </span>
                        <span className={`ml-auto shrink-0 rounded px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wide ${style.badge}`}>
                          {line.level}
                        </span>
                      </div>
                      <p className={`font-mono text-[10.5px] leading-snug line-clamp-2 ${style.text}`}>
                        {msg}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
