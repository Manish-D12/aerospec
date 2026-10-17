import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/api'

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; message: string } | { kind: 'error'; message: string }

/** Amber nudge shown on the dashboard until the signed-in user verifies their email. */
export default function VerifyBanner() {
  const { user, resendVerification } = useAuth()
  const [state, setState] = useState<SendState>({ kind: 'idle' })

  const resend = async () => {
    setState({ kind: 'sending' })
    try {
      const res = await resendVerification()
      setState({ kind: 'sent', message: res.message })
    } catch (err) {
      setState({ kind: 'error', message: errorMessage(err) })
    }
  }

  return (
    <AnimatePresence initial={false}>
      {user && !user.verified && (
        <motion.aside
          key="verify-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 backdrop-blur text-sm"
        >
          <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300" aria-hidden="true">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-200">Verify your email to activate full access</p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              {state.kind === 'sent'
                ? state.message
                : state.kind === 'error'
                  ? <span className="text-red-300">{state.message}</span>
                  : <>We sent a link to <span className="text-amber-100">{user.email}</span>. It expires in 24 hours.</>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={state.kind === 'sending'}
            className="btn-lift self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-400/50 text-amber-200 hover:bg-amber-500/15 disabled:opacity-60 disabled:cursor-wait"
          >
            {state.kind === 'sending' && <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-200/30 border-t-amber-200 animate-spin" aria-hidden="true" />}
            {state.kind === 'sending' ? 'Sending…' : state.kind === 'sent' ? 'Send again' : 'Resend email'}
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
