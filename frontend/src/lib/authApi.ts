import axios, { AxiosError } from 'axios'
import { API_URL, ApiError } from './api'
import type {
  ApiErrorBody,
  AuthResponse,
  AuthUser,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResendVerificationResponse,
} from '../types'

/** axios instance for /api/v1/auth. Same base URL (VITE_API_URL) as the fetch client. */
const http = axios.create({
  baseURL: `${API_URL}/api/v1/auth`,
  headers: { Accept: 'application/json' },
  timeout: 10_000,
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body
}

/** Normalise axios failures into the app's ApiError (status 0 = backend unreachable). */
function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body: unknown = err.response?.data
    if (err.response && isApiErrorBody(body)) {
      return new ApiError(err.response.status, body.error.message, body.error.details ?? [])
    }
    if (err.response) return new ApiError(err.response.status, `Request failed with HTTP ${err.response.status}`)
    return new ApiError(0, `Cannot reach the API at ${API_URL}. Is the backend running?`)
  }
  return new ApiError(0, err instanceof Error ? err.message : 'Unknown error')
}

async function call<T>(run: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await run()).data
  } catch (err) {
    throw toApiError(err)
  }
}

export const authApi = {
  register: (input: RegisterInput) => call(() => http.post<AuthResponse>('/register', input)),
  login: (input: LoginInput) => call(() => http.post<AuthResponse>('/login', input)),
  me: async (token: string, signal?: AbortSignal): Promise<AuthUser> =>
    (await call(() => http.get<MeResponse>('/me', { headers: bearer(token), signal }))).user,
  resendVerification: (token: string) =>
    call(() => http.post<ResendVerificationResponse>('/resend-verification', null, { headers: bearer(token) })),
}
