"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Box,
  Brain,
  Cpu,
  Database,
  GitBranch,
  Layers,
  Network,
  RefreshCw,
  Shield,
  Sigma,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DocFigure } from "@/components/doc/DocFigure";
import { DocPdfDownload } from "@/components/doc/DocPdfDownload";
import { DocHackathonFooter } from "@/components/doc/DocHackathonFooter";
import { MathDisplay } from "@/components/doc/KatexMath";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const services = [
  { name: "user-service", role: "Upstream app", tone: "from-cyan-500/20 to-cyan-500/5" },
  { name: "payment-service", role: "Upstream app", tone: "from-violet-500/20 to-violet-500/5" },
  { name: "api-gateway", role: "Metrics + trace entry", tone: "from-emerald-500/20 to-emerald-500/5" },
  { name: "prometheus", role: "Scrape & TSDB", tone: "from-amber-500/15 to-amber-500/5" },
  { name: "grafana", role: "Dashboards", tone: "from-sky-500/15 to-sky-500/5" },
  { name: "jaeger", role: "Traces", tone: "from-fuchsia-500/20 to-fuchsia-500/5" },
  { name: "loki + promtail", role: "Logs", tone: "from-rose-500/15 to-rose-500/5" },
  { name: "detector-service", role: "FastAPI /detect + workers", tone: "from-[var(--accent-cyan)]/25 to-transparent" },
];

const fusionWeights = [
  { name: "Metric layer", value: 40, fill: "var(--chart-line-primary)" },
  { name: "Log layer", value: 40, fill: "var(--accent-purple)" },
  { name: "Trace layer", value: 20, fill: "var(--accent-amber)" },
];

const signalScores = [
  { signal: "Errors", path: "Gateway Δcounters → threshold 0.2", icon: Zap },
  { signal: "Latency ML", path: "LSTM → autoencoder fallback", icon: Brain },
  { signal: "Logs", path: "MiniLM embeddings + z-score", icon: Waves },
  { signal: "Traces", path: "Jaeger heuristics", icon: GitBranch },
];

const body = "text-lg leading-[1.75] text-zinc-300 sm:text-xl sm:leading-[1.7]";
const bodyTight = "text-base leading-relaxed text-zinc-300 sm:text-lg";
const note = "text-base leading-relaxed text-zinc-400 sm:text-lg";

const LATEX_METRIC = String.raw`\begin{aligned}
\text{error}_m &= \left\lvert \text{actual\_metric} - \text{predicted\_metric} \right\rvert \\
\text{threshold}_m &= P_{95}(\text{training\_errors}) \\
\text{metric\_score} &= \min\left( \frac{\text{error}_m}{\text{threshold}_m},\, 1 \right)
\end{aligned}`;

const LATEX_LOG = String.raw`\text{log\_score} = 1 - P(\text{log\_sequence})`;

const LATEX_TRACE = String.raw`\begin{aligned}
\text{error}_t &= \left\lvert \text{actual\_span\_latency} - \text{baseline\_latency} \right\rvert \\
\text{threshold}_t &= P_{95}(\text{trace\_training\_errors}) \\
\text{trace\_score} &= \min\left( \frac{\text{error}_t}{\text{threshold}_t},\, 1 \right)
\end{aligned}`;

const LATEX_CONFIDENCE = String.raw`\begin{aligned}
\text{confidence} &= 0.4\,\text{metric\_score} + 0.35\,\text{log\_score} \\
&\quad + 0.25\,\text{trace\_score}
\end{aligned}`;

const LATEX_MULTISIGNAL = String.raw`\text{count}(\text{scores} > 0.6) \geq 2`;

const LATEX_SMOOTH = String.raw`\text{final\_confidence} = \operatorname{mean}(\text{conf}_{t_1},\, \text{conf}_{t_2},\, \text{conf}_{t_3})`;

const LATEX_ROOT = String.raw`\text{root\_cause} = \operatorname*{arg\,max}_{i} \,\text{confidence\_service}_i`;

