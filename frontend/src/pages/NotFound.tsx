import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { fadeUp, stagger } from '../lib/motion'

export default function NotFound() {
  return (
    <motion.main
      className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-24"
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
    >
      <motion.span variants={fadeUp} className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs mb-6">
        404 · No carrier
      </motion.span>
      <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-extrabold tracking-tight">
        Signal <span className="text-shimmer animate-shimmer-text">lost</span>
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-4 max-w-md text-slate-400">
        There's nothing on this frequency. The page may have moved, or the link is mistyped.
      </motion.p>
      <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link to="/" className="btn-lift px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold">
          Back to home
        </Link>
        <Link to="/dashboard" className="btn-lift px-6 py-3 rounded-2xl border border-slate-700 hover:border-cyan-500/50 text-slate-200 bg-slate-950/40 backdrop-blur">
          Open dashboard
        </Link>
      </motion.div>
    </motion.main>
  )
}
