'use client'

import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  enabled: boolean
  engaged: boolean
  restoring: boolean
  onClick: () => void
}

export function AdaptiveModeButton({ enabled, engaged, restoring, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={restoring}
      className={cn(
        'inline-flex w-full min-w-0 items-center justify-center gap-0 rounded-full px-5 py-3 text-[0.9375rem] font-medium shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors [font-family:var(--font-ui)]',
        !enabled && 'adaptive-btn-off hover:border-white/[0.18] hover:bg-black',
        enabled && 'adaptive-btn-on',
        restoring && 'cursor-wait opacity-70',
      )}
      aria-pressed={enabled}
    >
      <span className="inline-flex items-center">
        <Zap className="mr-2 size-[1.125rem] opacity-90" strokeWidth={1.75} aria-hidden />
        Adaptive mode
        {enabled && (
          <span
            className={cn(
              'adaptive-indicator',
              engaged ? 'adaptive-indicator-engaged' : 'adaptive-indicator-idle',
            )}
            aria-hidden
          />
        )}
      </span>
    </button>
  )
}
