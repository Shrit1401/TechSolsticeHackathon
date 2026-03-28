"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardStore } from "@/store/dashboardStore";
import { mergeMetrics, sliceByRange, type TimeRange } from "@/lib/graphUtils";
import { GraphMainChart } from "@/components/dashboard/graph/GraphMainChart";
import { CountUp } from "@/components/ui/CountUp";
import { SparkLine } from "@/components/ui/SparkLine";
import { RadialGauge } from "@/components/ui/RadialGauge";
import { DeltaIndicator } from "@/components/ui/DeltaIndicator";
import { syntheticPreviousValue, memoryGb } from "@/lib/widgetMockData";
import type { WidgetId, WidgetSize } from "@/lib/constants";
import { useWidgetSize } from "@/components/dashboard/WidgetSizeContext";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { MetricPoint } from "@/lib/types";

/** Stable empty array — never recreated, safe to use as Zustand selector fallback. */
const EMPTY: MetricPoint[] = [];

function chartHeightForTile(size: WidgetSize): number {
  if (size === "2x2") return 340;
  if (size === "3x1") return 168;
  return 140;
}

function windowDelta(series: MetricPoint[]) {
  const cur = series[series.length - 1]?.value ?? 0;
  const prev = series[0]?.value ?? cur;
  return { current: cur, previous: prev };
}

function NoData({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
      <p className="text-[13px] text-[var(--text-tertiary)]">No data</p>
      <p className="text-[11px] text-[var(--text-tertiary)]/60">{label}</p>
    </div>
  );
}

export function widgetMeta(id: WidgetId): { title: string; subtitle?: string } {
  const m: Record<WidgetId, { title: string; subtitle?: string }> = {
    "request-rate": { title: "Request rate", subtitle: "Live throughput" },
    "error-rate": { title: "Error rate", subtitle: "Failed requests %" },
    latency: { title: "Latency (P99)", subtitle: "Tail latency" },
    throughput: {
      title: "Throughput & error budget",
      subtitle: "Request rate with error overlay",
    },
    cpu: { title: "CPU saturation", subtitle: "Cluster average" },
    memory: { title: "Memory utilization", subtitle: "Heap + page cache" },
    connections: { title: "Active connections", subtitle: "TCP established" },
    anomaly: { title: "Anomaly score", subtitle: "Detector confidence 0–1" },
    "service-map": {
      title: "Service dependency map",
      subtitle: "Topology (simplified)",
    },
    "incident-timeline": { title: "Incident timeline", subtitle: "Last 24h" },
    "queue-depth": { title: "Queue depth", subtitle: "Backlog pressure" },
    saturation: { title: "Saturation", subtitle: "Capacity headroom" },
    "disk-io": { title: "Disk I/O", subtitle: "Aggregate read/write" },
    "network-in": { title: "Network in", subtitle: "Ingress bandwidth" },
    "gc-pause": { title: "GC pause", subtitle: "Stop-the-world P99" },
    "cache-hit": { title: "Cache hit rate", subtitle: "Edge cache" },
    "thread-pool": { title: "Thread pool", subtitle: "Executor utilization" },
    "db-connections": { title: "DB connections", subtitle: "Active pool" },
  };
  return m[id];
}

export const WidgetBody = memo(function WidgetBody({ id }: { id: WidgetId }) {
  switch (id) {
    case "request-rate":
      return <RequestRateBody />;
    case "error-rate":
      return <ErrorRateBody />;
    case "latency":
      return <LatencyBody />;
    case "throughput":
      return <ThroughputBody />;
    case "cpu":
      return <CpuBody />;
    case "memory":
      return <MemoryBody />;
    case "connections":
      return <ConnectionsBody />;
    case "anomaly":
      return <AnomalyBody />;
    case "service-map":
      return <ServiceMapBody />;
    case "incident-timeline":
      return <IncidentTimelineBody />;
    case "queue-depth":
      return (
        <ExtendedMetricBody
          widgetId="queue-depth"
          unit="msgs"
          color="var(--accent-cyan)"
          invertDelta
        />
      );
    case "saturation":
      return (
        <ExtendedMetricBody
          widgetId="saturation"
          unit="%"
          color="var(--accent-cyan)"
          invertDelta
          clampMax={100}
        />
      );
    case "disk-io":
      return (
        <ExtendedMetricBody
          widgetId="disk-io"
          unit="MB/s"
          color="var(--accent-cyan)"
        />
      );
    case "network-in":
      return (
        <ExtendedMetricBody
          widgetId="network-in"
          unit="Mbps"
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
        />
      );
    case "gc-pause":
      return (
        <ExtendedMetricBody
          widgetId="gc-pause"
          unit="ms"
          decimals={2}
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
          invertDelta
        />
      );
    case "cache-hit":
      return (
        <ExtendedMetricBody
          widgetId="cache-hit"
          unit="%"
          decimals={1}
          color="var(--accent-cyan)"
          clampMax={100}
        />
      );
    case "thread-pool":
      return (
        <ExtendedMetricBody
          widgetId="thread-pool"
          unit="%"
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
          invertDelta
          clampMax={100}
        />
      );
    case "db-connections":
      return (
        <ExtendedMetricBody
          widgetId="db-connections"
          unit="conns"
          color="var(--accent-cyan)"
          invertDelta
        />
      );
    default:
      return null;
  }
});

