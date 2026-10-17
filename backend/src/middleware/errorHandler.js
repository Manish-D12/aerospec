import { isConnectionError } from '../db.js'
import { HttpError } from '../httpError.js'

/** 404 for any route nothing else matched. */
export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`))
}

/**
 * Central error middleware (Express recognises it by its 4 arguments).
 * Every thrown/forwarded error ends up here and leaves as `{ error: { status, message } }`.
 */
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? err.statusCode ?? 500
  let message = err.message || 'Internal server error'

  if (err.type === 'entity.parse.failed') {
    status = 400
    message = 'Request body is not valid JSON'
  } else if (isConnectionError(err)) {
    status = 503
    message = 'Database unavailable'
  }

  if (status >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl} →`, err)
    // Don't leak internals (SQL, stack) to clients.
    if (status === 500) message = 'Internal server error'
  }

  const body = { error: { status, message } }
  if (err.details) body.error.details = err.details
  res.status(status).json(body)
}
