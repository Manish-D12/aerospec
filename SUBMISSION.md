# AeroSpec — Capstone Submission (CO1–CO6)

**Project:** RF Spectrum & Signal Strength Telemetry Pod: a 3-tier app built with a React/TypeScript dashboard, an Express + Socket.io API and PostgreSQL.
**Repo layout:** `frontend/` (React + Vite + TS + Tailwind) · `backend/` (Express + Socket.io + pg) · `.github/workflows/ci.yml` · `README.md`

---

## Course-outcome mapping

### CO1 — HTML/CSS: semantic, responsive, Tailwind

| Requirement | Where |
| --- | --- |
| Semantic landmarks: `header`/`nav`/`main`/`section`/`article`/`footer` | `frontend/src/components/Layout.tsx` (shared `<footer>`), `components/Navbar.tsx` (`<header><nav aria-label="Main">`), every page renders a `<main>`. Panels are `<section>` with a `<header>`, and stat cards and sensors are `<article>`. `pages/Home.tsx`, `pages/Dashboard.tsx`, `pages/Sensors.tsx`, `components/AuthCard.tsx` |
| Responsive mobile → desktop | Stat cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; chart and alerts `lg:grid-cols-3` with `lg:col-span-2`; sensor form `sm:grid-cols-[1fr_1fr_auto_auto]`; hamburger menu below `sm` (`Navbar.tsx`); `ResponsiveContainer` for charts |
| Tailwind utilities, flexbox and grid | Tailwind v4 via `@tailwindcss/vite` (`frontend/vite.config.js`, `src/index.css`); no custom CSS files |
| Accessibility extras | `aria-live` on alerts and connection status, `role="alert"` on errors, `aria-pressed` toggles, labelled form controls, status shown with colour **and** text |

### CO2 — JavaScript/TypeScript: async/await, fetch JSON

| Requirement | Where |
| --- | --- |
| TypeScript everywhere, strict, no `any` | `frontend/tsconfig.json` (`strict: true`); ESLint `@typescript-eslint/no-explicit-any: error` (`frontend/eslint.config.js`) |
| Interfaces for every data shape | `frontend/src/types.ts`: wire DTOs (`TelemetryPoint`, `TelemetryFrame`, `Sensor`, `SensorInput`, `HistoryResponse`, `HealthResponse`, `ApiErrorBody`, typed Socket.io `ServerToClientEvents`) and view models (`TelemetryReading`, `TelemetryAlert`, `TelemetryState`); `src/vite-env.d.ts` types `import.meta.env` |
| async/await + fetch | `frontend/src/lib/api.ts`: generic `request<T>()` wrapper (JSON in and out, `ApiError` with HTTP status, network-error handling, `AbortSignal` support) and the typed `api.*` functions |
| Used from components | `components/dashboard/HistoryChart.tsx` (GET history, aborted on change/unmount); `pages/Sensors.tsx` (GET, POST, PUT, DELETE) |

### CO3 — React: components, hooks, charts

| Requirement | Where |
| --- | --- |
| `/dashboard` page | `frontend/src/pages/Dashboard.tsx` (lazy-loaded in `App.tsx`) |
| Custom hook `useTelemetry()` with a rolling window of 60 | `frontend/src/hooks/useTelemetry.ts` uses `pushWindow()` from `lib/telemetry.ts` (`WINDOW_SIZE = 60`) |
| Live stat cards: RSSI dBm, Frequency MHz, SNR dB (+ Active band) | `components/dashboard/StatCard.tsx`, used in `Dashboard.tsx` |
| Abnormal colouring (RSSI < -100, SNR < 10) | thresholds in `lib/telemetry.ts` (`RSSI_WEAK`, `SNR_POOR`); red badge and border via `STATUS_STYLES` in `StatCard.tsx`; dashed red "Weak" reference line in `SignalChart.tsx`; edge-triggered alert feed in `AlertFeed.tsx` |
| Recharts line chart (60 s rolling) | `components/dashboard/SignalChart.tsx` |
| Spectrum bar chart (10 bands) | `components/dashboard/SpectrumChart.tsx`, with the active band highlighted |
| History chart (REST + Postgres) | `components/dashboard/HistoryChart.tsx`: bucket average line plus a min–max band; metric and range selectors |
| `useState` / `useEffect` / `useRef` / cleanup | `useTelemetry.ts`: state for readings, alerts and connection; refs for the socket, last reading and id counters; the effect cleanup removes listeners and disconnects the socket. `HistoryChart.tsx` and `Sensors.tsx` abort fetches in their effect cleanup. `Login.tsx` and `Register.tsx` clear their redirect timeout |
| Routing and shared navbar | `App.tsx` (layout route), `Navbar.tsx`. Login/Register redirect to `/dashboard`; Home's **Launch Dashboard** links to `/dashboard` |

### CO4 — Node.js + Express REST API + CORS

