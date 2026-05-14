# Story 1.6: E2E Test Infrastructure & Auth Flow Coverage

Status: done

## Story

As a developer maintaining bag-please,
I want a Playwright e2e test suite covering the core auth flows,
so that regressions in login, registration, session handling, and route guards are caught before they reach production.

## Acceptance Criteria

1. **AC1 — Suite runs:** `npm run test:e2e` against a locally running full stack (nginx `:2080`, backend `:4000`,
   MongoDB) passes all tests and produces an HTML report.

2. **AC2 — Route guard redirect:** An unauthenticated user visiting any protected route (e.g. `/`) is redirected to
   `/auth`.

3. **AC3 — Valid login:** Submitting the login form with valid credentials redirects to `/` and the `UserChip` shows the
   correct username in the AppBar.

4. **AC4 — Invalid login:** Submitting the login form with invalid credentials shows an inline `FormHelperText` error
   below the password field; no redirect occurs.

5. **AC5 — New user registration:** Submitting the registration form with a username not in the database auto-logs in,
   redirects to `/`, and the `WelcomeBanner` is visible.

6. **AC6 — Taken username registration:** Submitting the registration form with an existing username shows an inline
   `FormHelperText` error below the username field.

7. **AC7 — Logout:** A logged-in user clicking the logout icon is redirected to `/auth`; subsequent navigation to `/`
   redirects back to `/auth`.

8. **AC8 — Session expiry alert:** Navigating to `/auth?expired=1` shows an `Alert` with session-expiry text visible
   above the "Sign in" heading.

## Tasks / Subtasks

- [x] Task 1: Add `@playwright/test` devDependency and `test:e2e` script to `bp_front/package.json` (AC: 1)
    - [x] From `bp_front/`: `npm install --save-dev @playwright/test`
    - [x] Add `"test:e2e": "playwright test"` to `scripts` block in `package.json`
    - [x] Run `npx playwright install chromium` to download browser binary

- [x] Task 2: Create `bp_front/playwright.config.ts` (AC: 1)
    - [x] `testDir: './e2e'`, `baseURL: 'http://localhost:2080'`
    - [x] `workers: 1` — tests hit a shared real backend; serial prevents test interference
    - [x] `reporter: [['html', { open: 'never' }]]`
    - [x] Two projects: `setup` (matches `*.setup.ts`) and `chromium` (depends on `setup`)
    - [x] Do NOT set global `storageState` on the `chromium` project — auth state is opt-in per test file
    - [x] `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0`

- [x] Task 3: Create `bp_front/e2e/auth.setup.ts` — generates saved auth state (AC: 7)
    - [x] Call `page.request.post('/api/auth/login', { data: { username: 'admin', password: 'admin' } })`
    - [x] `await page.context().storageState({ path: 'e2e/.auth/user.json' })`
    - [x] Create `e2e/.auth/` directory (empty; `.gitignore` covers its contents)

- [x] Task 4: Create `bp_front/e2e/auth.spec.ts` — unauthenticated flow tests (AC: 2, 3, 4, 5, 6, 8)
    - [x] AC2: `page.goto('/')` → expect URL `/auth`
    - [x] AC3: fill `#username`/`#password` with `admin`/`admin`, submit → expect URL `/`,
      `getByRole('banner').getByText('admin')` visible
    - [x] AC4: fill `admin`/`wrongpassword`, submit → expect `#password-helper-text` visible, URL stays `/auth`
    - [x] AC5: fill unique username (`testuser_${Date.now()}`)/`password123` on `/auth/register`, submit → expect URL
      `/`, `text=You now have your own account` visible
    - [x] AC6: fill `admin`/`anypassword` on `/auth/register`, submit → expect `#username-helper-text` visible
    - [x] AC8: `page.goto('/auth?expired=1')` → expect `text=session has expired` visible

- [x] Task 5: Create `bp_front/e2e/logout.spec.ts` — authenticated logout test (AC: 7)
    - [x] `test.use({ storageState: 'e2e/.auth/user.json' })` at top of file
    - [x] Open nav menu: `page.locator('button[aria-haspopup="true"]').click()`
    - [x] Click logout: `page.locator('[aria-label="logout"]').click()`
    - [x] Expect URL `/auth`, then navigate to `/`, expect redirect back to `/auth`

