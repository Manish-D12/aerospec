import type { AlertKind, BandActivity, Metric, Severity, TelemetryAlert, TelemetryFrame, TelemetryReading } from '../types'

/** Rolling window length: the dashboard keeps the latest 60 readings (≈ 60 s at 1 Hz). */
export const WINDOW_SIZE = 60
export const MAX_ALERTS = 50

export const RSSI_MIN = -120
export const RSSI_MAX = -30
/** RSSI below this is a weak signal. */
export const RSSI_WEAK = -100
/** RSSI below this escalates a weak-signal alert to critical. */
export const RSSI_CRITICAL = -110
/** SNR below this is poor. */
export const SNR_POOR = 10
/** SNR below this escalates a poor-SNR alert to critical. */
export const SNR_CRITICAL = 5
/** Band activity at or above this is shown as congested. */
export const BAND_CONGESTED = 90

export const METRIC_META: Record<Metric, { label: string; unit: string; digits: number }> = {
  rssi: { label: 'Signal strength', unit: 'dBm', digits: 1 },
  snr: { label: 'SNR', unit: 'dB', digits: 1 },
  frequency: { label: 'Frequency', unit: 'MHz', digits: 3 },
}

/**
 * Merge a server frame into a view reading. Metrics or spectrum missing from
 * the frame (e.g. a single-metric MQTT message) carry over from `prev`.
 */
export function frameToReading(frame: TelemetryFrame, prev: TelemetryReading | null, id: number): TelemetryReading {
  const value = (metric: Metric, fallback: number): number =>
    frame.readings.find((r) => r.metric === metric)?.value ?? fallback

  const spectrum: BandActivity[] = frame.spectrum
    ? frame.spectrum.map((b) => ({ band: b.band, centerMHz: b.center_mhz, activity: b.activity }))
    : (prev?.spectrum ?? [])

  return {
    id,
    timestamp: Date.parse(frame.ts),
    sensorId: frame.sensor_id,
    rssi: value('rssi', prev?.rssi ?? RSSI_MIN),
    frequency: value('frequency', prev?.frequency ?? 0),
    snr: value('snr', prev?.snr ?? 0),
    activeBand: frame.active_band ?? prev?.activeBand ?? '—',
    spectrum,
  }
}

/** Append and trim: the rolling-window operation, kept pure so it's trivially testable. */
export function pushWindow<T>(window: readonly T[], items: readonly T[], size = WINDOW_SIZE): T[] {
  return [...window, ...items].slice(-size)
}

export const isWeak = (r: TelemetryReading): boolean => r.rssi < RSSI_WEAK
export const isPoorSnr = (r: TelemetryReading): boolean => r.snr < SNR_POOR

/**
 * Alerts raised by `next`. Each condition is edge-triggered: it fires when a
 * reading goes abnormal, not on every abnormal reading while it stays that way.
 */
export function detectAlerts(
  prev: TelemetryReading | null,
  next: TelemetryReading,
  nextId: () => number,
): TelemetryAlert[] {
  const alerts: TelemetryAlert[] = []
  const raise = (kind: AlertKind, severity: Severity, message: string) =>
    alerts.push({ id: nextId(), timestamp: next.timestamp, kind, severity, message })

  if (isWeak(next) && !(prev && isWeak(prev))) {
    raise(
      'weak-signal',
      next.rssi < RSSI_CRITICAL ? 'critical' : 'warning',
      `Weak signal: ${next.rssi.toFixed(1)} dBm (< ${RSSI_WEAK} dBm)`,
    )
  }
  if (isPoorSnr(next) && !(prev && isPoorSnr(prev))) {
    raise(
      'poor-snr',
      next.snr < SNR_CRITICAL ? 'critical' : 'warning',
      `Poor SNR: ${next.snr.toFixed(1)} dB (< ${SNR_POOR} dB)`,
    )
  }
  return alerts
}

export const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
