# Story 3.2: E2E Test Coverage — Admin Panel

Status: done

## Story

As a developer maintaining bag-please,
I want Playwright E2E tests covering all Epic 2 admin UI flows,
so that regressions in user management and registration configuration are caught before reaching production.

## Acceptance Criteria

**AC1 — Create user:**
Given the admin is on `/admin/users`,
When they click "Create user", fill in a unique username and password, and click "Create",
Then the new user row appears in the table immediately without a page reload.

**AC2 — Delete user:**
Given the admin is on `/admin/users` and a test user exists,
When the admin clicks the delete icon for that user and confirms in the dialog,
Then the user row is removed from the table.

**AC3 — Reset password:**
Given the admin is on `/admin/users` and a test user exists,
When the admin clicks the reset-password icon, fills a new password, and clicks "Reset",
Then the dialog closes without an error Alert visible.

**AC4 — Registration toggle — disable:**
Given registration is currently enabled,
When the admin toggles the "Allow public registration" switch OFF and navigates to `/auth`,
Then the "Contact your admin to get access" text is visible and the "Register" link is absent.

**AC5 — Registration toggle — enable:**
Given registration is currently disabled,
When the admin toggles the "Allow public registration" switch ON and navigates to `/auth`,
Then the "Register" link is visible and the "Contact your admin" text is absent.

**AC6 — Admin guard — non-admin redirect:**
Given a logged-in regular user navigates to `/admin/users`,
When the admin guard evaluates,
Then the user is redirected to `/`.

**AC7 — Navigation "User Management" visibility:**
Given the admin opens the navigation menu,
When the menu renders,
Then a "User Management" item is visible.
And this item is NOT rendered for a non-admin user's navigation menu.

**AC8 — webServer config:**
Given `playwright.config.ts` has a `webServer` block,
When `npm run test:e2e` is run with no stack running (non-CI mode with `reuseExistingServer: true`),
Then Playwright starts the stack via `docker compose up -d` automatically and tests proceed.

## Tasks / Subtasks

- [x] Task 1: Update `playwright.config.ts` — add `webServer` block (AC: 8)
    - [x] Import `path` at top of config file
    - [x] Add `webServer` option: `command: 'docker compose up -d'`, `cwd: path.join(__dirname, '..')` (project root),
      `url: 'http://localhost:2080'`, `reuseExistingServer: !process.env.CI`, `timeout: 120 * 1000`

- [x] Task 2: Create `bp_front/e2e/admin-users.spec.ts` — create, delete, reset password, and navigation tests (AC: 1,
  2, 3, 7)
    - [x] `test.use({storageState: path.join(__dirname, '.auth/user.json')})` — reuse existing admin session
    - [x] Test: create user — fill dialog, assert row appears in table
    - [x] Test: delete user — create user first via UI, then delete via confirmation dialog
    - [x] Test: reset password — scope to a test user, fill new password, assert dialog closes without error
    - [x] Test: navigation "User Management" visible for admin (open menu via `button[aria-haspopup="true"]`, assert
      text)

- [x] Task 3: Create `bp_front/e2e/admin-config.spec.ts` — registration toggle and login screen adaptation (AC: 4, 5)
    - [x] `test.use({storageState: path.join(__dirname, '.auth/user.json')})` — admin session
    - [x] Before all tests: read current registration state via API and store original value
    - [x] Test: disable registration via switch → navigate to /auth → assert "Contact your admin" visible, "Register"
      absent
    - [x] Test: enable registration via switch → navigate to /auth → assert "Register" link visible, "Contact admin"
      absent
    - [x] After all tests: restore registration to original value via API

- [x] Task 4: Create `bp_front/e2e/admin-guard.spec.ts` — non-admin redirect and nav menu tests (AC: 6, 7)
    - [x] In each test: use admin session to obtain access token via POST `/api/auth/refresh`, create a unique regular
      user via GraphQL mutation, login as that user, test the guard/menu
    - [x] Test: non-admin navigates to `/admin/users` → asserts redirect to `/`
    - [x] Test: non-admin opens navigation menu → asserts "User Management" text is NOT present

- [x] Task 5: Run and verify (AC: all)
    - [x] From `bp_front/`: `npm run test:e2e` — all tests pass with zero failures
    - [x] Confirm no regressions in existing `auth.spec.ts` and `logout.spec.ts`

## Dev Notes

### Auth mechanism — critical context

