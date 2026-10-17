# AeroSpec — Dashboard Build Summary (historical)

> **Superseded.** This describes the earlier client-only build where telemetry was simulated in the browser. The simulator now lives in `backend/src/realtime/simulator.js` and data arrives over Socket.io; see the root `README.md` and `SUBMISSION.md`.

## Routes

| Path         | Page                | Notes                                                    |
| ------------ | ------------------- | -------------------------------------------------------- |
| `/`          | Home                | "Launch Dashboard" now routes to `/dashboard`            |
| `/register`  | Register            | On submit → success state → redirects to `/dashboard`    |
| `/login`     | Login               | **Newly routed** (page existed but wasn't in `App`)      |
| `/dashboard` | Dashboard (**new**) | Lazy-loaded so recharts isn't in the main bundle         |

All routes share one layout (`components/Layout.tsx`): slate-950 background, cyan and blue glow blobs, navbar, and footer.

## What was added

```
src/
  types.ts                         shared interfaces (readings, alerts, forms, nav)
  lib/telemetry.ts                 pure simulation + thresholds + alert detection
  hooks/useTelemetry.ts            live 1 Hz feed, 60-sample rolling window, start/stop
  components/
    Layout.tsx                     layout route: blobs + <header> + <Outlet/> + <footer>
    Navbar.tsx                     logo, Home/Dashboard/Login (active state), Get Started,
                                   hamburger menu below `sm`
    AuthCard.tsx                   shared card / fields / success state for Login & Register
    dashboard/
      StatCard.tsx                 live value + green/red status badge
      SignalChart.tsx              RSSI line chart (recharts) with axis labels + "Weak" line
      SpectrumChart.tsx            10-band activity bar chart, active band highlighted
      AlertFeed.tsx                scrolling alert list, severity badge + timestamp
      chartTheme.ts                Tailwind palette as raw hex for recharts
  pages/Dashboard.tsx              the dashboard page
```

The dashboard layout is a header with a Live/Paused pill and a Start/Stop button. Under it are 4 stat cards: 1 column on mobile, 2 on `sm`, 4 on `lg`. Next comes the RSSI chart (2/3 width) beside the alert feed (1/3 width), which stack on mobile. The spectrum chart spans the full width at the bottom.

## How the telemetry simulation works

Everything runs client-side in `src/lib/telemetry.ts`, and `useTelemetry()` drives it.

- **RSSI** is a mean-reverting random walk around -75 dBm with Gaussian noise. Each tick has a 5% chance of a deep fade of 20–35 dB. Values are clamped to -120…-30 dBm.
- **SNR** = RSSI − noise floor, with the floor around -112 dBm plus jitter. Each tick has a 4% chance of an interference spike that raises the floor by 15–25 dB. As a result, SNR follows signal strength, but it can also go poor on its own.
- **Spectrum** has 10 bands: VHF Air, UHF 433, ISM 868/915, ADS-B, GPS L1, LTE 1800, Wi-Fi 2.4, C-Band and Wi-Fi 5.8. Each band's activity (0–100%) is a random walk around its own baseline, with occasional traffic bursts.
- **Active band** is the band with the most activity. **Frequency** is that band's centre frequency plus a little jitter, as if the pod were tracking the busiest signal.
- **Rolling window**: on load, 60 back-dated readings are pre-filled so the charts start full. After that, one reading is added per second and the oldest is dropped.
- **Start/Stop** flips a `running` flag. While running, an effect creates the `setInterval` and stores its id in `intervalRef` (`useRef`). The effect's cleanup clears that interval when the feed is stopped and when the page unmounts.
- The random draws happen in the tick callback, not inside React state updaters. StrictMode calls updaters twice in development, and drawing outside them keeps each tick to a single reading and single alert.

### Status & alert rules

| Metric      | Abnormal when                    | Alert severity                         |
| ----------- | -------------------------------- | -------------------------------------- |
| RSSI        | `< -100 dBm` → "Weak"            | critical if `< -110 dBm`, else warning |
| SNR         | `< 10 dB` → "Poor"               | critical if `< 5 dB`, else warning     |
| Active band | activity `≥ 90%` → "Congested"   | none; card status only                 |
| Frequency   | always "Locked" (green)          | none                                   |

All thresholds are named constants in `lib/telemetry.ts`.

## Decisions & deviations (worth knowing)

1. **JS → TypeScript migration.** The brief said TypeScript, but the project was plain `.jsx`. I converted it: added `typescript` and `typescript-eslint`, added `tsconfig.json` (strict), and renamed `main`, `App`, and all pages to `.tsx`. I updated `index.html` to point at `main.tsx` and switched the ESLint config to TypeScript (`no-explicit-any` set to error). The code uses no `any`.
2. **`/login` wasn't routed** in the original `App.jsx`, so the Register page's "Sign in" link went nowhere. It is routed now.
3. **The shared navbar replaces Home's inline nav.** Home's old "Features" anchor link was swapped for the required Home/Dashboard/Login links. The "Get Started" button stays.
4. **Auth flow**: the forms are now real `<form>` elements with `required` fields, so submitting empty fields no longer "succeeds." After a successful submit, the original success screen shows for about 1.2 s and then the app navigates to `/dashboard`. There is still no real authentication, because the brief says no backend. I removed the old `console.log(form)`, which printed the password to the console.
5. **Alerts are edge-triggered.** An entry is logged when a metric *goes* abnormal, not on every second that it stays abnormal. That keeps the feed readable. The feed keeps the latest 50 alerts and has a "Clear" button.
6. **"Congested" band status** is an extra rule I added so the Active Band card's green/red status means something. The brief only defined rules for RSSI and SNR.
7. **Code splitting**: the Dashboard page is loaded with `React.lazy`. This removed Vite's >500 kB chunk warning: the main bundle is about 270 kB, and the dashboard chunk (mostly recharts) is about 388 kB.
8. `npm run build` now runs `tsc` before `vite build`. I also added `npm run typecheck`.
9. `src/App.css` is leftover Vite scaffold and nothing imports it. I left it untouched.

## Verification

- `npm run build`: type-check and production build are clean, with no warnings.
- `npx eslint .`: clean.
- Tested manually in Chrome against `npm run dev`:
  - Values update every second, Stop freezes them, and Start resumes them.
  - Both charts render with their axes and ticks, and alerts appear.
  - Login and Register both redirect to `/dashboard`, and submitting empty fields is blocked.
  - Home's "Launch Dashboard" button goes to `/dashboard`.
  - At about 450 px wide, the cards stack, the hamburger menu appears, and there is no horizontal scroll.
  - No console errors.
