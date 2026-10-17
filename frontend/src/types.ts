/* ------------------------------------------------------------------ *
 * Wire types: exactly what the backend sends (snake_case JSON).
 * ------------------------------------------------------------------ */

/** Metrics the pod reports; matches backend/src/metrics.js. */
export type Metric = 'rssi' | 'frequency' | 'snr'

/** One persisted telemetry row: `{ sensor_id, metric, value, ts }`. */
export interface TelemetryPoint {
  sensor_id: number
  metric: Metric
  value: number
  /** ISO-8601 timestamp. */
  ts: string
}

/** One spectrum band as sent by the server. */
export interface BandActivityDTO {
  band: string
  center_mhz: number
  /** 0–100 %. */
  activity: number
}

export type FeedSource = 'simulator' | 'mqtt'

/** Payload of the Socket.io `telemetry` event (one per second from the simulator). */
export interface TelemetryFrame {
  sensor_id: number
  ts: string
  source: FeedSource
  readings: TelemetryPoint[]
  /** Present on simulator frames; MQTT frames may omit it. */
  spectrum?: BandActivityDTO[]
  active_band?: string
}

/** Events the server emits, for a typed socket.io-client. */
export interface ServerToClientEvents {
  telemetry: (frame: TelemetryFrame) => void
  'telemetry:backlog': (frames: TelemetryFrame[]) => void
}

/** The client emits nothing. */
export type ClientToServerEvents = Record<string, never>

export type SensorStatus = 'active' | 'inactive' | 'maintenance'

export interface Sensor {
  id: number
  name: string
  location: string
  status: SensorStatus
  created_at: string
  updated_at: string
}

/** Body for POST / PUT /api/v1/sensors. */
export interface SensorInput {
  name: string
  location: string
  status: SensorStatus
}

export interface HistoryPoint {
  ts: string
  /** Bucket average. */
  value: number
  min: number
  max: number
  samples: number
}

export interface HistoryResponse {
  sensor_id: number
  metric: Metric
  hours: number
  bucket_seconds: number
  source: 'postgres' | 'unavailable'
  count: number
  data: HistoryPoint[]
}

export interface FeedStatus {
  source: FeedSource | 'starting' | 'none'
  clients: number
  frames_emitted?: number
  rows_persisted?: number
  last_frame_at?: string | null
}

export interface HealthResponse {
  status: 'ok'
  uptime_s: number
  db: 'up' | 'down'
  feed: FeedStatus
  ts: string
}

/** `{ data }` envelope used by the sensors endpoints. */
export interface DataEnvelope<T> {
  data: T
}

export interface ApiErrorBody {
  error: { status: number; message: string; details?: string[] }
}

/* ------------------------------------------------------------------ *
 * Auth wire types (/api/v1/auth/*).
 * ------------------------------------------------------------------ */

export interface AuthUser {
  id: number
  name: string
  email: string
  verified: boolean
}

/** POST /auth/register and POST /auth/login. */
export interface AuthResponse {
  token: string
  user: AuthUser
}

/** GET /auth/me. */
export interface MeResponse {
  user: AuthUser
}

/** POST /auth/resend-verification. */
export interface ResendVerificationResponse {
  sent: boolean
  via?: 'email' | 'console'
  message: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

/* ------------------------------------------------------------------ *
 * View types: what components render (camelCase, numbers for time).
 * ------------------------------------------------------------------ */

/** One spectrum band and its current activity level (0–100 %). */
export interface BandActivity {
  band: string
  /** Band centre frequency in MHz. */
  centerMHz: number
  activity: number
}

/** A single combined sample (all metrics at one instant) in the rolling window. */
export interface TelemetryReading {
  id: number
  timestamp: number
  sensorId: number
  /** Received signal strength, -120 to -30 dBm. */
  rssi: number
  /** Tuned frequency in MHz. */
  frequency: number
  /** Signal-to-noise ratio in dB. */
  snr: number
  /** Label of the most active band in this sample. */
  activeBand: string
  spectrum: BandActivity[]
}

export type Severity = 'warning' | 'critical'

export type AlertKind = 'weak-signal' | 'poor-snr'

export interface TelemetryAlert {
  id: number
  timestamp: number
  kind: AlertKind
  severity: Severity
  message: string
}

export type StatStatus = 'good' | 'abnormal'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'paused'

export interface TelemetryState {
  readings: TelemetryReading[]
  latest: TelemetryReading | null
  alerts: TelemetryAlert[]
  connection: ConnectionState
  source: FeedSource | null
  /** Last connection error message, if any. */
  error: string | null
  running: boolean
  start: () => void
  stop: () => void
  toggle: () => void
  clearAlerts: () => void
}

export type InputType = 'text' | 'email' | 'password'

/** Declarative description of one auth-form input. */
export interface FormField<K extends string> {
  label: string
  name: K
  type: InputType
  placeholder: string
  autoComplete: string
}

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  name: string
  email: string
  password: string
}

export interface NavItem {
  to: string
  label: string
}
