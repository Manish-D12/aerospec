import { AnimatePresence, motion } from 'framer-motion'
import { startTransition, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { NavItem } from '../types'

const APP_ITEMS: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sensors', label: 'Sensors' },
]
const LOGIN_ITEM: NavItem = { to: '/login', label: 'Login' }

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'

/** Avatar + name chip for the signed-in user. */
function UserChip({ name, verified }: { name: string; verified: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0" title={verified ? name : `${name} · email not verified`}>
      <span className="relative shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-slate-950">
        {initials(name)}
        {!verified && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950" aria-hidden="true" />}
      </span>
      <span className="truncate max-w-[10rem] text-slate-200">{name}</span>
    </span>
  )
}

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `relative py-1 transition-colors duration-200 ${isActive ? 'text-cyan-300' : 'text-slate-300 hover:text-white'}`

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = user ? APP_ITEMS : [...APP_ITEMS, LOGIN_ITEM]

  const handleLogout = () => {
    close()
    // React Router applies navigations as transitions. Clearing the session in the same
    // transition commits both together; otherwise the protected page would render once
    // signed-out first and its guard would redirect to /login instead of /.
    startTransition(() => {
      logout()
      navigate('/', { replace: true })
    })
  }

  return (
    <header className="relative z-20">
      <nav aria-label="Main" className="flex items-center justify-between px-4 sm:px-8 py-5 max-w-6xl mx-auto">
        <Link to="/" onClick={close} className="group flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30 transition-transform duration-300 group-hover:rotate-12" />
          <span className="font-bold text-lg tracking-tight text-white">AeroSpec</span>
        </Link>

        <div className="hidden sm:flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              {({ isActive }) => (
                <>
                  {item.label}
                  {/* One shared underline that glides to the active link. */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgb(34_211_238/0.8)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
          {user ? (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
              <UserChip name={user.name} verified={user.verified} />
              <button
                type="button"
                onClick={handleLogout}
                className="btn-lift px-3 py-1.5 rounded-xl border border-slate-700 hover:border-cyan-500/50 text-slate-200"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/register"
              className="btn-lift px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium"
            >
              Get Started
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="sm:hidden p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-500/50 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-nav"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="sm:hidden absolute inset-x-4 top-full rounded-2xl bg-slate-900/90 backdrop-blur border border-slate-800 shadow-2xl p-4 flex flex-col gap-3 text-sm"
        >
          {user && (
            <div className="pb-3 mb-1 border-b border-slate-800">
              <UserChip name={user.name} verified={user.verified} />
            </div>
          )}
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={close} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="btn-lift mt-1 px-4 py-2 rounded-xl border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-center"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/register"
              onClick={close}
              className="btn-lift mt-1 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-center"
            >
              Get Started
            </Link>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  )
}
