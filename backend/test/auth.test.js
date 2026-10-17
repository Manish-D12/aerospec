import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { signSessionToken, signVerifyToken } from '../src/auth/tokens.js'
import { config } from '../src/config.js'
import { initSchema, isDbReady, pool } from '../src/db.js'

// Auth is Postgres-only by design, so these need a real database (CI provides one).
const app = createApp()
const RUN = `${Date.now()}-${process.pid}`
const email = `pilot-${RUN}@test.aerospec.dev`
const password = 'correct-horse-battery'
let dbUp = false

before(async () => {
  try {
    await initSchema()
  } catch {
    // handled below
  }
  dbUp = isDbReady()
  if (!dbUp) console.info('# auth tests: no database, only the DB-independent checks will run')
})

after(async () => {
  if (dbUp) await pool.query('DELETE FROM users WHERE email LIKE $1', [`%-${RUN}@test.aerospec.dev`])
  await pool.end()
})

const needsDb = (t) => {
  if (!dbUp) t.skip('PostgreSQL not reachable')
  return !dbUp
}

describe('auth without a token', () => {
  test('GET /me without Authorization → 401', async () => {
    await request(app).get('/api/v1/auth/me').expect(401)
  })

  test('GET /me with a garbage token → 401', async () => {
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401)
  })

  test('GET /me with a token signed by another secret → 401', async () => {
    const forged = jwt.sign({ userId: 1, email: 'x@y.z' }, 'some-other-secret', { audience: 'session', issuer: 'aerospec-api' })
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`).expect(401)
  })

  test('an email-verify token is not accepted as a session token', async () => {
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${signVerifyToken(1)}`).expect(401)
  })

  test('POST /resend-verification without a token → 401', async () => {
    await request(app).post('/api/v1/auth/resend-verification').expect(401)
  })

  test('register validation → 400 with details', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: '', email: 'nope', password: 'short' }).expect(400)
    assert.equal(res.body.error.details.length, 3)
  })
})

describe('register → login → me → verify', () => {
  let token
  let userId

  test('POST /register → 201 with token + public user', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Test Pilot', email: email.toUpperCase(), password }).expect(201)
    assert.ok(res.body.token)
    assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'id', 'name', 'verified'])
    assert.equal(res.body.user.email, email, 'email is normalised to lower case')
    assert.equal(res.body.user.verified, false)
    token = res.body.token
    userId = res.body.user.id

    const decoded = jwt.decode(token)
    assert.equal(decoded.userId, userId)
    assert.equal(decoded.email, email)
    assert.equal(decoded.exp - decoded.iat, 7 * 24 * 3600, '7 day expiry')
  })

  test('password is stored only as a bcrypt hash', async (t) => {
    if (needsDb(t)) return
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    assert.match(rows[0].password_hash, /^\$2[aby]\$10\$/)
    assert.ok(!rows[0].password_hash.includes(password))
  })

  test('duplicate email → 409', async (t) => {
    if (needsDb(t)) return
    await request(app).post('/api/v1/auth/register').send({ name: 'Again', email, password }).expect(409)
  })

  test('login with the right password → 200', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200)
    assert.equal(res.body.user.id, userId)
    assert.ok(res.body.token)
  })

  test('login with a wrong password or unknown email → 401 (same message)', async (t) => {
    if (needsDb(t)) return
    const a = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' }).expect(401)
    const b = await request(app).post('/api/v1/auth/login').send({ email: `ghost-${RUN}@test.aerospec.dev`, password }).expect(401)
    assert.equal(a.body.error.message, b.body.error.message)
  })

  test('GET /me with the token → the user row', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(res.body.user.email, email)
    assert.equal(res.body.user.password_hash, undefined)
  })

  test('POST /resend-verification → 202 while unverified', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).post('/api/v1/auth/resend-verification').set('Authorization', `Bearer ${token}`).expect(202)
    assert.equal(res.body.sent, true)
  })

  test('GET /verify with a bad token → redirect to login?verified=0', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).get('/api/v1/auth/verify?token=garbage').expect(302)
    assert.equal(res.headers.location, `${config.auth.appUrl}/login?verified=0&reason=invalid`)
  })

  test('GET /verify with a session token (wrong audience) is rejected', async (t) => {
    if (needsDb(t)) return
    await request(app).get(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`).expect(302)
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(res.body.user.verified, false)
  })

  test('GET /verify with a valid link → verified + redirect to login?verified=1', async (t) => {
    if (needsDb(t)) return
    const res = await request(app).get(`/api/v1/auth/verify?token=${encodeURIComponent(signVerifyToken(userId))}`).expect(302)
    assert.equal(res.headers.location, `${config.auth.appUrl}/login?verified=1`)
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(me.body.user.verified, true)
  })

  test('a valid token for a deleted user → 401', async (t) => {
    if (needsDb(t)) return
    const orphan = signSessionToken({ id: 2_000_000_000, email: 'gone@test.aerospec.dev' })
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${orphan}`).expect(401)
  })
})
