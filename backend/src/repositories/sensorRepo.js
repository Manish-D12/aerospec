import { query, withDbFallback, withTransaction } from '../db.js'

export const SENSOR_STATUSES = Object.freeze(['active', 'inactive', 'maintenance'])

const COLUMNS = 'id, name, location, status, created_at, updated_at'

/**
 * In-memory stand-in used only while Postgres is unreachable, so the API and
 * dashboard still work with zero external services.
 */
const memory = {
  rows: new Map(),
  nextId: 2,
}
{
  const now = new Date().toISOString()
  memory.rows.set(1, { id: 1, name: 'AeroSpec Pod-01', location: 'Hangar 3 · rooftop mast', status: 'active', created_at: now, updated_at: now })
}

export function listSensors() {
  return withDbFallback(
    async () => (await query(`SELECT ${COLUMNS} FROM sensors ORDER BY id`)).rows,
    () => [...memory.rows.values()],
  )
}

export function getSensor(id) {
  return withDbFallback(
    async () => (await query(`SELECT ${COLUMNS} FROM sensors WHERE id = $1`, [id])).rows[0] ?? null,
    () => memory.rows.get(id) ?? null,
  )
}

export function createSensor({ name, location, status }) {
  return withDbFallback(
    async () =>
      (
        await query(
          `INSERT INTO sensors (name, location, status) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
          [name, location, status],
        )
      ).rows[0],
    () => {
      const now = new Date().toISOString()
      const row = { id: memory.nextId++, name, location, status, created_at: now, updated_at: now }
      memory.rows.set(row.id, row)
      return row
    },
  )
}

/** Full replacement (PUT semantics). Returns null if the sensor doesn't exist. */
export function updateSensor(id, { name, location, status }) {
  return withDbFallback(
    async () =>
      (
        await query(
          `UPDATE sensors SET name = $2, location = $3, status = $4, updated_at = now()
           WHERE id = $1 RETURNING ${COLUMNS}`,
          [id, name, location, status],
        )
      ).rows[0] ?? null,
    () => {
      const row = memory.rows.get(id)
      if (!row) return null
      Object.assign(row, { name, location, status, updated_at: new Date().toISOString() })
      return row
    },
  )
}

/** Deletes the sensor and its telemetry atomically. Returns false if it didn't exist. */
export function deleteSensor(id) {
  return withDbFallback(
    () =>
      withTransaction(async (client) => {
        await client.query('DELETE FROM telemetry WHERE sensor_id = $1', [id])
        const res = await client.query('DELETE FROM sensors WHERE id = $1', [id])
        return res.rowCount > 0
      }),
    () => memory.rows.delete(id),
  )
}
