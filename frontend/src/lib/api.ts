import type {
  ApiErrorBody,
  DataEnvelope,
  HealthResponse,
  HistoryResponse,
  Metric,
  Sensor,
  SensorInput,
} from '../types'

const stripSlash = (url: string): string => url.replace(/\/+$/, '')

/** REST base URL. The frontend talks to the backend only through these two env vars. */
export const API_URL = stripSlash(import.meta.env.VITE_API_URL || 'http://localhost:4000')
export const SOCKET_URL = stripSlash(import.meta.env.VITE_SOCKET_URL || API_URL)

/** Thrown for non-2xx responses (status 0 = network error / backend down). */
export class ApiError extends Error {
  readonly status: number
  readonly details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body
}

/** Typed fetch wrapper: JSON in, JSON out, errors normalised to ApiError. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, `Cannot reach the API at ${API_URL}. Is the backend running?`)
  }

  if (res.status === 204) return undefined as T

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    if (isApiErrorBody(body)) throw new ApiError(res.status, body.error.message, body.error.details)
    throw new ApiError(res.status, `Request failed with HTTP ${res.status}`)
  }
  return body as T
}

export const api = {
  health: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }),

  listSensors: async (signal?: AbortSignal): Promise<Sensor[]> =>
    (await request<DataEnvelope<Sensor[]>>('/api/v1/sensors', { signal })).data,

  getSensor: async (id: number, signal?: AbortSignal): Promise<Sensor> =>
    (await request<DataEnvelope<Sensor>>(`/api/v1/sensors/${id}`, { signal })).data,

  createSensor: async (input: SensorInput): Promise<Sensor> =>
    (await request<DataEnvelope<Sensor>>('/api/v1/sensors', { method: 'POST', body: JSON.stringify(input) })).data,

  updateSensor: async (id: number, input: SensorInput): Promise<Sensor> =>
    (await request<DataEnvelope<Sensor>>(`/api/v1/sensors/${id}`, { method: 'PUT', body: JSON.stringify(input) })).data,

  deleteSensor: (id: number): Promise<void> => request<void>(`/api/v1/sensors/${id}`, { method: 'DELETE' }),

  history: (id: number, metric: Metric, hours: number, signal?: AbortSignal): Promise<HistoryResponse> => {
    const qs = new URLSearchParams({ metric, hours: String(hours) })
    return request<HistoryResponse>(`/api/v1/sensors/${id}/history?${qs.toString()}`, { signal })
  },
}

export const errorMessage = (err: unknown): string =>
  err instanceof ApiError
    ? [err.message, ...err.details].join(' · ')
    : err instanceof Error
      ? err.message
      : 'Something went wrong'
