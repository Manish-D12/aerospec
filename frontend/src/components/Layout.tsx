import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { pageFade } from '../lib/motion'
import Navbar from './Navbar'

/** Shared page chrome: dark background, drifting glow blobs, navbar, route fade and footer. */
export default function Layout() {
  const location = useLocation()
  // Capture the outlet element so the exiting page keeps rendering its own content while it fades out.
  const outlet = useOutlet()

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-clip flex flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute top-0 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-drift-a" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-drift-b" />
      <div aria-hidden="true" className="pointer-events-none absolute top-1/3 left-1/2 w-72 h-72 bg-cyan-400/5 rounded-full blur-3xl animate-drift-b" />

      <Navbar />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={pageFade}
          initial="initial"
          animate="enter"
          exit="exit"
          className="relative flex-1 flex flex-col"
        >
          {outlet}
        </motion.div>
      </AnimatePresence>

      <footer className="relative mt-auto border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs text-slate-500 text-center">
          <span>© {new Date().getFullYear()} AeroSpec · RF Telemetry Pod</span>
          <span>Telemetry simulated server-side · streamed over Socket.io · stored in PostgreSQL</span>
        </div>
      </footer>
    </div>
  )
}
