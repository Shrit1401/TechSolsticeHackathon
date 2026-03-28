"use client";

import { Fragment, memo, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import {
  anomalyScoreFromStore,
  deriveSparkSeries,
  gaugeValue,
  generateStackedConnections,
  memoryGb,
  syntheticPreviousValue,
} from "@/lib/widgetMockData";
import type { WidgetId, WidgetSize } from "@/lib/constants";
import { useWidgetSize } from "@/components/dashboard/WidgetSizeContext";
import { useId } from "react";
import { cn } from "@/lib/utils";

function chartHeightForTile(size: WidgetSize): number {
  if (size === "2x2") return 316;
  if (size === "3x1") return 148;
  return 120;
}

function windowDelta(series: { value: number }[]) {
  const cur = series[series.length - 1]?.value ?? 0;
  const prev = series[0]?.value ?? cur;
  return { current: cur, previous: prev };
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
    connections: { title: "Active connections", subtitle: "By protocol" },
    anomaly: { title: "Anomaly score", subtitle: "ML composite 0–1" },
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
        <DerivedSparkBody
          seed={101}
          base={48}
          amplitude={18}
          unit="msgs"
          color="var(--accent-cyan)"
          invertDelta
        />
      );
    case "saturation":
      return (
        <DerivedSparkBody
          seed={102}
          base={62}
          amplitude={8}
          unit="%"
          color="var(--accent-cyan)"
          clampMax={100}
          invertDelta
        />
      );
    case "disk-io":
      return (
        <DerivedSparkBody
          seed={103}
          base={320}
          amplitude={45}
          unit="MB/s"
          color="var(--accent-cyan)"
        />
      );
    case "network-in":
      return (
        <DerivedSparkBody
          seed={104}
          base={840}
          amplitude={120}
          unit="Mbps"
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
        />
      );
    case "gc-pause":
      return (
        <DerivedSparkBody
          seed={105}
          base={2.4}
          amplitude={0.85}
          decimals={2}
          unit="ms"
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
          invertDelta
        />
      );
    case "cache-hit":
      return (
        <DerivedSparkBody
          seed={106}
          base={94}
          amplitude={2}
          decimals={1}
          unit="%"
          color="var(--accent-cyan)"
          clampMin={88}
          clampMax={100}
        />
      );
    case "thread-pool":
      return (
        <DerivedSparkBody
          seed={107}
          base={71}
          amplitude={9}
          unit="%"
          color="var(--accent-blue)"
          textClass="text-[var(--text-primary)]"
          clampMax={100}
          invertDelta
        />
      );
    case "db-connections":
      return (
        <DerivedSparkBody
          seed={108}
          base={128}
          amplitude={22}
          unit="conns"
          color="var(--accent-cyan)"
          invertDelta
        />
      );
    default:
      return null;
  }
});

function RequestRateBody() {
  const series = useDashboardStore((s) => s.metrics.requestRate);
  const { current, previous } = windowDelta(series);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--accent-cyan)]">
          <CountUp value={current} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">
            req/s
          </span>
        </p>
        <DeltaIndicator
          current={current}
          previous={previous}
          unit="req/s"
          invertColors={false}
        />
      </div>
      <SparkLine data={series} />
    </div>
  );
}

function ErrorRateBody() {
  const series = useDashboardStore((s) => s.metrics.errorRate);
  const { current, previous } = windowDelta(series);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--accent-cyan)]">
          <CountUp value={current} decimals={1} />%
        </p>
        <DeltaIndicator
          current={current}
          previous={previous}
          unit="%"
          invertColors
          decimals={1}
        />
      </div>
      <SparkLine data={series} color="var(--chart-line-secondary)" />
    </div>
  );
}

function LatencyBody() {
  const series = useDashboardStore((s) => s.metrics.latency);
  const { current, previous } = windowDelta(series);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className="font-numeric-dial text-4xl text-[var(--text-primary)]">
          <CountUp value={current} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">
            ms
          </span>
        </p>
        <DeltaIndicator
          current={current}
          previous={previous}
          unit="ms"
          invertColors
        />
      </div>
      <SparkLine data={series} color="var(--accent-blue)" />
    </div>
  );
}

