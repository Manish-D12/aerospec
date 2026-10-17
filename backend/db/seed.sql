-- 24 hours of 1-minute history for sensor 1, three metrics (rssi, snr, frequency).
-- Pure SQL alternative to `npm run seed`:
--   psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql
--
-- Re-runnable: clears sensor 1's last 24 h first.

BEGIN;

DELETE FROM telemetry
 WHERE sensor_id = 1
   AND ts >= now() - interval '24 hours';

WITH t AS (
  -- generate_series yields one timestamp per minute across the last 24 h (1440 rows).
  SELECT g                               AS ts,
         extract(epoch FROM g) / 3600.0  AS h,
         random()                        AS noise,
         random()                        AS fade_roll
    FROM generate_series(now() - interval '24 hours',
                         now() - interval '1 minute',
                         interval '1 minute') AS g
),
s AS (
  -- RSSI: slow 6 h swell around -78 dBm + noise + the occasional deep fade.
  SELECT ts,
         round((-78 + 10 * sin(h * pi() / 3)
                + (noise - 0.5) * 8
                - CASE WHEN fade_roll < 0.04 THEN 25 ELSE 0 END)::numeric, 1)::float8 AS rssi
    FROM t
)
INSERT INTO telemetry (sensor_id, metric, value, ts)
SELECT 1, 'rssi', rssi, ts FROM s
UNION ALL
-- SNR tracks RSSI against a ~-112 dBm noise floor.
SELECT 1, 'snr', greatest(0, round((rssi + 112 + (random() - 0.5) * 3)::numeric, 1))::float8, ts FROM s
UNION ALL
-- Frequency: centre of a randomly dominant band (MHz) plus a little jitter.
SELECT 1, 'frequency',
       round(((ARRAY[127.5, 433.92, 868.3, 915.0, 1090.0, 1575.42, 1842.5, 2437.0, 3600.0, 5800.0])
                [1 + floor(random() * 10)::int] + (random() - 0.5) * 0.5)::numeric, 3)::float8,
       ts
  FROM s;

COMMIT;

SELECT metric, count(*) AS rows, round(avg(value)::numeric, 2) AS avg
  FROM telemetry
 WHERE sensor_id = 1 AND ts >= now() - interval '24 hours'
 GROUP BY metric
 ORDER BY metric;
