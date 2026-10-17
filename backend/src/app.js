import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import { sensorsRouter } from './routes/sensors.js'

/**
 * Build the Express app (no listening here, so tests can drive it with supertest).
 * `getFeedStatus` lets /health report on the live feed without importing Socket.io.
 */
export function createApp({ getFeedStatus = () => ({ source: 'none', clients: 0 }) } = {}) {
  const app = express()

  app.disable('x-powered-by')
  // CORS: the browser only lets the Vite origin (5173 / Vercel) call this API if we say so.
  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json({ limit: '100kb' }))

  app.get('/', (_req, res) => {
    res.json({ name: 'AeroSpec API', version: 'v1', docs: ['/health', '/api/v1/sensors'] })
  })
  app.use('/health', healthRouter(getFeedStatus))
  app.use('/api/v1/auth', authRouter())
  app.use('/api/v1/sensors', sensorsRouter())

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
