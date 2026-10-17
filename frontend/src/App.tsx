import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Sensors from './pages/Sensors'

// Recharts is heavy; load it only when the dashboard is visited.
const Dashboard = lazy(() => import('./pages/Dashboard'))

function PageLoading() {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-4 px-4 py-24" role="status">
      <span className="relative flex h-10 w-10">
        <span className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
      </span>
      <p className="text-sm text-slate-400">Loading telemetry…</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Signed-in only */}
        <Route element={<RequireAuth />}>
          <Route path="/sensors" element={<Sensors />} />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoading />}>
                <Dashboard />
              </Suspense>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
