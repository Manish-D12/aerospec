# Authentication: design notes

Real auth backed by PostgreSQL + bcrypt + JWT, with email verification through Resend. There are no demo accounts, no seeded users and no bypass. Telemetry, Socket.io, history and sensors code are unchanged.

## Backend

| Piece | File |
| --- | --- |
| `users` table (`id, name, email UNIQUE, password_hash, verified DEFAULT false, created_at`) | `backend/db/schema.sql`, created by `initSchema()` on boot |
| Routes | `backend/src/routes/auth.js`, mounted at `/api/v1/auth` in `src/app.js` |
| JWT sign/verify | `backend/src/auth/tokens.js` |
| Verification email / console fallback | `backend/src/auth/mailer.js` |
| Bearer middleware | `backend/src/middleware/requireAuth.js` |
| SQL (all parameterized) | `backend/src/repositories/userRepo.js` |
| Tests | `backend/test/auth.test.js` (17 cases) |

| Endpoint | Success | Errors |
| --- | --- | --- |
| `POST /api/v1/auth/register` `{name,email,password}` | **201** `{token, user}`, then the verification email is sent in the background | 400 validation (with `details[]`), **409** duplicate email, 503 DB down |
| `POST /api/v1/auth/login` `{email,password}` | 200 `{token, user}` | 400, **401** bad credentials, 503 |
| `GET /api/v1/auth/me` (Bearer) | 200 `{user}` | **401** missing/invalid/expired token or deleted user |
| `POST /api/v1/auth/resend-verification` (Bearer) | **202** `{sent:true, via:'email'\|'console'}`; 200 `{sent:false}` if already verified | 401 |
| `GET /api/v1/auth/verify?token=…` | **302** → `APP_URL/login?verified=1` | **302** → `APP_URL/login?verified=0&reason=expired\|invalid` |

### Decisions

1. **Password hashing:** `bcrypt.hash(password, 10)`. Only the hash is stored. Passwords are never logged: the error middleware logs errors, not request bodies, and a test asserts the plaintext isn't in the stored hash. Passwords over 72 bytes are rejected with a 400 rather than silently truncated by bcrypt.
2. **JWTs:**
   - Session tokens are HS256 with payload `{userId, email}`, a 7-day expiry, `iss=aerospec-api` and `aud=session`.
   - Verification links use a **separate** token (`aud=email-verify`, 24 h). A verify link can't be used as a session token, and a session token can't verify an email; both cases are tested.
3. **`JWT_SECRET`:** if unset, the server generates a random 384-bit secret at boot and logs a warning. It never crashes, but tokens die on restart. I put a generated secret in your local `backend/.env`, which is gitignored.
4. **Emails** are trimmed and lower-cased before insert and lookup, so `UNIQUE` behaves case-insensitively. A duplicate insert hits Postgres `23505` and maps to 409; there's no check-then-insert race.
5. **No account enumeration:** login gives one 401 message for both an unknown email and a wrong password. It also runs `bcrypt.compare` against a dummy hash when the email doesn't exist, so the timing matches.
6. **Email delivery never blocks or fails sign-up.** The email is sent after the 201 response. Without `RESEND_API_KEY`, or if Resend errors, the full link is printed to the server console.
   - `EMAIL_FROM` defaults to `onboarding@resend.dev`, which only delivers to your own Resend account address until you verify a domain.
   - `API_PUBLIC_URL` (optional) sets the host in the emailed link; it defaults to `http://localhost:$PORT`.
7. **`/verify` answers with redirects, not JSON**, because a person clicks it in an email client. Failures redirect to the login page with a reason, which the page explains.
8. **Postgres-only:** auth has no in-memory fallback, unlike sensors. If the DB is down, auth returns **503**, not a fake success.
9. **`/me` re-reads the database**, so a deleted user's still-valid token gets a 401, and `verified` is always fresh.
10. **Not added (out of scope):** login rate limiting / lockout, password reset, refresh tokens. Worth adding before a real deployment.

## Frontend

