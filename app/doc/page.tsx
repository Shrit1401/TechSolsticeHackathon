import type { Metadata } from "next";
import { ArchitectureDoc } from "@/components/doc";

export const metadata: Metadata = {
  title: "Architecture — Multi-signal anomaly detection",
  description:
    "Digital twin view of the observability stack: metrics, logs, traces, fusion, and remediation.",
};

export default function DocPage() {
  return <ArchitectureDoc />;
}
