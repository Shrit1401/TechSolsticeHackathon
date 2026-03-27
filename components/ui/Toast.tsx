'use client'

import { AnimatePresence, motion } from 'framer-motion'

export function Toast({ message, open }: { message: string; open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-300 -translate-x-1/2 rounded-full border border-white/[0.1] bg-black px-4 py-2 text-[13px] text-[var(--text-primary)] shadow-lg [font-family:var(--font-ui)]"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
