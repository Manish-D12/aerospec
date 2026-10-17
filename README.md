# AeroSpec — RF Spectrum & Signal Strength Telemetry Pod

A 3-tier full-stack app: a **React + Vite + TypeScript + Tailwind** dashboard streams live RF telemetry over **Socket.io** from a **Node.js / Express** API, which also stores every reading in **PostgreSQL** and serves history over REST.

| Tier     | Tech                                                          | Folder                       | Deploy target (placeholder)                          |
| -------- | ------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript, Tailwind v4, Recharts, socket.io-client | `frontend/`                  | Vercel: `https://aerospec.vercel.app` *(TBD)*        |
| Backend  | Node ≥ 20, Express 5, Socket.io 4, pg, dotenv, mqtt (optional) | `backend/`                   | Render: `https://aerospec-api.onrender.com` *(TBD)*  |
| Database | PostgreSQL 14+                                                | `backend/db/*.sql`           | Neon: `postgres://…neon.tech/aerospec` *(TBD)* or local |
| CI       | GitHub Actions                                                | `.github/workflows/ci.yml`   | runs on every push to `main`                          |

## Architecture

```
 ┌──────────────────────────── Browser (Vercel) ────────────────────────────┐
 │  React SPA (frontend/)                                                   │
 │   /  /register  /login  /dashboard  /sensors                             │
 │                                                                          │
 │   useTelemetry() ── socket.io-client ──────────────┐  (VITE_SOCKET_URL)   │
 │     rolling 60-reading window, alerts              │                     │
 │   lib/api.ts ── fetch + async/await ───────────┐   │  (VITE_API_URL)      │
 └────────────────────────────────────────────────┼───┼─────────────────────┘
                     REST / JSON  (CORS)          │   │  WebSocket 'telemetry' @ 1 Hz
 ┌────────────────────────────────────────────────▼───▼─────────────────────┐
 │  Node.js API (backend/, Render)              one HTTP server, one port   │
 │                                                                          │
 │   Express app  ── cors() ── express.json() ── routes ── errorHandler     │
 │     GET  /health                                                         │
 │     GET|POST        /api/v1/sensors                                      │
 │     GET|PUT|DELETE  /api/v1/sensors/:id                                  │
 │     GET             /api/v1/sensors/:id/history?metric=&hours=           │
 │                                                                          │
 │   Socket.io server ◄── feed.ingest(frame) ◄── simulator (default, 1 Hz)  │
 │        │  emit('telemetry')               ◄── MQTT bridge (if MQTT_URL)  │
 │        └─ backlog of last 60 frames on connect                           │
 │                         │ persist (UNNEST batch insert)                  │
 └─────────────────────────┼────────────────────────────────────────────────┘
                           ▼  pg.Pool (max 10, SSL off on localhost)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  PostgreSQL (local or Neon)                                              │
 │   sensors(id, name, location, status, created_at, updated_at)            │
 │   telemetry(id, sensor_id, metric, value, ts)                            │
 │     + INDEX (sensor_id, metric, ts DESC)                                 │
 └──────────────────────────────────────────────────────────────────────────┘
```

**Zero external services.** The simulator runs inside the API, so no broker or cloud is needed. If Postgres is unreachable, the live feed keeps streaming: history returns `[]`, sensors use an in-memory fallback, and the API reconnects by itself when the database comes back.

## Run it locally

Prerequisites: Node 20+ (tested on 24) and, optionally, PostgreSQL 14+ running locally.

```bash
# 1) Backend: http://localhost:4000
cd backend
cp .env.example .env          # edit DATABASE_URL if your postgres password differs
npm install
# createdb aerospec           # once, or: psql -U postgres -c "CREATE DATABASE aerospec"
npm run seed                  # optional: 24 h of history (also creates the tables)
npm run dev                   # Express + Socket.io + simulator, auto-restarts on change

# 2) Frontend: http://localhost:5173   (in a second terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:5173> and click **Launch Dashboard**.

Pure-SQL alternative to `npm run seed`:

```bash
psql "postgres://postgres:postgres@localhost:5432/aerospec" -f backend/db/schema.sql -f backend/db/seed.sql
```

### Scripts

| Folder     | Command           | What it does                                                   |
| ---------- | ----------------- | -------------------------------------------------------------- |
| `backend`  | `npm run dev`     | `node --watch src/server.js`                                   |
| `backend`  | `npm start`       | production start (Render)                                      |
| `backend`  | `npm run seed`    | schema + 24 h × 3 metrics of 1-minute history (`--hours N`)     |
| `backend`  | `npm run lint`    | ESLint                                                         |
| `backend`  | `npm test`        | `node:test` + supertest: REST, CORS, validation, simulator     |
| `frontend` | `npm run dev`     | Vite dev server                                                |
| `frontend` | `npm run build`   | `tsc` type-check + Vite production build                       |
| `frontend` | `npm run lint`    | ESLint (`no-explicit-any` is an error)                         |

## Environment variables

### `backend/.env` (see `backend/.env.example`)

| Variable          | Default                                                | Purpose                                                    |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| `PORT`            | `4000`                                                 | HTTP + Socket.io port                                      |
| `NODE_ENV`        | `development`                                          |                                                            |
| `CORS_ORIGIN`     | `http://localhost:5173`                                | Comma-separated allowed origins (`*` = any)                |
| `DATABASE_URL`    | `postgres://postgres:postgres@localhost:5432/aerospec` | Postgres connection string                                 |
| `DB_SSL`          | *(auto)*                                               | `true`/`false` to override SSL (auto: off for localhost)   |
| `SIM_SENSOR_ID`   | `1`                                                    | Sensor the simulator reports as                            |
| `SIM_INTERVAL_MS` | `1000`                                                 | Simulator tick                                             |
| `MQTT_URL`        | *(empty)*                                              | e.g. `mqtt://localhost:1883`; empty means use the simulator |
| `MQTT_TOPIC`      | `aerospec/telemetry`                                   | Topic the bridge subscribes to                             |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | *(empty)*                              | Broker credentials, if needed                              |
| `JWT_SECRET`      | *(random per boot, with a warning)*                    | HS256 signing secret; **set it** (48 random bytes)          |
| `RESEND_API_KEY`  | *(empty)*                                              | Resend key; empty means verification links are printed to the console |
| `EMAIL_FROM`      | `AeroSpec <onboarding@resend.dev>`                     | Sender for verification emails                             |
| `APP_URL`         | `http://localhost:5173`                                | Frontend URL; verify redirects to `APP_URL/login?verified=1` |
| `API_PUBLIC_URL`  | `http://localhost:$PORT`                               | Public API URL used inside the emailed link                |

