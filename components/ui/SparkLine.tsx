"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { MetricPoint } from "@/lib/types";

export function SparkLine({
  data,
  color = "var(--accent-cyan)",
}: {
  data: MetricPoint[];
  color?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `spark-${uid}`;
  const chartData = data.map((d) => ({ v: d.value }));
  if (chartData.length === 0) return null;
  return (
    <div className="h-[58px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="50%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
