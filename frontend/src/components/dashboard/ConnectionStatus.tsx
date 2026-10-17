import type { ConnectionState, FeedSource } from '../../types'

const STYLES: Record<ConnectionState, { dot: string; pill: string; label: string }> = {
  connected: {
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    label: 'Live',
  },
  connecting: {
    dot: 'bg-amber-400 animate-pulse',
    pill: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    label: 'Connecting…',
  },
  disconnected: {
    dot: 'bg-red-400',
    pill: 'bg-red-500/10 border-red-500/30 text-red-300',
    label: 'Disconnected',
  },
  paused: {
    dot: 'bg-slate-500',
    pill: 'bg-slate-500/10 border-slate-600 text-slate-300',
    label: 'Paused',
  },
}

interface ConnectionStatusProps {
  state: ConnectionState
  source: FeedSource | null
}

/** Socket.io connection dot + label (colour AND text, never colour alone). */
export default function ConnectionStatus({ state, source }: ConnectionStatusProps) {
  const s = STYLES[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs backdrop-blur transition-colors duration-300 ${s.pill}`}
    >
      <span className="relative flex w-2 h-2" aria-hidden="true">
        {/* Expanding ring = "the link is alive"; only while connected. */}
        {state === 'connected' && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring" />}
        <span className={`relative w-2 h-2 rounded-full ${s.dot}`} />
      </span>
      {s.label}
      {state === 'connected' && source && <span className="text-slate-400">· {source} · 1 Hz</span>}
    </span>
  )
}
