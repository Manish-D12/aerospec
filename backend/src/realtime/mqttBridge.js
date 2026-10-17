import { payloadToFrames } from './frames.js'

/**
 * Optional MQTT → Socket.io bridge. Subscribes to `topic` and pushes every valid
 * message through the same ingest path as the simulator. The `mqtt` package is
 * imported lazily so nothing broker-related loads unless MQTT_URL is set.
 */
export async function startMqttBridge({ url, topic, username, password, defaultSensorId, onFrame, log = console }) {
  const { default: mqtt } = await import('mqtt')
  const client = mqtt.connect(url, { username, password, reconnectPeriod: 5_000, connectTimeout: 5_000 })
  let warned = false

  client.on('connect', () => {
    warned = false
    log.info(`[mqtt] connected to ${url}, subscribing to "${topic}"`)
    client.subscribe(topic, { qos: 0 }, (err) => {
      if (err) log.warn(`[mqtt] subscribe failed: ${err.message}`)
    })
  })

  client.on('message', (_topic, buf) => {
    let payload
    try {
      payload = JSON.parse(buf.toString('utf8'))
    } catch {
      log.warn('[mqtt] dropped non-JSON message')
      return
    }
    const frames = payloadToFrames(payload, { defaultSensorId, source: 'mqtt' })
    if (frames.length === 0) log.warn('[mqtt] dropped message with no valid readings')
    frames.forEach(onFrame)
  })

  client.on('error', (err) => {
    if (!warned) log.warn(`[mqtt] ${err.message} (will keep retrying)`)
    warned = true
  })

  return {
    connected: () => client.connected,
    stop: () => new Promise((resolve) => client.end(false, {}, resolve)),
  }
}
