/**
 * npm run seed — fill Postgres with 24 h of 1-minute history for the simulator
 * sensor (3 metrics × 1440 rows), using the same RF model as the live feed.
 *
 *   npm run seed                 # sensor SIM_SENSOR_ID (default 1), last 24 h
 *   npm run seed -- --hours 48   # longer history
 *
 * Re-runnable: deletes that sensor's rows inside the seeded window first.
 */
import { config } from '../src/config.js'
import { initSchema, pool, withTransaction } from '../src/db.js'
import { nextSample } from '../src/realtime/simulator.js'

const STEP_MS = 60_000
const BATCH = 1_000

function argValue(name, fallback) {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback
}

async function main() {
  const hours = argValue('--hours', 24)
  const sensorId = argValue('--sensor', config.simSensorId)
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('--hours must be a positive number')

  console.info(`[seed] connecting to ${config.databaseUrl.replace(/:[^:@/]+@/, ':****@') || '(DATABASE_URL not set)'}`)
  await initSchema()

  const end = Date.now() - STEP_MS
  const start = end - hours * 3_600_000
  const rows = []
  let prev = null
  for (let t = start; t <= end; t += STEP_MS) {
    prev = nextSample(prev)
    const ts = new Date(t).toISOString()
    rows.push(
      { sensor_id: sensorId, metric: 'rssi', value: prev.rssi, ts },
      { sensor_id: sensorId, metric: 'snr', value: prev.snr, ts },
      { sensor_id: sensorId, metric: 'frequency', value: prev.frequency, ts },
    )
  }

  const inserted = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO sensors (id, name, location, status)
       VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
      [sensorId, `AeroSpec Pod-${String(sensorId).padStart(2, '0')}`, 'Seeded sensor'],
    )
    await client.query(
      'DELETE FROM telemetry WHERE sensor_id = $1 AND ts BETWEEN $2 AND $3',
      [sensorId, new Date(start).toISOString(), new Date(end).toISOString()],
    )

    let count = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const res = await client.query(
        `INSERT INTO telemetry (sensor_id, metric, value, ts)
         SELECT * FROM UNNEST($1::int[], $2::text[], $3::float8[], $4::timestamptz[])`,
        [chunk.map((r) => r.sensor_id), chunk.map((r) => r.metric), chunk.map((r) => r.value), chunk.map((r) => r.ts)],
      )
      count += res.rowCount
    }
    return count
  })

  console.info(`[seed] inserted ${inserted} rows (${rows.length / 3} per metric) for sensor ${sensorId} over ${hours} h`)
}

main()
  .catch((err) => {
    console.error(`[seed] failed: ${err.message}`)
    console.error('[seed] Is Postgres running and DATABASE_URL in backend/.env correct?')
    process.exitCode = 1
  })
  .finally(() => pool.end())
