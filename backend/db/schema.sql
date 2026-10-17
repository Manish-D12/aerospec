-- AeroSpec schema. Idempotent: safe to run on every boot (db.js initSchema() runs this file).
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS sensors (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  location    TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (sensor, metric, instant). "Long/narrow" layout so new metrics need no migration.
CREATE TABLE IF NOT EXISTS telemetry (
  id         BIGSERIAL PRIMARY KEY,
  sensor_id  INTEGER          NOT NULL,
  metric     TEXT             NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  ts         TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- History queries filter on sensor + metric and scan a recent time range.
CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_metric_ts
  ON telemetry (sensor_id, metric, ts DESC);

-- The simulator reports as sensor 1, so make sure it exists.
INSERT INTO sensors (id, name, location, status)
VALUES (1, 'AeroSpec Pod-01', 'Hangar 3 · rooftop mast', 'active')
ON CONFLICT (id) DO NOTHING;

-- Keep the SERIAL counter ahead of the explicit id above.
SELECT setval(pg_get_serial_sequence('sensors', 'id'), GREATEST((SELECT MAX(id) FROM sensors), 1));

-- Accounts. Emails are stored lower-cased by the API, so UNIQUE is effectively case-insensitive.
-- Only bcrypt hashes are stored, never plaintext passwords.
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  verified       BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
