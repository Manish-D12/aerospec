import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { initSchema, isDbReady, pool } from '../src/db.js'

// Runs against Postgres when DATABASE_URL is reachable (CI provides a service
// container), otherwise against the in-memory fallback. Both must behave the same.
const app = createApp()

before(async () => {
  try {
    await initSchema()
  } catch {
    // No database: exercising the fallback path is part of the point.
  }
  console.info(`# tests running against ${isDbReady() ? 'PostgreSQL' : 'in-memory fallback'}`)
})

after(() => pool.end())

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200)
    assert.equal(res.body.status, 'ok')
    assert.ok(['up', 'down'].includes(res.body.db))
  })
})

describe('CORS', () => {
  test('allows the configured frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173').expect(200)
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173')
  })
})

describe('sensors CRUD', () => {
  let id

  test('GET /api/v1/sensors lists the default pod', async () => {
    const res = await request(app).get('/api/v1/sensors').expect(200)
    assert.ok(Array.isArray(res.body.data))
    assert.ok(res.body.data.some((s) => s.id === 1))
  })

  test('POST creates a sensor → 201 + Location', async () => {
    const res = await request(app)
      .post('/api/v1/sensors')
      .send({ name: 'Test Pod', location: 'Lab bench', status: 'maintenance' })
      .expect(201)
    id = res.body.data.id
    assert.equal(res.body.data.name, 'Test Pod')
    assert.equal(res.headers.location, `/api/v1/sensors/${id}`)
  })

  test('POST with no name → 400 with details', async () => {
    const res = await request(app).post('/api/v1/sensors').send({ location: 'x' }).expect(400)
    assert.ok(res.body.error.details.includes('name is required'))
  })

  test('POST with malformed JSON → 400', async () => {
    await request(app).post('/api/v1/sensors').set('Content-Type', 'application/json').send('{"name":').expect(400)
  })

  test('GET /:id returns it', async () => {
    const res = await request(app).get(`/api/v1/sensors/${id}`).expect(200)
    assert.equal(res.body.data.location, 'Lab bench')
  })

  test('PUT /:id replaces it', async () => {
    const res = await request(app)
      .put(`/api/v1/sensors/${id}`)
      .send({ name: 'Test Pod v2', location: 'Roof', status: 'inactive' })
      .expect(200)
    assert.equal(res.body.data.name, 'Test Pod v2')
    assert.equal(res.body.data.status, 'inactive')
  })

  test('PUT with a bad status → 400', async () => {
    await request(app).put(`/api/v1/sensors/${id}`).send({ name: 'x', status: 'exploded' }).expect(400)
  })

  test('DELETE /:id → 204, then 404', async () => {
    await request(app).delete(`/api/v1/sensors/${id}`).expect(204)
    await request(app).get(`/api/v1/sensors/${id}`).expect(404)
    await request(app).delete(`/api/v1/sensors/${id}`).expect(404)
  })

  test('DELETE of the live-feed sensor → 409', async () => {
    await request(app).delete('/api/v1/sensors/1').expect(409)
  })

  test('non-numeric id → 400', async () => {
    await request(app).get('/api/v1/sensors/abc').expect(400)
  })

  test("SQL-injection-looking id is rejected, not executed", async () => {
    await request(app).get(`/api/v1/sensors/${encodeURIComponent('1; DROP TABLE sensors')}`).expect(400)
    await request(app).get('/api/v1/sensors/1').expect(200)
  })
})

describe('GET /api/v1/sensors/:id/history', () => {
  test('returns points for a valid metric', async () => {
    const res = await request(app).get('/api/v1/sensors/1/history?metric=snr&hours=24').expect(200)
    assert.equal(res.body.metric, 'snr')
    assert.equal(res.body.hours, 24)
    assert.ok(Array.isArray(res.body.data))
    assert.equal(res.body.bucket_seconds, 240)
  })

  test('defaults to rssi over 1 hour', async () => {
    const res = await request(app).get('/api/v1/sensors/1/history').expect(200)
    assert.equal(res.body.metric, 'rssi')
    assert.equal(res.body.hours, 1)
  })

  test('unknown metric → 400', async () => {
    await request(app).get('/api/v1/sensors/1/history?metric=temperature').expect(400)
  })

  test('out-of-range hours → 400', async () => {
    await request(app).get('/api/v1/sensors/1/history?hours=0').expect(400)
    await request(app).get('/api/v1/sensors/1/history?hours=9999').expect(400)
  })

  test('unknown sensor → 404', async () => {
    await request(app).get('/api/v1/sensors/999999/history').expect(404)
  })
})

test('unknown route → 404 JSON', async () => {
  const res = await request(app).get('/api/v1/nope').expect(404)
  assert.equal(res.body.error.status, 404)
})
