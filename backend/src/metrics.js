/** Telemetry metrics the pod reports. Also the whitelist for ?metric= on /history. */
export const METRICS = Object.freeze({
  rssi: { label: 'Signal strength', unit: 'dBm' },
  frequency: { label: 'Frequency', unit: 'MHz' },
  snr: { label: 'Signal-to-noise ratio', unit: 'dB' },
})

export const METRIC_NAMES = Object.freeze(Object.keys(METRICS))

export const isMetric = (m) => typeof m === 'string' && Object.hasOwn(METRICS, m)