// ── Core metric widgets ────────────────────────────────────────────────────

function RequestRateBody() {
  const series = useDashboardStore(s => s.metrics.requestRate);
  const { current, previous } = windowDelta(series);
  if (series.length === 0) return <NoData label="awaiting Prometheus data" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--accent-cyan)]">
          <CountUp value={current} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">req/s</span>
        </p>
        <DeltaIndicator current={current} previous={previous} unit="req/s" invertColors={false} />
      </div>
      <SparkLine data={series} />
    </div>
  );
}

function ErrorRateBody() {
  const series = useDashboardStore(s => s.metrics.errorRate);
  const { current, previous } = windowDelta(series);
  if (series.length === 0) return <NoData label="awaiting Prometheus data" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--accent-cyan)]">
          <CountUp value={current} decimals={1} />%
        </p>
        <DeltaIndicator current={current} previous={previous} unit="%" invertColors decimals={1} />
      </div>
      <SparkLine data={series} color="var(--chart-line-secondary)" />
    </div>
  );
}

function LatencyBody() {
  const series = useDashboardStore(s => s.metrics.latency);
  const { current, previous } = windowDelta(series);
  if (series.length === 0) return <NoData label="awaiting Prometheus data" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--text-primary)]">
          <CountUp value={current} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">ms</span>
        </p>
        <DeltaIndicator current={current} previous={previous} unit="ms" invertColors />
      </div>
      <SparkLine data={series} color="var(--accent-blue)" />
    </div>
  );
}

function ThroughputBody() {
  const tileSize = useWidgetSize();
  const [range, setRange] = useState<TimeRange>("5m");
  const rr = useDashboardStore(s => s.metrics.requestRate);
  const er = useDashboardStore(s => s.metrics.errorRate);
  const lat = useDashboardStore(s => s.metrics.latency);
  const merged = useMemo(() => mergeMetrics(rr, er, lat), [rr, er, lat]);
  const data = useMemo(() => sliceByRange(merged, range), [merged, range]);
  const uid = useId().replace(/:/g, "");
  const chartH = chartHeightForTile(tileSize);
  const erDelta = useMemo(() => {
    if (data.length === 0) return { current: 0, previous: 0 };
    return { current: data[data.length - 1]!.er, previous: data[0]!.er };
  }, [data]);

  if (rr.length === 0) return <NoData label="awaiting Prometheus data" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap gap-1">
        {(["5m", "1h", "24h"] as const).map(r => (
          <span
            key={r}
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); setRange(r); }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRange(r); }
            }}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium",
              range === r ? "bg-white/10 text-white" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {r}
          </span>
        ))}
      </div>
      <DeltaIndicator current={erDelta.current} previous={erDelta.previous} unit="%" timeframe="5m ago" invertColors decimals={1} />
      <div className="min-h-[140px] w-full min-w-0 flex-1">
        <GraphMainChart data={data} range={range} height={chartH} gradientId={`tp-${uid}`} />
      </div>
    </div>
  );
}

// ── Gauge widgets — CPU & Memory ───────────────────────────────────────────

function CpuBody() {
  const tileSize = useWidgetSize();
  const series = useDashboardStore(s => s.extendedMetrics['cpu'] ?? EMPTY);
  const { current, previous } = windowDelta(series);
  if (series.length === 0) return <NoData label="node exporter required" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
      <RadialGauge value={current} label="" size={tileSize === "2x2" ? "lg" : "md"} />
      <DeltaIndicator current={current} previous={previous} unit="%" invertColors decimals={0} />
    </div>
  );
}

