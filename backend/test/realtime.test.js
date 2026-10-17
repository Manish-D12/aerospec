import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sslFor } from '../src/db.js'
import { normalizeReading, payloadToFrames } from '../src/realtime/frames.js'
import { BANDS, RSSI_MAX, RSSI_MIN, nextSample, sampleToFrame } from '../src/realtime/simulator.js'
import { bucketSecondsFor } from '../src/repositories/telemetryRepo.js'

test('simulator stays inside physical bounds over many ticks', () => {
  let s = null
  for (let i = 0; i < 2_000; i++) {
    s = nextSample(s)
    assert.ok(s.rssi >= RSSI_MIN && s.rssi <= RSSI_MAX, `rssi ${s.rssi}`)
    assert.ok(s.snr >= 0 && s.snr <= 50, `snr ${s.snr}`)
    assert.equal(s.spectrum.length, BANDS.length)
    for (const b of s.spectrum) assert.ok(b.activity >= 0 && b.activity <= 100)
  }
})

test('frame carries one {sensor_id, metric, value, ts} per metric', () => {
  const frame = sampleToFrame(nextSample(), 7, new Date('2026-01-01T00:00:00Z'))
  assert.deepEqual(
    frame.readings.map((r) => Object.keys(r).sort()),
    Array(3).fill(['metric', 'sensor_id', 'ts', 'value']),
  )
  assert.deepEqual(frame.readings.map((r) => r.metric).sort(), ['frequency', 'rssi', 'snr'])
  assert.ok(frame.readings.every((r) => r.sensor_id === 7 && r.ts === '2026-01-01T00:00:00.000Z'))
})

test('normalizeReading rejects junk and fills defaults', () => {
  assert.equal(normalizeReading({ metric: 'temperature', value: 1 }, 1), null)
  assert.equal(normalizeReading({ metric: 'rssi', value: 'loud' }, 1), null)
  assert.equal(normalizeReading({ metric: 'rssi', value: null }, 1), null)
  assert.equal(normalizeReading({ metric: 'rssi', value: -80, ts: 'yesterday-ish' }, 1), null)
  const ok = normalizeReading({ metric: 'rssi', value: '-80.5' }, 3)
  assert.equal(ok.sensor_id, 3)
  assert.equal(ok.value, -80.5)
})

test('payloadToFrames groups MQTT readings by sensor', () => {
  const frames = payloadToFrames(
    [
      { sensor_id: 1, metric: 'rssi', value: -70 },
      { sensor_id: 2, metric: 'snr', value: 20 },
      { sensor_id: 1, metric: 'snr', value: 30 },
      { metric: 'nonsense', value: 1 },
    ],
    { defaultSensorId: 1, source: 'mqtt' },
  )
  assert.equal(frames.length, 2)
  assert.equal(frames.find((f) => f.sensor_id === 1).readings.length, 2)
})

test('SSL is off for localhost and on for remote hosts', () => {
  assert.equal(sslFor('postgres://u:p@localhost:5432/db'), false)
  assert.equal(sslFor('postgres://u:p@127.0.0.1/db'), false)
  assert.deepEqual(sslFor('postgres://u:p@ep-x.neon.tech/db'), { rejectUnauthorized: false })
  assert.equal(sslFor('postgres://u:p@ep-x.neon.tech/db', 'false'), false)
})

test('history buckets keep responses under the point cap', () => {
  assert.equal(bucketSecondsFor(1), 10)
  assert.equal(bucketSecondsFor(24), 240)
})
