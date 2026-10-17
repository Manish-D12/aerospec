import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RSSI_MAX, RSSI_MIN, RSSI_WEAK, formatTime } from '../../lib/telemetry'
import type { TelemetryReading } from '../../types'
import ChartReveal from './ChartReveal'
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

interface SignalPoint {
  time: string
  rssi: number
}

export default function SignalChart({ readings }: { readings: TelemetryReading[] }) {
  const data: SignalPoint[] = readings.map((r) => ({ time: formatTime(r.timestamp), rssi: r.rssi }))

  return (
    <div className="relative h-64 sm:h-80">
      {data.length === 0 && <EmptyState icon="signal" title="Waiting for signal" message="Readings appear here as soon as the feed connects." />}
      <ChartReveal className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
            <defs>
              <linearGradient id="rssi-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.cyan400} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COLORS.cyan400} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={AXIS_TICK}
              tickLine={{ stroke: COLORS.slate700 }}
              axisLine={{ stroke: COLORS.slate700 }}
              minTickGap={32}
              interval="preserveStartEnd"
              label={{ value: 'Time', position: 'insideBottom', offset: -16, fill: COLORS.slate400, fontSize: 12 }}
            />
            <YAxis
              domain={[RSSI_MIN, RSSI_MAX]}
              ticks={[-120, -100, -80, -60, -40]}
              tick={AXIS_TICK}
              tickLine={{ stroke: COLORS.slate700 }}
              axisLine={{ stroke: COLORS.slate700 }}
              width={48}
              label={{ value: 'RSSI (dBm)', angle: -90, position: 'insideLeft', offset: 8, fill: COLORS.slate400, fontSize: 12, style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              cursor={LINE_CURSOR}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value) => [`${String(value)} dBm`, 'RSSI']}
            />
            <ReferenceLine
              y={RSSI_WEAK}
              stroke={COLORS.red400}
              strokeOpacity={0.7}
              strokeDasharray="4 4"
              label={{ value: 'Weak', position: 'insideTopRight', fill: COLORS.red400, fontSize: 11 }}
            />
            {/* Soft fill under the trace; baseValue anchors it to the bottom of the axis. */}
            <Area
              type="monotone"
              dataKey="rssi"
              baseValue={RSSI_MIN}
              stroke="none"
              fill="url(#rssi-fill)"
              isAnimationActive={false}
              tooltipType="none"
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="rssi"
              stroke={COLORS.cyan400}
              strokeWidth={2}
              dot={false}
              activeDot={ACTIVE_DOT}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartReveal>
    </div>
  )
}
