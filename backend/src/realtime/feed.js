import { describeError, isConnectionError, isDbReady, markDbDown } from '../db.js'
import { insertReadings } from '../repositories/telemetryRepo.js'

export const BACKLOG_SIZE = 60

/**
 * The single ingest path for live telemetry, whatever the source (simulator
 * or MQTT): remember → broadcast over Socket.io → persist to Postgres.
 */
export function createFeed({ io, source, log = console }) {
  const backlog = []
  let framesEmitted = 0
  let rowsPersisted = 0
  let lastFrameAt = null
  let persistWarned = false

  io.on('connection', (socket) => {
    // Late joiners get the last minute straight away so charts aren't empty.
    socket.emit('telemetry:backlog', backlog)
  })

  async function persist(frame) {
    if (!isDbReady()) return
    try {
      rowsPersisted += await insertReadings(frame.readings)
      persistWarned = false
    } catch (err) {
      if (isConnectionError(err)) markDbDown()
      if (!persistWarned) {
        log.warn(`[feed] could not persist telemetry (${describeError(err)}); live feed continues`)
        persistWarned = true
      }
    }
  }

  function ingest(frame) {
    backlog.push(frame)
    if (backlog.length > BACKLOG_SIZE) backlog.shift()
    framesEmitted++
    lastFrameAt = frame.ts

    // Broadcast first: a slow or dead DB must never delay the live view.
    io.emit('telemetry', frame)
    void persist(frame)
  }

  const status = () => ({
    source: source(),
    clients: io.engine?.clientsCount ?? 0,
    frames_emitted: framesEmitted,
    rows_persisted: rowsPersisted,
    last_frame_at: lastFrameAt,
  })

  return { ingest, status }
}
