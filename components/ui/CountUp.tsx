"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { useMetricCardMotion } from "@/contexts/MetricCardMotionContext";

export function CountUp({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const { countUpDelayMs } = useMetricCardMotion();
  const d = useCountUp(value, 600, countUpDelayMs);
  return (
    <span className="font-numeric-dial">
      {decimals > 0 ? d.toFixed(decimals) : Math.round(d).toString()}
    </span>
  );
}
