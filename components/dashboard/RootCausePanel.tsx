'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Search, AlertOctagon, Info } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import type { DependencyEdge } from '@/lib/types'

// Service node positions in the SVG (viewBox 0 0 320 180)
const nodePositions: Record<string, { x: number; y: number; label: string }> = {
  client:          { x: 40,  y: 90,  label: 'Client' },
  'api-gateway':   { x: 120, y: 90,  label: 'API GW' },
  'user-service':  { x: 220, y: 40,  label: 'User' },
  'payment-service': { x: 220, y: 90,  label: 'Payment' },
  'auth-service':  { x: 220, y: 140, label: 'Auth' },
}

function DependencyGraph({ dependencies, rootService }: { dependencies: DependencyEdge[]; rootService: string }) {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" style={{ maxHeight: 160 }}>
      {/* Edges */}
      {dependencies.map((edge, i) => {
        const from = nodePositions[edge.from]
        const to = nodePositions[edge.to]
        if (!from || !to) return null
        return (
          <motion.line
            key={i}
            x1={from.x + 22}
            y1={from.y}
            x2={to.x - 22}
            y2={to.y}
            stroke={edge.affected ? '#f87171' : 'rgba(255,255,255,0.15)'}
            strokeWidth={edge.affected ? 2 : 1}
            strokeDasharray={edge.affected ? '4 3' : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          />
        )
      })}

      {/* Nodes */}
      {Object.entries(nodePositions).map(([id, pos]) => {
        const isRoot = id === rootService
        const isClient = id === 'client'
        const isAffectedEdge = dependencies.some(e => e.to === id && e.affected)
        return (
          <motion.g key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.05 }}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isRoot ? 24 : 20}
              fill={isRoot ? 'rgba(239,68,68,0.12)' : isClient ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.06)'}
              stroke={isRoot ? '#f87171' : isAffectedEdge ? '#f87171' : 'rgba(255,255,255,0.18)'}
              strokeWidth={isRoot ? 1.5 : 1}
            />
            <text
              x={pos.x}
              y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isRoot ? '9' : '8'}
              fill={isRoot ? '#fca5a5' : 'rgba(255,255,255,0.6)'}
              fontFamily="monospace"
              fontWeight={isRoot ? 'bold' : 'normal'}
            >
              {pos.label}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}

interface RootCausePanelProps {
  variant?: 'default' | 'embedded'
}

export function RootCausePanel({ variant = 'default' }: RootCausePanelProps) {
  const rootCause = useDashboardStore(s => s.rootCause)

  const inner = (
    <>
      {variant === 'default' && (
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-[#4b5563]" />
          <h2 className="text-sm font-semibold text-white">Root cause analysis</h2>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!rootCause ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-6 gap-2"
          >
            <Info className="w-7 h-7 text-[#4b5563]" />
            <p className="text-[0.875rem] text-[#9ca3af]">Awaiting anomaly data</p>
            <p className="text-[0.75rem] text-[#4b5563]">RCA runs after anomaly detection</p>
          </motion.div>
        ) : (
          <motion.div
            key="rca"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col gap-3"
          >
            {/* Root cause service highlight */}
            <motion.div
              className="rounded-xl p-3 border border-red-500/25 bg-red-500/[0.06]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-400/90" />
                <span className="text-xs text-red-300/90 font-medium">Affects service</span>
              </div>
              <p className="text-base font-mono font-semibold text-red-200/95 mt-1">{rootCause.service}</p>
            </motion.div>

            {/* Reasons */}
            <div className="flex flex-col gap-1.5">
              <p className="section-label">Identified reasons</p>
              {rootCause.reasons.map((reason, i) => (
                <motion.div
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-red-400/70 text-xs mt-0.5">→</span>
                  <span className="text-[0.875rem] text-[#9ca3af] leading-relaxed">{reason}</span>
                </motion.div>
              ))}
            </div>

            {/* Dependency graph */}
            <div>
              <p className="section-label mb-2">Dependency map</p>
              <div className="glass-l1 rounded-xl p-3 border border-white/[0.1]">
                <DependencyGraph dependencies={rootCause.dependencies} rootService={rootCause.service} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  if (variant === 'embedded') {
    return <div className="flex flex-col gap-3">{inner}</div>
  }

  return (
    <section className="glass-l2 p-6 md:p-8 flex flex-col gap-3">
      {inner}
    </section>
  )
}