The Playwright setup in `auth.setup.ts` logs in via `page.request.post('/api/auth/login')` which causes the server to *
*set a `refresh_token` httpOnly cookie**. That cookie is captured by `page.context().storageState()` and stored in
`.auth/user.json`. Tests that use this `storageState` start with the cookie; the frontend's `AuthContext` calls
`/api/auth/refresh` on mount, receives an `accessToken`, and the user is authenticated. **There is no `localStorage`
involved** — `origins` is empty in the stored state, which is correct.

This means: getting an admin access token in any test or setup is
`const {accessToken} = await (await page.request.post('/api/auth/refresh')).json()` — this works in any test that uses
the admin storageState.

### playwright.config.ts — webServer addition

Current file (`bp_front/playwright.config.ts`, line 1–25) has no `webServer` block. Add after the `use` block:

```ts
import path from 'path'  // add at top

// inside defineConfig():
webServer: {
  command: 'docker compose up -d',
  cwd: path.join(__dirname, '..'),  // project root (bp_front/../ = repo root)
  url: 'http://localhost:2080',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

`reuseExistingServer: !process.env.CI` means:

- **Local dev**: if `http://localhost:2080` is already responding, use it (no command runs); if not, start
  `docker compose up -d`
- **CI**: always run `docker compose up -d` (ignore any existing server)

`cwd` must point to the project root because `docker-compose.yaml` lives there, not in `bp_front/`.

### admin-users.spec.ts — selectors and patterns

```ts
import {expect, test} from '@playwright/test'
import path from 'path'

test.use({storageState: path.join(__dirname, '.auth/user.json')})
```

**Button selectors:**

- "Create user" button: `page.getByRole('button', {name: 'Create user'})`
- Delete icon: `page.getByTitle('Delete user')` — scope to specific row: `row.getByTitle('Delete user')`
- Reset icon: `page.getByTitle('Reset password')` — scope to specific row: `row.getByTitle('Reset password')`
- Confirm/action buttons in dialog: `page.getByRole('button', {name: 'Create'})`,
  `page.getByRole('button', {name: 'Delete'})`, `page.getByRole('button', {name: 'Reset'})`

**Dialog field selectors (always scope to dialog):**

```ts
const dialog = page.getByRole('dialog')
await dialog.getByLabel('Username').fill(uniqueUser)
await dialog.getByLabel('Password').fill('testpass')   // create dialog
await dialog.getByLabel('New password').fill('newpass') // reset dialog
```

**Table row selector:**

```ts
const row = page.getByRole('row', {name: new RegExp(uniqueUser)})
await row.getByTitle('Delete user').click()
```

**Assert user in table:**

```ts
await expect(page.getByRole('cell', {name: uniqueUser})).toBeVisible()
```

**Unique usernames** — use `Date.now()` prefix to avoid test collisions:

```ts
const uniqueUser = `e2e_create_${Date.now()}`
```

**Navigation menu test:**

```ts
await page.locator('button[aria-haspopup="true"]').click()
await expect(page.getByText('User Management')).toBeVisible()
```

### admin-config.spec.ts — registration toggle patterns

**MUI Switch selector** — the Switch renders as a checkbox input; the FormControlLabel wraps it with the label "Allow
public registration":

```ts
const regSwitch = page.getByLabel('Allow public registration')
// check state:
const isChecked = await regSwitch.isChecked()
// toggle: click the label text (more reliable than clicking the input directly)
await page.getByText('Allow public registration').click()
// assert state:
await expect(regSwitch).toBeChecked()
await expect(regSwitch).not.toBeChecked()
```

**Reading current state via API for `beforeAll` / `afterAll`:**

```ts
let originalRegistrationEnabled: boolean

test.beforeAll(async ({browser}) => {
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  const p = await ctx.newPage()
  const tokenRes = await p.request.post('/api/auth/refresh')
  const {accessToken} = await tokenRes.json()
  const configRes = await p.request.get('/api/auth/config')
  const config = await configRes.json()
  originalRegistrationEnabled = config.registrationEnabled
  await ctx.close()
})

test.afterAll(async ({browser}) => {
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  const p = await ctx.newPage()
  const tokenRes = await p.request.post('/api/auth/refresh')
  const {accessToken} = await tokenRes.json()
  await p.request.post('/api/graphql', {
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    data: JSON.stringify({
      query: `mutation { setRegistrationEnabled(enabled: ${originalRegistrationEnabled}) { registrationEnabled } }`,
    }),
  })
  await ctx.close()
})
```

