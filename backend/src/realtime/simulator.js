/**
 * Simulated RF telemetry pod. Pure functions: `nextSample(prev)` produces the
 * next 1 Hz sample from the previous one.
 *
 * - RSSI: mean-reverting random walk around -75 dBm, 5 % chance of a 20–35 dB fade.
 * - SNR: RSSI minus a ~-112 dBm noise floor that spikes 4 % of the time (interference).
 * - Spectrum: 10 bands, each a random walk around its baseline with traffic bursts.
 * - Frequency: centre of the busiest band (the pod "tracks" the dominant signal).
 */

export const RSSI_MIN = -120
export const RSSI_MAX = -30

export const BANDS = Object.freeze([
  { band: 'VHF Air', center_mhz: 127.5, baseline: 35 },
  { band: 'UHF 433', center_mhz: 433.92, baseline: 25 },
  { band: 'ISM 868', center_mhz: 868.3, baseline: 30 },
  { band: 'ISM 915', center_mhz: 915.0, baseline: 40 },
  { band: 'ADS-B', center_mhz: 1090.0, baseline: 60 },
  { band: 'GPS L1', center_mhz: 1575.42, baseline: 45 },
  { band: 'LTE 1800', center_mhz: 1842.5, baseline: 55 },
  { band: 'Wi-Fi 2.4', center_mhz: 2437.0, baseline: 65 },
  { band: 'C-Band', center_mhz: 3600.0, baseline: 30 },
  { band: 'Wi-Fi 5.8', center_mhz: 5800.0, baseline: 50 },
])

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round = (v, digits) => Number(v.toFixed(digits))

/** Standard normal sample (Box–Muller). */
export function gaussian(rand = Math.random) {
  const u = 1 - rand()
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function nextSpectrum(prev) {
  return BANDS.map((def, i) => {
    const last = prev?.[i]?.activity ?? def.baseline
    const burst = Math.random() < 0.03 ? 30 + Math.random() * 25 : 0
    const activity = last + 0.2 * (def.baseline - last) + gaussian() * 7 + burst
    return { band: def.band, center_mhz: def.center_mhz, activity: round(clamp(activity, 0, 100), 1) }
  })
}

/** @returns {{ rssi: number, snr: number, frequency: number, spectrum: object[], active_band: string }} */
export function nextSample(prev = null) {
  const lastRssi = prev?.rssi ?? -75
  const fade = Math.random() < 0.05 ? -(20 + Math.random() * 15) : 0
  const rssi = round(clamp(lastRssi + 0.15 * (-75 - lastRssi) + gaussian() * 4 + fade, RSSI_MIN, RSSI_MAX), 1)

  const interference = Math.random() < 0.04 ? 15 + Math.random() * 10 : 0
  const noiseFloor = -112 + gaussian() * 1.5 + interference
  const snr = round(clamp(rssi - noiseFloor + gaussian() * 1.5, 0, 50), 1)

  const spectrum = nextSpectrum(prev?.spectrum)
  const dominant = spectrum.reduce((a, b) => (b.activity > a.activity ? b : a))
  const frequency = round(dominant.center_mhz + gaussian() * 0.25, 3)

  return { rssi, snr, frequency, spectrum, active_band: dominant.band }
}

/** Turn a sample into the wire frame: one `{sensor_id, metric, value, ts}` row per metric. */
export function sampleToFrame(sample, sensorId, ts = new Date()) {
  const iso = ts.toISOString()
  return {
    sensor_id: sensorId,
    ts: iso,
    source: 'simulator',
    readings: [
      { sensor_id: sensorId, metric: 'rssi', value: sample.rssi, ts: iso },
      { sensor_id: sensorId, metric: 'frequency', value: sample.frequency, ts: iso },
      { sensor_id: sensorId, metric: 'snr', value: sample.snr, ts: iso },
    ],
    spectrum: sample.spectrum,
    active_band: sample.active_band,
  }
}

/** Start emitting one frame every `intervalMs`. Returns a stop() function. */
export function startSimulator({ sensorId, intervalMs, onFrame }) {
  let prev = null
  const timer = setInterval(() => {
    prev = nextSample(prev)
    onFrame(sampleToFrame(prev, sensorId))
  }, intervalMs)
  return () => clearInterval(timer)
}
