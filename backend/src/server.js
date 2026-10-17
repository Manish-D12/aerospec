import http from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { config } from './config.js'
import { connectWithRetry, pool } from './db.js'
import { createFeed } from './realtime/feed.js'
import { startMqttBridge } from './realtime/mqttBridge.js'
import { startSimulator } from './realtime/simulator.js'

let sourceName = 'starting'
let feed = null

const app = createApp({ getFeedStatus: () => feed?.status() ?? { source: sourceName, clients: 0 } })
const server = http.createServer(app)

// Socket.io shares the HTTP server (same port) and needs its own CORS config.
const io = new Server(server, {
  cors: { origin: config.corsOrigin },
})

feed = createFeed({ io, source: () => sourceName })
const db = connectWithRetry()

/** MQTT if MQTT_URL is set, otherwise (or if the bridge can't start) the built-in simulator. */
async function startSource() {
  if (config.mqtt.url) {
    try {
      const bridge = await startMqttBridge({
        ...config.mqtt,
        defaultSensorId: config.simSensorId,
        onFrame: feed.ingest,
      })
      sourceName = 'mqtt'
      return bridge.stop
    } catch (err) {
      console.warn(`[mqtt] bridge failed to start (${err.message}); falling back to simulator`)
    }
  }
  sourceName = 'simulator'
  console.info(`[sim] simulator emitting sensor ${config.simSensorId} every ${config.simIntervalMs} ms`)
  return startSimulator({ sensorId: config.simSensorId, intervalMs: config.simIntervalMs, onFrame: feed.ingest })
}

const stopSource = await startSource()

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] port ${config.port} is already in use. Set PORT in backend/.env or stop the other process.`)
  } else {
    console.error('[api] server error', err)
  }
  process.exit(1)
})

server.listen(config.port, () => {
  const cors = config.corsOrigin === true ? '*' : config.corsOrigin.join(', ')
  console.info(`[api] AeroSpec API listening on http://localhost:${config.port} (CORS: ${cors})`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.info(`[api] ${signal} received, shutting down`)
  await stopSource()
  db.stop()
  io.close()
  server.close()
  await pool.end().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