**Login screen selectors** for registration state:

```ts
await page.goto('/auth')
// Registration disabled:
await expect(page.getByText('Contact your admin to get access')).toBeVisible()
await expect(page.getByRole('link', {name: 'Register'})).not.toBeVisible()
// Registration enabled:
await expect(page.getByRole('link', {name: 'Register'})).toBeVisible()
await expect(page.getByText('Contact your admin to get access')).not.toBeVisible()
```

`AuthContext` fetches `/api/auth/config` on app load. After toggling the switch on the admin page, navigating to `/auth`
triggers a fresh page load which calls `getConfig` again. The login page uses `registrationEnabled` from that fresh
fetch.

### admin-guard.spec.ts — creating a non-admin session inline

Each test in this file creates its own regular user via the GraphQL API, then logs in as that user using a separate
browser context. This is fully self-contained — no shared setup file needed.

```ts
import {expect, test} from '@playwright/test'
import path from 'path'

test('non-admin user navigating to /admin/users is redirected to /', async ({browser}) => {
  const uniqueUser = `guardtest_${Date.now()}`

  // Obtain admin access token via admin storageState
  const adminCtx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  const adminPage = await adminCtx.newPage()
  const tokenRes = await adminPage.request.post('/api/auth/refresh')
  const {accessToken} = await tokenRes.json()

  // Create a regular user via GraphQL
  await adminPage.request.post('/api/graphql', {
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    data: JSON.stringify({
      query: `mutation { createUser(username: "${uniqueUser}", password: "testpass123") { id } }`,
    }),
  })
  await adminCtx.close()

  // Login as the regular user (new isolated context)
  const userCtx = await browser.newContext()
  const userPage = await userCtx.newPage()
  await userPage.request.post('/api/auth/login', {
    data: {username: uniqueUser, password: 'testpass123'},
  })

  // Navigate to admin route and assert redirect
  await userPage.goto('/admin/users')
  await expect(userPage).toHaveURL('/')

  await userCtx.close()
})
```

The same pattern works for the navigation menu test — navigate to `/`, open the menu, assert "User Management" is
absent.

### GraphQL mutation signatures

From `bp_front/src/lib/user/Queries.tsx` and `bp_front/src/lib/config/Queries.tsx`:

```
createUser(username: String!, password: String!): User     → {id, username, role}
deleteUser(id: ID!): User
resetUserPassword(id: ID!, newPassword: String!): User
setRegistrationEnabled(enabled: Boolean!): ApplicationConfig  → {registrationEnabled}
```

For raw GraphQL calls in tests, use `page.request.post('/api/graphql', ...)` with `Authorization: Bearer <accessToken>`
header.

### Concurrency and test isolation

All tests in this file run with `workers: 1` (sequential, from playwright.config.ts). The `admin-config.spec.ts` tests
share a side effect (registration state). The `beforeAll`/`afterAll` approach above is the correct isolation boundary.

Tests in `admin-users.spec.ts` use unique `Date.now()`-prefixed usernames — they accumulate in the DB (no teardown).
This is the same accepted pattern as `auth.spec.ts` (registration test creates users without cleanup). Clean the dev DB
periodically.

### Project Structure Notes

- All new test files: `bp_front/e2e/` — consistent with existing `auth.spec.ts`, `logout.spec.ts`
- Admin auth storageState: `bp_front/e2e/.auth/user.json` — created by existing `auth.setup.ts`; read-only for all tests
- No new setup project in `playwright.config.ts` needed — admin-guard tests are self-contained
- `path.join(__dirname, '.auth/user.json')` in every test file that uses admin storageState — `__dirname` is
  `bp_front/e2e/`

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, the dev agent must verify and explicitly check each item:

- [x] **Mutation errors surface to the user** — N/A for this story (E2E only, no new mutations)
- [x] **Dialog does not close on error** — N/A (tested behavior from 3.1, not new code)
- [x] **Cancel remains interactive during in-flight requests** — N/A
- [x] **Client-side input validation** — N/A
- [x] **Concurrent write safety** — tests use unique usernames; no shared mutable state between tests
- [x] **Loading state prevents double-submit** — N/A

### References

