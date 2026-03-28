"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import type { ChartPoint, TimeRange } from "@/lib/graphUtils";
import {
  averageError,
  formatAxisTime,
  mixHealthColors,
  healthT,
} from "@/lib/graphUtils";
import { cn } from "@/lib/utils";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-black px-3.5 py-2.5 shadow-xl">
      <p className="font-numeric-dial text-[11px] text-white/40">
        {typeof label === "number" ? new Date(label).toLocaleString() : "—"}
      </p>
      <div className="mt-2 space-y-1 font-numeric-dial text-[13px]">
        <p className="text-emerald-300/95">{Math.round(row.rr)} req/s</p>
        <p className="text-red-300/90">{row.er.toFixed(2)}% err</p>
        <p className="text-sky-200/85">{Math.round(row.lat)} ms</p>
      </div>
    </div>
  );
}

type GraphMainChartProps = {
  data: ChartPoint[];
  range: TimeRange;
  height: number;
  gradientId: string;
  className?: string;
  isFocus?: boolean;
  /** Overrides default axis tick formatting */
  tickFormatter?: (ts: number) => string;
};

export function GraphMainChart({
  data,
  range,
  height,
  gradientId,
  className,
  isFocus,
  tickFormatter: tickFormatterProp,
}: GraphMainChartProps) {
  const avgErr = useMemo(() => averageError(data), [data]);
  const tHealth = healthT(avgErr);
  const colors = mixHealthColors(tHealth);

  const lastIdx = Math.max(0, data.length - 1);

  const axisTick = {
    fill: "rgba(156,163,175,0.5)",
    fontSize: 10,
    fontFamily:
      "'Graph Tile Numerals', var(--font-numeric-display), var(--font-ui), sans-serif",
    fontWeight: 200,
  } as const;
  const axisTickRight = {
    ...axisTick,
    fill: "rgba(248,113,113,0.5)",
  } as const;

  return (
    <div
      className={cn("relative w-full min-w-0", className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{
            top: 12,
            right: isFocus ? 18 : 10,
            bottom: 4,
            left: isFocus ? 10 : 6,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.top} stopOpacity={0.38} />
              <stop offset="50%" stopColor={colors.mid} stopOpacity={0.1} />
              <stop offset="100%" stopColor={colors.top} stopOpacity={0} />
            </linearGradient>
            <filter
              id={`${gradientId}-glow`}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation={isFocus ? 3 : 2} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid
            stroke="rgba(255,255,255,0.045)"
            strokeDasharray="3 10"
            vertical={false}
          />

          <XAxis
            type="number"
            dataKey="t"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts) =>
              tickFormatterProp
                ? tickFormatterProp(ts as number)
                : formatAxisTime(ts as number, range)
            }
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v) => `${Math.round(v as number)}`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={axisTickRight}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
            animationDuration={200}
          />

          <Area
            yAxisId="left"
            type="natural"
            dataKey="rr"
            fill="none"
            stroke={colors.stroke}
            strokeWidth={isFocus ? 8 : 6}
            strokeOpacity={0.15}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            filter={`url(#${gradientId}-glow)`}
          />

          <Area
            yAxisId="left"
            type="natural"
            dataKey="rr"
            stroke={colors.stroke}
            strokeWidth={isFocus ? 2.3 : 1.9}
            strokeOpacity={0.96}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== lastIdx || cx == null || cy == null) return null;
              return (
                <g className="recharts-dot">
                  <motion.circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill={colors.stroke}
                    fillOpacity={0.12}
                    animate={{ r: [8, 18], opacity: [0.35, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={colors.stroke}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={1}
                  />
                </g>
              );
            }}
            activeDot={{
              r: 6,
              fill: colors.stroke,
              stroke: "rgba(255,255,255,0.4)",
              strokeWidth: 1,
            }}
            isAnimationActive
            animationDuration={420}
            animationEasing="ease-out"
          />

          <Line
            yAxisId="right"
            type="natural"
            dataKey="er"
            stroke="#fb7185"
            strokeWidth={1.35}
            strokeOpacity={0.88}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive
            animationDuration={480}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
