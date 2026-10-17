import { AnimatePresence, motion } from 'framer-motion'
import type { ChangeEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EASE_OUT } from '../lib/motion'
import type { FormField } from '../types'

/** Centered glass card used by the Login and Register pages. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex-1 flex items-center justify-center px-4 py-12">
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className="glow-panel relative w-full max-w-md bg-slate-900/70 backdrop-blur border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-950/40 p-6 sm:p-8"
      >
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30" />
          <span className="font-bold text-white text-lg">AeroSpec</span>
        </Link>
        {children}
      </motion.section>
    </main>
  )
}

interface AuthSuccessProps {
  title: string
  message: ReactNode
}

/** Success state shown briefly before redirecting to the dashboard. */
export function AuthSuccess({ title, message }: AuthSuccessProps) {
  return (
    <motion.div
      className="text-center py-8"
      role="status"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
        className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_-6px_rgb(34_211_238/0.6)]"
      >
        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="text-slate-400 text-sm mt-2">{message}</p>
      <p className="text-slate-500 text-xs mt-4">Redirecting to your dashboard…</p>
      <Link
        to="/dashboard"
        className="btn-lift inline-block mt-4 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
      >
        Open Dashboard
      </Link>
    </motion.div>
  )
}

interface AuthFieldsProps<K extends string> {
  fields: FormField<K>[]
  values: Record<K, string>
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  /** Per-field validation messages; a field with a message is marked invalid. */
  errors?: Partial<Record<K, string>>
  disabled?: boolean
}

export function AuthFields<K extends string>({ fields, values, onChange, errors = {}, disabled = false }: AuthFieldsProps<K>) {
  return (
    <>
      {fields.map((f) => {
        const error = errors[f.name]
        const errorId = `field-${f.name}-error`
        return (
          <div key={f.name}>
            <label htmlFor={`field-${f.name}`} className="block text-slate-300 text-sm mb-1.5">{f.label}</label>
            <input
              id={`field-${f.name}`}
              name={f.name}
              type={f.type}
              value={values[f.name]}
              onChange={onChange}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              required
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border text-white placeholder-slate-500 outline-none focus:ring-2 focus:bg-slate-800 disabled:opacity-60 transition ${
                error
                  ? 'border-red-500/60 focus:border-red-400 focus:ring-red-500/30'
                  : 'border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/30'
              }`}
            />
            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  id={errorId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="mt-1.5 text-xs text-red-300 overflow-hidden"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </>
  )
}

type AlertTone = 'error' | 'success' | 'info'

const ALERT_TONES: Record<AlertTone, string> = {
  error: 'border-red-500/40 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
}

/** Form-level message (server error, "email verified", etc.) that animates in. */
export function AuthAlert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  return (
    <motion.p
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 p-3 rounded-xl border text-sm ${ALERT_TONES[tone]}`}
    >
      {children}
    </motion.p>
  )
}

/** Primary submit button with an inline spinner while the request is in flight. */
export function AuthSubmit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="btn-lift w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 disabled:cursor-wait text-slate-950 font-semibold mt-2 inline-flex items-center justify-center gap-2"
    >
      {busy && <span className="h-4 w-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" aria-hidden="true" />}
      {busy ? busyLabel : label}
    </button>
  )
}
