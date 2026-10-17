import { useIsPresent } from 'framer-motion'
import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Layout route guard: renders the child route only for a signed-in user, else redirects to /login. */
export default function RequireAuth() {
  const { user, token, loading } = useAuth()
  const location = useLocation()
  // Layout keys each page by pathname, so a guard instance belongs to exactly one path.
  const [guardedPath] = useState(location.pathname)
  // False while this page is fading out after a route change (Layout's AnimatePresence).
  const isPresent = useIsPresent()
  const leaving = !isPresent || location.pathname !== guardedPath

  if (loading) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center gap-4 px-4 py-24" role="status" aria-label="Checking your session">
        <span className="relative flex h-10 w-10">
          <span className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        </span>
        <p className="text-sm text-slate-400">Checking your session…</p>
      </main>
    )
  }

  // A leaving page must not redirect: on logout it would override navigate('/') with /login.
  if (leaving) return <Outlet />

  if (!token || !user) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