| Piece | File |
| --- | --- |
| Auth state `{user, token, loading, login, register, logout, refreshUser, resendVerification}` | `src/context/AuthContext.tsx` (provider), `src/context/authContextValue.ts` (context + interface), `src/hooks/useAuth.ts` |
| axios client for `/api/v1/auth` | `src/lib/authApi.ts` (errors normalised to the existing `ApiError`) |
| Client validation (mirrors server rules) | `src/lib/validation.ts` |
| Route guard | `src/components/RequireAuth.tsx`, wrapping `/dashboard` and `/sensors` in `App.tsx` |
| Forms | `pages/Login.tsx`, `pages/Register.tsx`, `components/AuthCard.tsx` (`AuthFields` errors, `AuthAlert`, `AuthSubmit`) |
| Verify banner | `components/dashboard/VerifyBanner.tsx` on the Dashboard |
| Navbar user chip + Logout | `components/Navbar.tsx` |

### Decisions

1. **Hydration:** the token and a cached copy of the user are read from `localStorage` synchronously on first render, so there's no flash of the login page. `GET /me` then confirms them.
   - A **401** clears the session.
   - Network errors or a 503 keep the cached user, so a brief backend outage doesn't log you out.
   - `loading` is only true while a stored token is being checked; `RequireAuth` shows a spinner during that.
2. **`verified` stays fresh:** the provider re-calls `/me` on window focus. After clicking the email link in another tab, coming back to the dashboard removes the banner. Login/logout in one tab syncs to others through the `storage` event.
3. **Redirects:**
   - `RequireAuth` sends signed-out users to `/login` with `state.from`, and login returns them there (default `/dashboard`).
   - `/login` and `/register` redirect to `/dashboard` if you're already signed in.
   - The success screen and its animation are kept: the card shows for about 1.2–1.6 s, then navigates.
4. **Logout** clears the context and `localStorage` and navigates to `/`. Both happen inside one `startTransition`. React Router v7 runs navigations as transitions, so clearing the user outside it rendered the protected page signed-out first, and its guard bounced you to `/login`. `RequireAuth` also ignores pages that are animating out (`useIsPresent` plus a path check).
5. **Validation:** `noValidate` forms with per-field messages (`aria-invalid` and `aria-describedby`), cleared as you type. Server errors are mapped too: 409 → the email field, 401 → "Incorrect email or password", others → a form-level alert.
6. **No `any`:** the user cached in `localStorage` is runtime-checked by a type guard before use.
7. **Sensors and history REST calls are unchanged.** Those backend endpoints stay public as instructed; the guard protects the pages, not the API.

## UI leftovers fixed in this pass

- **404 page** (`pages/NotFound.tsx`): unknown URLs previously rendered an empty layout. It now has the same entrance animation and route fade as the other pages.
- **Route loaders:** the Suspense fallback ("Loading telemetry…") was unstyled text. It's now a cyan spinner, matching the session check.
- **Stat cards before the first reading** showed a green "Waiting" badge, which read as "good". They now use a neutral slate badge with a pulsing dot (`pending` prop on `StatCard`).
- **Form inputs** gained error and disabled states, and the submit buttons got an inline spinner.
- **Navbar:** signed-in users get an avatar chip with initials and an amber dot when unverified, plus Logout, on desktop and in the mobile menu. The Login link is hidden when signed in.

## Verification

- `cd backend && npm test`: **42/42 pass** against PostgreSQL. Without a DB, 31 pass and 11 DB-only auth tests skip cleanly.
- `cd frontend && npm run build` and `npm run lint`: clean.
- **curl end to end:**
  - register → 201; duplicate → 409; wrong password → 401; login → 200
  - `/me` without a token → 401, with a token → user
  - resend → 202 (link logged)
  - verify link → 302 to `/login?verified=1`, after which `/me` shows `verified: true` and resend → 200 "already verified"
  - the password never appears in the server log
- **Browser:** `/dashboard` and `/sensors` redirect to `/login` when signed out. Empty-form validation messages show. Signed in, the amber banner shows, and Resend shows the server's message. Logout lands on `/` with the signed-out navbar. `/login?verified=1` shows the success alert. Unknown URLs show the 404 page. No console errors.
