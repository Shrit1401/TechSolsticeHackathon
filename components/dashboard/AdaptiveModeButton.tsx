'use client'

import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { AdaptivePhase } from '@/hooks/useAdaptiveMode'

type Props = {
  phase: AdaptivePhase
  issueCount: number
  onClick: () => void
}

export function AdaptiveModeButton({ phase, issueCount, onClick }: Props) {
  const off = phase === 'disabled'
  const idle = phase === 'watching'
  const active = phase === 'engaged'
  const restoring = phase === 'restoring'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={restoring}
      className={cn(
        'inline-flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full border px-5 py-3 text-[0.9375rem] font-medium shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors [font-family:var(--font-ui)]',
        off && 'adaptive-btn-off',
        idle && 'adaptive-btn-idle',
        (active || restoring) && 'adaptive-btn-active',
        restoring && 'cursor-wait opacity-80',
      )}
      aria-pressed={!off}
    >
      <span className="inline-flex items-center gap-2">
        <motion.span
          animate={
            active
              ? { scale: [1, 1.12, 1], opacity: [1, 0.85, 1] }
              : { scale: 1, opacity: off ? 0.55 : 1 }
          }
          transition={active ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        >
          <Zap className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
        </motion.span>
        Adaptive mode
      </span>
      {!off && idle && (
        <span className="text-[10px] font-normal leading-tight text-[#4A5568]">Watching</span>
      )}
      {(active || restoring) && (
        <span className="text-[10px] font-normal leading-tight text-[#8A9AB0]">
          {restoring ? 'Restoring…' : `Active — ${issueCount} issue${issueCount === 1 ? '' : 's'}`}
        </span>
      )}
    </button>
  )
}