- [x] Task 6: Update `bp_front/.gitignore` (AC: 1)
    - [x] Add `e2e/.auth/`, `playwright-report/`, `test-results/`

## Dev Notes

### Auth Flow Architecture — Read Before Writing Tests

1. **No localStorage token.** Auth state lives in React state only (in-memory). The `AuthProvider` calls
   `authApi.refresh()` on every mount — this hits `POST /api/auth/refresh` which reads the httpOnly `refresh_token`
   cookie set by login and returns a fresh access token. If no cookie → `refresh()` throws → `isLoading` goes `false`
   and `username` stays `null`.

2. **For authenticated tests:** `storageState` saves browser cookies. Since the refresh token is an httpOnly cookie,
   saving state after a `POST /api/auth/login` call captures it. On next Playwright page load, `AuthProvider.refresh()`
   succeeds because the cookie is present in the browser context.

3. **Use `page.request.post()`, NOT the standalone `request` fixture.** The standalone `request` fixture has its own
   isolated cookie jar — cookies set there do NOT appear in the browser page context. `page.request` shares cookies with
   the page's browser context, so `storageState()` captures them.

### Setup Fixture (exact implementation)

```typescript
// bp_front/e2e/auth.setup.ts
import {test as setup} from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

setup('authenticate as admin', async ({page}) => {
  await page.request.post('/api/auth/login', {
    data: {username: 'admin', password: 'admin'},
  })
  await page.context().storageState({path: authFile})
})
```

### Playwright Config (exact implementation)

```typescript
// bp_front/playwright.config.ts
import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', {open: 'never'}]],
  use: {
    baseURL: 'http://localhost:2080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
      dependencies: ['setup'],
    },
  ],
})
```

### Selector Reference (verified against current source)

| Target               | Selector                                      | Why this works                                                                                                |
|----------------------|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Username TextField   | `#username`                                   | `id="username"` in `auth/page.tsx:57` and `register/page.tsx:51`                                              |
| Password TextField   | `#password`                                   | `id="password"` in `auth/page.tsx:69`                                                                         |
| Username helper text | `#username-helper-text`                       | MUI auto-generates `{id}-helper-text` from TextField `id`                                                     |
| Password helper text | `#password-helper-text`                       | MUI auto-generates `{id}-helper-text`                                                                         |
| Submit button        | `button[type="submit"]`                       | All forms use `<Button type="submit">`                                                                        |
| Navigation hamburger | `button[aria-haspopup="true"]`                | `Navigation.tsx:34` — `aria-haspopup="true"` is always rendered; `aria-controls` is conditional on `menuOpen` |
| Logout icon button   | `[aria-label="logout"]`                       | `Logout.tsx:41` — `<IconButton aria-label="logout">`                                                          |
| UserChip username    | `page.getByRole('banner').getByText('admin')` | AppBar = `<header role="banner">`; UserChip Typography is inside it                                           |
| WelcomeBanner text   | `text=You now have your own account`          | `WelcomeBanner.tsx:13` Typography content                                                                     |
| Session expiry alert | `text=session has expired`                    | `auth/page.tsx:53` Alert text: "Your session has expired. Please sign in again."                              |

### Rate Limit Requirement

The backend auth rate limiter (`rateLimit.attempts` in `application.yaml`) applies globally (all IPs share the counter)
to all `/api/auth/*` endpoints including `/auth/refresh`. A complete test run makes ~8 calls. The backend must be
configured with `KTOR_RATE_LIMIT_ATTEMPTS` ≥ 20 (e.g. 6000) for the test suite to pass reliably. The default of 5 is
insufficient for local e2e test execution.

### WelcomeBanner Timing

`RegisterPage` calls `router.push('/?welcome=1')` on success. `HomeContent` reads `?welcome=1` at mount and
immediately calls `router.replace('/')` — the URL cleans, but `showBanner` React state stays `true`. Playwright's
`expect(page.locator('text=You now have your own account')).toBeVisible()` will auto-wait for the element to
appear post-redirect. The banner persists until the user dismisses it.

### Registration Test — Username Uniqueness

