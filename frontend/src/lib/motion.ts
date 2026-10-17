import type { Transition, Variants } from 'framer-motion'

/** House easing: quick out, soft landing. */
export const EASE_OUT: Transition['ease'] = [0.22, 1, 0.36, 1]

/** Parent that reveals its children one after another. */
export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})

/** Child: fade in while sliding up ~16px (0.4 s). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
}

/** Route-level cross-fade used by Layout's AnimatePresence. */
export const pageFade: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
}