function MemoryBody() {
  const tileSize = useWidgetSize();
  const series = useDashboardStore(s => s.extendedMetrics['memory'] ?? EMPTY);
  const { current, previous } = windowDelta(series);
  const { used, total } = memoryGb(current);
  if (series.length === 0) return <NoData label="node exporter required" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
      <RadialGauge
        value={current}
        label=""
        sublabel={`${used.toFixed(1)} / ${total} GB`}
        size={tileSize === "2x2" ? "lg" : "md"}
      />
      <DeltaIndicator current={current} previous={previous} unit="%" invertColors decimals={0} />
    </div>
  );
}

// ── Connections ────────────────────────────────────────────────────────────

function ConnectionsBody() {
  const tileSize = useWidgetSize();
  const series = useDashboardStore(s => s.extendedMetrics['connections'] ?? EMPTY);
  const { current, previous } = windowDelta(series);
  const uid = useId().replace(/:/g, "");
  const chartH = chartHeightForTile(tileSize);

  if (series.length === 0) return <NoData label="node_netstat_Tcp_CurrEstab" />;

  // Build a simple stacked-looking area from the single series
  const data = series.map(p => ({
    t: p.timestamp,
    total: p.value,
  }));

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-between gap-2">
      <div className="shrink-0">
        <p className="font-numeric-dial text-3xl text-[var(--accent-cyan)]">
          <CountUp value={current} />{" "}
          <span className="text-base font-medium text-[var(--text-tertiary)]">conns</span>
        </p>
        <DeltaIndicator current={current} previous={previous} unit="conns" invertColors={false} />
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`c1-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid-line)" vertical={false} />
          <XAxis dataKey="t" type="number" hide />
          <YAxis hide />
          <Tooltip
            content={({ payload }) =>
              payload?.length ? (
                <div className="font-numeric-dial rounded-lg border border-white/[0.1] bg-black px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                  {Math.round(Number(payload[0]?.value))} connections
                </div>
              ) : null
            }
          />
          <Area type="natural" dataKey="total" stroke="#00e5ff" fill={`url(#c1-${uid})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Anomaly score ──────────────────────────────────────────────────────────

function AnomalyBody() {
  const score = useDashboardStore(s => s.anomalyScore);
  const prevScore = useMemo(
    () => syntheticPreviousValue(score, Math.round(score * 1e6)),
    [score],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
      <div>
        <p
          className={cn(
            "font-numeric-dial text-3xl",
            score > 0.7
              ? "text-[var(--accent-red)] drop-shadow-[0_0_12px_rgba(255,77,106,0.45)]"
              : "text-[var(--text-primary)]",
          )}
        >
          <CountUp value={score} decimals={2} />
        </p>
        <DeltaIndicator current={score} previous={prevScore} invertColors decimals={2} />
      </div>
      <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-red)] transition-[width] duration-500"
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Service map ────────────────────────────────────────────────────────────

function ServiceMapBody() {
  const tileSize = useWidgetSize();
  const services = useDashboardStore(s => s.services);
  const isLoading = useDashboardStore(s => s.isLoading);

  const counts = useMemo(() => {
    const healthy = services.filter(s => s.status === 'healthy').length
    const degraded = services.filter(s => s.status === 'degraded').length
    const down = services.filter(s => s.status === 'down').length
    return { healthy, degraded, down, total: services.length }
  }, [services])

  const healthyPct = useMemo(
    () => counts.total === 0 ? 100 : (counts.healthy / counts.total) * 100,
    [counts],
  )

  const prevHealthyPct = useMemo(
    () => syntheticPreviousValue(healthyPct, services.length + 501),
    [healthyPct, services.length],
  )

  if (isLoading && services.length === 0) return <NoData label="loading services…" />;
  if (services.length === 0) return <NoData label="no services discovered" />;

  const pieData = [
    { name: 'Healthy', value: counts.healthy, color: 'var(--accent-green)' },
    { name: 'Degraded', value: counts.degraded, color: 'var(--accent-amber)' },
    { name: 'Down', value: counts.down, color: 'var(--accent-red)' },
  ].filter(d => d.value > 0)

  const compact = tileSize === '1x1'
  const showPie = !compact || services.length > 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex items-center gap-3">
        {showPie && (
          <div className="shrink-0" style={{ width: compact ? 56 : 64, height: compact ? 56 : 64 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={compact ? 16 : 19}
                  outerRadius={compact ? 26 : 30}
                  dataKey="value"
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-numeric-dial text-2xl leading-none text-[var(--text-primary)]">
            <CountUp value={healthyPct} decimals={0} />
            <span className="text-sm font-medium text-[var(--text-tertiary)]">% up</span>
          </p>
          <DeltaIndicator current={healthyPct} previous={prevHealthyPct} unit="%" invertColors={false} decimals={0} />
          <p className="mt-1 text-[10px] text-[var(--text-tertiary)] [font-family:var(--font-ui)]">
            {counts.healthy}↑ {counts.degraded > 0 ? `${counts.degraded}⚠ ` : ''}{counts.down > 0 ? `${counts.down}↓ ` : ''}{counts.total} total
          </p>
        </div>
      </div>

      {/* Service rows */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]">
        {services.slice(0, compact ? 3 : 6).map(svc => {
          const color = svc.status === 'healthy' ? 'var(--accent-green)' : svc.status === 'degraded' ? 'var(--accent-amber)' : 'var(--accent-red)'
          return (
            <div key={svc.id} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">{svc.name}</span>
              {svc.latency > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">{Math.round(svc.latency)}ms</span>
              )}
              {svc.errorRate > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-red-400">{svc.errorRate.toFixed(1)}%↑</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}

// ── Incident timeline ──────────────────────────────────────────────────────

function IncidentTimelineBody() {
  const events = useDashboardStore(s => s.incidentTimeline);
  // Use 0 on server, set real value after mount to avoid hydration mismatch
  const [now, setNow] = useState(0);
  const len = events.length;
  const previousIncidentCount = useMemo(() => syntheticPreviousValue(len, len * 997 + 13), [len]);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const day = 24 * 60 * 60 * 1000;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-2 pt-2">
      <DeltaIndicator
        current={len}
        previous={Math.round(previousIncidentCount)}
        timeframe="session"
        invertColors
        decimals={0}
      />
      <div className={cn("relative h-[88px] w-full shrink-0", events.length === 0 ? "flex items-center" : "")}>
        {events.length > 0 && (
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
        )}
        {events.length === 0 ? (
          <p className="px-1 text-[13px] text-[var(--text-tertiary)]">No incidents in session.</p>
        ) : (
          events.map(ev => {
            const t = (ev.timestamp - (now - day)) / day;
            if (t < 0 || t > 1) return null;
            return (
              <div
                key={ev.id}
                className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-red)]"
                style={{ left: `${t * 100}%` }}
                title={ev.description}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Service stats fallback for widgets with no Prometheus data ─────────────

function ServiceStatsBody() {
  const services = useDashboardStore(s => s.services)
  if (services.length === 0) return null

  const maxRR = Math.max(...services.map(s => s.requestCount), 0.001)
  const shown = services.slice(0, 5)

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] [font-family:var(--font-ui)]">
        Services · req/s
      </p>
      {shown.map(svc => {
        const color =
          svc.status === 'healthy' ? 'var(--accent-green)'
          : svc.status === 'degraded' ? 'var(--accent-amber)'
          : 'var(--accent-red)'
        const pct = Math.max((svc.requestCount / maxRR) * 100, svc.requestCount > 0 ? 4 : 0)
        return (
          <div key={svc.id} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">
              {svc.name}
            </span>
            <div className="w-16 h-1 shrink-0 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
              {svc.requestCount > 0 ? svc.requestCount.toFixed(1) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Shows service stats if available, otherwise NoData */
function ExtendedNoData({ widgetId }: { widgetId: WidgetId }) {
  const hasServices = useDashboardStore(s => s.services.length > 0)
  if (hasServices) return <ServiceStatsBody />
  return <NoData label={`no metric for ${widgetId}`} />
}

// ── Extended metric widget (real Prometheus data or service stats fallback) ──

function ExtendedMetricBody({
  widgetId,
  unit,
  color,
  textClass = "text-[var(--accent-cyan)]",
  invertDelta = false,
  decimals = 0,
  clampMax,
}: {
  widgetId: WidgetId;
  unit: string;
  color: string;
  textClass?: string;
  invertDelta?: boolean;
  decimals?: number;
  clampMax?: number;
}) {
  const raw = useDashboardStore(s => s.extendedMetrics[widgetId] ?? EMPTY);
  const series = useMemo(
    () =>
      clampMax != null
        ? raw.map(p => ({ ...p, value: Math.min(p.value, clampMax) }))
        : raw,
    [raw, clampMax],
  );
  const { current, previous } = windowDelta(series);

  if (series.length === 0) return <ExtendedNoData widgetId={widgetId} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className={cn("font-numeric-dial text-4xl", textClass)}>
          <CountUp value={current} decimals={decimals} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">{unit}</span>
        </p>
        <DeltaIndicator
          current={current}
          previous={previous}
          unit={unit}
          invertColors={invertDelta}
          decimals={decimals}
        />
      </div>
      <SparkLine data={series} color={color} />
    </div>
  );
}
