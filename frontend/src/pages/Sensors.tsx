import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import EmptyState from '../components/dashboard/EmptyState'
import { api, errorMessage } from '../lib/api'
import { fadeUp, stagger } from '../lib/motion'
import type { Sensor, SensorInput, SensorStatus } from '../types'

const STATUSES: SensorStatus[] = ['active', 'inactive', 'maintenance']
const EMPTY: SensorInput = { name: '', location: '', status: 'active' }

const STATUS_BADGE: Record<SensorStatus, string> = {
  active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  inactive: 'bg-slate-500/10 border-slate-600 text-slate-300',
  maintenance: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
}

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 outline-none hover:border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 focus:bg-slate-800 transition text-sm'

type LoadState = { status: 'loading' } | { status: 'ready'; sensors: Sensor[] } | { status: 'error'; message: string }

interface SensorFormProps {
  initial: SensorInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: SensorInput) => void
  onCancel?: () => void
}

function SensorForm({ initial, submitLabel, busy, onSubmit, onCancel }: SensorFormProps) {
  const [form, setForm] = useState<SensorInput>(initial)
  const change = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <label className="block">
        <span className="block text-slate-400 text-xs mb-1">Name</span>
        <input name="name" value={form.name} onChange={change} required maxLength={80} placeholder="AeroSpec Pod-02" className={inputClass} />
      </label>
      <label className="block">
        <span className="block text-slate-400 text-xs mb-1">Location</span>
        <input name="location" value={form.location} onChange={change} maxLength={120} placeholder="North field mast" className={inputClass} />
      </label>
      <label className="block">
        <span className="block text-slate-400 text-xs mb-1">Status</span>
        <select name="status" value={form.status} onChange={change} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-lift px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-sm"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-lift px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

/** Sensor registry: exercises every REST verb (GET list, POST, PUT, DELETE). */
export default function Sensors() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [formKey, setFormKey] = useState(0)

  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  // GET /api/v1/sensors on mount and after every refresh(); abort if we unmount mid-request.
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const sensors = await api.listSensors(controller.signal)
        setState({ status: 'ready', sensors })
      } catch (err) {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: errorMessage(err) })
      }
    }
    void load()
    return () => controller.abort()
  }, [reloadKey])

  /** Run a mutation, then re-fetch the list and show the outcome. */
  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      setNotice({ kind: 'ok', text: success })
      setEditingId(null)
      refresh()
      return true
    } catch (err) {
      setNotice({ kind: 'error', text: errorMessage(err) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const create = async (input: SensorInput) => {
    if (await mutate(() => api.createSensor(input), `Created "${input.name}"`)) setFormKey((k) => k + 1)
  }
  const update = (id: number, input: SensorInput) => void mutate(() => api.updateSensor(id, input), `Updated sensor #${id}`)
  const remove = (s: Sensor) => void mutate(() => api.deleteSensor(s.id), `Deleted "${s.name}" and its telemetry`)

  return (
    <motion.main
      className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-16 space-y-6"
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={fadeUp}>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Sensor{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Registry</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">REST resource <code className="text-slate-300">/api/v1/sensors</code>, stored in PostgreSQL</p>
      </motion.header>

      <motion.section
        variants={fadeUp}
        aria-labelledby="add-sensor"
        className="glow-panel p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800"
      >
        <h2 id="add-sensor" className="font-semibold text-lg mb-4">Add a sensor</h2>
        <SensorForm key={formKey} initial={EMPTY} submitLabel="Add sensor" busy={busy} onSubmit={(i) => void create(i)} />
      </motion.section>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-2xl border text-sm backdrop-blur ${
            notice.kind === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {notice.text}
        </p>
      )}

      <motion.section
        variants={fadeUp}
        aria-labelledby="sensor-list"
        className="glow-panel p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800"
      >
        <header className="flex items-center justify-between mb-4">
          <h2 id="sensor-list" className="font-semibold text-lg">Sensors</h2>
          <button type="button" onClick={refresh} className="btn-lift px-2.5 py-1 rounded-xl text-xs text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10">
            Refresh
          </button>
        </header>

        {state.status === 'loading' && (
          <div role="status" aria-label="Loading sensors" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton animate-skeleton h-14 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {state.status === 'error' && (
          <div role="alert">
            <EmptyState overlay={false} icon="warning" tone="error" title="Couldn't load sensors" message={state.message} />
          </div>
        )}
        {state.status === 'ready' && state.sensors.length === 0 && (
          <EmptyState overlay={false} icon="antenna" title="No sensors yet" message="Add your first pod above." />
        )}
        {state.status === 'ready' && state.sensors.length > 0 && (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
            {state.sensors.map((s) => (
              <motion.li
                key={s.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3 }}
                className="glow-card p-4 rounded-2xl bg-slate-800/30 border border-slate-800 hover:border-cyan-500/30"
              >
                {editingId === s.id ? (
                  <SensorForm
                    initial={{ name: s.name, location: s.location, status: s.status }}
                    submitLabel="Save"
                    busy={busy}
                    onSubmit={(input) => update(s.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <article className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 tabular-nums">#{s.id}</span>
                        <h3 className="font-medium truncate">{s.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                      </div>
                      <p className="text-sm text-slate-400 truncate">{s.location || 'No location'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(s.id)}
                        className="btn-lift px-3 py-1.5 rounded-xl border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(s)}
                        className="btn-lift px-3 py-1.5 rounded-xl border border-red-500/40 hover:bg-red-500/10 text-red-300 text-sm disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )}
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.section>
    </motion.main>
  )
}