Always generate unique usernames: `testuser_${Date.now()}`. Fixed names fail on re-run with "username taken" error.
These test users accumulate in the development DB — expected and acceptable.

### auth.spec.ts (example implementation)

```typescript
// bp_front/e2e/auth.spec.ts
import {test, expect} from '@playwright/test'

test('unauthenticated user visiting / is redirected to /auth', async ({page}) => {
  await page.goto('/')
  await expect(page).toHaveURL('/auth')
})

test('valid login redirects to / and shows UserChip', async ({page}) => {
  await page.goto('/auth')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'admin')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('banner').getByText('admin')).toBeVisible()
})

test('invalid login shows error below password field', async ({page}) => {
  await page.goto('/auth')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('#password-helper-text')).toBeVisible()
  await expect(page).toHaveURL('/auth')
})

test('registration with new username auto-logs in and shows WelcomeBanner', async ({page}) => {
  const uniqueUser = `testuser_${Date.now()}`
  await page.goto('/auth/register')
  await page.fill('#username', uniqueUser)
  await page.fill('#password', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
  await expect(page.locator('text=You now have your own account')).toBeVisible()
})

test('registration with taken username shows error below username field', async ({page}) => {
  await page.goto('/auth/register')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'anypassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('#username-helper-text')).toBeVisible()
})

test('session expiry alert is visible when ?expired=1', async ({page}) => {
  await page.goto('/auth?expired=1')
  await expect(page.locator('text=session has expired')).toBeVisible()
})
```

### logout.spec.ts (example implementation)

```typescript
// bp_front/e2e/logout.spec.ts
import {test, expect} from '@playwright/test'
import path from 'path'

test.use({storageState: path.join(__dirname, '.auth/user.json')})

test('logout redirects to /auth and subsequent navigation redirects back', async ({page}) => {
  await page.goto('/')
  await expect(page).toHaveURL('/')

  await page.locator('button[aria-haspopup="true"]').click()
  await page.locator('[aria-label="logout"]').click()
  await expect(page).toHaveURL('/auth')

  await page.goto('/')
  await expect(page).toHaveURL('/auth')
})
```

### Files to Create / Modify

| File                            | Action | Notes                                                   |
|---------------------------------|--------|---------------------------------------------------------|
| `bp_front/package.json`         | MODIFY | Add `@playwright/test` devDep, `test:e2e` script        |
| `bp_front/playwright.config.ts` | CREATE | Playwright config                                       |
| `bp_front/e2e/auth.setup.ts`    | CREATE | Auth setup — saves httpOnly cookie to storageState      |
| `bp_front/e2e/auth.spec.ts`     | CREATE | AC2–6, AC8: unauthenticated flows                       |
| `bp_front/e2e/logout.spec.ts`   | CREATE | AC7: logout with auth state                             |
| `bp_front/.gitignore`           | MODIFY | Add `e2e/.auth/`, `playwright-report/`, `test-results/` |

**Do NOT touch:** any `src/` files, `__generated__/`, or backend files — this story is test infrastructure only.

### Scope Boundaries

- **No component/unit test framework** — this story adds Playwright e2e only
- **No backend test changes** — backend tests (Kotest) are separate; this story is frontend-only
- **No CI pipeline changes** — the epics note CI runs in `headed=false` (default for Playwright) with HTML report
  retained; actual CI config (GitHub Actions yml) is out of scope for this story

### References