### `frontend/.env.local` (see `frontend/.env.example`)

| Variable          | Default                 | Purpose                    |
| ----------------- | ----------------------- | -------------------------- |
| `VITE_API_URL`    | `http://localhost:4000` | REST base URL              |
| `VITE_SOCKET_URL` | `VITE_API_URL`          | Socket.io server URL       |

## REST API

All responses are JSON; errors use `{ "error": { "status", "message", "details?" } }`.

| Method & path                                   | Success | Errors          | Notes                                         |
| ----------------------------------------------- | ------- | --------------- | --------------------------------------------- |
| `GET /health`                                   | 200     |                 | `db: up/down`, feed stats                     |
| `GET /api/v1/sensors`                           | 200     |                 | `{ data: Sensor[], count }`                   |
| `GET /api/v1/sensors/:id`                       | 200     | 400, 404        |                                               |
| `POST /api/v1/sensors`                          | 201     | 400             | `Location` header; body `{name, location?, status?}` |
| `PUT /api/v1/sensors/:id`                       | 200     | 400, 404        | full replace                                  |
| `DELETE /api/v1/sensors/:id`                    | 204     | 400, 404, 409   | also deletes its telemetry (transaction); 409 for the live sensor |
| `GET /api/v1/sensors/:id/history?metric=rssi&hours=24` | 200 | 400, 404     | `metric ∈ rssi/snr/frequency`, `0 < hours ≤ 168`; ≤ 360 time-bucketed points |

### Auth (see [`AUTH.md`](AUTH.md))

| Method & path | Success | Errors |
| --- | --- | --- |
| `POST /api/v1/auth/register` `{name,email,password}` | 201 `{token,user}` + verification email | 400, 409 duplicate, 503 |
| `POST /api/v1/auth/login` `{email,password}` | 200 `{token,user}` | 400, 401 |
| `GET /api/v1/auth/me` (Bearer) | 200 `{user}` | 401 |
| `POST /api/v1/auth/resend-verification` (Bearer) | 202 (200 if already verified) | 401 |
| `GET /api/v1/auth/verify?token=` | 302 → `APP_URL/login?verified=1` | 302 → `…?verified=0` |

`/dashboard` and `/sensors` require sign-in in the UI. There are no demo accounts: register first. Without `RESEND_API_KEY`, copy the verification link from the backend console.

### Socket.io events (server → client)

| Event               | Payload                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `telemetry`         | `{ sensor_id, ts, source, readings: [{sensor_id, metric, value, ts} ×3], spectrum[10], active_band }` once per second |
| `telemetry:backlog` | the last ≤ 60 frames, sent once on connect                                                  |

### MQTT (optional)

Set `MQTT_URL` and publish JSON to `MQTT_TOPIC`, for example:

```bash
mosquitto_pub -t aerospec/telemetry -m '{"sensor_id":1,"metric":"rssi","value":-82.5}'
```

The bridge accepts a single reading, an array of readings, or a full frame. Each valid message goes through the same ingest path as the simulator: broadcast, then persist.

## Deploying (not deployed yet; config is ready)

1. **Database (Neon):** create a project and copy its connection string (it includes `sslmode=require`; SSL turns on automatically for non-localhost hosts). Tables are created on first boot, and `npm run seed` can be run locally against the Neon URL.
2. **Backend (Render):** *New → Blueprint* picks up `render.yaml` (root dir `backend`, `npm ci`, `npm start`, health check `/health`). Set `DATABASE_URL` and `CORS_ORIGIN=https://<your-app>.vercel.app`.
3. **Frontend (Vercel):** import the repo with root directory `frontend`. `vercel.json` sets the Vite build and SPA rewrites. Set `VITE_API_URL` and `VITE_SOCKET_URL` to the Render URL.
4. Fill in the placeholder URLs in the table at the top of this file.

| Live URL  | Value                                    |
| --------- | ---------------------------------------- |
| Frontend  | `https://<your-app>.vercel.app` *(TBD)*  |
| Backend   | `https://<your-api>.onrender.com` *(TBD)* |
| Database  | Neon project `aerospec` *(TBD)*          |

See [`SUBMISSION.md`](SUBMISSION.md) for the CO1–CO6 mapping.
