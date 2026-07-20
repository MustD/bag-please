---
baseline_commit: 6b141e365572e4b1189fb4d934655743bcff5caa
---

# Story 5.3: User Account

Status: done

**Delivers:** FR5 (one-time post-registration welcome), FR11 (self-service password change), FR12 (username in app
navigation). This story also stands up the **app shell / top `AppBar`** for the first time — a prerequisite for FR12,
not a separate feature. Bottom-tab navigation (Today/Lists) is explicitly out of scope (Stories 5.5/5.6).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Decisions (settled — do not re-open)

1. **Password change = clean sign-out.** On HTTP 200 the app shows no on-form success banner; it `clearAuth()`s and
   redirects to `/auth`, which carries the confirmation message in the **same alert slot** it already uses for
   session-expiry. A pre-submit note warns the user the change signs them out of all devices. FR11's "success
   confirmation" is satisfied by the `/auth` destination message, **not** an on-form Alert — flag this explicitly so a
   later Acceptance Auditor does not read the absent on-form banner as a missed AC.
2. **Confirm-new-password field is included** — client-side only, validated to equal the new password, **never sent**
   (the backend takes only `currentPassword` + `newPassword`).
3. **Change-password affordance is hidden for `role === 'admin'`.** The backend 403-forbids the admin account from
   `/api/auth/change-password`, so admins never see the menu item and a direct visit to `/account/password` redirects
   them to `/`. (Admin is the one account guaranteed on a fresh install — this is a first-boot correctness fix.)
4. **FR9 automated expiry-path E2E stays deferred.** 5.3's clean sign-out redirects immediately and therefore does
   **not** organically fire the 401 → refresh-fail → `/auth?expired=1` path; it does not discharge the debt tracked from
   Story 5.2. That debt remains filed for the first query-bearing story (5.5+).

## Story

As a signed-in user, I want to see who I am and manage my password, so that I control my own credentials.

## Acceptance Criteria

1. **Username in navigation (FR12).** The authenticated user's username is shown in the application navigation and is
   visible on **every** authenticated screen, with no visible loading/skeleton flash. Source of truth is
   `useAuth().username` (JWT-derived); do not add a `me`/`currentUser` query.
2. **Change Password screen (FR11).** A screen at route `/account/password` (inside the protected `RouteGuard` subtree)
   with three fields — **current password**, **new password**, and **confirm new password** — controlled MUI
   `TextField`s (`type="password"`, correct `autoComplete`). Confirm-new-password is validated client-side to equal the
   new password and is **never sent**. A pre-submit note reads *"Changing your password will sign you out of all
   devices."* Submitting calls the **existing** `authApi.changePassword(currentPassword, newPassword, accessToken)`. The
   submit button shows a `CircularProgress` and is disabled while the request is in flight (loading state).
3. **Change-password success (FR11) = clean sign-out.** On HTTP 200 the app calls `clearAuth()` and redirects to
   `/auth` (`replace`) carrying `state: { passwordChanged: true }`. The `/auth` page renders a confirmation message — *"
   Your password was changed. Please sign in with your new password."* — in the **same alert slot** it already uses for
   the `?expired=1` session-expiry banner (reuse it; do not build a new component). This is the backend-correct behavior
   (sessions are invalidated on change) and satisfies FR11's "success confirmation" via the destination message rather
   than an on-form Alert. Do **not** show an on-form success banner and do **not** keep the user on the screen.
4. **Change-password failure (FR11).** On the backend's `400 { "error": "Password change failed" }` (wrong current
   password), an inline error is surfaced **below the current-password field** (`helperText` / `FormHelperText error`),
   never a toast, and the user **stays on the screen** (no redirect). The backend `error` message is surfaced verbatim
   in an alert region as well (matching the Story 5.2 auth-error pattern). No field is cleared on failure.
5. **Empty-field / mismatch validation.** Before any network request, empty current/new/confirm fields produce inline
   field errors, and a confirm ≠ new mismatch produces an inline error under the confirm field; no request is made in
   either case (mirror the Story 5.2 `AuthPage` validate-on-submit pattern).
6. **Reachability & navigation.** The Change Password screen is reachable from a user menu opened off the username chip
   in the app bar, on every authenticated screen. Navigating to `/account/password` while authenticated renders the
   screen; unauthenticated access is redirected to `/auth` by the existing `RouteGuard` (no new guard logic needed).
7. **Admin has no change-password affordance (first-boot correctness).** The backend 403-forbids the `admin` account
   from `/api/auth/change-password`. Therefore, when `useAuth().role === 'admin'`: the "Change password" menu item is
   **hidden** (not disabled — a disabled item invites "then where?"), and a direct navigation to `/account/password`
   **redirects to `/`**. Admin still receives the app shell, the username chip (FR12 applies to admin too), and Logout.
8. **One-time welcome message (FR5).** The first time a user logs in **immediately after registration**, a one-time
   welcome banner is shown at the top of the home content area (below the app bar) reading **"Welcome, {username}! You
   now have your own account."** It is **not persisted** (no `localStorage`/DB flag — React state / router navigation
   `state` only), is dismissible via a close control, and **disappears on dismiss or on any navigation**. It does
   **not** appear on ordinary logins, on silent-refresh session restores, or on session-expiry re-logins.
