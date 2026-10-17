import { motion, useAnimate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { fadeUp } from '../../lib/motion'
import type { StatStatus } from '../../types'
import AnimatedNumber from '../AnimatedNumber'

interface StatCardProps {
  label: string
  /** Display text (used as-is when `numeric` is absent, e.g. "—" or a band name). */
  value: string
  /** When set, the value counts up/down to this number instead of jumping. */
  numeric?: number
  digits?: number
  unit?: string
  status: StatStatus
  statusText: string
  /** No reading yet: neutral badge instead of a green "good" one. */
  pending?: boolean
  hint: string
}

const STATUS_STYLES: Record<StatStatus, { badge: string; dot: string; ring: string; value: string }> = {
  good: {
    badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    dot: 'bg-emerald-400',
    ring: 'border-slate-800 hover:border-cyan-500/40',
    value: 'text-white',
  },
  abnormal: {
    badge: 'bg-red-500/10 border-red-500/30 text-red-300',
    dot: 'bg-red-400 animate-pulse',
    ring: 'border-red-500/50 shadow-[0_0_24px_-8px_rgb(239_68_68/0.5)]',
    value: 'text-red-200',
  },
}

const PENDING_BADGE = 'bg-slate-500/10 border-slate-600 text-slate-400'
const PENDING_DOT = 'bg-slate-500 animate-pulse'

export default function StatCard({ label, value, numeric, digits = 1, unit, status, statusText, hint, pending = false }: StatCardProps) {
  const s = STATUS_STYLES[status]
  const badge = pending ? PENDING_BADGE : s.badge
  const dot = pending ? PENDING_DOT : s.dot
  const [scope, animateCard] = useAnimate<HTMLElement>()
  const reduce = useReducedMotion()
  const prevStatus = useRef(status)

  // Edge-triggered: flash red (and shake, unless reduced motion) only when the card *becomes* abnormal.
  useEffect(() => {
    const was = prevStatus.current
    prevStatus.current = status
    if (status !== 'abnormal' || was === 'abnormal' || !scope.current) return

    void animateCard('[data-flash]', { opacity: [0, 1, 0] }, { duration: 0.7, ease: 'easeOut' })
    if (!reduce) void animateCard(scope.current, { x: [0, -6, 6, -4, 4, -2, 0] }, { duration: 0.45 })
  }, [status, reduce, animateCard, scope])

  return (
    <motion.article
      ref={scope}
      variants={fadeUp}
      className={`glow-card p-5 rounded-2xl bg-slate-900/60 backdrop-blur border ${s.ring}`}
    >
      <span
        data-flash
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl bg-red-500/20 ring-1 ring-red-400/60 opacity-0"
      />
      <div className="relative flex items-start justify-between gap-3">
        <h2 className="text-sm text-slate-400">{label}</h2>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs whitespace-nowrap transition-colors duration-300 ${badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
          {statusText}
        </span>
      </div>
      <p className={`relative mt-3 text-3xl font-bold tracking-tight tabular-nums transition-colors duration-300 ${s.value}`}>
        {numeric === undefined ? value : <AnimatedNumber value={numeric} digits={digits} />}
        {unit && <span className="ml-1 text-base font-medium text-slate-400">{unit}</span>}
      </p>
      <p className="relative mt-1 text-xs text-slate-500">{hint}</p>
    </motion.article>
  )
}
