import { query } from '../db.js'

/** Columns that are safe to send to a client (never password_hash). */
const PUBLIC_COLUMNS = 'id, name, email, verified, created_at'

/** Postgres unique_violation SQLSTATE. */
export const UNIQUE_VIOLATION = '23505'

export async function createUser({ name, email, passwordHash }) {
  const res = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash],
  )
  return res.rows[0]
}

/** Includes password_hash: for login only, never return this row to a client. */
export async function findUserWithHashByEmail(email) {
  const res = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email])
  return res.rows[0] ?? null
}

export async function findUserById(id) {
  const res = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id])
  return res.rows[0] ?? null
}

/** Returns the updated user, or null if the id doesn't exist. */
export async function markVerified(id) {
  const res = await query(`UPDATE users SET verified = true WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`, [id])
  return res.rows[0] ?? null
}
