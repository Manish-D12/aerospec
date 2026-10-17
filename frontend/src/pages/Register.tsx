import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthAlert, AuthCard, AuthFields, AuthSubmit, AuthSuccess } from '../components/AuthCard'
import { useAuth } from '../hooks/useAuth'
import { ApiError, errorMessage } from '../lib/api'
import { PASSWORD_MIN, hasErrors, validateRegister } from '../lib/validation'
import type { FieldErrors } from '../lib/validation'
import type { FormField, RegisterForm } from '../types'

const FIELDS: FormField<keyof RegisterForm>[] = [
  { label: 'Name', name: 'name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
  { label: 'Email', name: 'email', type: 'email', placeholder: 'you@klu.edu.in', autoComplete: 'email' },
  { label: 'Password', name: 'password', type: 'password', placeholder: `At least ${PASSWORD_MIN} characters`, autoComplete: 'new-password' },
]

const REDIRECT_DELAY_MS = 1600

type Status = 'idle' | 'submitting' | 'done'

export default function Register() {
  const navigate = useNavigate()
  const { user, register } = useAuth()
  const [form, setForm] = useState<RegisterForm>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<RegisterForm>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (status !== 'done') return
    const t = window.setTimeout(() => navigate('/dashboard', { replace: true }), REDIRECT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [status, navigate])

  if (user && status === 'idle') return <Navigate to="/dashboard" replace />

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as keyof RegisterForm
    setForm((f) => ({ ...f, [name]: e.target.value }))
    setErrors((errs) => ({ ...errs, [name]: undefined }))
    setServerError(null)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found = validateRegister(form)
    setErrors(found)
    if (hasErrors(found)) return

    setStatus('submitting')
    setServerError(null)
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: 'An account with this email already exists.' })
      } else {
        setServerError(errorMessage(err))
      }
    }
  }

  return (
    <AuthCard>
      {status === 'done' ? (
        <AuthSuccess
          title="Registration done!"
          message={
            <>
              Welcome aboard, {user?.name ?? form.name}. We sent a verification link to{' '}
              <span className="text-slate-200">{user?.email ?? form.email}</span>.
            </>
          }
        />
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white text-center">Create account</h1>
          <p className="text-slate-400 text-center text-sm mt-1 mb-6">
            Start monitoring your telemetry pod
          </p>

          {serverError && <AuthAlert tone="error">{serverError}</AuthAlert>}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            <AuthFields fields={FIELDS} values={form} onChange={handleChange} errors={errors} disabled={status === 'submitting'} />
            <AuthSubmit busy={status === 'submitting'} label="Register" busyLabel="Creating account…" />
          </form>

          <p className="text-slate-400 text-center text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthCard>
  )
}
