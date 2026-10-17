import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { SOCKET_URL } from '../lib/api'
import { MAX_ALERTS, detectAlerts, frameToReading, pushWindow } from '../lib/telemetry'
import type {
  ClientToServerEvents,
  FeedSource,
  ServerToClientEvents,
  TelemetryAlert,
  TelemetryFrame,
  TelemetryReading,
  TelemetryState,
} from '../types'

type TelemetrySocket = Socket<ServerToClientEvents, ClientToServerEvents>
type LinkState = 'connecting' | 'connected' | 'disconnected'

/**
 * Live telemetry over Socket.io. Keeps a rolling window of the latest
 * WINDOW_SIZE (60) readings plus a capped, edge-triggered alert log.
 *
 * Stopping the feed closes the socket; starting it opens a new one. The effect
 * cleanup always detaches listeners and disconnects, so navigating away never
 * leaks a connection.
 */
export function useTelemetry(autoStart = true): TelemetryState {
  const [readings, setReadings] = useState<TelemetryReading[]>([])
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([])
  const [running, setRunning] = useState(autoStart)
  const [link, setLink] = useState<LinkState>('connecting')
  const [source, setSource] = useState<FeedSource | null>(null)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<TelemetrySocket | null>(null)
  // Generator state lives in refs: it changes every second but never needs a re-render by itself.
  const lastRef = useRef<TelemetryReading | null>(null)
  const lastTsRef = useRef(0)
  const readingIdRef = useRef(0)
  const alertIdRef = useRef(0)

  /** Convert frames to readings, slide the window, and raise alerts (not for backlog). */
  const ingest = useCallback((frames: TelemetryFrame[], raiseAlerts: boolean) => {
    const fresh: TelemetryReading[] = []
    const raised: TelemetryAlert[] = []

    for (const frame of frames) {
      const ts = Date.parse(frame.ts)
      // A reconnect replays the server backlog; skip anything we already have.
      if (!raiseAlerts && ts <= lastTsRef.current) continue

      const prev = lastRef.current
      const next = frameToReading(frame, prev, ++readingIdRef.current)
      lastRef.current = next
      lastTsRef.current = Math.max(lastTsRef.current, ts)
      fresh.push(next)
      if (raiseAlerts) raised.push(...detectAlerts(prev, next, () => ++alertIdRef.current))
    }

    const last = frames[frames.length - 1]
    if (last) setSource(last.source)
    if (fresh.length > 0) setReadings((rs) => pushWindow(rs, fresh))
    if (raised.length > 0) setAlerts((as) => [...raised.reverse(), ...as].slice(0, MAX_ALERTS))
  }, [])

  useEffect(() => {
    if (!running) return

    const socket: TelemetrySocket = io(SOCKET_URL, {
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      timeout: 5_000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setLink('connected')
      setError(null)
    })
    socket.on('disconnect', () => setLink('disconnected'))
    socket.on('connect_error', (err) => {
      setLink('disconnected')
      setError(err.message)
    })
    socket.on('telemetry:backlog', (frames) => ingest(frames, false))
    socket.on('telemetry', (frame) => ingest([frame], true))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [running, ingest])

  const start = useCallback(() => {
    setLink('connecting')
    setRunning(true)
  }, [])
  const stop = useCallback(() => setRunning(false), [])
  const toggle = useCallback(() => {
    setLink('connecting')
    setRunning((r) => !r)
  }, [])
  const clearAlerts = useCallback(() => setAlerts([]), [])

  return {
    readings,
    latest: readings[readings.length - 1] ?? null,
    alerts,
    connection: running ? link : 'paused',
    source,
    error,
    running,
    start,
    stop,
    toggle,
    clearAlerts,
  }
}