| Requirement | Where |
| --- | --- |
| Express server, CORS middleware | `backend/src/app.js` (`cors({ origin: config.corsOrigin })`, `express.json()`); `backend/src/server.js` |
| `GET /health` | `backend/src/routes/health.js` |
| `GET/POST /api/v1/sensors`, `GET/PUT/DELETE /api/v1/sensors/:id` | `backend/src/routes/sensors.js` → `repositories/sensorRepo.js` |
| `GET /api/v1/sensors/:id/history?metric=&hours=` (from PostgreSQL) | `routes/sensors.js` → `repositories/telemetryRepo.js#getHistory` (time-bucketed `AVG/MIN/MAX`) |
| Proper status codes | 200, 201 + `Location`, 204, 400 (validation, bad JSON, bad id), 404, 409 (deleting the live sensor), 503 (DB connection error), 500 |
| Parameterized SQL only | every query uses `$1…$n` placeholders: `sensorRepo.js`, `telemetryRepo.js` (batch insert via `UNNEST($1::int[], …)`), `scripts/seed.js`. The metric is also whitelisted (`src/metrics.js`) |
| try/catch + error middleware | each route handler wraps in `try/catch → next(err)`; `middleware/errorHandler.js` has `notFoundHandler` plus a 4-argument `errorHandler` that maps to a JSON `{error:{status,message,details}}` and hides internals on 500 |
| dotenv + `.env.example` | `backend/src/config.js` (`dotenv.config()`), `backend/.env.example` |
| Tests | `backend/test/api.test.js` (19 supertest cases: CRUD, CORS header, 400/404/409, an injection-shaped id) + `test/realtime.test.js` (6 unit tests) |

### CO5 — Real-time: Socket.io (+ optional MQTT)

| Requirement | Where |
| --- | --- |
| Socket.io server emitting `telemetry` every second | `backend/src/server.js` (Socket.io attached to the same HTTP server); `realtime/simulator.js#startSimulator` produces a frame every `SIM_INTERVAL_MS` (1000) |
| Payload `{sensor_id, metric, value, ts}` | each frame carries `readings: [{sensor_id, metric, value, ts}]` for rssi, frequency and snr, plus spectrum and active band (`sampleToFrame`) |
| Persist each reading to PostgreSQL, broadcast to clients | `realtime/feed.js#ingest`: push to a 60-frame backlog, then `io.emit('telemetry')`, then `insertReadings()` |
| Frontend subscribes and updates live | `frontend/src/hooks/useTelemetry.ts` (typed `socket.io-client`), also handles `telemetry:backlog` on connect |
| Connection-status dot | `components/dashboard/ConnectionStatus.tsx` (Live / Connecting / Disconnected / Paused) plus a reconnect banner in `Dashboard.tsx` |
| Optional MQTT behind env flag | `realtime/mqttBridge.js` (lazy `import('mqtt')`), `realtime/frames.js` (validation); enabled only when `MQTT_URL` is set, otherwise the simulator runs. No broker needed |

### CO6 — PostgreSQL + deployment + CI/CD

| Requirement | Where |
| --- | --- |
| `db.js` with `pg.Pool`; SSL off on localhost, on otherwise | `backend/src/db.js` (`sslFor()`, `DB_SSL` override, `pool.on('error')` so the process never crashes) |
| `initSchema()` → `telemetry(id, sensor_id, metric, value, ts)` + index | `db.js#initSchema` runs `backend/db/schema.sql` (also `sensors` and `idx_telemetry_sensor_metric_ts`) |
| SQL seed (`generate_series`, 24 h, 3 metrics) | `backend/db/seed.sql` |
| Node seed (`npm run seed`) | `backend/scripts/seed.js` (same RF model as the live feed, batch insert in one transaction, re-runnable, `--hours N`) |
| Graceful DB-down behaviour | `db.js#connectWithRetry` (background retry plus watchdog), `withDbFallback()`; history returns `[]` with `source:"unavailable"`; the live feed is unaffected |
| CI | `.github/workflows/ci.yml`: **frontend** (npm ci, lint, tsc + vite build, upload dist) and **backend** (Postgres 16 service, npm ci, lint, tests, seed) on push/PR to `main` |
| Deploy-ready | `render.yaml` (backend), `frontend/vercel.json` (SPA rewrites), README section with placeholder URLs (Render / Vercel / Neon) |

---

## How to run locally

