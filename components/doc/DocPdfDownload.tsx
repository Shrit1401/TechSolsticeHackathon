"use client";

import { Download } from "lucide-react";
import { useCallback, useState, type RefObject } from "react";
import { exportArchitecturePdf } from "@/lib/exportArchitecturePdf";

export function DocPdfDownload({
  targetRef,
}: {
  targetRef: RefObject<HTMLElement | null>;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    const el = targetRef.current;
    if (!el || busy) return;
    setBusy(true);
    try {
      await exportArchitecturePdf(el);
    } finally {
      setBusy(false);
    }
  }, [busy, targetRef]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100/95 shadow-[0_0_28px_-10px_rgba(0,229,255,0.35)] backdrop-blur-sm transition-[background-color,opacity,box-shadow] hover:border-cyan-400/45 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download className="size-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      {busy ? "Generating PDF…" : "Download PDF"}
    </button>
  );
}