export default function ArchitectureDoc() {
  const pdfRef = useRef<HTMLElement>(null);

  return (
    <div className="relative z-10 min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,rgba(0,229,255,0.14),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(124,58,237,0.08),transparent_50%)]" />

      <header className="glass-header-strip sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="text-base text-zinc-400 transition-colors hover:text-white"
          >
            ← Control center
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <DocPdfDownload targetRef={pdfRef} />
            <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80 sm:inline">
              TechSolstice 2026
            </span>
            <span className="section-label text-sm tracking-[0.2em] text-[var(--accent-cyan)]">Architecture</span>
          </div>
        </div>
      </header>

      <main
        ref={pdfRef}
        id="architecture-doc-pdf"
        className="relative mx-auto max-w-6xl bg-black px-5 pb-32 pt-14 sm:px-8"
      >
        <motion.section
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-20 text-center sm:mb-28"
        >
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-100/90 shadow-[0_0_32px_-8px_rgba(0,229,255,0.35)] backdrop-blur-md">
            <Sparkles className="size-4 text-[var(--accent-cyan)]" />
            RecoX WOrking
          </div>
          <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl md:leading-[1.08]">
            Multi-signal anomaly detection
          </h1>
          <p className={`mx-auto max-w-3xl ${body}`}>
            A live software twin of a microservice stack: metrics, logs, and traces feed one FastAPI brain that
            answers —{" "}
            <span className="font-medium text-white">is something wrong right now, and with what confidence?</span>
          </p>
        </motion.section>

        <motion.section
          custom={1}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Network className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            The twin idea
          </h2>
          <div className="rounded-3xl border border-white/10 bg-zinc-950/40 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_80px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-10 md:p-12">
            <p className={`mb-10 max-w-4xl ${body}`}>
              Think of the running Docker stack as the <strong className="font-semibold text-white">physical plant</strong>.
              Prometheus, Loki, and Jaeger are <strong className="font-semibold text-white">sensors</strong>. The detector
              service is a <strong className="font-semibold text-white">reasoning layer</strong> on top: it never trusts a
              single signal — HTTP errors, latency history (with optional deep learning), log semantics, and trace structure
              fuse into one decision, with optional remediation when the twin screams anomaly.
            </p>
            <TwinDiagram />
          </div>
        </motion.section>

        <motion.section
          custom={2}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Box className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            System layout (Docker)
          </h2>
          <p className={`mb-10 max-w-4xl ${body}`}>
            <code className="rounded-lg bg-white/10 px-2 py-1 text-lg font-normal text-cyan-300">docker-compose</code>{" "}
            wires
            apps, observability, and the detector. The gateway exposes Prometheus metrics; Promtail ships container logs to
            Loki; Jaeger receives traces.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {services.map((s, i) => (
              <motion.div
                key={s.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                className={`rounded-2xl border border-white/15 bg-gradient-to-br ${s.tone} p-6 shadow-lg shadow-black/40 ring-1 ring-white/5 transition-shadow hover:shadow-[0_0_40px_-12px_rgba(0,229,255,0.15)] sm:p-7`}
              >
                <div className="font-mono text-lg font-medium tracking-tight text-white">{s.name}</div>
                <div className="mt-2 text-base text-zinc-400">{s.role}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Cpu className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Gateway instrumentation
          </h2>
          <div className="rounded-3xl border border-white/10 bg-zinc-950/40 p-8 backdrop-blur-xl sm:p-10">
            <p className={`mb-10 ${body}`}>
              The API gateway uses <span className="font-medium text-white">prometheus_client</span>: counters for
              requests and 5xx errors, plus a latency histogram. That yields fast local error rates from two scrapes and rich
              time series in Prometheus for ML and PromQL fallbacks.
            </p>
            <MetricsFlow />
          </div>
        </motion.section>

        <motion.section
          custom={4}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Layers className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Detector: HTTP path vs background workers
          </h2>
          <DetectorSplitDiagram />
        </motion.section>

        <motion.section
          custom={5}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Activity className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Four signals into the twin
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
            {signalScores.map(({ signal, path, icon: Icon }, i) => (
              <motion.div
                key={signal}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                className="flex gap-5 rounded-3xl border border-white/10 bg-zinc-950/50 p-7 shadow-lg shadow-black/30 backdrop-blur-md transition-shadow hover:border-cyan-500/20 hover:shadow-[0_20px_50px_-20px_rgba(0,229,255,0.12)] sm:p-8"
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/20 to-transparent shadow-inner shadow-cyan-500/10">
                  <Icon className="size-7 text-[var(--accent-cyan)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-semibold text-white">{signal}</div>
                  <div className={`mt-2 ${bodyTight}`}>{path}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          custom={6}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-6 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Sigma className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Anomaly engine
          </h2>
          <p className={`mb-10 max-w-3xl ${body}`}>
            Predicted vs actual residuals for metrics and traces, sequence surprise for logs, then a weighted blend and
            gating. Engine doc uses{" "}
            <span className="font-medium text-white">0.4 / 0.35 / 0.25</span> for combined confidence; live{" "}
            <code className="rounded-md bg-white/10 px-2 py-0.5 text-cyan-300">fuse_signals</code> defaults are{" "}
            <span className="font-medium text-white">0.4 / 0.4 / 0.2</span> (see Fusion policy).
          </p>

          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Telemetry shapes</h3>
          <div className="mb-14 overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/30">
            <table className="w-full min-w-[min(100%,520px)] text-left text-base">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="px-5 py-4 font-medium text-zinc-300">Type</th>
                  <th className="px-5 py-4 font-medium text-zinc-300">Format</th>
                  <th className="px-5 py-4 font-medium text-zinc-300">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-200">
                <tr>
                  <td className="px-5 py-4 font-medium text-cyan-400/95">metric</td>
                  <td className="px-5 py-4 text-zinc-300">numbers over time</td>
                  <td className="px-5 py-4 font-mono text-[0.95rem] text-zinc-100 sm:text-base">latency = 4820 ms</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-medium text-cyan-400/95">log</td>
                  <td className="px-5 py-4 text-zinc-300">text events</td>
                  <td className="px-5 py-4 font-mono text-[0.95rem] text-zinc-100 sm:text-base">
                    &quot;database timeout error&quot;
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-medium text-cyan-400/95">trace</td>
                  <td className="px-5 py-4 text-zinc-300">request path timing</td>
                  <td className="px-5 py-4 font-mono text-[0.95rem] text-zinc-100 sm:text-base">
                    payment-service took 4820 ms
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mx-auto max-w-4xl space-y-12">
            <FormulaSection
              step="01"
              title="Metric score (LSTM residual)"
              footnote={
                <>
                  <span className="font-medium text-zinc-300">Read as:</span> 0 is normal, 1 is a strong anomaly.{" "}
                  <span className="text-zinc-500">P₉₅ denotes the 95th percentile.</span>
                </>
              }
            >
              <MathDisplay latex={LATEX_METRIC} />
              <DocFigure
                src="/lstm_anomaly_timeline.png"
                alt="LSTM anomaly chart: observed vs forecast, absolute error, and threshold over time windows"
                caption="LSTM anomaly: prediction error vs rolling baseline — error spikes past μ + 2σ on the last window."
              />
            </FormulaSection>

            <FormulaSection
              step="02"
              title="Log score (sequence abnormality)"
              footnote={
                <>
                  <span className="font-medium text-zinc-300">P(log_sequence)</span> is the probability of the sequence under
                  normal behaviour; lower probability means a higher score.
                </>
              }
            >
              <MathDisplay latex={LATEX_LOG} />
            </FormulaSection>

            <FormulaSection step="03" title="Trace score (latency deviation)">
              <MathDisplay latex={LATEX_TRACE} />
              <DocFigure
                className="mt-6"
                src="/trace_score_baseline_example.png"
                alt="Bar chart: illustrative trace training errors in ms with P95 threshold and example baseline vs actual latency"
                caption="Trace anomaly: error from actual vs baseline span latency; threshold from P₉₅ of training errors; score capped at 1."
              />
            </FormulaSection>

            <FormulaSection step="04" title="Combined confidence">
              <MathDisplay latex={LATEX_CONFIDENCE} />
            </FormulaSection>

            <FormulaSection
              step="05"
              title="Multi-signal validation"
              footnote="Require at least two strong signals before acting to reduce false positives."
            >
              <MathDisplay latex={LATEX_MULTISIGNAL} />
            </FormulaSection>

            <FormulaSection step="06" title="Temporal smoothing (3 checks)">
              <MathDisplay latex={LATEX_SMOOTH} />
            </FormulaSection>

            <FormulaSection step="07" title="Root cause">
              <MathDisplay latex={LATEX_ROOT} />
            </FormulaSection>

            <div>
              <FormulaSectionHeader step="08" title="Pipeline flow" />
              <PipelineFlowBlock
                text={String.raw`Locust traffic
→ Telemetry collection (Prometheus + Loki + Jaeger)
→ metric_score  (LSTM)
→ log_score     (LogBERT)
→ trace_score   (Jaeger deviation)
→ Confidence score per service
→ Multi-signal validation (≥ 2 signals > 0.6)
→ Temporal smoothing (3 consecutive checks)
→ Root cause detection (argmax)
→ Automated remediation`}
              />
            </div>
          </div>
        </motion.section>

        <motion.section
          custom={7}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <Database className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Fusion policy
          </h2>
          <p className={`mb-10 max-w-4xl ${body}`}>
            Metric layer takes the max of normalized error pressure and ML when ML fires. Logs scale by{" "}
            <code className="rounded-md bg-white/10 px-2 py-0.5 text-cyan-300">LOG_SCORE_SCALE</code>. Traces are binary. Weights default to{" "}
            <span className="font-semibold text-white">0.4 / 0.4 / 0.2</span> and renormalize if a layer is off. Final
            anomaly ORs metric, log, and trace flags; confidence gets floors and small bonuses for multi-signal agreement.
          </p>
          <DocFigure
            className="mb-10"
            src="/signal_fusion_radar.png"
            alt="Radar chart: metric, log, and trace scores fused into confidence"
            caption="Signal fusion radar: weights for metric (0.40), log (0.35), and trace (0.25) toward combined confidence."
          />
          <div className="rounded-3xl border border-white/10 bg-zinc-950/40 p-6 backdrop-blur-xl sm:p-10">
            <div className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Default fusion weights (live stack)
            </div>
            <ChartShell height={320}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fusionWeights}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={124}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={2}
                  >
                    {fusionWeights.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(17,17,24,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#e8ecf1",
                      fontSize: 16,
                    }}
                    formatter={(v) => [`${v ?? 0}%`, "weight"]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: 24 }}
                    formatter={(value) => <span className="text-base text-zinc-400">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartShell>
            <FusionBar />
          </div>
        </motion.section>

        <motion.section
          custom={8}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
          className="mb-20 sm:mb-24"
        >
          <h2 className="mb-8 flex items-center gap-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            <RefreshCw className="size-7 shrink-0 text-[var(--accent-cyan)]" />
            Remediation
          </h2>
          <div className="rounded-3xl border border-red-500/25 bg-gradient-to-br from-red-950/40 to-zinc-950/60 p-8 shadow-[0_0_60px_-20px_rgba(255,77,106,0.25)] backdrop-blur-xl sm:p-10">
            <div className="flex flex-wrap items-start gap-6">
              <Shield className="mt-1 size-10 shrink-0 text-[var(--accent-red)] drop-shadow-[0_0_12px_rgba(255,77,106,0.5)]" />
              <div>
                <p className={body}>
                  This section focuses on the system's approach to automated remediation. Here, we integrate detection and response: when an anomaly is identified by fusion, our logic can initiate steps to address potential faults autonomously. This demonstrates how observability and control mechanisms work together, providing a feedback loop designed to maintain system health and reduce manual intervention.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          custom={9}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={fadeUp}
        >
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
            Config surface (mental map)
          </h2>
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/30 shadow-inner backdrop-blur-sm">
            <table className="w-full min-w-[560px] text-left text-base">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-5 font-semibold text-white">Area</th>
                  <th className="p-5 font-semibold text-white">Examples</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-white/5">
                  <td className="p-5 font-mono text-sm font-medium text-cyan-400">Intervals</td>
                  <td className="p-5">ML, log, trace worker periods</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-5 font-mono text-sm font-medium text-cyan-400">Fusion</td>
                  <td className="p-5">
                    <code className="rounded bg-white/10 px-2 py-1 text-white">FUSION_W_*</code>,{" "}
                    <code className="rounded bg-white/10 px-2 py-1 text-white">LOG_SCORE_SCALE</code>
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-5 font-mono text-sm font-medium text-cyan-400">Loki</td>
                  <td className="p-5">LogQL query, limit, window, z</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-5 font-mono text-sm font-medium text-cyan-400">ML</td>
                  <td className="p-5">Model paths, scaler, lookback, step, σ</td>
                </tr>
                <tr>
                  <td className="p-5 font-mono text-sm font-medium text-cyan-400">Jaeger</td>
                  <td className="p-5">Service name, trace limit, API URL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.section>

        <DocHackathonFooter />
      </main>
    </div>
  );
}

function FormulaSectionHeader({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-3">
      <span className="font-mono text-xs font-semibold tabular-nums tracking-wider text-cyan-500/85">
        {step}
      </span>
      <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h3>
    </div>
  );
}

function FormulaSection({
  step,
  title,
  children,
  footnote,
}: {
  step: string;
  title: string;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <section className="scroll-mt-8">
      <FormulaSectionHeader step={step} title={title} />
      <FormulaCard footnote={footnote}>{children}</FormulaCard>
    </section>
  );
}

function FormulaCard({ children, footnote }: { children: ReactNode; footnote?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/35 px-4 py-6 sm:px-7 sm:py-7">
      {children}
      {footnote ? <div className={`mt-6 border-t border-white/[0.07] pt-5 ${note}`}>{footnote}</div> : null}
    </div>
  );
}

function PipelineFlowBlock({ text }: { text: string }) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines[0] ?? "";
  const steps = lines.slice(1).map((l) => l.replace(/^→\s*/, ""));
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/35 px-5 py-6 sm:px-7 sm:py-8">
      <p className="mb-6 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">{header}</p>
      <ol className="space-y-0">
        {steps.map((step, i) => (
          <motion.li
            key={`${i}-${step.slice(0, 24)}`}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-24px" }}
            transition={{ delay: Math.min(i * 0.03, 0.24), duration: 0.35 }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {i < steps.length - 1 && (
              <span
                className="absolute left-[0.65rem] top-8 bottom-0 w-px bg-zinc-700/80 sm:left-[0.7rem]"
                aria-hidden
              />
            )}
            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-center font-mono text-[11px] font-semibold text-zinc-300 sm:size-7 sm:text-xs">
              {i + 1}
            </span>
            <p className="min-w-0 pt-0.5 text-base leading-relaxed text-zinc-200 sm:text-lg">{step}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function TwinDiagram() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-zinc-900/80 to-black/90 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_80px_-30px_rgba(0,229,255,0.2)] sm:p-10">
      <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_0%,rgba(0,229,255,0.06)_45%,rgba(124,58,237,0.05)_55%,transparent_100%)]" />
      <div className="relative flex flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <TwinNode label="Real stack" sub="Containers & gateway" accent="border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]" />
        <FlowArrow className="hidden lg:flex" color="cyan" />
        <FlowArrowMobile className="flex lg:hidden" color="cyan" />
        <TwinNode label="Observability plane" sub="Prom · Loki · Jaeger" accent="border-violet-400/50 bg-violet-500/15 shadow-[0_0_40px_-12px_rgba(167,139,250,0.35)]" />
        <FlowArrow className="hidden lg:flex" color="violet" />
        <FlowArrowMobile className="flex lg:hidden" color="violet" />
        <TwinNode label="Detector twin" sub="Fusion + confidence" accent="border-amber-400/50 bg-amber-500/15 shadow-[0_0_40px_-12px_rgba(251,191,36,0.3)]" />
      </div>
      <div className="mt-10 flex justify-center">
        <div className="inline-flex max-w-xl items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-5 py-3 text-center text-base text-zinc-300 shadow-lg backdrop-blur-md sm:text-lg">
          <Sparkles className="size-5 shrink-0 text-amber-400" />
          The twin never sleeps on one sensor — it cross-checks metrics, ML, logs, and traces.
        </div>
      </div>
    </div>
  );
}

function FlowArrow({ className, color }: { className?: string; color: "cyan" | "violet" }) {
  const glow = color === "cyan" ? "rgba(34,211,238,0.45)" : "rgba(167,139,250,0.45)";
  return (
    <motion.div
      className={className}
      animate={{ opacity: [0.5, 1, 0.5], x: [0, 6, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <ArrowRight
        className="size-8"
        style={{ color: glow, filter: `drop-shadow(0 0 8px ${glow})` }}
        strokeWidth={2.5}
      />
    </motion.div>
  );
}

function FlowArrowMobile({ className, color }: { className?: string; color: "cyan" | "violet" }) {
  const glow = color === "cyan" ? "rgba(34,211,238,0.45)" : "rgba(167,139,250,0.45)";
  return (
    <motion.div
      className={`${className ?? ""} justify-center py-1`}
      animate={{ opacity: [0.5, 1, 0.5], y: [0, 5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <ArrowRight
        className="size-8 rotate-90"
        style={{ color: glow, filter: `drop-shadow(0 0 8px ${glow})` }}
        strokeWidth={2.5}
      />
    </motion.div>
  );
}

function TwinNode({
  label,
  sub,
  accent,
}: {
  label: string;
  sub: string;
  accent: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`w-full min-h-[120px] rounded-2xl border-2 px-6 py-6 text-center ring-1 ring-white/5 backdrop-blur-sm sm:min-h-[132px] lg:max-w-[280px] lg:flex-1 ${accent}`}
    >
      <div className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{label}</div>
      <div className="mt-2 text-base text-zinc-400 sm:text-lg">{sub}</div>
    </motion.div>
  );
}

function MetricsFlow() {
  const steps = ["Proxied requests", "Counters + histogram", "/metrics scrape", "Prometheus TSDB"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:gap-4 sm:text-base">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-3">
          <span className="rounded-xl border border-white/12 bg-white/5 px-4 py-3 font-medium text-zinc-100 shadow-inner backdrop-blur-sm sm:px-5 sm:py-3.5">
            {s}
          </span>
          {i < steps.length - 1 && (
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            >
              <ArrowRight className="size-5 shrink-0 text-cyan-400/80" strokeWidth={2.5} />
            </motion.span>
          )}
        </span>
      ))}
    </div>
  );
}

function DetectorSplitDiagram() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/40 to-zinc-950/80 p-8 shadow-lg backdrop-blur-md sm:p-10">
        <div className="mb-6 flex items-center gap-3 text-cyan-300">
          <Zap className="size-7" strokeWidth={2} />
          <span className="text-xl font-semibold">GET /detect (fast path)</span>
        </div>
        <ul className="space-y-4 text-lg leading-relaxed text-zinc-300">
          <li className="flex gap-3">
            <span className="font-mono text-cyan-500/80">1.</span>
            Live error rate from gateway metrics (or PromQL fallback)
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-cyan-500/80">2.</span>
            Read latest snapshots from in-memory globals (workers)
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-cyan-500/80">3.</span>
            Fuse, optionally remediate, return JSON
          </li>
        </ul>
      </div>
      <div className="rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/40 to-zinc-950/80 p-8 shadow-lg backdrop-blur-md sm:p-10">
        <div className="mb-6 flex items-center gap-3 text-violet-300">
          <Activity className="size-7" strokeWidth={2} />
          <span className="text-xl font-semibold">Background asyncio tasks</span>
        </div>
        <ul className="space-y-4 text-lg leading-relaxed text-zinc-300">
          <li className="flex gap-3">
            <span className="text-violet-500/80">•</span>
            Refresh ML, Loki, Jaeger snapshots on timers
          </li>
          <li className="flex gap-3">
            <span className="text-violet-500/80">•</span>
            Heavy CPU / blocking I/O via <code className="rounded-md bg-white/10 px-2 py-0.5 text-base text-white">asyncio.to_thread</code>
          </li>
          <li className="flex gap-3">
            <span className="text-violet-500/80">•</span>
            TensorFlow + requests stay off the hot event loop
          </li>
        </ul>
      </div>
    </div>
  );
}

function FusionBar() {
  const data = fusionWeights.map((w) => ({ name: w.name.replace(" layer", ""), weight: w.value }));
  return (
    <ChartShell height={200} className="mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 13 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={108}
            tick={{ fill: "#a1a1aa", fontSize: 14 }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="weight" radius={[0, 8, 8, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={fusionWeights[i].fill} />
            ))}
          </Bar>
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "rgba(17,17,24,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#e8ecf1",
            }}
            formatter={(v) => [`${v ?? 0}%`, ""]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function ChartShell({
  height,
  className,
  children,
}: {
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return (
    <div
      className={`w-full min-w-0 ${className ?? ""}`}
      style={{ height }}
    >
      {!ready ? (
        <div
          className="h-full w-full animate-pulse rounded-xl bg-white/[0.04]"
          aria-hidden
        />
      ) : (
        children
      )}
    </div>
  );
}
