import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthAlert, AuthCard, AuthFields, AuthSubmit, AuthSuccess } from '../components/AuthCard'
import { useAuth } from '../hooks/useAuth'
import { ApiError, errorMessage } from '../lib/api'
import { hasErrors, validateLogin } from '../lib/validation'
import type { FieldErrors } from '../lib/validation'
import type { FormField, LoginForm } from '../types'

const FIELDS: FormField<keyof LoginForm>[] = [
  { label: 'Email', name: 'email', type: 'email', placeholder: 'you@klu.edu.in', autoComplete: 'email' },
  { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', autoComplete: 'current-password' },
]

const REDIRECT_DELAY_MS = 1200

type Status = 'idle' | 'submitting' | 'done'

/** `state.from` set by <RequireAuth>, so we can send the user back where they were going. */
function redirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string' && state.from.startsWith('/')) {
    return state.from
  }
  return '/dashboard'
}

const VERIFY_FAILURES: Record<string, string> = {
  expired: 'That verification link has expired. Sign in and use "Resend email" on the dashboard.',
  invalid: 'That verification link is invalid. Sign in and request a new one from the dashboard.',
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { user, login } = useAuth()
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<LoginForm>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const target = redirectTarget(location.state)

  useEffect(() => {
    if (status !== 'done') return
    const t = window.setTimeout(() => navigate(target, { replace: true }), REDIRECT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [status, navigate, target])

  // Already signed in (e.g. returning from the verification link): go straight in.
  if (user && status === 'idle') return <Navigate to={target} replace />

  const verified = params.get('verified')
  const banner =
    verified === '1'
      ? { tone: 'success' as const, text: 'Email verified. Sign in to continue.' }
      : verified === '0'
        ? { tone: 'error' as const, text: VERIFY_FAILURES[params.get('reason') ?? ''] ?? VERIFY_FAILURES.invalid }
        : null

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as keyof LoginForm
    setForm((f) => ({ ...f, [name]: e.target.value }))
    // Clear a field's error as soon as the user edits it.
    setErrors((errs) => ({ ...errs, [name]: undefined }))
    setServerError(null)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found = validateLogin(form)
    setErrors(found)
    if (hasErrors(found)) return

    setStatus('submitting')
    setServerError(null)
    try {
      await login({ email: form.email.trim(), password: form.password })
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      setServerError(err instanceof ApiError && err.status === 401 ? 'Incorrect email or password.' : errorMessage(err))
    }
  }

  return (
    <AuthCard>
      {status === 'done' ? (
        <AuthSuccess title="Signed in!" message={`Welcome back${user ? `, ${user.name}` : ''}.`} />
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white text-center">Sign in</h1>
          <p className="text-slate-400 text-center text-sm mt-1 mb-6">
            Access your telemetry dashboard
          </p>

          {banner && <AuthAlert tone={banner.tone}>{banner.text}</AuthAlert>}
          {serverError && <AuthAlert tone="error">{serverError}</AuthAlert>}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            <AuthFields fields={FIELDS} values={form} onChange={handleChange} errors={errors} disabled={status === 'submitting'} />
            <AuthSubmit busy={status === 'submitting'} label="Sign in" busyLabel="Signing in…" />
          </form>

          <p className="text-slate-400 text-center text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline">Register</Link>
          </p>
        </>
      )}
    </AuthCard>
  )
}
