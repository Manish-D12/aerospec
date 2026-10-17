import type { LoginForm, RegisterForm } from '../types'

/** Mirrors the backend rules in backend/src/routes/auth.js so most mistakes are caught before a round trip. */
export const PASSWORD_MIN = 8
const PASSWORD_MAX_BYTES = 72
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type FieldErrors<T> = Partial<Record<keyof T, string>>

function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Email is required'
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address'
  return undefined
}

export function validateLogin(form: LoginForm): FieldErrors<LoginForm> {
  const errors: FieldErrors<LoginForm> = {}
  const email = emailError(form.email)
  if (email) errors.email = email
  if (!form.password) errors.password = 'Password is required'
  return errors
}

export function validateRegister(form: RegisterForm): FieldErrors<RegisterForm> {
  const errors: FieldErrors<RegisterForm> = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  else if (form.name.trim().length > 80) errors.name = 'Name must be at most 80 characters'
  const email = emailError(form.email)
  if (email) errors.email = email
  if (form.password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters`
  else if (new TextEncoder().encode(form.password).length > PASSWORD_MAX_BYTES) errors.password = 'Password is too long (max 72 bytes)'
  return errors
}

export const hasErrors = <T,>(errors: FieldErrors<T>): boolean => Object.keys(errors).length > 0
