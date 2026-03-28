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
    <div className="h-[52px] w-full min-w-0 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.25}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
