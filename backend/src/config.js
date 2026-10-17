import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

const stripSlash = (url) => url.replace(/\/+$/, '')

/**
 * JWT signing secret. Without JWT_SECRET we fall back to a random 384-bit
 * secret so the server still boots, but every restart invalidates all tokens.
 */
function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) {
    if (fromEnv.length < 32) console.warn('[auth] JWT_SECRET is shorter than 32 characters; use a longer random value.')
    return fromEnv
  }
  console.warn('[auth] JWT_SECRET is not set. Using a random secret for this process; tokens will not survive a restart. Set JWT_SECRET in backend/.env.')
  return randomBytes(48).toString('base64url')
}

const origins =(process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/** All runtime configuration, read once from the environment (.env via dotenv). */
export const config = {
  port: int(process.env.PORT, 4000),
  env: process.env.NODE_ENV ?? 'development',
  /** `true` lets any origin through; otherwise an explicit allow-list. */
  corsOrigin: origins.includes('*') ? true : origins,
  databaseUrl: process.env.DATABASE_URL ?? '',
  dbSsl: process.env.DB_SSL,
  simSensorId: int(process.env.SIM_SENSOR_ID, 1),
  simIntervalMs: Math.max(100, int(process.env.SIM_INTERVAL_MS, 1000)),
  auth: {
    jwtSecret: resolveJwtSecret(),
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    emailFrom: process.env.EMAIL_FROM?.trim() || 'AeroSpec <onboarding@resend.dev>',
    appUrl: stripSlash(process.env.APP_URL?.trim() || 'http://localhost:5173'),
    apiPublicUrl: stripSlash(process.env.API_PUBLIC_URL?.trim() || `http://localhost:${int(process.env.PORT, 4000)}`),
  },
  mqtt: {
    url: process.env.MQTT_URL?.trim() ?? '',
    topic: process.env.MQTT_TOPIC?.trim() || 'aerospec/telemetry',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },
}
