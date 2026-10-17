import type { CSSProperties } from 'react'

/** Tailwind palette values used inside Recharts (which needs raw colors). */
export const COLORS = {
  cyan300: '#67e8f9',
  cyan400: '#22d3ee',
  cyan500: '#06b6d4',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  red400: '#f87171',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1e293b',
  slate950: '#020617',
} as const

export const AXIS_TICK = { fill: COLORS.slate400, fontSize: 11 }

/** Grid lines: present but recessive. */
export const GRID_STROKE = 'rgba(51, 65, 85, 0.45)'

/** Glass tooltip matching the card surfaces. */
export const TOOLTIP_STYLE: CSSProperties = {
  background: 'rgba(2, 6, 23, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(34, 211, 238, 0.25)',
  borderRadius: 12,
  boxShadow: '0 12px 32px -12px rgba(6, 182, 212, 0.45)',
  color: COLORS.slate200,
  fontSize: 12,
  padding: '8px 12px',
}

export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: COLORS.slate400, marginBottom: 2 }
/** Values wear text ink, not the series colour. */
export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: COLORS.slate200, padding: 0 }

/** Vertical hover crosshair for line charts. */
export const LINE_CURSOR = { stroke: COLORS.cyan400, strokeOpacity: 0.35, strokeWidth: 1, strokeDasharray: '3 3' }

/** Hollow hover dot with a surface ring so it reads on top of the line. */
export const ACTIVE_DOT = { r: 5, fill: COLORS.cyan400, stroke: COLORS.slate950, strokeWidth: 2 }
