import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Wipes its chart in left → right on mount so lines appear to draw themselves.
 * Done with clip-path on the wrapper (not Recharts' own animation) so the 1 Hz
 * live updates afterwards don't re-trigger it.
 */
export default function ChartReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1], delay: 0.15 }}
    >
      {children}
    </motion.div>
  )
}
