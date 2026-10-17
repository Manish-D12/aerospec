import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../../lib/api'
import { METRIC_META } from '../../lib/telemetry'
import type { HistoryResponse, Metric } from '../../types'
import EmptyState from './EmptyState'
import {
  ACTIVE_DOT,
  AXIS_TICK,
  COLORS,
  GRID_STROKE,
  LINE_CURSOR,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from './chartTheme'

const METRICS: Metric[] = ['rssi', 'snr', 'frequency']
const RANGES = [1, 6, 24] as const
type Range = (typeof RANGES)[number]

interface HistoryChartProps {
  sensorId: number
}

interface HistoryPointView {
  ts: number
  value: number
  range: [number, number]
}

/** Result tagged with the request that produced it, so "loading" is derived, not stored. */
type Loaded = { key: string; response: HistoryResponse; error: null } | { key: string; response: null; error: string }

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format: (v: T) => string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-slate-700 bg-slate-950/40 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`relative px-2.5 py-1 rounded-lg transition-colors duration-200 ${
            o === value ? 'text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          {/* The selected pill slides between options instead of blinking. */}
          {o === value && (
            <motion.span
              layoutId={`seg-${label}`}
              className="absolute inset-0 rounded-lg bg-cyan-500 shadow-[0_0_16px_-4px_rgb(34_211_238/0.6)]"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{format(o)}</span>
        </button>
      ))}
    </div>
  )
}

/** Placeholder shaped like the chart (axis gutter, bars of varying height) with a moving shimmer. */
function HistorySkeleton() {
  const heights = [55, 70, 45, 80, 60, 75, 50, 65, 85, 58, 72, 48]
  return (
    <div role="status" aria-label="Loading history" className="absolute inset-0 flex gap-3 pb-8 pl-1">
      <div className="flex flex-col justify-between py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="skeleton animate-skeleton h-2.5 w-8 rounded-full" />
        ))}
      </div>
      <div className="flex-1 flex items-end gap-1.5 sm:gap-2 border-b border-l border-slate-800 pl-2">
        {heights.map((h, i) => (
          <span
            key={i}
            className="skeleton animate-skeleton flex-1 rounded-t-lg"
            style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

const formatAxisTime = (hours: number) => (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', ...(hours <= 1 && { second: '2-digit' }) })

/** Historical telemetry from PostgreSQL via GET /api/v1/sensors/:id/history. */
export default function HistoryChart({ sensorId }: HistoryChartProps) {
  const [metric, setMetric] = useState<Metric>('rssi')
  const [hours, setHours] = useState<Range>(24)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [reload, setReload] = useState(0)
  const reduce = useReducedMotion()

  const key = `${sensorId}:${metric}:${hours}:${reload}`

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await api.history(sensorId, metric, hours, controller.signal)
        setLoaded({ key, response, error: null })
      } catch (err) {
        if (controller.signal.aborted) return
        setLoaded({ key, response: null, error: errorMessage(err) })
      }
    }
    void load()
    // Abort the in-flight request if the user switches metric/range or leaves the page.
    return () => controller.abort()
  }, [key, sensorId, metric, hours])

  const meta = METRIC_META[metric]
  const current = loaded?.key === key ? loaded : null
  const response = current?.response ?? null
  const data: HistoryPointView[] =
    response?.data.map((p) => ({ ts: Date.parse(p.ts), value: p.value, range: [p.min, p.max] })) ?? []

  let overlay: ReactNode = null
  if (!current) overlay = <HistorySkeleton />
  else if (current.error) overlay = <EmptyState icon="warning" tone="error" title="Couldn't load history" message={current.error} />
  else if (response?.source === 'unavailable')
    overlay = <EmptyState icon="database" tone="warning" title="Database offline" message="The live feed still works. History returns once Postgres is reachable." />
  else if (data.length === 0)
    overlay = <EmptyState icon="database" title="No history yet" message='Run "npm run seed" in backend/, or let the live feed record for a while.' />
  const showChart = data.length > 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented label="Metric" options={METRICS} value={metric} onChange={setMetric} format={(m) => METRIC_META[m].label} />
        <div className="flex items-center gap-2">
          <Segmented label="Time range" options={RANGES} value={hours} onChange={setHours} format={(h) => `${h}h`} />
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="btn-lift px-2.5 py-1 rounded-xl border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-cyan-500/50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="relative h-64 sm:h-72">
        {overlay}
        {showChart && (
        <ResponsiveContainer width="100%" height="100%">
          {/* Keyed by request so each metric/range switch remounts and the line draws in again. */}
          <ComposedChart key={key} data={data} margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatAxisTime(hours)}
              tick={AXIS_TICK}
              tickLine={{ stroke: COLORS.slate700 }}
              axisLine={{ stroke: COLORS.slate700 }}
              minTickGap={40}
              label={{ value: 'Time', position: 'insideBottom', offset: -16, fill: COLORS.slate400, fontSize: 12 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={AXIS_TICK}
              tickLine={{ stroke: COLORS.slate700 }}
              axisLine={{ stroke: COLORS.slate700 }}
              width={56}
              label={{ value: `${meta.label} (${meta.unit})`, angle: -90, position: 'insideLeft', offset: 8, fill: COLORS.slate400, fontSize: 12, style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              cursor={LINE_CURSOR}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelFormatter={(ts) => new Date(Number(ts)).toLocaleString([], { hour12: false })}
              formatter={(value, name) =>
                name === 'range' && Array.isArray(value)
                  ? [`${value.map((v) => Number(v).toFixed(meta.digits)).join(' … ')} ${meta.unit}`, 'Min … max']
                  : [`${Number(value).toFixed(meta.digits)} ${meta.unit}`, 'Average']
              }
            />
            {/* Min–max envelope per bucket, then the bucket average on top. */}
            <Area
              dataKey="range"
              stroke="none"
              fill={COLORS.cyan500}
              fillOpacity={0.12}
              activeDot={false}
              animationDuration={900}
              animationEasing="ease-out"
              isAnimationActive={!reduce}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={COLORS.cyan400}
              strokeWidth={2}
              dot={false}
              activeDot={ACTIVE_DOT}
              animationDuration={1100}
              animationEasing="ease-in-out"
              isAnimationActive={!reduce}
            />
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>
      {showChart && response && (
        <p className="mt-2 text-xs text-slate-500">
          {response.count} points · {response.bucket_seconds}s buckets · source: PostgreSQL
        </p>
      )}
    </div>
  )
}
