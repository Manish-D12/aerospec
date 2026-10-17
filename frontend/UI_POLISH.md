# UI polish & motion: design notes

These changes are purely cosmetic. No data logic, API calls, socket subscriptions, routes, env vars, `types.ts` interfaces or backend files were touched. The only prop change is two optional props on the presentational `StatCard` (`numeric`, `digits`), which drive the count-up animation.

## Motion system

| Piece | Where | Notes |
| --- | --- | --- |
| Shared variants | `src/lib/motion.ts` | `fadeUp` (opacity 0→1, y 16→0, 0.4 s, ease `[0.22,1,0.36,1]`), `stagger(gap)`, `pageFade` |
| Reduced motion | `main.tsx` `<MotionConfig reducedMotion="user">` + `@media (prefers-reduced-motion)` in `index.css` | framer-motion skips transforms and keeps fades. CSS loops, sweeps and hover lifts are disabled, and the scanline is hidden. Shake, count-up and chart draw-in check `useReducedMotion()` and are skipped |
| Page transitions | `components/Layout.tsx` | `AnimatePresence mode="wait"` keyed by pathname; `useOutlet()` freezes the leaving page so it fades out with its own content (0.3 s in / 0.18 s out) |
| Keyframes | `index.css` `@theme` | drift, text shimmer, skeleton, scanline, wave, pulse ring, exposed as `animate-*` utilities |

Hover effects use the CSS `translate`/`scale` properties rather than `transform`. Those compose with framer-motion's inline `transform`, so an entering card can still lift on hover without the two fighting.

## What changed, by area

- **Home:** the hero stagger-fades in (badge → headline → copy → buttons). `SignalWave.tsx` draws three looping sine traces plus emitter pulse rings behind the title. Each trace is twice the view box wide and slides by a whole number of wavelengths, so the loop is seamless. The headline gradient shimmers slowly (6 s). Feature cards stagger in when scrolled into view.
- **Background:** three blurred glow blobs drift on 22–28 s loops, slow enough to read as ambient.
- **Cards and buttons:**
  - `.glow-card` lifts 3 px, gains a cyan shadow and shows a 1 px border highlight that sweeps around the edge. The sweep only runs while hovered, so idle cards cost nothing.
  - `.glow-panel` is the same glow without the lift, for chart and form panels, so charts don't jump under the cursor.
  - `.btn-lift` adds scale 1.03, a 1 px raise and a glow, and presses down on `:active`.
- **Dashboard:**
  - The Live dot has an expanding ring only while connected; Connecting pulses amber, and Disconnected/Paused stay still.
  - Stat values count to each new reading (0.5 s tween, well inside the 1 s tick). `AnimatedNumber` writes straight to the DOM instead of re-rendering React each frame.
  - When a card *becomes* abnormal, it flashes red once and shakes. This is edge-triggered, like the alert feed, so a value that stays abnormal doesn't keep shaking. While abnormal, the card keeps a red border glow and a pulsing dot.
  - The backdrop is a faint 40 px grid that fades out down the page, plus a slow scanline sweep (7 s, 6 % opacity).
  - Stat cards stagger in one by one (90 ms apart), followed by the chart panels.
  - New alerts slide in from the right, with a severity colour edge.
- **Charts:**
  - The live RSSI line wipes in left → right on mount through a clip-path wrapper (`ChartReveal`). Recharts' own animation stays off for the 1 Hz updates, so live data never re-animates or jitters.
  - The history line uses Recharts' draw-in. It is keyed per metric/range, so it redraws when you switch.
  - Tooltips are glass panels with a cyan hairline border. Values are in text colour, not the series colour. Hover dots are hollow with a dark ring, and the crosshair is a dashed cyan line.
  - The RSSI line has a soft gradient fill. Spectrum bars use vertical gradients: the active band in bright cyan, the others in muted blue.
  - Grid lines are more recessive than before.
- **History:**
  - Loading shows a chart-shaped skeleton (axis gutter plus staggered shimmering bars).
  - Errors, database-offline and no-data now use a shared `EmptyState` (icon badge, title, one line of help) with warning/error tones.
  - The metric and range selectors have a selection pill that slides between options (`layoutId`).
- **Navbar:** a single glowing underline glides to the active link, the mobile menu scales and fades in, and the logo tilts on hover.
- **Auth pages:** the card rises in, the success check pops with a spring, and inputs have softer hover/focus states.
- **Sensors:** sections stagger in, loading uses skeleton rows, rows animate in and out on add/delete, and empty and error states use `EmptyState`.
- **Consistency:** surfaces are `rounded-2xl`; buttons and inputs are `rounded-xl`.

## Trade-offs

- **Bundle size:** framer-motion adds about 47 kB gzipped to the main chunk (87 → 134 kB). Converting to `LazyMotion` + `m.*` would claw most of that back if it matters later.
- **Animation budget:** all loops are CSS (GPU-friendly `translate`/opacity). The only per-frame JS is the brief number tween.
- **Not changed:** chart types, data, thresholds and alert rules are untouched; the 1 Hz live charts deliberately don't animate per tick.
