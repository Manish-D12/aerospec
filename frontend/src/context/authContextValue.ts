import { createContext } from 'react'
import type { AuthUser, LoginInput, RegisterInput, ResendVerificationResponse } from '../types'

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  /** True while a stored token is being checked against GET /auth/me. */
  loading: boolean
  login: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  logout: () => void
  /** Re-read the user from /me (e.g. after verifying the email in another tab). */
  refreshUser: () => Promise<void>
  resendVerification: () => Promise<ResendVerificationResponse>
}

/** Kept apart from the provider component so Vite fast-refresh stays happy. */
export const AuthContext = createContext<AuthContextValue | null>(null)
