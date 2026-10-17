import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import SignalWave from '../components/SignalWave'
import { fadeUp, stagger } from '../lib/motion'

interface Feature {
  t: string
  d: string
}

const FEATURES: Feature[] = [
  { t: 'Live Spectrum', d: 'Sweep and visualize RF activity across bands in real time.' },
  { t: 'Signal Strength', d: 'Track RSSI and signal quality with precise telemetry.' },
  { t: 'Flight Mapping', d: 'Overlay readings onto flight paths for spatial analysis.' },
]

export default function Home() {
  return (
    <main className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-24 sm:pb-32 text-center">
      <motion.section
        aria-labelledby="hero-title"
        className="relative isolate"
        variants={stagger(0.1)}
        initial="hidden"
        animate="show"
      >
        <SignalWave className="absolute inset-x-0 top-6 sm:top-10 h-48 sm:h-60 -z-10 opacity-80" />

        <motion.span
          variants={fadeUp}
          className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs mb-6 backdrop-blur"
        >
          RF Telemetry · Live Signal Mapping
        </motion.span>
        <motion.h1
          id="hero-title"
          variants={fadeUp}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight"
        >
          <span className="text-shimmer animate-shimmer-text">RF Spectrum &amp; Signal Strength</span>
          <br />
          Telemetry Pod
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-6 max-w-2xl mx-auto text-slate-400 text-base sm:text-lg">
          Real-time spectrum monitoring and signal-strength visualization from an
          airborne telemetry pod. Capture, stream, and analyze the invisible.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="btn-lift px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
          >
            Launch Dashboard
          </Link>
          <a
            href="#features"
            className="btn-lift px-6 py-3 rounded-2xl border border-slate-700 hover:border-cyan-500/50 text-slate-200 bg-slate-950/40 backdrop-blur"
          >
            Learn More
          </a>
        </motion.div>
      </motion.section>

      <motion.section
        id="features"
        aria-label="Features"
        className="mt-28 grid md:grid-cols-3 gap-6 text-left"
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {FEATURES.map((f) => (
          <motion.article
            key={f.t}
            variants={fadeUp}
            className="glow-card p-6 rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800 hover:border-cyan-500/40"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 mb-4 shadow-lg shadow-cyan-500/20" />
            <h2 className="font-semibold text-lg">{f.t}</h2>
            <p className="mt-2 text-sm text-slate-400">{f.d}</p>
          </motion.article>
        ))}
      </motion.section>
    </main>
  )
}
