import { motion } from 'framer-motion'

type IconName = 'signal' | 'database' | 'bell' | 'antenna' | 'warning'
type Tone = 'neutral' | 'warning' | 'error'

const ICONS: Record<IconName, string> = {
  // Paths are 24×24 stroke icons.
  signal: 'M2 12h3l2-6 4 12 3-9 2 3h6',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4.3 13a2 2 0 0 0 3.4 0',
  antenna: 'M12 12v9m-4 0h8M8.5 8.5a5 5 0 0 1 7 0M5.6 5.6a9 9 0 0 1 12.8 0M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  warning: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
}

const TONES: Record<Tone, { ring: string; icon: string }> = {
  neutral: { ring: 'bg-cyan-500/10 border-cyan-500/25', icon: 'text-cyan-300' },
  warning: { ring: 'bg-amber-500/10 border-amber-500/30', icon: 'text-amber-300' },
  error: { ring: 'bg-red-500/10 border-red-500/30', icon: 'text-red-300' },
}

interface EmptyStateProps {
  icon: IconName
  title: string
  message?: string
  tone?: Tone
  /** Overlay the parent (charts) instead of taking up space in the flow. */
  overlay?: boolean
}

/** Consistent "nothing here yet" / "offline" placeholder: icon badge, title, one line of help. */
export default function EmptyState({ icon, title, message, tone = 'neutral', overlay = true }: EmptyStateProps) {
  const t = TONES[tone]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`${overlay ? 'absolute inset-0 z-10' : 'py-12'} flex flex-col items-center justify-center text-center px-6 pointer-events-none`}
    >
      <span className={`mb-3 inline-flex w-11 h-11 items-center justify-center rounded-2xl border ${t.ring}`}>
        <svg className={`w-5 h-5 ${t.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICONS[icon]} />
        </svg>
      </span>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {message && <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>}
    </motion.div>
  )
}
