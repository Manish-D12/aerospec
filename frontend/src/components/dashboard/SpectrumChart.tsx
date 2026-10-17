import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BandActivity } from '../../types'
import EmptyState from './EmptyState'
import { AXIS_TICK, COLORS, GRID_STROKE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chartTheme'

interface SpectrumChartProps {
  spectrum: BandActivity[]
  activeBand: string
}

export default function SpectrumChart({ spectrum, activeBand }: SpectrumChartProps) {
  return (
    <div className="relative h-72 sm:h-80">
      {spectrum.length === 0 && <EmptyState icon="antenna" title="No sweep yet" message="Band occupancy appears with the first live frame." />}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={spectrum} margin={{ top: 8, right: 12, bottom: 8, left: 4 }} barCategoryGap="18%">
          <defs>
            <linearGradient id="bar-active" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.cyan300} />
              <stop offset="100%" stopColor={COLORS.cyan500} />
            </linearGradient>
            <linearGradient id="bar-idle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blue500} stopOpacity={0.85} />
              <stop offset="100%" stopColor={COLORS.blue600} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="band"
            tick={AXIS_TICK}
            tickLine={{ stroke: COLORS.slate700 }}
            axisLine={{ stroke: COLORS.slate700 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={64}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={AXIS_TICK}
            tickLine={{ stroke: COLORS.slate700 }}
            axisLine={{ stroke: COLORS.slate700 }}
            width={48}
            label={{ value: 'Activity (%)', angle: -90, position: 'insideLeft', offset: 8, fill: COLORS.slate400, fontSize: 12, style: { textAnchor: 'middle' } }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(34, 211, 238, 0.06)', radius: 8 }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value) => [`${String(value)} %`, 'Activity']}
          />
          <Bar dataKey="activity" radius={[6, 6, 0, 0]} animationDuration={450} animationEasing="ease-out">
            {spectrum.map((b) => (
              <Cell key={b.band} fill={b.band === activeBand ? 'url(#bar-active)' : 'url(#bar-idle)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