function DerivedSparkBody({
  seed,
  base,
  amplitude,
  decimals = 0,
  unit,
  color,
  textClass = "text-[var(--accent-cyan)]",
  clampMin,
  clampMax,
  invertDelta = false,
}: {
  seed: number;
  base: number;
  amplitude: number;
  decimals?: number;
  unit: string;
  color: string;
  textClass?: string;
  clampMin?: number;
  clampMax?: number;
  invertDelta?: boolean;
}) {
  const template = useDashboardStore((s) => s.metrics.requestRate);
  const series = useMemo(
    () =>
      deriveSparkSeries(template, seed, base, amplitude, {
        min: clampMin,
        max: clampMax,
      }),
    [template, seed, base, amplitude, clampMin, clampMax],
  );
  const { current, previous } = windowDelta(series);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div>
        <p className={cn("font-numeric-dial text-4xl", textClass)}>
          <CountUp value={current} decimals={decimals} />{" "}
          <span className="text-lg font-medium text-[var(--text-tertiary)]">
            {unit}
          </span>
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

function ThroughputBody() {
  const tileSize = useWidgetSize();
  const [range, setRange] = useState<TimeRange>("5m");
  const rr = useDashboardStore((s) => s.metrics.requestRate);
  const er = useDashboardStore((s) => s.metrics.errorRate);
  const lat = useDashboardStore((s) => s.metrics.latency);
  const merged = useMemo(() => mergeMetrics(rr, er, lat), [rr, er, lat]);
  const data = useMemo(() => sliceByRange(merged, range), [merged, range]);
  const uid = useId().replace(/:/g, "");
  const chartH = chartHeightForTile(tileSize);
  const erDelta = useMemo(() => {
    if (data.length === 0) return { current: 0, previous: 0 };
    const cur = data[data.length - 1]!.er;
    const prev = data[0]!.er;
    return { current: cur, previous: prev };
  }, [data]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap gap-1">
        {(["5m", "1h", "24h"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRange(r);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              range === r
                ? "bg-white/10 text-white"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <DeltaIndicator
        current={erDelta.current}
        previous={erDelta.previous}
        unit="%"
        timeframe="5m ago"
        invertColors
        decimals={1}
      />
      <div className="min-h-[120px] w-full min-w-0 flex-1">
        <GraphMainChart
          data={data}
          range={range}
          height={chartH}
          gradientId={`tp-${uid}`}
        />
      </div>
    </div>
  );
}

function CpuBody() {
  const tileSize = useWidgetSize();
  const [v, setV] = useState(() => gaugeValue(Date.now(), "cpu"));
  const [prevV, setPrevV] = useState(() => gaugeValue(Date.now(), "cpu"));
  useEffect(() => {
    const id = setInterval(() => {
      setV((cur) => {
        const next = gaugeValue(Date.now(), "cpu");
        setPrevV(cur);
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
      <RadialGauge value={v} label="" size={tileSize === "2x2" ? "lg" : "md"} />
      <DeltaIndicator
        current={v}
        previous={prevV}
        unit="%"
        invertColors
        decimals={0}
      />
    </div>
  );
}

function MemoryBody() {
  const tileSize = useWidgetSize();
  const [v, setV] = useState(() => gaugeValue(Date.now() + 99, "mem"));
  const [prevV, setPrevV] = useState(() => gaugeValue(Date.now() + 99, "mem"));
  useEffect(() => {
    const id = setInterval(() => {
      setV((cur) => {
        const next = gaugeValue(Date.now() + 99, "mem");
        setPrevV(cur);
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const { used, total } = memoryGb(v);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
      <RadialGauge
        value={v}
        label=""
        sublabel={`${used.toFixed(1)} / ${total} GB`}
        size={tileSize === "2x2" ? "lg" : "md"}
      />
      <DeltaIndicator
        current={v}
        previous={prevV}
        unit="%"
        invertColors
        decimals={0}
      />
    </div>
  );
}

function ConnectionsBody() {
  const tileSize = useWidgetSize();
  const data = useMemo(() => generateStackedConnections("5m"), []);
  const uid = useId().replace(/:/g, "");
  const chartH = chartHeightForTile(tileSize);
  const totals = useMemo(() => {
    if (data.length === 0) return { current: 0, previous: 0 };
    const first = data[0]!;
    const last = data[data.length - 1]!;
    const prev = first.h1 + first.h2 + first.ws;
    const cur = last.h1 + last.h2 + last.ws;
    return { current: cur, previous: prev };
  }, [data]);
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-between gap-2">
      <div className="shrink-0">
        <p className="font-numeric-dial text-3xl text-[var(--accent-cyan)]">
          <CountUp value={totals.current} />{" "}
          <span className="text-base font-medium text-[var(--text-tertiary)]">
            conns
          </span>
        </p>
        <DeltaIndicator
          current={totals.current}
          previous={totals.previous}
          unit="conns"
          invertColors={false}
        />
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`c1-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d7cfe" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4d7cfe" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`c2-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`c3-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb020" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#ffb020" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid-line)" vertical={false} />
          <XAxis dataKey="t" type="number" hide />
          <YAxis hide />
          <Tooltip
            content={({ payload }) =>
              payload?.length ? (
                <div className="font-numeric-dial rounded-lg border border-white/[0.1] bg-black px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                  HTTP/1.1 {Math.round(Number(payload[0]?.value))} · HTTP/2{" "}
                  {Math.round(Number(payload[1]?.value))} · WS{" "}
                  {Math.round(Number(payload[2]?.value))}
                </div>
              ) : null
            }
          />
          <Area
            type="natural"
            dataKey="h1"
            stackId="a"
            stroke="#4d7cfe"
            fill={`url(#c1-${uid})`}
          />
          <Area
            type="natural"
            dataKey="h2"
            stackId="a"
            stroke="#00e5ff"
            fill={`url(#c2-${uid})`}
          />
          <Area
            type="natural"
            dataKey="ws"
            stackId="a"
            stroke="#ffb020"
            fill={`url(#c3-${uid})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AnomalyBody() {
  const anomalies = useDashboardStore((s) => s.anomalies);
  const isFail = useDashboardStore((s) => s.isSimulatingFailure);
  const score = useMemo(
    () => anomalyScoreFromStore(anomalies.length, isFail),
    [anomalies.length, isFail],
  );
  const prevScore = useMemo(
    () => syntheticPreviousValue(score, anomalies.length * 7919 + (isFail ? 3 : 1)),
    [score, anomalies.length, isFail],
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
        <DeltaIndicator
          current={score}
          previous={prevScore}
          invertColors
          decimals={2}
        />
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

function serviceMapAbbr(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

function ServiceMapBody() {
  const tileSize = useWidgetSize();
  const services = useDashboardStore((s) => s.services);
  const maxNodes = tileSize === "1x1" ? 4 : tileSize === "2x2" ? 6 : 5;
  const nodes = services.slice(0, maxNodes);

  const ring = cn(
    "font-numeric-dial flex shrink-0 items-center justify-center rounded-full border-2 bg-[rgba(255,255,255,0.07)] uppercase tracking-wide text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
    tileSize === "2x2" && "h-[4.5rem] w-[4.5rem] text-sm",
    tileSize === "3x1" && "h-14 w-14 text-xs",
    tileSize === "2x1" && "h-12 w-12 text-xs",
    tileSize === "1x1" && "h-11 w-11 text-[10px]",
  );

  const labelClass = cn(
    "w-full text-center font-medium leading-snug text-[var(--text-secondary)] [font-family:var(--font-ui)]",
    tileSize === "2x2" && "text-[13px]",
    tileSize === "3x1" && "text-[12px]",
    (tileSize === "2x1" || tileSize === "1x1") && "text-[11px]",
  );

  const healthyPct = useMemo(() => {
    const list = services.slice(0, maxNodes);
    if (list.length === 0) return 100;
    const n = list.filter((s) => s.status === "healthy").length;
    return (n / list.length) * 100;
  }, [services, maxNodes]);
  const prevHealthyPct = useMemo(
    () => syntheticPreviousValue(healthyPct, services.length + maxNodes + 501),
    [healthyPct, services.length, maxNodes],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-x-auto overflow-y-hidden pb-0.5">
      <div className="shrink-0 px-1">
        <p className="font-numeric-dial text-2xl text-[var(--text-primary)]">
          <CountUp value={healthyPct} decimals={0} />
          <span className="text-sm font-medium text-[var(--text-tertiary)]">
            % healthy
          </span>
        </p>
        <DeltaIndicator
          current={healthyPct}
          previous={prevHealthyPct}
          unit="%"
          invertColors={false}
          decimals={0}
        />
      </div>
      <div className="flex min-w-0 items-center justify-center">
        {nodes.map((s, i) => {
          const color =
            s.status === "healthy"
              ? "var(--accent-green)"
              : s.status === "degraded"
                ? "var(--accent-amber)"
                : "var(--accent-red)";
          const title = `${s.displayName} · ${s.status} · ${Math.round(s.latency)} ms`;
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <div
                  className="h-px min-w-[6px] flex-1 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "flex max-w-[min(100%,6.75rem)] shrink-0 flex-col items-center gap-2 px-1 sm:max-w-[7.5rem]",
                  tileSize === "2x2" && "max-w-[8.5rem] gap-2.5",
                )}
              >
                <div
                  className={ring}
                  style={{ borderColor: color }}
                  title={title}
                >
                  {serviceMapAbbr(s.displayName)}
                </div>
                <p
                  className={cn(labelClass, "line-clamp-2")}
                  title={s.displayName}
                >
                  {s.displayName}
                </p>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function IncidentTimelineBody() {
  const events = useDashboardStore((s) => s.incidentTimeline);
  const [now, setNow] = useState(() => Date.now());
  const len = events.length;
  const previousIncidentCount = useMemo(
    () => syntheticPreviousValue(len, len * 997 + 13),
    [len],
  );
  useEffect(() => {
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
      <div
        className={cn(
          "relative h-[88px] w-full shrink-0",
          events.length === 0 ? "flex items-center" : "",
        )}
      >
        {events.length > 0 && (
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
        )}
        {events.length === 0 ? (
          <p className="px-1 text-[13px] text-[var(--text-tertiary)]">
            No incidents in session.
          </p>
        ) : (
          events.map((ev) => {
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
