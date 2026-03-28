"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

export function MathDisplay({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return latex.replace(/</g, "&lt;");
    }
  }, [latex]);

  return (
    <div
      className={[
        "doc-math min-h-[3rem] overflow-x-auto py-3 text-center sm:py-4",
        "[&_.katex]:text-[1.05rem] [&_.katex]:leading-relaxed sm:[&_.katex]:text-[1.15rem]",
        "[&_.katex]:text-zinc-100 [&_.katex-html]:text-zinc-100",
        className ?? "",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
