import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Docs", template: "%s · Docs" },
  description: "Architecture and anomaly engine documentation.",
};

export default function DocLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black">{children}</div>;
}
