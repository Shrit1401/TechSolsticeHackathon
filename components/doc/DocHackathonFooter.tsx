"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

const TEAM = ["Shrit", "Rishikanth", "Tharun", "Rajvardhan"] as const;

export function DocHackathonFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-16 border-t border-white/10 pt-12 pb-8"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 text-center backdrop-blur-sm sm:px-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">
          <Trophy className="size-3.5 text-amber-400" aria-hidden />
          TechSolstice Hackathon 2026
        </div>
        <p className="mb-5 text-sm leading-relaxed text-zinc-500 sm:text-base">
          Built for the hackathon submission — observability architecture & anomaly engine documentation.
        </p>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">Team</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-200 sm:text-xl">
          {TEAM.join(" · ")}
        </p>
      </div>
      <p className="mt-10 text-center text-sm text-zinc-600">
        End-to-end observability demo — snapshot workers keep{" "}
        <code className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-zinc-500">GET /detect</code> responsive.
      </p>
    </motion.footer>
  );
}