9. **Accessibility.** All inputs have visible associated labels; Enter submits the form (native `<form onSubmit>`);
   fields are keyboard-navigable; field errors are programmatically associated with their inputs; the change-password
   and welcome UI render with no perceptible layout shift on mobile (NFR10, NFR13–NFR16).
10. **E2E (Playwright, UI-driven, FR-mapped, dual chromium + mobile).**
    - **Change password → clean sign-out → re-login (FR11):** register a fresh unique user via the UI → open the
      change-password screen → submit current + new + confirm → **assert redirect to `/auth`** and that the "password
      changed, please sign in" message is shown → **log in with the NEW password** (succeeds) → assert the **old**
      password now fails.
    - **Confirm-mismatch (FR11):** entering a confirm value ≠ new password blocks submit with an inline error and fires
      no request.
    - **Admin has no change-password (FR11):** log in as `admin/admin` → open the user menu → assert "Change password"
      is **absent** and "Logout" present → navigate to `/account/password` directly → assert redirect to `/`.
    - **Welcome once (FR5):** after register → auto-login, assert the welcome banner appears **exactly once**; after
      logout → log back in, assert it does **not** reappear.
    - Tests are UI-driven (no API-only shortcuts for the asserted behavior), FR-mapped in test names, and green on both
      `chromium` (Desktop Chrome) and `mobile` (Pixel 7) projects.

## Tasks / Subtasks

