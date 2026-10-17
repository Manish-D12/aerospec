import { verifySessionToken } from '../auth/tokens.js'
import { HttpError } from '../httpError.js'

/**
 * Require `Authorization: Bearer <jwt>`. On success sets `req.auth = { userId, email }`;
 * otherwise responds 401 through the error middleware.
 */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match) return next(new HttpError(401, 'Missing bearer token'))

  try {
    const { userId, email } = verifySessionToken(match[1])
    req.auth = { userId, email }
    next()
  } catch (err) {
    next(new HttpError(401, err.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid token'))
  }
}
