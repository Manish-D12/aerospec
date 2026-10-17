import { isMetric } from '../metrics.js'

/**
 * Validate one incoming reading (from MQTT or anywhere untrusted) into
 * `{ sensor_id, metric, value, ts }`, or return null if it's unusable.
 */
export function normalizeReading(raw, defaultSensorId) {
  if (!raw || typeof raw !== 'object') return null
  const sensorId = raw.sensor_id === undefined ? defaultSensorId : Number(raw.sensor_id)
  const value = Number(raw.value)
  const ts = raw.ts === undefined ? new Date() : new Date(raw.ts)

  if (!Number.isInteger(sensorId) || sensorId < 1) return null
  if (!isMetric(raw.metric)) return null
  if (raw.value === null || raw.value === '' || !Number.isFinite(value)) return null
  if (Number.isNaN(ts.getTime())) return null

  return { sensor_id: sensorId, metric: raw.metric, value, ts: ts.toISOString() }
}

/**
 * Accepts a single reading, an array of readings, or a full frame
 * `{ readings: [...], spectrum?, active_band? }` and returns frames grouped by sensor.
 */
export function payloadToFrames(payload, { defaultSensorId, source }) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.readings) ? payload.readings : [payload]
  const readings = list.map((r) => normalizeReading(r, defaultSensorId)).filter(Boolean)

  const bySensor = new Map()
  for (const r of readings) {
    if (!bySensor.has(r.sensor_id)) bySensor.set(r.sensor_id, [])
    bySensor.get(r.sensor_id).push(r)
  }

  const spectrum = Array.isArray(payload?.spectrum) ? payload.spectrum : undefined
  const activeBand = typeof payload?.active_band === 'string' ? payload.active_band : undefined

  return [...bySensor.entries()].map(([sensorId, rs]) => ({
    sensor_id: sensorId,
    ts: rs.reduce((latest, r) => (r.ts > latest ? r.ts : latest), rs[0].ts),
    source,
    readings: rs,
    ...(spectrum && { spectrum }),
    ...(activeBand && { active_band: activeBand }),
  }))
}
