---
baseline_commit: 13946496e2d3bc5784f553737aacf124002ed5b8
---

# Story 5.4: Admin User Management

Status: ready-for-dev

**Delivers:** FR13 (view all users), FR14 (create user), FR15 (delete user), FR16 (reset password), FR17 (explicit
confirmation before destructive actions), FR20 (registration toggle at runtime), FR30 (admin can reach the admin UI),
FR31 (non-admins denied). This is the **first Epic-5 story to consume the GraphQL API** — it introduces the first
generated operations and the first `npm run generate` run of the reframe. All admin operations are **GraphQL**, not REST
(AR2).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Decisions (settled — do not re-open)

1. **Admin operations are GraphQL (AR2), not REST.** The backend already exposes the full admin surface: `users` query,
   `applicationConfig` query, `createUser` / `deleteUser` / `resetUserPassword` / `setRegistrationEnabled` mutations
   (exact contract in Dev Notes). Consume them through the existing Apollo HTTP link. **Do not** invent REST admin
   endpoints (the UX spec's `POST /admin/users` etc. are stale Next.js-era artifacts — ignore them).
2. **This is the first codegen run of the reframe.** `src/__generated__/` currently holds the client-preset **scaffold**
   (`fragment-masking.ts`, `gql.ts`, `graphql.ts`, `index.ts`) but **no operations** (`gql.ts` has `documents = {}`; the
   `graphql()` template is already exported from there). Do **not** recreate or delete the scaffold — author operations
   with the `graphql()` tagged template and run `npm run generate` (needs the stack on `:2080` + a fresh admin
   `CODEGEN_TOKEN`) to populate it. This is the **one** story where `src/__generated__/` legitimately changes — via the
   generator only, **never** hand-edited. Regenerate after finalizing every operation; commit the generated output.
3. **Admin panel is a single route `/admin`.** `AdminPage` (replacing the placeholder) renders inside the existing
   `AdminGuard` + `AppShell`. No sub-routing. The existing `<Route path="/admin/*">` already routes `/admin` here — do
   not add nested routes or a `/admin/users` path.
4. **Admin reaches the panel via a role-gated menu item in the AppShell.** There is currently **no** navigation to
   `/admin`. Add an "Admin" `MenuItem` to the existing user menu, rendered only when `role === 'admin'` (mirror how
   "Change password" is hidden for admin). Regular users must never see it (FR31 affordance-hiding).
5. **Destructive actions are confirmation-first (FR17).** Delete and reset-password each open an explicit MUI `Dialog`;
   the action fires only from the dialog's confirm button. The reset dialog contains the **new-password field** and a
   plain-language warning that it signs the target user out of all sessions (the backend invalidates their refresh
   tokens). No Snackbars/toasts anywhere — confirmation and errors are inline/in-dialog (project UX rule).
6. **The users table shows regular users only.** The backend `users` query returns non-admin accounts (the admin has no
   `users` collection row — FR18). So the admin never appears in the table and cannot self-delete. Never assert on a
   total row count in tests — the shared DB holds users from other runs.
7. **"Toggle reflected immediately on the auth page" is already satisfied by the existing config fetch.** `AuthPage`
   re-reads `GET /api/auth/config` on every mount (`bp_front/src/routes/AuthPage.tsx:57-75`), so a fresh `/auth` load
   after the admin flips the switch reflects the new state with no code change. The toggle mutation is
   `setRegistrationEnabled(enabled)`; read the current value from `applicationConfig.registrationEnabled`.
8. **FR9 automated expiry-path E2E remains out of scope here (but note the shift).** 5.4 is the first query-bearing
   story, so the `users` query firing with an expired token now *organically* exercises the Apollo 401→refresh path
   (`ApolloProvider.tsx:55-95` clears auth as expired; `RouteGuard` owns the resulting `/auth?expired=1` redirect —
   single redirect owner, no nav race). 5.4's ACs (FR13–17, FR20, FR30, FR31) do **not**
   include FR9, so do not build the FR9 E2E unless `md` asks (see Open Question at the end). Do not regress the existing
   error-link behavior.

## Story

As an admin, I want to manage user accounts and the registration toggle, so that I can control the user base.

## Acceptance Criteria

1. **Admin route access (FR30).** An authenticated **admin** can reach the admin panel at `/admin`. An "Admin" entry in
   the AppShell user menu (visible only when `role === 'admin'`) navigates there. Navigating to `/admin` as admin
   renders the panel.
2. **Non-admin denial (FR31).** A non-admin (`role === 'user'`) is denied `/admin`: the existing `AdminGuard` redirects
   them to `/` (`replace`), and the "Admin" menu item is **absent** from their user menu. (No new guard logic — reuse
   `AdminGuard`; only add the menu affordance.)
3. **Users table (FR13).** The panel lists all regular user accounts returned by the `users` query, each showing
   **username** and **role**, in a MUI `Table` (or list) with row-level action controls. A **loading** state is shown
   while the query is in flight and an **empty** state when there are zero users; a query error is surfaced inline (not
   a toast) and does not crash the panel.
4. **Create user (FR14).** A "Create user" affordance opens a dialog with **username** and **initial password** fields.
   Submitting calls the `createUser(username, password)` mutation; on success the dialog closes and the new user appears
   in the table (refetch or cache update — no full page reload). Empty username/password are blocked client-side with
   inline field errors before any request (mirror the 5.2/5.3 validate-on-submit pattern). A backend failure (e.g.
   duplicate/reserved username → GraphQL `CONFLICT` "Username already taken") is surfaced inline **in the dialog**; the
   dialog stays open and fields are not cleared.
5. **Delete user with confirmation (FR15, FR17).** A row-level delete control opens a confirmation `Dialog` naming the
   user and stating the consequence in plain language. Only the dialog's confirm button fires
   `deleteUser(id)`; Cancel closes it with no effect. On success the user is removed from the table. A backend error
   (e.g. `NOT_FOUND`) is surfaced inline; the row is not optimistically removed before success.
6. **Reset password with confirmation (FR16, FR17).** A row-level reset control opens a `Dialog` containing a
   **new-password** field and a **warning** that the reset signs the user out of all sessions. Confirm fires
   `resetUserPassword(id, newPassword)`; an empty new password is blocked client-side. On success the dialog closes with
   an inline confirmation (no toast). Cancel closes with no effect.
7. **Registration toggle (FR20, ties FR21).** A `Switch` reflects the current `applicationConfig.registrationEnabled`
   and toggling it calls `setRegistrationEnabled(enabled)`. The switch shows the resolved state (guard the
   still-loading/`null` case — do not render "off" while loading, per the 5.2 null-vs-false learning). After the
   mutation resolves, the switch reflects the confirmed value. The effect on `/auth` (Register link hidden when
   disabled) is verified via the auth page's existing fresh config fetch — **no** change to `AuthPage`/`authApi` is
   required.
8. **Error & feedback conventions.** All mutation/query errors are surfaced inline (dialog error region or a panel-level
   alert region) using the GraphQL error `message`; **never** a Snackbar/toast. Destructive actions never execute
   without an explicit confirm click. In-flight controls show a disabled/loading state and are guarded against same-tick
   double-submit (`if (loading) return`) — the 5.2/5.3 pattern.
9. **Accessibility & no-shift.** Dialog fields have visible associated labels; Enter submits dialog forms
   (`<form onSubmit>`); dialogs are keyboard-navigable and focus-managed (MUI `Dialog` defaults); field errors are
   programmatically associated; the panel renders with no perceptible layout shift on the mobile (Pixel 7) viewport
   (NFR10, NFR13–NFR16). Style via theme + `sx` only.
10. **No backend changes; GraphQL only via codegen.** No files under `bp_back/` change. All new GraphQL operations live
    in the frontend and are typed through `npm run generate`; `src/__generated__/` is regenerated (not hand-edited) and
    committed.
11. **E2E (Playwright, UI-driven, FR-mapped, dual chromium + mobile).** A new spec (e.g.
    `bp_front/e2e/admin.spec.ts`), all UI-driven (no API shortcuts for asserted behavior), FR-tagged in test names,
    green on both `chromium` and `mobile`:
    - **Create → login (FR13/FR14):** admin logs in → opens `/admin` via the menu → creates a **unique** user → asserts
      the user's row appears in the table → in a fresh context, that user **logs in** successfully.
    - **Reset password (FR16/FR17):** admin resets that user's password via the confirm dialog → in a fresh context the
      user logs in with the **new** password (and the old password fails).
    - **Delete (FR15/FR17):** admin deletes that user via the confirm dialog → the user's row disappears from the table.
    - **Registration toggle (FR20/FR21):** admin toggles registration **off** → a fresh unauthenticated `/auth` load
      hides the Register link (`to-register-link` absent, `contact-admin` present) → admin toggles it back **on** → a
      fresh `/auth` load shows the Register link again. **Always restore to ON** (see the shared-flag hazard in Testing
      Standards).
    - **Non-admin blocked (FR30/FR31):** a freshly-registered regular user has no "Admin" menu item and a direct visit
      to
      `/admin` redirects to `/`.
    - Assert only on data this test created (unique usernames); never assert total table counts.

## Tasks / Subtasks

- [ ] **Task 1 — Define GraphQL operations & run first codegen (AC: 3, 4, 5, 6, 7, 10)**
    - [ ] Create a frontend operations module for admin ops (suggested: `bp_front/src/lib/admin/adminQueries.ts` — a new
      `lib/admin/` slice). Define with the `graphql()` tagged template imported from `@/__generated__`:
        - `query AdminUsers { users { id username role } }`
        - `query AdminConfig { applicationConfig { registrationEnabled } }`
        -
        `mutation CreateUser($username: String!, $password: String!) { createUser(username: $username, password: $password) { id username role } }`
        - `mutation DeleteUser($id: ID!) { deleteUser(id: $id) { id } }`
        -
        `mutation ResetUserPassword($id: ID!, $newPassword: String!) { resetUserPassword(id: $id, newPassword: $newPassword) { id } }`
        -
        `mutation SetRegistrationEnabled($enabled: Boolean!) { setRegistrationEnabled(enabled: $enabled) { registrationEnabled } }`
    - [ ] Start the full stack (`docker compose up -d --build`), mint a fresh admin token, and run codegen:
      `CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate`
      Verify `src/__generated__/graphql.ts` now contains `User`, `ApplicationConfig`, and the operation types. Commit
      the generated files. **Never hand-edit** them.
    - [ ] Use the generated typed documents in the page via `useQuery`/`useMutation` from `@apollo/client/react`. All
      GraphQL types come from `@/__generated__` — no inline response/variable types (project rule).

- [ ] **Task 2 — Admin navigation affordance (AC: 1, 2)**
    - [ ] In `bp_front/src/components/AppShell.tsx`, add an "Admin" `MenuItem` to the existing user `Menu`, rendered
      only when `role === 'admin'` (e.g.
      `{role === 'admin' && <MenuItem data-testid="menu-admin" onClick={() => { closeMenu(); navigate('/admin') }}>…</MenuItem>}`).
      Give it an icon consistent with the existing items (e.g. `AdminPanelSettingsIcon` from `@mui/icons-material`).
      Keep
      "Logout" always present; keep "Change password" hidden-for-admin behavior unchanged.
    - [ ] Do **not** change `AdminGuard` — it already redirects non-admins to `/` and renders `null` otherwise. It sits
      inside `RouteGuard`, so auth is resolved before it runs (FR31).

- [ ] **Task 3 — Admin panel: users table + registration toggle (AC: 3, 7, 8, 9)**
    - [ ] Replace the `AdminPage` placeholder (`bp_front/src/routes/AdminPage.tsx`) with the real panel: keep
      `data-testid="admin-page"` on the root. Layout inside `AppShell` (top AppBar already present) — a `Paper`-wrapped
      section per the UX reference (calm, confirmation-first admin).
    - [ ] **Registration toggle section:** `useQuery(AdminConfig)`; render an MUI `Switch` (with label) bound to
      `applicationConfig.registrationEnabled`. Guard the loading/`null` state (no "off" flash). `onChange` →
      `useMutation(SetRegistrationEnabled)` with `{ enabled }`; reflect the confirmed returned value; disable while
      in-flight. `data-testid="registration-toggle"` on the switch input.
    - [ ] **Users table:** `useQuery(AdminUsers)`; render an MUI `Table` of username + role with a per-row actions cell
      (reset, delete `IconButton`s). Handle **loading** (`data-testid="admin-users-loading"`), **empty**
      (`data-testid="admin-users-empty"`), and **error** (inline alert region, not a toast) states. Give each row
      `data-testid={`admin-user-row-${user.username}`}` so E2E can scope by the unique username it created.
    - [ ] Provide a "Create user" button (`data-testid="admin-create-user-button"`) that opens the create dialog (Task
      4).

- [ ] **Task 4 — Create / Delete / Reset dialogs (AC: 4, 5, 6, 8, 9)**
    - [ ] **Create dialog** (MUI `Dialog` + `<form onSubmit>`): username + password `TextField`s (controlled state,
      validate-on-submit; empty → inline field errors, no request). Submit → `CreateUser` mutation; on success close +
      refresh the `users` query (refetch or `update` the cache) and show the new row. On error surface the GraphQL
      `message` in an in-dialog alert region; keep the dialog open, fields intact. Same-tick re-entry guard + loading
      spinner on the submit button. testids: `create-user-dialog`, `create-user-username`, `create-user-password`,
      `create-user-submit`, `create-user-cancel`, `create-user-error`.
    - [ ] **Delete dialog:** confirmation `Dialog` naming the user + plain-language consequence; Confirm → `DeleteUser`
      with the row's `id`; on success close + remove from table (refetch or cache evict). Cancel closes, no effect.
      Error inline. testids: `delete-user-dialog`, `delete-user-confirm`, `delete-user-cancel`; the row's control:
      `delete-user-button` (scoped within the row testid).
    - [ ] **Reset dialog:** `Dialog` with a `type="password"` new-password field + a warning line ("This signs
      {username} out of all sessions."); validate non-empty; Confirm → `ResetUserPassword(id, newPassword)`; on success
      close + inline confirmation. Cancel closes, no effect. Error inline. testids: `reset-password-dialog`,
      `reset-password-input`, `reset-password-confirm`, `reset-password-cancel`; row control: `reset-password-button`.
    - [ ] All dialog buttons/fields: MUI `sx`/theme only; correct `autoComplete` (`new-password` for the create/reset
      password fields); `slotProps={{ htmlInput: { 'data-testid': … } }}` for inputs (v9 slot API, matches 5.2/5.3).

- [ ] **Task 5 — E2E tests (AC: 11)**
    - [ ] Manually exercise every flow in a real browser against the `:2080` Caddy stack first (reframe rule 1); note
      discovered steps.
    - [ ] Add `bp_front/e2e/admin.spec.ts` with the five scenarios in AC #11, all UI-driven via `getByTestId`, FR-tagged
      in test names. Admin logs in with `admin/admin` (guaranteed first-boot account). Create each managed user with a
      **unique** username per run/project (`admin_e2e_${label}_${test.info().project.name}_${Date.now()}`); assert on
      that row only.
    - [ ] For "user logs in" / "logs in with new password" assertions, use a **fresh browser context**
      (`browser.newContext()`) so the admin session isn't disturbed. Log in via the auth UI (no API shortcut).
    - [ ] For the registration-toggle scenario: after toggling off and asserting `/auth` hides the Register link,
      **toggle it back on** and assert it returns — and put the restore in a path that runs even on failure (see Testing
      Standards shared-flag hazard). Reuse `e2e/global-setup.ts` (registration enabled idempotently); no new global
      setup.
    - [ ] Run `npm run test:e2e`; confirm green on both `chromium` and `mobile`. Re-run the existing suite to confirm no
      regression from the AppShell menu change (5.3 `account.spec.ts` admin scenario still passes: `menu-admin` present
      is additive, `menu-change-password` still absent for admin).

- [ ] **Task 6 — Verification & housekeeping**
    - [ ] `npm run lint` clean; `npm run build` (tsc strict + vite) passes.
    - [ ] Confirm **no `bp_back/` files changed**; `src/__generated__/` changed **only** via `npm run generate` (and
      committed).
    - [ ] Manual real-browser pass of all admin features on the `:2080` stack before marking review.

## Dev Notes

### Scope & non-negotiable constraints (Epic 5 standing rules)

- **Do NOT modify backend code.** The admin GraphQL surface and the `/api/auth/config` REST endpoint are consumed as-is.
  If you believe a backend change is needed, STOP and confirm with
  `md`. [Source: epics.md#Epic-5 standing constraints lines 1707–1727]
- **Every feature ships a real-browser Playwright E2E** you manually exercised first; UI-driven, FR-mapped, green on
  chromium + mobile.
- **Auth tokens:** access token in memory (React context) only; refresh via httpOnly cookie; never `localStorage`.
- **Styling:** MUI theme + `sx` only. Dark theme (`bp_front/src/theme.ts`): bg `#000`, paper `#1C1C1E`, primary teal
  `#4DC9BB`, success `#30D158`, error `#FF453A`, warning `#FFD60A`. `theme.custom.bp.*` tokens available.
- **No `console.log` in components** (only `ApolloProvider` logs GraphQL/network errors intentionally). No `style={{}}`,
  no CSS modules. One default export per file; PascalCase component files.

### The backend admin GraphQL surface (consume as-is — the exact contract)

All operations **require the admin role**; a non-admin or missing principal throws
`GraphQLForbiddenException("Forbidden")` with `extensions.code === "FORBIDDEN"`. [Source:
bp_back .../entity/user/gql/UserAdminApi.kt, .../config/gql/ApplicationConfigApi.kt]

Types:

- `type User { id: ID!, username: String!, role: String! }` (`role` is a plain `String`: `"user"` or
  `"admin"`). [Source:
  bp_back .../entity/user/gql/GqlUser.kt]
- `type ApplicationConfig { registrationEnabled: Boolean! }`. [Source: bp_back .../config/gql/GqlApplicationConfig.kt]

Queries:

- `users: [User!]!` — **regular users only** (admin isn't stored in the DB,
  FR18). [Source: UserAdminApi.kt:28-32, UserService.getAllRegularUsers → UserRepository.getAll]
- `applicationConfig: ApplicationConfig!`. [Source: ApplicationConfigApi.kt:20-25]

Mutations (all return the affected entity):

- `createUser(username: String!, password: String!): User!` — **any** failure (duplicate key **or** reserved `admin`
  username) surfaces as `extensions.code === "CONFLICT"`, message **"Username already taken"**. There is **no**
  server-side empty-field or password-length check — so do client-side required-field validation. [Source:
  UserAdminApi.kt:39-45, UserService.adminCreateUser:70-83]
- `deleteUser(id: ID!): User!` — bad UUID → `BAD_USER_INPUT` "Invalid user ID format"; unknown id → `NOT_FOUND` "User
  not found". **Side effect:** invalidates the deleted user's sessions (revokes refresh tokens). [Source:
  UserAdminApi.kt:47-61]
- `resetUserPassword(id: ID!, newPassword: String!): User!` — same id errors. **Side effect:** invalidates the target
  user's sessions — this is why the reset dialog warns about sign-out. [Source: UserAdminApi.kt:63-77]
- `setRegistrationEnabled(enabled: Boolean!): ApplicationConfig!` — persists the flag and refreshes the service's
  in-memory cache (`ApplicationConfigService` holds the config in an `AtomicReference`; only the cold read hits MongoDB,
  and `update()` refreshes the cache in-process). Because it's a single backend process with one shared cache, a later
  `/api/auth/config` read reflects the new value
  immediately. [Source: ApplicationConfigApi.kt:28-35, ApplicationConfigService.kt:6-15] Confirmed working via the
  existing E2E global-setup, which already issues this exact mutation. [Source: bp_front/e2e/global-setup.ts:41-50]

**GraphQL error handling in Apollo:** these are resolver exceptions → `data` null, `errors[]` populated. In Apollo
Client 4, catch via `CombinedGraphQLErrors.is(error)` — `error.errors[].message` and `error.errors[].extensions.code`
(codes: `FORBIDDEN`, `CONFLICT`, `NOT_FOUND`, `BAD_USER_INPUT`). Surface `message` inline (dialog/panel alert); never a
toast. [Source: bp_back .../plugins (Java) GraphQL*Exception.java; bp_front/src/lib/apollo/ApolloProvider.tsx:97-104]

### The registration toggle ↔ auth page linkage (no AuthPage change needed)

- Read current value from the `applicationConfig` query; write via `setRegistrationEnabled`.
- The public read used by the login screen is a **separate** REST endpoint: `GET /api/auth/config` →
  `{ registrationEnabled }` (unauthenticated). [Source: bp_back .../features/auth/AuthRoutes.kt:40-43]
- `AuthPage` already re-fetches `/api/auth/config` on every mount and shows/hides the Register link accordingly
  (`canRegister`), with `contact-admin` copy when disabled. So "reflected immediately" needs **no** frontend change —
  the E2E just loads a fresh `/auth` after
  toggling. [Source: bp_front/src/routes/AuthPage.tsx:52-75, 295-334; authApi.getConfig bp_front/src/lib/auth/authApi.ts:79-83]

### Existing code to touch (READ before editing)

- `bp_front/src/routes/AdminPage.tsx` — **placeholder** (`data-testid="admin-page"` + "Admin" heading). Replace its body
  with the real panel; keep the root testid.
- `bp_front/src/routes/AdminGuard.tsx` — **do not change.** Already redirects `role !== 'admin'` to `/` (`replace`) and
  renders `null` otherwise. It's inside `RouteGuard`, so `role` is resolved (FR31). [Source: AdminGuard.tsx]
- `bp_front/src/components/AppShell.tsx` — add the role-gated "Admin" `MenuItem` to the existing `Menu` (Task 2). Follow
  the existing `MenuItem` structure (`ListItemIcon` + `ListItemText`, `data-testid`). Do not disturb the
  hidden-for-admin "Change password" item or the always-present "Logout". [Source: AppShell.tsx:108-130]
- `bp_front/src/App.tsx` — routing is already correct: `/admin/*` → `<AdminGuard><AdminPage/></AdminGuard>` inside
  `RouteGuard`+`AppShell`. **No routing change needed.** [Source: App.tsx:23]
- `bp_front/src/lib/apollo/ApolloProvider.tsx` — the single Apollo client (split link + auth link + 401 error link) is
  already wired. **Do not** create a second client. Just `useQuery`/`useMutation`. The access token is injected by the
  auth link automatically. [Source: ApolloProvider.tsx]
- `bp_front/src/lib/auth/AuthContext.tsx` — `useAuth()` gives `role`/`username`/`accessToken`. Use `role === 'admin'`
  for the nav gate. [Source: AuthContext.tsx]

### GraphQL operations & codegen (client-preset)

- Operations are authored with the `graphql()` tagged template imported from `@/__generated__` and are discovered by
  codegen scanning `src/**/*.{ts,tsx}` (`codegen.ts` `documents`). Put them in a dedicated module (`lib/admin/`), not
  inline in the component, for a clean single source. [Source: bp_front/codegen.ts:24; client-preset]
- `npm run generate` needs the full stack on `:2080` and a fresh admin `CODEGEN_TOKEN` (access tokens ~15 min). The
  exact command is in Task 1 and in `codegen.ts`'s header
  comment. [Source: codegen.ts:1-14, CLAUDE.md#GraphQL schema management]
- The generated dir currently holds the client-preset scaffold (`fragment-masking.ts`, `gql.ts`, `graphql.ts`,
  `index.ts`) with **no operations** (`documents = {}`). After codegen it will also contain the schema types + typed
  documents. Commit it; never hand-edit. [Source: memory: never edit
  `src/__generated__/`; verified scaffold-only, zero operations]
- Apollo Client `4.1.9` + `@apollo/client/react` — import `useQuery`/`useMutation` from `@apollo/client/react` (v4 split
  entry points, as `ApolloProvider.tsx` already does for `ApolloProvider`). Consult the `mcp__mui-mcp__*` tools for MUI
  `Dialog`/`Table`/`Switch`/`IconButton` v9 APIs before writing (do not guess v5/v6).

### Forms & UX pattern (copy the Story 5.2/5.3 conventions exactly)

Manual controlled state (no react-hook-form): `useState` per field, `fieldErrors` object, top-level error string,
`loading` boolean. Controlled `TextField` with `error`/`helperText={fieldErrors.x ?? ' '}` (space keeps layout stable,
AC #9). Same-tick re-entry guard `if (loading) return`; wrap each mutation in `try/catch/finally`; **real `catch`** that
sets the inline error (5.2 shipped a bug from a missing catch). Errors in `role="alert"` regions / MUI `<Alert>` —
**never** Snackbars/toasts. Enter submits via native `<form onSubmit>` inside each dialog. [Source:
bp_front/src/routes/AuthPage.tsx, ChangePasswordPage.tsx; Story 5.3 Previous Story Intelligence]

### UX reference (visual/interaction only)

- Admin panel: MUI `Table` + row-level `IconButton` actions; confirmation dialogs with plain-language copy before
  destructive actions; registration `Switch` with immediate feedback; `Paper`-wrapped table. [Source:
  ux-design-specification.md lines 201-205, 231, 489; Journey 3 lines 537-570] The spec's REST endpoint references
  (`POST /admin/users`, `PUT /admin/config`) are **stale** — the real backend is GraphQL (Decision #1).
- Username-in-AppBar identity is already delivered by 5.3's `AppShell`; the admin panel lives below it.

### Testing standards summary

- Playwright config `bp_front/playwright.config.ts`: runs against the **production Caddy stack on `:2080`**
  (`webServer` runs `docker compose up -d --build`); two mandatory projects `chromium` + `mobile` (Pixel 7); `baseURL`
  `http://localhost:2080`; `globalSetup: ./e2e/global-setup.ts` (enables registration idempotently via admin login + the
  `setRegistrationEnabled` GQL mutation). Reuse it. [Source: playwright.config.ts, e2e/global-setup.ts]
- **No login fixture/storageState exists.** Log in via the UI in-test. Admin uses `admin/admin`. Managed users use a
  unique username per run/project (`admin_e2e_${label}_${test.info().project.name}_${Date.now()}` — a distinct prefix
  from the existing `acct_e2e_`/`mia_e2e_` specs) — the `./db/data` volume persists across runs and the two projects run
  concurrently. Assert only on your own data; **never** assert total table
  counts. [Source: e2e/account.spec.ts:15-32 conventions]
- Use `browser.newContext()` for the "managed user logs in" assertions so the admin session is
  untouched. [Standard Playwright multi-context]
- **⚠️ Shared-state hazard — the registration flag is global.** `setRegistrationEnabled` mutates one shared backend
  document, and the two projects (chromium + mobile) run concurrently against the same `:2080` backend and `./db/data`.
  Toggling registration **off** in one project can transiently break the register-based scenarios in `auth.spec.ts` /
  `account.spec.ts` running in the other project. Mitigations (do all):
    1. Keep the "off" window as small as possible — toggle off, do the single fresh-`/auth` assertion, toggle back on
       immediately.
    2. **Always restore to ON**, even on failure (put the re-enable in a `try/finally` around the off-assertion, or an
       `afterEach`/`afterAll` that force-enables via the admin UI). `global-setup` only runs once at suite start, so a
       left-off flag would break subsequent files.
    3. Prefer asserting the toggle's *auth-page effect* in the **same** context/project rather than relying on
       isolation. This mirrors the documented "tests run against shared backend state" limitation in
       `project-context.md#Testing Rules`. If flakiness persists, flag it to `md` rather than weakening the assertion.
- E2E must be UI-driven (no API shortcuts for asserted behavior) and FR-mapped in the test title. [Source:
  epics.md#Epic-5 constraints; memory: E2E-in-epics rule]

### Project Structure Notes

- New files (suggested): `bp_front/src/lib/admin/adminQueries.ts` (or `.tsx`), `bp_front/e2e/admin.spec.ts`. Optional:
  extract dialogs into `bp_front/src/components/` (e.g. `ConfirmDialog.tsx`, `CreateUserDialog.tsx`) if `AdminPage`
  grows large — one default export per file.
- Modified files: `bp_front/src/routes/AdminPage.tsx` (real panel), `bp_front/src/components/AppShell.tsx` (admin menu
  item), `bp_front/src/__generated__/**` (regenerated by codegen — committed, not hand-edited).
- No routing change to `App.tsx`; no `AdminGuard`/`RouteGuard` change; no `AuthPage`/`authApi` change.

### References

- [Source: epics.md#Story 5.4 lines 1791–1808] — story statement, ACs, E2E.
- [Source: epics.md#Epic 5 standing constraints lines 1707–1727] — backend-frozen, E2E-mandatory, tokens, design ref.
- [Source: epics.md#Functional Requirements lines 40–62] — FR13–FR17, FR20, FR21, FR30, FR31 (and FR18 admin-not-in-DB).
- [Source: epics.md#Additional Requirements AR2 lines 141–144] — admin ops are GraphQL; auth is REST.
- [Source: architecture.md#Frontend Reframe (Epic 5) lines 842–876] — Vite+MUI+Caddy topology, admin guard `/admin/*`,
  codegen retargeted, backend unchanged.
- [Source: ux-design-specification.md lines 201–205, 231, 489; Journeys 2–3 lines 516–570, 615–625] — admin panel
  table/dialog/toggle patterns (visual reference; REST endpoints stale).
- [Source: bp_back .../entity/user/gql/UserAdminApi.kt, GqlUser.kt; .../config/gql/ApplicationConfigApi.kt, GqlApplicationConfig.kt; .../entity/user/UserService.kt:68-96] —
  exact GraphQL admin contract + error semantics + session-invalidation side effects.
- [Source: bp_back .../features/auth/AuthRoutes.kt:40-43] — public `GET /api/auth/config`.
- [Source: bp_back .../plugins/GraphQL*Exception.java] — error `extensions.code` values (FORBIDDEN/CONFLICT/NOT_FOUND/
  BAD_USER_INPUT).
- [Source: bp_front/src/routes/AdminPage.tsx, AdminGuard.tsx, components/AppShell.tsx, App.tsx, lib/apollo/ApolloProvider.tsx, lib/auth/AuthContext.tsx, routes/AuthPage.tsx, lib/auth/authApi.ts] —
  files to touch/mirror/leave-alone.
- [Source: bp_front/codegen.ts, package.json] — codegen config + `npm run generate`; deps (Apollo 4.1.9, MUI 9.0.0,
  react-router 7, Playwright).
- [Source: bp_front/e2e/global-setup.ts, account.spec.ts, playwright.config.ts] — E2E harness, conventions, and the
  proven `setRegistrationEnabled` GQL call.

## Previous Story Intelligence (Story 5.3)

Learnings from 5.3 (User Account) and its code review — apply directly:

- **`useAuth().role` is JWT-derived and already resolved inside the guarded subtree** — no `me` query, no loading flash.
  Use it for the admin nav gate and trust it (RouteGuard gates rendering until auth resolves). [Source: 5-3 Dev Notes]
- **Real `catch` on every async branch + same-tick re-entry guard** — 5.2 shipped a bug from a missing catch and a
  double-submit; 5.3 held the bar. Your dialogs' submit handlers need both.
- **Don't bucket a loading (`null`) state with `false`** — the registration `Switch` must not render "off" while the
  `applicationConfig` query is still loading (5.2's `registrationEnabled === null` learning).
- **No success toasts** — mutations are confirmed inline (dialog closes / row updates / inline confirmation). This is a
  hard project UX rule reaffirmed in every prior story.
- **`helperText ?? ' '`** reserves vertical space to avoid layout shift (AC #9). Long usernames: `Typography noWrap` +
  `maxWidth` (5.3 app-bar chip fix) if you echo usernames anywhere.
- **E2E must genuinely prove the branch** (new password logs in AND old fails; row present then absent), UI-driven,
  FR-mapped; 5.3 held **20/20 green on chromium + mobile**. Hold that bar.
- **Manual-exercise-first caught real bugs in 5.2/5.3.** Do the manual browser pass before writing the E2E.

## Git Intelligence Summary

Recent commits confirm the Epic-5 reframe is a from-scratch Vite/MUI/Caddy frontend, backend untouched:

- `1394649 feat(auth): add password change functionality with clean sign-out flow` — **Story 5.3** (immediate
  predecessor; the `AppShell`, user menu, and E2E harness you build on). This is the `baseline_commit`.
- `6117817 feat(auth): implement single-page authentication UI …` — Story 5.2 (auth UI, `authApi`, `AuthPage`).
- `6b141e3`, `a3fdd35`, `3433bf8`, `51fcc32` — reframe groundwork (Caddy edge, removed Next.js/nginx, Vite/MUI
  scaffold).

Takeaway: the old Next.js/nginx patterns and the REST-admin references in `project-context.md` / the UX spec are
**stale** for the frontend. Follow the *actual* `bp_front` Vite code and the GraphQL admin contract above. Backend rules
in `project-context.md` remain valid but you won't touch the backend.

## Latest Tech Information

Pinned versions in `bp_front/package.json` (use these APIs, not older-major memory):

- React `19.2.5`, react-dom `19.2.5`.
- **`@apollo/client` `4.1.9`** — import `useQuery`/`useMutation` from `@apollo/client/react`; error handling via
  `CombinedGraphQLErrors.is(error)` → `error.errors[].message` / `.extensions.code`. Single client already provided by
  `ApolloProvider.tsx` — never instantiate another.
- **`@graphql-codegen/cli` `7.0.0` + `@graphql-codegen/client-preset` `6.0.0`** — `graphql()` tagged template from
  `@/__generated__`; `npm run generate` with a live schema on `:2080` + `CODEGEN_TOKEN`.
- **MUI `@mui/material` `9.0.0`**, `@mui/icons-material` `9.0.0` — consult `mcp__mui-mcp__fetchDocs` /
  `mcp__mui-mcp__useMuiDocs` for v9 `Dialog`, `Table`/`TableRow`/`TableCell`, `Switch`, `IconButton`, `Paper` APIs.
  Inputs use `slotProps={{ htmlInput: { 'data-testid' } }}` (v9 slot API), not legacy `inputProps`.
- **react-router-dom `^7.9.0`** — `useNavigate` for the admin-menu navigation; routing already in place.
- TypeScript `6.0.3` strict — no `any`, fully typed props, `@/*` path alias → `src/*`.
- `@playwright/test` `^1.60.0` — `getByTestId`, `browser.newContext()`, per-project `test.info().project.name`.

## Project Context Reference

- Project rules: `/home/md/projects/bag-please/_bmad-output/project-context.md` — **frontend section is stale** (it
  documents the removed Next.js/nginx stack and localStorage tokens). Its **backend** rules still apply but are out of
  scope here. Trust the live `bp_front` Vite code and this story for frontend guidance.
- Repo guidance: `/home/md/projects/bag-please/CLAUDE.md` — current Vite/MUI/Caddy architecture; `npm run generate`
  command; temp files under `.tmp/<session-id>/`.
- Memory notes: E2E must be UI-driven and FR-mapped in UI epics; access token is in-memory (not `localStorage`); `admin`
  is blocked from *list* ops (not relevant here — admin owns user management); never hand-edit `src/__generated__/`
  (regenerate via `npm run generate`).

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. Status set to `ready-for-dev`.

**Open question for `md` (does not block dev):** 5.4 is the first query-bearing Epic-5 story, so the deferred **FR9**
automated E2E (401 → silent refresh → `/auth?expired=1`) is now *organically* exercisable via the `users` query with an
expired token. FR9 is **not** in 5.4's AC set (FR13–17, FR20, FR30, FR31), so it is left deferred. Confirm whether to
discharge that debt here or keep it filed for a later story.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