```bash
# Terminal 1: backend (http://localhost:4000)
cd backend
cp .env.example .env          # set DATABASE_URL to your local Postgres
npm install
npm run seed                  # creates tables + 24 h of history (skip if no Postgres)
npm run dev

# Terminal 2: frontend (http://localhost:5173)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Then open <http://localhost:5173/dashboard>. Quick checks:

* `curl localhost:4000/health` shows `db: "up"` and a growing `frames_emitted`.
* `curl "localhost:4000/api/v1/sensors/1/history?metric=snr&hours=24"` returns stored data.
* Stop Postgres: the dashboard keeps streaming, and history says "Database offline".

Seed alternatives: `npm run seed -- --hours 48`, or pure SQL with `psql "$DATABASE_URL" -f backend/db/schema.sql -f backend/db/seed.sql`.

---

## Viva one-liners

* **Connection pooling:** `pg.Pool` keeps up to 10 open Postgres connections and lends one to each query, so requests skip the TCP + auth handshake and the DB is never flooded with connections.
* **Parameterized queries:** the SQL text is fixed and values travel separately as `$1, $2…`, so Postgres never parses user input as SQL. That closes off SQL injection and also handles quoting and types.
* **Rolling window:** each new reading is appended and the array is sliced to the last 60 (`[...window, next].slice(-60)`), so memory stays constant and the chart always shows the latest minute.
* **CORS:** browsers block cross-origin requests unless the server opts in; the `cors` middleware (and Socket.io's `cors` option) sends `Access-Control-Allow-Origin` only for the frontend origin(s) in `CORS_ORIGIN`.

A few more, in case they come up:

* **Why Socket.io and not polling:** one persistent connection pushes data the moment it exists. That means no 1 Hz request storm and lower latency, and it reconnects automatically.
* **Why emit before persisting:** the live view must not wait on the database, so `feed.ingest` broadcasts first and then writes asynchronously.
* **Why the `(sensor_id, metric, ts DESC)` index:** history queries filter on the first two columns and range-scan the third, which is exactly that index's order.
* **Why a transaction on DELETE:** removing a sensor and its telemetry must succeed or fail together.

---

## Decisions & deviations

1. **Repo restructure.** The existing app moved unchanged into `frontend/` (including `node_modules`). The stale `dist/`, the unused Vite `App.css` and the Vite template README were removed. The old `SUMMARY.md` is kept in `frontend/` and marked as historical.
2. **Simulator moved server-side.** The RF model from `frontend/src/lib/telemetry.ts` was ported to `backend/src/realtime/simulator.js`. The frontend now only renders server data and keeps thresholds and alert logic.
3. **Frame shape.** Rather than three separate events per second, each `telemetry` event is one frame whose `readings[]` items are exactly `{sensor_id, metric, value, ts}` (the persisted row shape), plus spectrum data the bar chart needs. This keeps the three metrics of one instant together.
4. **Metrics stored:** `rssi`, `frequency`, `snr` (the "3 metrics" in the seeds). Spectrum (10 bands) is streamed live only, not persisted.
5. **`sensors` table added** so the CRUD endpoints have a real resource. Sensor 1 (the simulator) is created by the schema and protected from deletion (**409**). `telemetry.sensor_id` has no FK, so MQTT readings for unregistered sensors are still stored; deleting a sensor removes its telemetry in a transaction.
6. **DB-down fallback:** history returns an empty list with `source:"unavailable"`, and sensors CRUD uses an in-memory store so the app still works with zero services. The API retries the DB connection every 10 s.
7. **History downsampling:** responses are capped at about 360 points by averaging into time buckets (`bucket_seconds` in the response). A min–max envelope is drawn so short fades remain visible.
8. **Backlog on connect:** the server sends the last 60 frames when a client connects, so charts fill immediately. Backlog frames don't raise alerts (only live transitions do).
9. **Start/Stop** now disconnects and reconnects the socket, and the status dot shows *Paused*.
10. **Auth stays mock.** The brief asked to keep Register/Login working and redirecting; there is no real authentication.
11. **New `/sensors` page** exercises POST/PUT/DELETE from the UI. It was added to the navbar.
12. **Layout `overflow-hidden` → `overflow-clip`.** This fixes a pre-existing bug where focusing a form field scrolled the decorative glow blob into view and shifted the page sideways.
13. **Express 5** is used, which also forwards rejected promises to the error middleware. Handlers still use explicit `try/catch → next(err)` as the rubric asks.
14. **No `axios`:** native `fetch` with a typed wrapper covers it.
15. **Local verification:** a database named `aerospec` was created on the local PostgreSQL 17 server for testing; `backend/.env` points at it.

## Verification performed

* `cd backend && npm run lint && npm test`: clean, **25/25 pass**, both against PostgreSQL and with the DB unreachable (in-memory fallback).
* `npm run seed` inserts 4,323 rows (1,441 per metric); `db/seed.sql` inserts 4,320 rows via `generate_series`.
* `npm run dev` starts with no errors, `/health` reports `db: up`, and rows are persisted every second. With a bad `DATABASE_URL` it still starts, streams, and returns empty history.
* `cd frontend && npm run build`: `tsc` and the Vite build are clean; `npm run lint` is clean.
* In Chrome: the dashboard goes live (status dot, stat cards, both live charts updating), the History chart renders 24 h from Postgres, Stop/Start toggles Paused/Live, the Sensors page creates and deletes a sensor and shows the 409 message for Pod-01, and there are no console errors.
