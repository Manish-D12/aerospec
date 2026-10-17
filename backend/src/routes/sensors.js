import { Router } from 'express'
import { config } from '../config.js'
import { HttpError, badRequest, notFound } from '../httpError.js'
import { METRIC_NAMES, isMetric } from '../metrics.js'
import {
  SENSOR_STATUSES,
  createSensor,
  deleteSensor,
  getSensor,
  listSensors,
  updateSensor,
} from '../repositories/sensorRepo.js'
import { getHistory } from '../repositories/telemetryRepo.js'

const MAX_HOURS = 168

/** `:id` must be a positive integer; anything else is a 400 before we touch the DB. */
function parseId(raw) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw badRequest(`Invalid sensor id "${raw}"`)
  return id
}

/** Validate a POST/PUT body into a clean `{ name, location, status }`. */
function parseSensorBody(body) {
  const errors = []
  const src = body && typeof body === 'object' ? body : {}
  const name = typeof src.name === 'string' ? src.name.trim() : ''
  const location = typeof src.location === 'string' ? src.location.trim() : ''
  const status = src.status ?? 'active'

  if (!name) errors.push('name is required')
  else if (name.length > 80) errors.push('name must be at most 80 characters')
  if (location.length > 120) errors.push('location must be at most 120 characters')
  if (!SENSOR_STATUSES.includes(status)) errors.push(`status must be one of: ${SENSOR_STATUSES.join(', ')}`)

  if (errors.length) throw badRequest('Invalid sensor', errors)
  return { name, location, status }
}

export function sensorsRouter() {
  const router = Router()

  // GET /api/v1/sensors
  router.get('/', async (_req, res, next) => {
    try {
      const sensors = await listSensors()
      res.status(200).json({ data: sensors, count: sensors.length })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/sensors/:id
  router.get('/:id', async (req, res, next) => {
    try {
      const sensor = await getSensor(parseId(req.params.id))
      if (!sensor) throw notFound(`Sensor ${req.params.id} not found`)
      res.status(200).json({ data: sensor })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/sensors
  router.post('/', async (req, res, next) => {
    try {
      const sensor = await createSensor(parseSensorBody(req.body))
      res.status(201).location(`${req.baseUrl}/${sensor.id}`).json({ data: sensor })
    } catch (err) {
      next(err)
    }
  })

  // PUT /api/v1/sensors/:id
  router.put('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id)
      const sensor = await updateSensor(id, parseSensorBody(req.body))
      if (!sensor) throw notFound(`Sensor ${id} not found`)
      res.status(200).json({ data: sensor })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /api/v1/sensors/:id
  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id)
      if (id === config.simSensorId) {
        throw new HttpError(409, `Sensor ${id} is the live feed source and cannot be deleted`)
      }
      const deleted = await deleteSensor(id)
      if (!deleted) throw notFound(`Sensor ${id} not found`)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/sensors/:id/history?metric=rssi&hours=24
  router.get('/:id/history', async (req, res, next) => {
    try {
      const id = parseId(req.params.id)
      const metric = req.query.metric ?? 'rssi'
      if (!isMetric(metric)) throw badRequest(`metric must be one of: ${METRIC_NAMES.join(', ')}`)

      const hours = req.query.hours === undefined ? 1 : Number(req.query.hours)
      if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) {
        throw badRequest(`hours must be a number in (0, ${MAX_HOURS}]`)
      }

      const sensor = await getSensor(id)
      if (!sensor) throw notFound(`Sensor ${id} not found`)

      const { points, bucketSeconds, source } = await getHistory(id, metric, hours)
      res.status(200).json({
        sensor_id: id,
        metric,
        hours,
        bucket_seconds: bucketSeconds,
        source,
        count: points.length,
        data: points,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
