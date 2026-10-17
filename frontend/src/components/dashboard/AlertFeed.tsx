import { AnimatePresence, motion } from 'framer-motion'
import { formatTime } from '../../lib/telemetry'
import type { Severity, TelemetryAlert } from '../../types'
import EmptyState from './EmptyState'

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-500/15 border-red-500/40 text-red-300',
  warning: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
}

const SEVERITY_EDGE: Record<Severity, string> = {
  critical: 'before:bg-red-400',
  warning: 'before:bg-amber-400',
}

export default function AlertFeed({ alerts }: { alerts: TelemetryAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="relative h-56 lg:h-80">
        <EmptyState icon="bell" title="All clear" message="Abnormal readings (RSSI < -100 dBm, SNR < 10 dB) will appear here." />
      </div>
    )
  }

  return (
    <ol aria-live="polite" className="max-h-80 lg:h-80 overflow-y-auto overflow-x-hidden space-y-2 pr-1">
      <AnimatePresence initial={false}>
        {alerts.map((a) => (
          <motion.li
            key={a.id}
            layout="position"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`relative p-3 pl-4 rounded-2xl bg-slate-800/50 border border-slate-800 overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 ${SEVERITY_EDGE[a.severity]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[a.severity]}`}>
                {a.severity}
              </span>
              <time dateTime={new Date(a.timestamp).toISOString()} className="text-xs text-slate-500 tabular-nums">
                {formatTime(a.timestamp)}
              </time>
            </div>
            <p className="mt-1.5 text-sm text-slate-200">{a.message}</p>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  )
}
