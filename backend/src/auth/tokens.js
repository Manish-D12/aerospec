import jwt from 'jsonwebtoken'
import { config } from '../config.js'

const ISSUER = 'aerospec-api'
const ALGORITHM = 'HS256'

/** Session token: `{ userId, email }`, valid 7 days. */
export function signSessionToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, config.auth.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: '7d',
    issuer: ISSUER,
    audience: 'session',
  })
}

/** Throws if the token is missing, expired, tampered with, or not a session token. */
export function verifySessionToken(token) {
  const payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: [ALGORITHM], issuer: ISSUER, audience: 'session' })
  if (!Number.isInteger(payload.userId)) throw new jwt.JsonWebTokenError('malformed payload')
  return payload
}

/**
 * Email-verification token: `{ userId }` with its own audience and a 24 h life,
 * so a verify link can't be used as a login token (or vice versa).
 */
export function signVerifyToken(userId) {
  return jwt.sign({ userId }, config.auth.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: '24h',
    issuer: ISSUER,
    audience: 'email-verify',
  })
}

export function verifyVerifyToken(token) {
  const payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: [ALGORITHM], issuer: ISSUER, audience: 'email-verify' })
  if (!Number.isInteger(payload.userId)) throw new jwt.JsonWebTokenError('malformed payload')
  return payload
}
