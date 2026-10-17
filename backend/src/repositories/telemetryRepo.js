import { query, withDbFallback } from '../db.js'

/** Upper bound on points returned by /history; longer ranges are averaged into buckets. */
export const MAX_HISTORY_POINTS = 360

/**
 * Persist a batch of readings in ONE round trip. The SQL text is constant; the
 * values travel as four typed array parameters that UNNEST turns back into rows.
 */
export async function insertReadings(readings) {
  if (readings.length === 0) return 0
  const res = await query(
    `INSERT INTO telemetry (sensor_id, metric, value, ts)
     SELECT * FROM UNNEST($1::int[], $2::text[], $3::float8[], $4::timestamptz[])`,
    [
      readings.map((r) => r.sensor_id),
      readings.map((r) => r.metric),
      readings.map((r) => r.value),
      readings.map((r) => r.ts),
    ],
  )
  return res.rowCount
}

/** Bucket width (seconds) so `hours` of data fits in MAX_HISTORY_POINTS points. */
export const bucketSecondsFor = (hours) => Math.max(1, Math.ceil((hours * 3600) / MAX_HISTORY_POINTS))

/**
 * Time-bucketed averages of one metric for one sensor over the last `hours`.
 * Returns [] when Postgres is down so callers can still render.
 */
export function getHistory(sensorId, metric, hours) {
  const bucket = bucketSecondsFor(hours)
  return withDbFallback(
    async () => {
      const res = await query(
        `SELECT to_timestamp(floor(extract(epoch FROM ts) / $4) * $4) AS ts,
                round(avg(value)::numeric, 2)::float8               AS value,
                min(value)                                          AS min,
                max(value)                                          AS max,
                count(*)::int                                       AS samples
           FROM telemetry
          WHERE sensor_id = $1
            AND metric    = $2
            AND ts       >= now() - ($3::float8 * interval '1 hour')
          GROUP BY 1
          ORDER BY 1`,
        [sensorId, metric, hours, bucket],
      )
      return { points: res.rows, bucketSeconds: bucket, source: 'postgres' }
    },
    () => ({ points: [], bucketSeconds: bucket, source: 'unavailable' }),
  )
}