- [x] **Task 1 — App shell / navigation with username chip (AC: 1, 6, 7, 9)**
    - [x] Create a shared authenticated layout (e.g. `bp_front/src/routes/AppLayout.tsx` or
      `bp_front/src/components/AppShell.tsx`) that renders a top MUI `AppBar`/`Toolbar` + an `<Outlet/>` for page
      content. Mount it as the element on the protected route subtree in `App.tsx` (wrap the existing
      `RouteGuard` `<Outlet/>` pages) so the bar appears on `/`, `/lists`, `/account/password`, and `/admin/*`.
    - [x] Render the username from `useAuth().username` as an identity chip: an avatar circle with the first-letter
      initial + the username `Typography` (the "UserChip" pattern). No loading text — `RouteGuard` already gates
      rendering until auth is resolved, so `username` is non-null inside the shell.
    - [x] Provide navigation to Change Password and Logout from the chip (an MUI `Menu`/`MenuItem` opened from the chip,
      or a visible overflow `IconButton`). "Change password" navigates to `/account/password`; "Logout" reuses the Story
      5.2 logout logic. **Render the "Change password" item only when `role !== 'admin'`** (AC #7) — e.g.
      `{role !== 'admin' && <MenuItem data-testid="menu-change-password" …>}`; "Logout" is always present.
    - [x] Migrate the temporary logout control and "Signed in as {username}" text **out of** `HomePage.tsx` into the new
      shell (remove them from `HomePage`). Preserve the logout behavior exactly: `await authApi.logout()` then
      `clearAuth()`, with an in-flight disabled guard (Story 5.2 review fix).
    - [x] Style via the theme (`theme.custom.bp.navBg`, `MuiAppBar` defaults already exist) and `sx` only — no
      `style={{}}`, no CSS modules.
    - [x] Add `data-testid`s: e.g. `app-bar`, `user-chip`, `user-menu-button`, `menu-change-password`, `menu-logout`.

- [x] **Task 2 — Change Password screen (AC: 2, 3, 4, 5, 7, 9)**
    - [x] Create `bp_front/src/routes/ChangePasswordPage.tsx` and register a `<Route path="/account/password">`
      **inside**
      the `RouteGuard` subtree in `App.tsx`, **before** the `path="*"` catch-all `Navigate`.
    - [x] **Admin guard (AC #7):** at the top of the component, if `useAuth().role === 'admin'`, `return <Navigate to="/"
        replace/>` — admins never render this form (the backend 403s them).
    - [x] Build the form by mirroring the `AuthPage.tsx` pattern exactly: manual `useState` per field (`current`,
      `next`,
      `confirm`) + `fieldErrors` object + top-level `formError` string + `loading` boolean; controlled `TextField`s with
      `type="password"`, `autoComplete="current-password"` (current) and `autoComplete="new-password"` (new + confirm);
      `error`/`helperText` per field; `<Box component="form" onSubmit={…} noValidate>` + `<Stack
        spacing={2}>`. Add the pre-submit note *"Changing your password will sign you out of all devices."* under the
      submit button (`data-testid="change-password-signout-note"`).
    - [x] `validate()` returns false and blocks submit if any of current/next/confirm is empty, **or** if `confirm !==
        next` (inline error under the confirm field); clear a field's error on change. `confirm` is validated locally
      and **never** passed to `authApi`.
    - [x] Submit handler: `if (loading) return` re-entry guard; `event.preventDefault()`; read `accessToken` from
      `useAuth()`; `try { await authApi.changePassword(current, next, accessToken) }` `catch (err) { surface
        err.message inline (current-password helperText + `change-password-error` alert region); stay on screen }`
      `finally { setLoading(false) }`.
    - [x] **On success (AC #3): clean sign-out.** No on-form success banner. Call `clearAuth()` then `navigate('/auth', {
        replace: true, state: { passwordChanged: true } })`.
    - [x] **Wire the `/auth` confirmation:** in `AuthPage.tsx`, read `location.state?.passwordChanged` and render *"Your
      password was changed. Please sign in with your new password."* in the **existing** alert slot used for
      `?expired=1` (reuse; don't add a component). Ensure it does not collide with the expiry banner.
    - [x] Submit `<Button type="submit" variant="contained" fullWidth disabled={loading}>` shows
      `<CircularProgress size={24} color="inherit"/>` while loading.
    - [x] `data-testid`s: `change-password-form`, `current-password-input`, `new-password-input`,
      `confirm-password-input`, `change-password-submit`, `change-password-error`,
      `change-password-signout-note`; on `/auth`: `password-changed-message`.

- [x] **Task 3 — One-time welcome message (AC: 8, 9)**
    - [x] Inject a "just registered" signal at the single register→login funnel in `AuthPage.tsx`. Preferred: on the
      register path only, navigate with router state — `navigate('/', { replace: true, state: { welcome: true } })`
      — leaving the ordinary login path's `navigate('/', { replace: true })` unchanged. (Do **not** persist to
      `localStorage`/DB.)
    - [x] Create a `WelcomeBanner` (e.g. `bp_front/src/components/WelcomeBanner.tsx`): teal-tinted `Box`/`Alert` with
      the copy **"Welcome, {username}! You now have your own account."** + a close `IconButton`. Render it at the top of
      the home content area (below the app bar).
    - [x] On the home page, read `location.state?.welcome` **once** into local `useState` — local state is the single
      source of truth thereafter — then **scrub the history state** (`navigate(location.pathname, { replace: true,
        state: {} })`) so a re-render cannot resurrect the banner from `location.state`. Render the banner only while
      the local flag is true; clear it on dismiss. Because it is driven by transient router state + local state,
      navigating away and back, a reload, or a re-login will not re-trigger it. Verify a reload does not re-show it.
    - [x] `data-testid`s: `welcome-banner`, `welcome-banner-dismiss`.

- [x] **Task 4 — E2E tests (AC: 10)**
    - [x] Before writing tests, **manually exercise** every flow in a real browser against the `:2080` Caddy stack
      (reframe rule 1) and confirm it works; note any discovered steps.
    - [x] Add `bp_front/e2e/account.spec.ts` (or extend the existing spec set) with four UI-driven scenarios:
      (a) change-password → **redirect to `/auth`** with the "password changed" message → re-login with the NEW password
      (old password fails); (b) confirm-mismatch blocks submit with an inline error, no request; (c) admin has no
      "Change password" menu item and `/account/password` redirects admin to `/`; (d) welcome-once after registration,
      absent on subsequent login.
    - [x] For (a), (b), (d) register a **fresh unique user per run/project** via the register UI (e.g.
      `acct_e2e_${test.info().project.name}_${Date.now()}`) — never the `admin` account (403-forbidden from
      change-password), never a hard-coded `mia`. For (c), log in as `admin/admin` (the guaranteed first-boot account)
      purely to assert the *absence* of the affordance — do not call change-password as admin. Reuse the Story 5.2
      `global-setup.ts` (registration enabled idempotently); no new global setup needed.
    - [x] Drive everything through the UI via `getByTestId`; assert only on data this test created (unique username);
      embed FR numbers (FR5, FR11, FR12) in test names.
    - [x] Run `npm run test:e2e` and confirm green on both `chromium` and `mobile`.

- [x] **Task 5 — Verification & housekeeping**
    - [x] `npm run lint` clean; `npm run build` (tsc strict + vite) passes.
    - [x] Confirm **no backend files changed**, **no new GraphQL operations**, and `src/__generated__/` untouched
      (`npm run generate` NOT required — change-password is REST, username is JWT-derived).
    - [x] Manual real-browser pass of all three features on the `:2080` stack before marking review.

## Dev Notes

### Scope & non-negotiable constraints (Epic 5 standing rules)

- **Do NOT modify backend code.** All three features are satisfied by consuming the **existing** REST auth surface and
  JWT claims. If you believe a backend change is needed, STOP and confirm with `md` first. [Source:
  epics.md#Epic-5 standing constraints, lines 1707–1727]
- **Every feature ships a real-browser Playwright E2E** that you manually exercised first; UI-driven, FR-mapped.
- **No new GraphQL operations / no codegen run.** Change-password is REST; username/role come from the JWT. Leave
  `bp_front/src/__generated__/` untouched. [Source: project-context / Story 5.2 completion notes]
- **Auth tokens:** access token in memory (React context) only; refresh via httpOnly cookie; never `localStorage`.
- **Styling:** MUI theme + `sx` only. Dark theme (`bp_front/src/theme.ts`): bg `#000`, paper `#1C1C1E`, primary teal
  `#4DC9BB`, success `#30D158`, error `#FF453A`. `theme.custom.bp.navBg` (`rgba(0,0,0,0.78)`) and `MuiAppBar`
  (`elevation: 0`) defaults already exist for the nav.

### The change-password contract (REUSE — do not rebuild)

`bp_front/src/lib/auth/authApi.ts` **already contains** `changePassword(currentPassword, newPassword, accessToken)`
(POST `/api/auth/change-password`, `Authorization: Bearer <token>`, body `{ currentPassword, newPassword }`, throws
`data.error ?? statusText`). Reuse it verbatim. [Source: bp_front/src/lib/auth/authApi.ts:42–55]

Backend behavior you must design around [Source: bp_back .../auth/AuthRoutes.kt:110–129, UserService.changePassword]:

- **Success = HTTP 200 with an empty body.** `authApi.changePassword` resolves (no payload).
- **Current password IS verified.** Wrong current password → `400 { "error": "Password change failed" }` (non-
  distinguishing message — surface it verbatim; do not invent copy that reveals which field was wrong).
- **⚠️ Side effect — all of the user's sessions are invalidated on success.** The refresh tokens are revoked server-side
  (the in-memory access token would limp on ~15 min, but we do not rely on that). **This is exactly why the settled
  design (Decision #1) is a clean sign-out:** on success, `clearAuth()` + redirect to `/auth` with
  `state: { passwordChanged: true }`, and `/auth` shows the confirmation message. This is backend-correct (the session
  is already dead) and avoids a delayed "surprise expiry" mid-task. Do **not** keep the user on the screen with an
  on-form success banner.
- **Note (FR9 debt, do not re-derive):** because the redirect is immediate, this flow does **not** organically exercise
  the 401 → silent-refresh-fail → `/auth?expired=1` path. That automated E2E stays deferred from Story 5.2 to the first
  query-bearing story (5.5+) — 5.3 does not discharge it.
- **The `admin` account is 403-forbidden** from this endpoint (`Admin password cannot be changed via this endpoint`).
  Per Decision #3 / AC #7, admins never reach it: hide the menu item and redirect `/account/password` → `/` for
  `role === 'admin'`. The change-password E2E and any manual test of the *change* itself must use a **registered
  non-admin user**; the admin E2E only asserts the affordance is absent. [Source:
  bp_back .../auth/AuthRoutes.kt:113–116]

### Username / role source (no `me` query exists)

There is **no `me`/`currentUser` GraphQL query and no `/api/auth/me` REST endpoint.** [Source: bp_back backend audit]
The username and role are already in `useAuth()` — login returns `{ accessToken, username, role }`, and on
silent-refresh (`POST /api/auth/refresh` returns only `{ accessToken }`) the provider decodes `username`/`role` from the
JWT claims via `parseJwt` (`bp_front/src/lib/auth/jwt.ts`). So for FR12 just read `useAuth().username`. Do not add a
query, do not run codegen. [Source: bp_front/src/lib/auth/AuthContext.tsx, jwt.ts]

### Existing code to touch (READ these before editing)

- `bp_front/src/App.tsx` — React Router routes. The protected subtree is wrapped by `<RouteGuard/>` (element route with
  `<Outlet/>`). Add the app-shell layout as the wrapper around the protected pages, and add the `/account/password`
  route **before** the `path="*"` catch-all `<Navigate to="/" replace/>`. `/auth` stays public/outside the guard.
- `bp_front/src/routes/RouteGuard.tsx` — **do not change guard logic.** It already renders `null` while loading /
  unauthenticated and redirects to `/auth` (preserving `?expired=1`). It guarantees `username` is resolved before your
  shell renders, so no "loading user…" flash (AC #1).
- `bp_front/src/routes/HomePage.tsx` — currently holds the temporary "Signed in as {username}" text + logout button (its
  comments say "the proper app bar with the username label is Story 5.3"). **Migrate** these into the new shell and
  remove them here; then add the `WelcomeBanner` at the top of the home content.
- `bp_front/src/routes/AuthPage.tsx` — single-screen login/register. Register success chains `authApi.register()` →
  `authApi.login()` → `establishSession()` → `navigate('/', {replace:true})`. **This is the only place** to add the
  `state: { welcome: true }` signal (register path only). Login/refresh/expiry paths must NOT set it. Do not regress the
  Story 5.2 review fixes (trimmed username, `?expired` clearing, re-entry guard).
- `bp_front/src/lib/auth/AuthContext.tsx` / `authApi.ts` — reuse as-is (`useAuth()`, `changePassword`, `logout`).

### Forms & UX pattern (copy the Story 5.2 conventions exactly)

Manual controlled state (no react-hook-form, no validation lib): `useState` per field, `fieldErrors` object, top-level
`formError` string, `loading` boolean (the change-password form needs no on-form success string — success redirects to
`/auth`). Controlled `TextField` with
`value`/`onChange`/`error`/`helperText={fieldErrors.x ?? ' '}` (space keeps layout stable, AC #9 no-shift),
`disabled={loading}`, `fullWidth`, `slotProps={{ htmlInput: { 'data-testid': … } }}`, correct `autoComplete`. Errors in
`role="alert"` regions and MUI `<Alert>` — **never Snackbars/toasts** (project UX rule: mutations are confirmed inline,
no success toasts). Enter submits via native `<form onSubmit>`. Same-tick re-entry guard `if (loading) return` and a
`try/catch/finally` around the API call (learned the hard way in 5.2 — see Previous Story Intelligence). [Source:
bp_front/src/routes/AuthPage.tsx]

### Welcome banner specifics (FR5)

- Copy (exact): **"Welcome, {username}! You now have your own
  account."** [Source: prd.md#Success Criteria line 96–98; ux-design-specification.md Journey Path D lines 385–390]
- Placement: top of the home content area, **below** the app bar; teal-tinted container + close `IconButton`. [Source:
  ux-design-specification.md#WelcomeBanner lines 684–697, Feedback Patterns 769–772]
- Lifetime: React state only, **not persisted**; disappears on dismiss OR on navigation; never on ordinary login, silent
  refresh, or expiry re-login. [Source: prd.md#Journey 1 lines 194–201; ux spec Journey 4 line 588]
- Recommended mechanism: React Router navigation `state` set only on the register path, read once into `useState` on the
  home page. This is inherently transient (a reload drops history `state`; a fresh login does not set it), which
  satisfies "not persisted" and "not on subsequent logins" without any storage.

### Navigation model note (UX spec conflict — resolved by code)

The two UX specs disagree on chrome: the auth spec (`ux-design-specification.md`) describes a **top AppBar + UserChip +
hamburger menu**; the Epic-4 spec + `design/` prototype describe **bottom tabs (Today/Lists/Household) + large-title
toolbar** with identity living in the Household screen. **The current `bp_front` code has NO nav chrome at all**, so
there is nothing to conflict with. For Story 5.3, implement the **top AppBar + UserChip** model (it is the only model
that satisfies "username on every screen" now, and it is the auth-spec's explicit intent). Do **not** build the
bottom-tab navigation here — that belongs to Stories 5.5/5.6. Keep the shell minimal and forward-compatible. [Source:
ux-design-specification.md lines 456–470, 649–706; epics.md Story 5.5/5.6]

### Route path

Use `/account/password` for the change-password screen (matches the UX spec's New Pages table). No dedicated
`/account` index/hub page is specified or required for this story — do not build one. [Source:
ux-design-specification.md#New Pages line 713]

### Testing standards summary

- Playwright config `bp_front/playwright.config.ts`: runs against the **production Caddy stack on `:2080`** (`webServer`
  runs `docker compose up -d --build`), two mandatory projects `chromium` + `mobile` (Pixel 7), `baseURL`
  `http://localhost:2080`, `globalSetup: ./e2e/global-setup.ts` (enables registration idempotently via admin REST +
  `setRegistrationEnabled`). Reuse it. [Source: bp_front/playwright.config.ts, e2e/global-setup.ts]
- **No login fixture / storageState / shared helper exists.** Register + log in via the UI in-test. Use a unique
  username per run/project (`acct_e2e_${project.name}_${Date.now()}`) to avoid cross-project collisions on the persisted
  `./db/data` volume. Assert only on your own data. [Source: bp_front/e2e/auth.spec.ts]
- E2E must be UI-driven (no API shortcuts for asserted behavior) and FR-mapped in the test title. [Source:
  epics.md#Epic-5 constraints; memory: E2E-in-epics rule]

### Project Structure Notes

- New files (suggested): `bp_front/src/routes/ChangePasswordPage.tsx`, an app-shell layout
  (`bp_front/src/routes/AppLayout.tsx` or `bp_front/src/components/AppShell.tsx` — first `components/` file is fine),
  `bp_front/src/components/WelcomeBanner.tsx`, `bp_front/e2e/account.spec.ts`.
- Modified files: `bp_front/src/App.tsx` (routes + shell wrapper), `bp_front/src/routes/HomePage.tsx` (remove temp
  logout/username, add WelcomeBanner), `bp_front/src/routes/AuthPage.tsx` (register-path welcome signal).
- Component/file naming: PascalCase component files, one default export per file, named prop-type/const exports allowed.
- No `style={{}}`, no `className`+inline CSS, no CSS modules — MUI `sx`/theme only. No `console.log` in components (only
  `ApolloProvider` logs intentionally).

### References

- [Source: epics.md#Story 5.3 lines 1776–1789] — story statement, ACs, E2E.
- [Source: epics.md#Epic 5 standing constraints lines 1707–1727] — backend-frozen, E2E-mandatory, tokens, design ref.
- [Source: epics.md#Additional Requirements AR2 lines 141–144] — auth endpoints (incl. change-password) are REST.
- [Source: prd.md FR5 line 529, FR11 line 543, FR12 line 544; Success Criteria lines 96–98; Journey 1 lines 194–201]
- [Source: prd.md NFR10 line 682; NFR13–NFR16 lines 692–695] — no layout shift, a11y labels/keyboard/contrast.
- [Source: architecture.md#Frontend Reframe (Epic 5) lines 842–876] — Vite+MUI+Caddy topology, in-memory token model.
- [Source: ux-design-specification.md#UserChip 649–664, #WelcomeBanner 684–697, #New Pages 708–714, Form/Feedback Patterns 757–788] —
  username chip, welcome banner copy/placement, `/account/password`, no success toasts.
- [Source: bp_front/src/lib/auth/authApi.ts:42–55] — existing `changePassword` client (REUSE).
- [Source: bp_front/src/lib/auth/AuthContext.tsx, jwt.ts] — `useAuth()` exposes username/role/accessToken; JWT-decoded.
- [Source: bp_front/src/routes/AuthPage.tsx, HomePage.tsx, App.tsx, RouteGuard.tsx] — patterns to mirror / files to
  edit.
- [Source: bp_back .../features/auth/AuthRoutes.kt:110–129, dto/ChangePasswordRequest.kt, UserService.changePassword] —
  REST contract, session invalidation, admin-forbidden, current-password verification.
- [Source: bp_front/playwright.config.ts, e2e/global-setup.ts, e2e/auth.spec.ts] — E2E harness & conventions.

## Previous Story Intelligence (Story 5.2)

Learnings from the completed 5.2 Authentication story and its code review — apply these directly:

- **Wrap every branch's API call in its own `try/catch`.** A 5.2 bug shipped where the login branch had
  `try { … } finally { setLoading(false) }` with **no `catch`**, so a failed login threw out of the handler instead of
  populating the alert region. Your change-password submit MUST have a real `catch` that sets the inline error.
- **Same-tick re-entry guard is required.** `setLoading(true)` only disables the form on the *next* render, so two rapid
  Enter presses both enter the handler → double submit. Add `if (loading) return` at the top of the submit handler. Give
  the logout control an in-flight disabled state too.
- **Trim the username once and use the trimmed value for both validation and API calls** (5.2 patch) — relevant if your
  shell or any form echoes/sends a username.
- **Don't bucket a loading (`null`) state with a disabled/false state.** In 5.2, `registrationEnabled === null` briefly
  rendered the disabled branch. If you gate any UI on an async flag, guard the `null` (still-loading) case explicitly.
- **E2E must genuinely prove the branch**, not pass on an unresolved state — assert the concrete post-condition (e.g.
  new password logs in AND old password fails; banner visible exactly once then absent), and assert URL/param changes
  where relevant.
- **Manual-exercise-first caught a real bug in 5.2.** Do the manual browser pass before writing the E2E.
- 5.2 shipped **12/12 E2E green on chromium + mobile**; hold that bar.

## Git Intelligence Summary

Recent commits confirm the Epic 5 reframe is a from-scratch Vite/MUI/Caddy frontend, backend untouched:

- `6117817 feat(auth): implement single-page authentication UI …` — Story 5.2 (the immediate predecessor; the auth UI,
  `authApi`, and E2E harness you build on).
- `6b141e3 chore(infra): serve a single entrypoint behind an external SSL/domain edge proxy` — infra/Caddy edge.
- `a3fdd35 chore: remove outdated e2e tests, frontend configurations, and assets` and
  `3433bf8 … update frontend architecture … Docker Compose` and
  `51fcc32 chore(epic5): reframe frontend architecture with Vite, Material UI, and Caddy` — the reframe groundwork.

Takeaway: the old Next.js/nginx patterns in `project-context.md` are **stale** for the frontend; follow the *actual*
`bp_front` Vite code and the patterns above. Backend rules in `project-context.md` remain valid but you won't touch the
backend here.

## Latest Tech Information

Pinned versions in `bp_front/package.json` (use these APIs, not older-major memory):

- React `19.2.5`, react-dom `19.2.5`.
- **MUI `@mui/material` `9.0.0`**, `@mui/icons-material` `9.0.0` — consult the `mcp__mui-mcp__fetchDocs` /
  `mcp__mui-mcp__useMuiDocs` MCP tools for v9 `AppBar`, `Toolbar`, `Menu`, `TextField`, `Alert`, `Avatar` APIs before
  writing components (do not guess v5/v6 API). Note the codebase uses `slotProps={{ htmlInput: { 'data-testid' } }}`
  (v9 slot API), not the legacy `inputProps`.
- **react-router-dom `^7.9.0`** — use `useNavigate`, `useLocation` (`location.state`), `<Outlet/>`, `<Navigate/>`;
  navigation `state` (`navigate(path, { state })`) is the recommended transient carrier for the welcome flag.
- `@apollo/client` `4.1.9`, `graphql-ws` `6.0.8` — not needed for this story (no GraphQL ops).
- TypeScript `6.0.3` strict — no `any`, fully typed props, `@/*` path alias maps to `src/*` (use `@/` imports).
- `@playwright/test` `^1.60.0` — `getByTestId`, per-project `test.info().project.name`.

## Project Context Reference

- Project rules: `/home/md/projects/bag-please/_bmad-output/project-context.md` — **frontend section is stale** (it
  documents the removed Next.js/nginx stack); its **backend** rules still apply but are out of scope here. Trust the
  live `bp_front` code and this story for frontend guidance.
- Repo guidance: `/home/md/projects/bag-please/CLAUDE.md` — current Vite/MUI/Caddy architecture description; temp files
  under `.tmp/<session-id>/`.
- Memory notes: E2E must be UI-driven and FR-mapped in UI epics; access token is in-memory (not `localStorage`);
  `admin` is blocked from list/self-service ops (and 403 on change-password).

## Story Completion Status

Ultimate context engine analysis completed and pressure-tested in a party-mode review (2026-07-16); all open questions
resolved into the **Decisions** block at the top. Story set to `ready-for-dev`.

Resolved in review (see Decisions block — do not re-open):

1. **Confirm-new-password field** → included (client-side only, never sent).
2. **Post-success UX** → clean sign-out: `clearAuth()` + redirect to `/auth`, which carries the confirmation message (no
   on-form success banner). This is backend-correct (sessions die on change) and avoids a delayed surprise expiry.
3. **Change-password entry point** → a menu off the username chip in the app bar, **hidden for `role === 'admin'`**.
4. **Admin gap closed** → admin sees no change-password affordance; `/account/password` redirects admins to `/`.
5. **FR9 expiry-path E2E** → stays deferred to the first query-bearing story (5.5+); 5.3's clean sign-out does not
   discharge it.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- **Change-password confirmation-message race (resolved).** Manual browser verification showed the clean sign-out
  redirect reached `/auth` but the "password changed" message never rendered (`history.state.usr === null`).
  Instrumented logging proved RouteGuard fired its own state-less `navigate('/auth', {replace})` and won: react-router
  v7 defers an imperative `navigate()` (startTransition), so `clearAuth()`'s urgent re-render commits first at the
  still-guarded route and RouteGuard — the documented "single owner of the redirect-to-/auth behaviour" — redirects
  before our stateful navigate lands. `flushSync` did not help (a transition can't be flushed). Fix: route the signal
  through
  `clearAuth(false, true)` → a new `passwordChanged` flag in `AuthContext` → RouteGuard carries `state: { passwordChanged:
  true }` on the redirect, mirroring the existing `expired` → `/auth?expired=1` pattern. This keeps a single navigator,
  so the confirmation can't be stripped. `ChangePasswordPage` no longer navigates itself.

### Completion Notes List

- **FR12 (username in nav) + app shell:** New `AppShell` (`bp_front/src/components/AppShell.tsx`) renders a sticky top
  `AppBar` with the brand and a username identity chip (`Avatar` initial + username) on every authenticated screen,
  reading `useAuth().username` (JWT-derived — no `me` query, no codegen). Mounted as a layout route inside the existing
  `RouteGuard` subtree in `App.tsx`. Logout + Change-password live in an MUI `Menu` off the chip; the temporary
  logout/username were migrated out of `HomePage`.
- **FR11 (change password):** New `ChangePasswordPage` (`/account/password`, inside the guard) mirrors the Story 5.2
  `AuthPage` form conventions — manual controlled state, validate-on-submit, inline field errors + an alert region, no
  success toast, same-tick re-entry guard, `try/catch/finally`. Confirm-new-password is validated locally and never
  sent. Success = clean sign-out: `clearAuth(false, true)` → RouteGuard redirect to `/auth` with
  `state: { passwordChanged }`;
  `AuthPage` shows the confirmation in the same alert slot as `?expired=1`. Wrong current password surfaces the backend
  message verbatim inline under the current-password field + the alert region, staying on screen. Admin is hard-guarded
  (`<Navigate to="/"/>`) and the menu item is hidden for `role === 'admin'` (AC #7).
- **FR5 (one-time welcome):** New `WelcomeBanner` (teal-tinted, dismissible) rendered at the top of `HomePage`. Signal
  set only on the register→login path in `AuthPage` via `navigate('/', { state: { welcome: true } })`; `HomePage` reads
  it once into local state and scrubs the history state so a re-render/reload can't resurrect it. Never persisted;
  absent on ordinary login, silent refresh, and expiry re-login.
- **AuthContext change:** `clearAuth` gained an optional second arg `didChangePassword` and the context exposes a new
  `passwordChanged` flag (reset by `setAuth`), consumed by RouteGuard. Backward-compatible with all existing callers
  (`clearAuth()`, `clearAuth(true)`).
- **E2E:** `bp_front/e2e/account.spec.ts` adds 4 UI-driven, FR-mapped scenarios (change→sign-out→re-login incl.
  old-fails; confirm-mismatch fires no request; admin-no-affordance + redirect; welcome-once). Existing `auth.spec.ts`
  scenario 1 updated for the migrated nav chrome (username chip + menu logout). **Full suite: 20/20 green on chromium +
  mobile.**
- **Verification:** `npm run lint`, `npx tsc -b`, and `npm run build` all clean. No backend files changed, no new
  GraphQL operations, `src/__generated__/` untouched (`npm run generate` not required). All three features manually
  exercised in a real browser against the `:2080` Caddy stack before writing/running the E2E.
- **FR9 debt:** As designed (Decision #4), the immediate clean-sign-out redirect does not organically exercise the 401 →
  refresh-fail → `/auth?expired=1` path; that automated E2E remains deferred to the first query-bearing story (5.5+).

### File List

New:

- `bp_front/src/components/AppShell.tsx`
- `bp_front/src/components/WelcomeBanner.tsx`
- `bp_front/src/routes/ChangePasswordPage.tsx`
- `bp_front/e2e/account.spec.ts`

Modified:

- `bp_front/src/App.tsx` (app-shell layout route + `/account/password` route)
- `bp_front/src/routes/HomePage.tsx` (removed temp logout/username; added WelcomeBanner + read-once/scrub logic)
- `bp_front/src/routes/AuthPage.tsx` (register-path `welcome` signal; `passwordChanged` confirmation in the alert slot)
- `bp_front/src/routes/RouteGuard.tsx` (carry `passwordChanged` navigation state on the redirect)
- `bp_front/src/lib/auth/AuthContext.tsx` (`passwordChanged` flag + `clearAuth` second arg)
- `bp_front/e2e/auth.spec.ts` (updated scenario 1 for migrated nav chrome)

## Change Log

- 2026-07-16 — Implemented Story 5.3 (User Account): app shell + username chip (FR12), Change Password screen with clean
  sign-out (FR11), one-time post-registration welcome banner (FR5). Added `passwordChanged` signal through
  AuthContext/RouteGuard to make the post-change confirmation race-free. 4 new UI-driven E2E scenarios; full suite 20/20
  green on chromium + mobile. Status → review.

## Review Findings

_Code review 2026-07-17 (bmad-code-review: Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor
confirmed all 10 ACs and every Epic-5 standing constraint are met. 0 decision-needed, 4 patch, 2 defer, 10 dismissed._

- [x] [Review][Patch][Fixed] Change-password error handling only covered the wrong-password (400+JSON) path —
  gateway/401/500 responses gave empty or misattributed
  errors [bp_front/src/lib/auth/authApi.ts, bp_front/src/routes/ChangePasswordPage.tsx] — FIXED:
  `authApi.changePassword` now throws a typed `ChangePasswordError(message, isCredentialError)` with a
  guaranteed-non-empty message (400 → backend message / "Password change failed"; any other status → "Something went
  wrong. Please try again." — never the HTTP/2-empty `statusText`). `ChangePasswordPage` shows a wrong-password (400)
  error both inline under the current-password field AND in the alert region (AC #4), but any other fault in the alert
  region only (no misattribution to the field) and never leaves the form without feedback. (No-silent-refresh-on-401
  remains deferred by Decision #4 / FR9 debt.)
- [x] [Review][Patch][Fixed] Long username overflowed the app-bar chip on
  mobile [bp_front/src/components/AppShell.tsx] — FIXED: username `Typography` now `noWrap` with
  `maxWidth: {xs: 140, sm: 220}` (MUI `noWrap` supplies the ellipsis), so long names truncate instead of breaking the
  sticky bar on the Pixel-7 viewport (AC9).
- [x] [Review][Patch][Fixed] `passwordChanged` confirmation banner never cleared on typing or mode
  switch [bp_front/src/routes/AuthPage.tsx] — FIXED: the signal is now read once into local state and the history state
  is scrubbed on mount (no resurrection on reload/re-render); a new `dismissTransientBanners()` clears both the expiry
  and password-changed banners on field engagement and on `switchMode`, so the success message no longer lingers over
  the Create-account form.
- [x] [Review][Patch][Fixed] `aria-expanded` omitted (not `"false"`) when the user menu was
  closed [bp_front/src/components/AppShell.tsx] — FIXED: now `aria-expanded={menuOpen}`, so the `aria-haspopup` trigger
  announces as collapsed (AC9 a11y).
- [x] [Review][Defer] Consumed one-shot auth flags (`passwordChanged`/`expired`) are never reset after
  redirect [bp_front/src/lib/auth/AuthContext.tsx:87-92, bp_front/src/routes/RouteGuard.tsx:21-25] — deferred,
  pre-existing. `clearAuth` sets the flag and only a later `setAuth`/`clearAuth` resets it, so the flag stays sticky
  until the next sign-in. Re-entering a guarded route while still unauthenticated (e.g. manually typing `/` after a
  password change) re-fires the guard redirect and re-shows the banner. `expired` has the identical latent behaviour
  since Story 5.2; `passwordChanged` inherits the accepted pattern. Narrow trigger (manual nav back without signing in),
  low consequence.
- [x] [Review][Defer] Change-password error alert can shift the vertically-centered form on a failed submit
  (mobile) [bp_front/src/routes/ChangePasswordPage.tsx:93-105,187-197] — deferred, pre-existing pattern. Field
  `helperText ?? ' '` reserves space (no shift on inline errors), but the conditional `change-password-error`
  `Typography` grows a `justifyContent: 'center'` column, re-centering the stack on failure (AC9 no-shift). This mirrors
  the accepted Story 5.2 `auth-error` convention, so it is consistent rather than a regression; revisit holistically if
  the no-shift bar tightens.