- Epics `_bmad-output/planning-artifacts/epics.md` — Story 1.6 ACs
- Architecture `_bmad-output/planning-artifacts/architecture.md` lines 123-127 — Playwright config guidance
- `project-context.md` Frontend Testing section — base URL, auth fixture pattern, browser isolation requirement
- `bp_front/src/app/auth/page.tsx` — LoginForm: `id` attributes, session expiry Alert text
- `bp_front/src/app/auth/register/page.tsx` — RegisterPage: error goes to `usernameError`
- `bp_front/src/app/RouteGuard.tsx` — `PUBLIC_ROUTES`, redirect logic
- `bp_front/src/app/WelcomeBanner.tsx` — banner text
- `bp_front/src/app/AppHeader.tsx` — UserChip inside AppBar (role="banner")
- `bp_front/src/app/Navigation.tsx` — hamburger button `aria-haspopup="true"` (always rendered)
- `bp_front/src/app/auth/Logout.tsx` — `<IconButton aria-label="logout">`
- Story 1.5 `_bmad-output/implementation-artifacts/1-5-user-identity-account-management-ui.md` — review findings
  (UserChip empty-string guard at `AppHeader.tsx:38`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Initial run: 2 tests failed (valid login AC3, registration AC5) with 429 Too Many Requests. Root cause: backend
  auth rate limiter applies globally across all IPs to all `/api/auth/*` endpoints including `/auth/refresh`. A single
  test run makes ~8 rate-limited calls; the default limit of 5/60s is exceeded. Fixed by user setting
  `KTOR_RATE_LIMIT_ATTEMPTS` to 6000 in the running backend. See "Rate Limit Requirement" in Dev Notes.
- Selector divergence: story Dev Notes specified `[aria-controls="account-menu"]` for the hamburger button. This
  attribute is conditionally rendered by React only when `menuOpen=true` (`Navigation.tsx:32`). Replaced with
  `button[aria-haspopup="true"]` which is always present on the same button.

### Completion Notes List

- All 8 tests pass (1 setup + 6 auth.spec + 1 logout.spec), 5.6s total.
- AC1–AC8 fully covered.
- `button[aria-haspopup="true"]` used instead of `[aria-controls="account-menu"]` because the latter is
  React-conditional.
- Rate limit env var must be ≥ 20 for full suite; local dev default (5) is insufficient.

### File List

- `bp_front/package.json` — added `@playwright/test ^1.60.0` devDep + `test:e2e` script
- `bp_front/playwright.config.ts` — created
- `bp_front/e2e/auth.setup.ts` — created
- `bp_front/e2e/auth.spec.ts` — created
- `bp_front/e2e/logout.spec.ts` — created
- `bp_front/e2e/.auth/` — directory created (gitignored)
- `bp_front/.gitignore` — added `e2e/.auth/`, `/playwright-report/`, `/test-results/`

### Change Log

- 2026-05-14: Implemented Playwright e2e test infrastructure — playwright.config.ts, auth.setup.ts, auth.spec.ts,
  logout.spec.ts; updated package.json and .gitignore (Story 1.6, all ACs satisfied).

### Review Findings

- [x] [Review][Patch] AC6 error message not verified as username-specific — add `toContainText('Invalid credentials')`
  assertion; backend returns `{"error":"Invalid credentials"}` (AuthRoutes.kt:36) for all registration failures, which
  authApi surfaces verbatim [e2e/auth.spec.ts:40-42]

- [x] [Review][Patch] auth.setup.ts — login response not checked before saving storage state; if POST returns
  401/500/rate-limit, storageState is written empty and all logout.spec.ts tests silently fail with wrong-auth
  errors [e2e/auth.setup.ts:7-10]
- [x] [Review][Patch] auth.setup.ts — `.auth/` directory not created before storageState write; first run in a clean
  environment throws ENOENT [e2e/auth.setup.ts:10]

- [x] [Review][Defer] Hardcoded admin/admin credentials in test
  files [e2e/auth.setup.ts, e2e/auth.spec.ts, e2e/logout.spec.ts] — deferred, pre-existing; documented default dev
  credentials
- [x] [Review][Defer] Registration test accumulates test users — no teardown [e2e/auth.spec.ts:26] — deferred,
  pre-existing; explicitly accepted in dev notes
- [x] [Review][Defer] `button[aria-haspopup="true"]` selector not scoped to AppBar container [e2e/logout.spec.ts:10] —
  deferred, pre-existing documented selector choice
- [x] [Review][Defer] `[aria-label="logout"]` selector fragile to future label/i18n changes [e2e/logout.spec.ts:11] —
  deferred, pre-existing; verified working
- [x] [Review][Defer] No `webServer` config in playwright.config.ts — tests assume :2080
  pre-running [playwright.config.ts] — deferred, explicitly out of scope per story boundaries
- [x] [Review][Defer] No `playwright install` step in `test:e2e` script [package.json] — deferred, one-time manual setup
  per task notes
- [x] [Review][Defer] No explicit timeout overrides on URL/element assertions [e2e/*.spec.ts] — deferred, Playwright
  default 5s adequate for local dev