- [Epic 2 Retro §Story 3.2] — authoritative scope: `_bmad-output/implementation-artifacts/epic-2-retro-2026-05-15.md`
- [project-context.md §Frontend Testing] — Playwright config, base URL, auth isolation pattern
- [playwright.config.ts] — existing config at `bp_front/playwright.config.ts`
- [auth.setup.ts] — admin session setup; documents refresh_token cookie mechanism
- [auth.spec.ts, logout.spec.ts] — existing test patterns and selectors to reuse
- [admin/users/page.tsx] — admin UI component; source of all selectors and interaction patterns
- [admin/ConfirmDialog.tsx] — dialog behavior; `autoFocus` on Cancel, error Alert, loading spinner
- [admin/layout.tsx] — admin guard: `useEffect` + `role !== 'admin'` check
- [Navigation.tsx:124-132] — `role === 'admin'` condition for "User Management" menu item
- [deferred-work.md §1-6] — "No `webServer` config in playwright.config.ts — add with docker compose invocation"
- [docker-compose.yaml] — `services.router` on port 2080; `cwd` must be project root for `docker compose up`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Race condition in admin-config tests: `getByLabel('Allow public registration').isChecked()` called immediately after
page.goto resolved to false (Apollo query loading, switch defaulting to `?? false`). Fixed by setting precondition state
via API before navigating, then waiting for `not.toBeDisabled()` before interacting.

`getByRole('alert')` in reset-password test matched Next.js route announcer (
`<div role="alert" id="__next-route-announcer__">` — always present). Removed check: dialog-close success already proves
no error (ConfirmDialog only closes on success path).

### Completion Notes List

Implemented all 7 ACs:

- `playwright.config.ts`: added `webServer` block with `docker compose up -d` + `reuseExistingServer: !process.env.CI`
- `admin-users.spec.ts`: 4 tests — create user, delete user, reset password, nav menu (admin)
- `admin-config.spec.ts`: 2 tests — disable/enable registration toggle + login screen adaptation; beforeAll/afterAll
  restore state via API
- `admin-guard.spec.ts`: 2 tests — non-admin redirect + nav menu hidden for non-admin
- All 16 tests pass (8 new + 8 existing); no regressions in auth.spec.ts or logout.spec.ts

Key implementation decision: admin-config tests use API to set precondition state before navigating to the UI, then wait
for `not.toBeDisabled()` before interacting with the switch — avoids the Apollo loading race.

### File List

- bp_front/playwright.config.ts
- bp_front/e2e/admin-users.spec.ts
- bp_front/e2e/admin-config.spec.ts
- bp_front/e2e/admin-guard.spec.ts

## Review Findings

- [x] [Review][Decision→Patch] Switch mutation timing — resolved: added `waitForResponse` guard before
  `page.goto('/auth')` in both toggle tests [bp_front/e2e/admin-config.spec.ts]

- [x] [Review][Dismiss] Typo `/api/arat/refresh` — false positive introduced in review agent prompt; actual file has
  correct `/api/auth/refresh` in both tests [bp_front/e2e/admin-guard.spec.ts:45]

- [x] [Review][Patch] No try/finally in beforeAll/afterAll — fixed: wrapped body in try/finally to guarantee
  ctx.close() [bp_front/e2e/admin-config.spec.ts:24-46]

- [x] [Review][Patch] `originalRegistrationEnabled` has no fallback value — fixed: initialized to `true` as safe
  default [bp_front/e2e/admin-config.spec.ts:6]

- [x] [Review][Patch] Use `page.getByLabel('Allow public registration').click()` — fixed: replaced `getByText(...)` with
  `getByLabel(...)` in both toggle tests [bp_front/e2e/admin-config.spec.ts]

- [x] [Review][Defer] webServer has no teardown command — containers started during suite are never stopped after tests
  finish [bp_front/playwright.config.ts] — deferred, pre-existing

- [x] [Review][Defer] webServer URL health check only verifies nginx is responding, not that Ktor/Next.js are fully
  ready inside containers [bp_front/playwright.config.ts] — deferred, pre-existing

- [x] [Review][Defer] webServer no stdout/stderr filter — on startup failure Playwright waits the full 120 s before
  surfacing the compose error [bp_front/playwright.config.ts] — deferred, pre-existing

- [x] [Review][Defer] AC1: no explicit assertion that row appears without a page reload — impractical in Playwright
  without a framenavigated listener [bp_front/e2e/admin-users.spec.ts] — deferred, impractical at current test scope

- [x] [Review][Defer] Orphaned test users from guard tests never cleaned up — accepted pattern per story dev notes;
  clean dev DB periodically [bp_front/e2e/admin-guard.spec.ts] — deferred, accepted per dev notes
