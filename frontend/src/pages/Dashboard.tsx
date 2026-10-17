import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import AlertFeed from '../components/dashboard/AlertFeed'
import ConnectionStatus from '../components/dashboard/ConnectionStatus'
import HistoryChart from '../components/dashboard/HistoryChart'
import SignalChart from '../components/dashboard/SignalChart'
import SpectrumChart from '../components/dashboard/SpectrumChart'
import StatCard from '../components/dashboard/StatCard'
import VerifyBanner from '../components/dashboard/VerifyBanner'
import { useTelemetry } from '../hooks/useTelemetry'
import { fadeUp, stagger } from '../lib/motion'
import { SOCKET_URL } from '../lib/api'
import { BAND_CONGESTED, RSSI_WEAK, SNR_POOR, WINDOW_SIZE, isPoorSnr, isWeak } from '../lib/telemetry'

const DEFAULT_SENSOR_ID = 1

interface PanelProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

function Panel({ title, subtitle, action, className = '', children }: PanelProps) {
  return (
    <motion.section
      variants={fadeUp}
      className={`glow-panel p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800 min-w-0 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  )
}

export default function Dashboard() {
  const { readings, latest, alerts, connection, source, error, running, toggle, clearAlerts } = useTelemetry()

  const weak = latest ? isWeak(latest) : false
  const poorSnr = latest ? isPoorSnr(latest) : false
  const activeActivity = latest?.spectrum.find((b) => b.band === latest.activeBand)?.activity ?? 0
  const congested = activeActivity >= BAND_CONGESTED
  const placeholder = '—'

  return (
    <motion.main
      className="relative isolate w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-16 space-y-6"
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
    >
      {/* Backdrop: faint telemetry grid + a slow scanline sweep (hidden under reduced motion). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10 overflow-hidden">
        <div className="telemetry-grid absolute inset-0" />
        <div className="motion-loop absolute inset-x-0 top-0 h-[10%] animate-scanline bg-gradient-to-b from-transparent via-cyan-400/[0.06] to-transparent" />
      </div>

      <motion.header variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="mb-3">
            <ConnectionStatus state={connection} source={source} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Telemetry{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pod-{String(latest?.sensorId ?? DEFAULT_SENSOR_ID).padStart(2, '0')} · Socket.io live feed · rolling {WINDOW_SIZE}-sample window
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!running}
          className={`btn-lift self-start sm:self-auto px-5 py-2.5 rounded-2xl font-semibold ${
            running
              ? 'border border-slate-700 hover:border-cyan-500/50 text-slate-200 bg-slate-950/40 backdrop-blur'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          {running ? 'Stop feed' : 'Start feed'}
        </button>
      </motion.header>

      <VerifyBanner />

      {connection === 'disconnected' && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-sm text-red-200 backdrop-blur"
        >
          Can't reach the telemetry server at <code className="text-red-100">{SOCKET_URL}</code>
          {error && <span className="text-red-300/80"> ({error})</span>}. Start the backend with{' '}
          <code className="text-red-100">cd backend &amp;&amp; npm run dev</code>; the dashboard reconnects automatically.
        </motion.p>
      )}

      <motion.section
        aria-label="Current readings"
        variants={stagger(0.09)}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="Signal Strength"
          value={latest ? latest.rssi.toFixed(1) : placeholder}
          numeric={latest?.rssi}
          digits={1}
          unit="dBm"
          status={weak ? 'abnormal' : 'good'}
          pending={!latest}
          statusText={latest ? (weak ? 'Weak' : 'Good') : 'Waiting'}
          hint={`Weak below ${RSSI_WEAK} dBm`}
        />
        <StatCard
          label="Frequency"
          value={latest ? latest.frequency.toFixed(3) : placeholder}
          numeric={latest?.frequency}
          digits={3}
          unit="MHz"
          status="good"
          pending={!latest}
          statusText={latest ? 'Locked' : 'Waiting'}
          hint="Tracking the dominant band"
        />
        <StatCard
          label="SNR"
          value={latest ? latest.snr.toFixed(1) : placeholder}
          numeric={latest?.snr}
          digits={1}
          unit="dB"
          status={poorSnr ? 'abnormal' : 'good'}
          pending={!latest}
          statusText={latest ? (poorSnr ? 'Poor' : 'Good') : 'Waiting'}
          hint={`Poor below ${SNR_POOR} dB`}
        />
        <StatCard
          label="Active Band"
          value={latest?.activeBand ?? placeholder}
          status={congested ? 'abnormal' : 'good'}
          pending={!latest}
          statusText={latest ? (congested ? 'Congested' : 'Clear') : 'Waiting'}
          hint={latest ? `${activeActivity.toFixed(0)}% occupancy` : 'Busiest band in the sweep'}
        />
      </motion.section>

      <motion.div variants={stagger(0.1)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Signal Strength" subtitle={`RSSI over the last ${WINDOW_SIZE} seconds`} className="lg:col-span-2">
          <SignalChart readings={readings} />
        </Panel>
        <Panel
          title="Alert Feed"
          subtitle={`${alerts.length} logged`}
          action={
            alerts.length > 0 && (
              <button type="button" onClick={clearAlerts} className="btn-lift px-2.5 py-1 rounded-xl text-xs text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10">
                Clear
              </button>
            )
          }
        >
          <AlertFeed alerts={alerts} />
        </Panel>
      </motion.div>

      <Panel
        title="Spectrum Activity"
        subtitle={`Occupancy across ${latest?.spectrum.length || 10} bands · active band highlighted`}
      >
        <SpectrumChart spectrum={latest?.spectrum ?? []} activeBand={latest?.activeBand ?? ''} />
      </Panel>

      <Panel title="History" subtitle="Stored readings from PostgreSQL · bucket average with min–max band">
        <HistoryChart sensorId={latest?.sensorId ?? DEFAULT_SENSOR_ID} />
      </Panel>
    </motion.main>
  )
}
