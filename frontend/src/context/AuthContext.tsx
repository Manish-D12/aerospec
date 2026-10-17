import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../lib/api'
import { authApi } from '../lib/authApi'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '../types'
import { AuthContext } from './authContextValue'
import type { AuthContextValue } from './authContextValue'

const TOKEN_KEY = 'aerospec.token'
const USER_KEY = 'aerospec.user'

/* localStorage can throw (private mode, blocked storage); auth must still work in-memory. */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function isAuthUser(v: unknown): v is AuthUser {
  if (typeof v !== 'object' || v === null) return false
  const u = v as Record<string, unknown>
  return typeof u.id === 'number' && typeof u.name === 'string' && typeof u.email === 'string' && typeof u.verified === 'boolean'
}

function readCachedUser(): AuthUser | null {
  const raw = readStorage(USER_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAuthUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** A 401 from /me means the token is dead; anything else (offline, 503) is transient. */
const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401

/**
 * Holds the session. On mount it hydrates the token (and a cached copy of the
 * user, for instant paint) from localStorage, then confirms both with GET /me.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStorage(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => (readStorage(TOKEN_KEY) ? readCachedUser() : null))
  // Only "loading" if there's a token to check.
  const [loading, setLoading] = useState<boolean>(() => readStorage(TOKEN_KEY) !== null)

  const saveSession = useCallback(({ token: t, user: u }: AuthResponse) => {
    writeStorage(TOKEN_KEY, t)
    writeStorage(USER_KEY, JSON.stringify(u))
    setToken(t)
    setUser(u)
    setLoading(false)
  }, [])

  const clearSession = useCallback(() => {
    writeStorage(TOKEN_KEY, null)
    writeStorage(USER_KEY, null)
    setToken(null)
    setUser(null)
    // Also settles a /me check that this logout aborted.
    setLoading(false)
  }, [])

  const applyUser = useCallback((u: AuthUser) => {
    writeStorage(USER_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  // Validate the stored token once on mount (and whenever the token changes, e.g. login in another tab).
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const verify = async () => {
      try {
        applyUser(await authApi.me(token, controller.signal))
      } catch (err) {
        if (controller.signal.aborted) return
        // Offline / DB down: keep the cached user so the app stays usable; the next check will settle it.
        if (isUnauthorized(err)) clearSession()
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void verify()
    return () => controller.abort()
  }, [token, applyUser, clearSession])

  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      applyUser(await authApi.me(token))
    } catch (err) {
      if (isUnauthorized(err)) clearSession()
    }
  }, [token, applyUser, clearSession])

  // Coming back to the tab (e.g. after clicking the verification link) refreshes `verified`.
  useEffect(() => {
    const onFocus = () => void refreshUser()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUser])

  // Keep tabs in sync: logging in/out in one tab updates the others.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY) return
      setToken(e.newValue)
      setUser(e.newValue ? readCachedUser() : null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await authApi.login(input)
      saveSession(res)
      return res.user
    },
    [saveSession],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input)
      saveSession(res)
      return res.user
    },
    [saveSession],
  )

  const resendVerification = useCallback(async () => {
    if (!token) throw new ApiError(401, 'Not signed in')
    return authApi.resendVerification(token)
  }, [token])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout: clearSession, refreshUser, resendVerification }),
    [user, token, loading, login, register, clearSession, refreshUser, resendVerification],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
