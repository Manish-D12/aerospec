import bcrypt from 'bcrypt'
import { Router } from 'express'
import { sendVerificationEmail } from '../auth/mailer.js'
import { signSessionToken, verifyVerifyToken } from '../auth/tokens.js'
import { config } from '../config.js'
import { isDbReady } from '../db.js'
import { HttpError, badRequest } from '../httpError.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  UNIQUE_VIOLATION,
  createUser,
  findUserById,
  findUserWithHashByEmail,
  markVerified,
} from '../repositories/userRepo.js'

const BCRYPT_ROUNDS = 10
// bcrypt only uses the first 72 bytes; reject longer input rather than silently truncating.
const PASSWORD_MAX_BYTES = 72
const PASSWORD_MIN = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Compared against when the email doesn't exist, so "no such user" and
// "wrong password" take the same time (no account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('aerospec-timing-equaliser', BCRYPT_ROUNDS)

/** Auth is Postgres-only: no in-memory fallback, so fail clearly when it's down. */
function requireDb() {
  if (!isDbReady()) throw new HttpError(503, 'Authentication is unavailable: database offline')
}

const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

const toPublicUser = ({ id, name, email, verified }) => ({ id, name, email, verified })

function parseRegister(body) {
  const src = body && typeof body === 'object' ? body : {}
  const name = typeof src.name === 'string' ? src.name.trim() : ''
  const email = normalizeEmail(src.email)
  const password = typeof src.password === 'string' ? src.password : ''
  const errors = []

  if (!name) errors.push('name is required')
  else if (name.length > 80) errors.push('name must be at most 80 characters')
  if (!EMAIL_RE.test(email) || email.length > 254) errors.push('a valid email is required')
  if (password.length < PASSWORD_MIN) errors.push(`password must be at least ${PASSWORD_MIN} characters`)
  else if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) errors.push(`password must be at most ${PASSWORD_MAX_BYTES} bytes`)

  if (errors.length) throw badRequest('Invalid registration', errors)
  return { name, email, password }
}

function parseLogin(body) {
  const src = body && typeof body === 'object' ? body : {}
  const email = normalizeEmail(src.email)
  const password = typeof src.password === 'string' ? src.password : ''
  if (!email || !password) throw badRequest('Email and password are required')
  return { email, password }
}

export function authRouter() {
  const router = Router()

  // POST /api/v1/auth/register
  router.post('/register', async (req, res, next) => {
    try {
      const { name, email, password } = parseRegister(req.body)
      requireDb()

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      let user
      try {
        user = await createUser({ name, email, passwordHash })
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) throw new HttpError(409, 'An account with this email already exists')
        throw err
      }

      res.status(201).json({ token: signSessionToken(user), user: toPublicUser(user) })
      // Fire-and-forget after responding: email latency or failure must not block or fail sign-up.
      void sendVerificationEmail(user)
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/auth/login
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = parseLogin(req.body)
      requireDb()

      const row = await findUserWithHashByEmail(email)
      const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH)
      // One message for both cases so the API doesn't reveal which emails exist.
      if (!row || !ok) throw new HttpError(401, 'Invalid email or password')

      res.status(200).json({ token: signSessionToken(row), user: toPublicUser(row) })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/auth/me
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      requireDb()
      const user = await findUserById(req.auth.userId)
      // A valid token for a deleted account is still unauthorised.
      if (!user) throw new HttpError(401, 'Account no longer exists')
      res.status(200).json({ user: toPublicUser(user) })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/auth/resend-verification
  router.post('/resend-verification', requireAuth, async (req, res, next) => {
    try {
      requireDb()
      const user = await findUserById(req.auth.userId)
      if (!user) throw new HttpError(401, 'Account no longer exists')
      if (user.verified) {
        res.status(200).json({ sent: false, message: 'Email is already verified' })
        return
      }
      const via = await sendVerificationEmail(user)
      res.status(202).json({
        sent: true,
        via,
        message: via === 'email' ? `Verification email sent to ${user.email}` : 'Email delivery is not configured; the link was written to the server log',
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/auth/verify?token=… (opened from the email, so it answers with redirects, not JSON)
  router.get('/verify', async (req, res, next) => {
    const fail = (reason) => res.redirect(302, `${config.auth.appUrl}/login?verified=0&reason=${reason}`)
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : ''
      let userId
      try {
        ;({ userId } = verifyVerifyToken(token))
      } catch (err) {
        return fail(err.name === 'TokenExpiredError' ? 'expired' : 'invalid')
      }
      requireDb()
      const user = await markVerified(userId)
      if (!user) return fail('invalid')
      res.redirect(302, `${config.auth.appUrl}/login?verified=1`)
    } catch (err) {
      next(err)
    }
  })

  return router
}
