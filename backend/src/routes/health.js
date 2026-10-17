import { Router } from 'express'
import { isDbReady } from '../db.js'

/** GET /health — liveness + a quick look at the DB and live-feed state. */
export function healthRouter(getFeedStatus) {
  const router = Router()
  router.get('/', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime_s: Math.round(process.uptime()),
      db: isDbReady() ? 'up' : 'down',
      feed: getFeedStatus(),
      ts: new Date().toISOString(),
    })
  })
  return router
}
