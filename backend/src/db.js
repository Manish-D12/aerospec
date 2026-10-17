import { readFileSync } from 'node:fs'
import pg from 'pg'
import { config } from './config.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', ''])

/** SSL off for a local Postgres, on (Neon/Render/etc.) for anything else. DB_SSL overrides. */
export function sslFor(databaseUrl, override) {
  if (override === 'true') return { rejectUnauthorized: false }
  if (override === 'false') return false
  let host
  try {
    host = new URL(databaseUrl).hostname
  } catch {
    return false
  }
  return LOCAL_HOSTS.has(host.replace(/^\[|\]$/g, '')) ? false : { rejectUnauthorized: false }
}

/**
 * One shared connection pool for the whole process. Each query borrows an idle
 * client and gives it back, so we never pay a TCP + auth handshake per request.
 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: sslFor(config.databaseUrl, config.dbSsl),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
})

// An idle client dying (e.g. Postgres restarted) must not crash the process.
pool.on('error', (err) => {
  console.warn(`[db] idle client error: ${describeError(err)}`)
  markDbDown()
})

let ready = false

/** True once initSchema() has succeeded and no query has failed on a dead connection since. */
export const isDbReady = () => ready

export function markDbDown() {
  ready = false
}

/** Readable one-liner for pg errors, including Node's AggregateError (IPv4 + IPv6 both refused). */
export function describeError(err) {
  if (err?.message) return err.message
  const inner = err?.errors?.[0]
  return inner?.message || err?.code || String(err)
}

const CONNECTION_SQLSTATES = new Set(['08000', '08001', '08003', '08004', '08006', '57P01', '57P02', '57P03'])

/** Network / server-gone errors, as opposed to a bad query or a constraint violation. */
export function isConnectionError(err) {
  if (!err) return false
  if (CONNECTION_SQLSTATES.has(err.code)) return true
  if (typeof err.code === 'string' && /^E[A-Z]+$/.test(err.code)) return true // ECONNREFUSED, ETIMEDOUT…
  return /connection|timeout|terminat/i.test(err.message ?? '') && !err.code
}

/**
 * Run `fn` against Postgres when it is up; otherwise (or if the connection
 * drops mid-query) run `fallback` instead, so the API degrades rather than 500s.
 */
export async function withDbFallback(fn, fallback) {
  if (!ready) return fallback()
  try {
    return await fn()
  } catch (err) {
    if (!isConnectionError(err)) throw err
    console.warn(`[db] lost connection (${describeError(err)}); using fallback`)
    markDbDown()
    return fallback()
  }
}

/** Thin wrapper so callers always go through parameterised queries. */
export function query(text, params = []) {
  return pool.query(text, params)
}

/** Run `fn(client)` inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** db/schema.sql: CREATE TABLE IF NOT EXISTS sensors + telemetry, the history index, default sensor. */
export const SCHEMA_SQL = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')

/** Create tables + index if missing. Throws if Postgres is unreachable. */
export async function initSchema() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set')
  await pool.query(SCHEMA_SQL)
  ready = true
}

/**
 * Try initSchema(); on failure keep retrying in the background so the API
 * recovers by itself if Postgres comes up after the server.
 */
export function connectWithRetry({ retryMs = 10_000, log = console } = {}) {
  let timer = null
  let inFlight = false
  let warned = false

  const attempt = async () => {
    timer = null
    inFlight = true
    try {
      await initSchema()
      log.info(`[db] connected, schema ready`)
      warned = false
    } catch (err) {
      if (!warned) {
        log.warn(`[db] Postgres unavailable (${describeError(err)}). Live feed continues; history/sensors use fallbacks. Retrying every ${retryMs / 1000}s.`)
        warned = true
      }
      schedule()
    } finally {
      inFlight = false
    }
  }
  const schedule = () => {
    if (!timer) timer = setTimeout(attempt, retryMs).unref()
  }

  // Watchdog: if a query marks the DB as down, start retrying again.
  const watchdog = setInterval(() => {
    if (!ready && !timer && !inFlight) schedule()
  }, retryMs).unref()

  const first = attempt()
  return {
    ready: first,
    stop() {
      clearInterval(watchdog)
      if (timer) clearTimeout(timer)
    },
  }
}
