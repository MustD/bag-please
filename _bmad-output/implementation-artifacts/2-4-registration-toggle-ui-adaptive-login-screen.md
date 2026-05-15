# Story 2.4: Registration Toggle UI & Adaptive Login Screen

Status: ready-for-dev

## Story

As an admin and as a user arriving at the login screen,
I want the registration option to reflect the admin's configuration in real time,
So that user onboarding is controlled and the login screen is never in a confusing state.

## Acceptance Criteria

**AC1 — Toggle renders with current state:**
Given the admin is authenticated and navigates to `/admin/users`,
When the page renders,
Then a `Switch` with `FormControlLabel` labeled "Allow public registration" is visible,
And it reflects the current state from the backend config.

**AC2 — Enable registration:**
Given registration is currently disabled and the admin toggles the Switch on,
When the `setRegistrationEnabled(enabled: true)` mutation completes,
Then the Switch reflects the enabled state immediately,
And a visit to `/auth` now shows the "Register" link.

**AC3 — Disable registration:**
Given registration is currently enabled and the admin toggles it off,
When the `setRegistrationEnabled(enabled: false)` mutation completes,
Then the Switch reflects the disabled state immediately,
And a visit to `/auth` now hides the "Register" link.

**AC4 — Login screen: registration disabled:**
Given an unauthenticated user visits `/auth` and registration is disabled,
When the login page renders,
Then no "Register" link is shown,
And "Contact your admin to get access" text is visible below the form.

**AC5 — Login screen: registration enabled:**
Given an unauthenticated user visits `/auth` and registration is enabled,
When the login page renders,
Then the "Register" link is visible,
And no "Contact admin" text is shown.

**AC6 — Config available in app context:**
Given `GET /api/auth/config` is fetched once on app load,
When the registration state is resolved,
Then it is available in app context so the login page uses it without an additional network request.

## Tasks / Subtasks

- [ ] Task 1: Add public REST endpoint on backend (AC: 4, 5, 6)
    - [ ] In `bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt`, add `get("/auth/config")` route (no
      auth) returning `{ "registrationEnabled": Boolean }` from `appConfigService.get()`
    - [ ] Place the new route inside the existing `rateLimit` block alongside `/auth/login`

- [ ] Task 2: Add GQL operations for admin toggle (AC: 1, 2, 3)
    - [ ] Create `bp_front/src/lib/config/Queries.tsx` with `getApplicationConfigQuery` and
      `setRegistrationEnabledMutation`
    - [ ] Run `npm run generate` from `bp_front/` to regenerate `__generated__/graphql.ts` (requires backend on `:2080`
      with valid JWT in `codegen.ts`)

- [ ] Task 3: Expose `registrationEnabled` in `AuthContext` (AC: 4, 5, 6)
    - [ ] Add `getConfig: async () => fetch('/api/auth/config')...` helper to `bp_front/src/lib/auth/authApi.ts`
    - [ ] Add `registrationEnabled: boolean | null` to `AuthContextValue` in `bp_front/src/lib/auth/AuthContext.tsx`
    - [ ] In `AuthProvider` `useEffect`, fetch config in parallel with `authApi.refresh()` and set `registrationEnabled`
      state
    - [ ] Expose `registrationEnabled` via `AuthContext.Provider` value

- [ ] Task 4: Add toggle Switch to AdminUsersPage (AC: 1, 2, 3)
    - [ ] In `bp_front/src/app/admin/users/page.tsx`, add `useQuery(getApplicationConfigQuery)` to load current state
    - [ ] Add `useMutation(setRegistrationEnabledMutation)` with Apollo cache update (write back to
      `getApplicationConfigQuery` cache)
    - [ ] Render `FormControlLabel` + `Switch` labeled "Allow public registration" above the user table
    - [ ] Switch `checked` = `data?.applicationConfig?.registrationEnabled ?? false`; on `onChange` call the mutation
      immediately (no confirm dialog needed)
    - [ ] Disable Switch while mutation is in-flight

- [ ] Task 5: Make LoginPage adaptive (AC: 4, 5)
    - [ ] In `bp_front/src/app/auth/page.tsx`, read `registrationEnabled` from `useAuth()`
    - [ ] Show `<Link component={NextLink} href="/auth/register">Register</Link>` only when
      `registrationEnabled === true`
    - [ ] Show `<Typography color="text.secondary">Contact your admin to get access</Typography>` only when
      `registrationEnabled === false`
    - [ ] When `registrationEnabled` is `null` (still loading), render neither (no flash of wrong content)

- [ ] Task 6: TypeScript check (AC: all)
    - [ ] From `bp_front/`: `npx tsc --noEmit` — no new errors

## Dev Notes

### Critical Architecture Issue: Public vs. Admin-Only Config

The existing `applicationConfig` GraphQL query (`ApplicationConfigApi.kt:21`) calls `env.requireAdmin()`, meaning it is
**only accessible with a valid admin JWT**. The login page is rendered for unauthenticated users, so it cannot call this
GQL query.

**Solution:** Add a public REST endpoint `GET /api/auth/config` to `AuthRoutes.kt` (no auth). This mirrors the existing
pattern: auth REST routes bypass GQL auth entirely (same as `/auth/login`, `/auth/register`).

This story therefore has a **small backend change** (one new route, ~5 lines) in addition to the frontend work.

### Backend: New Route in `AuthRoutes.kt`

The route goes inside the existing `rateLimit(RateLimitName("auth"))` block. The function signature already receives
`appConfigService: ApplicationConfigService`. Add:

```kotlin
get("/auth/config") {
    val config = appConfigService.get()
    call.respond(HttpStatusCode.OK, mapOf("registrationEnabled" to config.registrationEnabled))
}
```

Note: `mapOf(...)` serializes fine via Jackson (already installed). No new imports needed beyond what's in the file.
No `post` — this is a read-only GET. Nginx routes `/api/*` to the backend, so the full path from the browser is
`/api/auth/config`.

### Frontend: GQL Operations File

Create `bp_front/src/lib/config/Queries.tsx`:

```tsx
import {graphql} from "@/__generated__"

export const getApplicationConfigQuery = graphql(`query GetApplicationConfig {
    applicationConfig {
        registrationEnabled
    }
}`)

export const setRegistrationEnabledMutation = graphql(`mutation SetRegistrationEnabled($enabled: Boolean!) {
    setRegistrationEnabled(enabled: $enabled) {
        registrationEnabled
    }
}`)
```

These require a valid **admin** JWT — only used from `AdminUsersPage`. The public config read for the login page is a
plain REST fetch, not GQL.

After creating this file, run codegen:

1. Ensure backend running: `docker compose up mongo router` + `../gradlew run -t` from `bp_back/`
2. Get JWT: `POST http://localhost:2080/api/auth/login` `{"username":"admin","password":"admin"}`
3. Update `codegen.ts` Authorization header with the JWT
4. `npm run generate` from `bp_front/`

### Frontend: `authApi.ts` Addition

Add alongside the existing functions:

```ts
getConfig: async (): Promise<{ registrationEnabled: boolean }> => {
  const res = await fetch('/api/auth/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
},
```

### Frontend: `AuthContext.tsx` Changes

Add `registrationEnabled: boolean | null` to:

- `AuthContextValue` interface (nullable — null means "not yet loaded")
- Default context value (null)
- `AuthProvider` component state (`useState<boolean | null>(null)`)

In the existing `useEffect`, run config fetch **in parallel** with `authApi.refresh()`:

```tsx
useEffect(() => {
  // Fetch public config (no auth needed)
  authApi.getConfig()
    .then(d => setRegistrationEnabled(d.registrationEnabled))
    .catch(() => {})  // silent — login page handles null gracefully

  // Existing auth refresh
  authApi.refresh()
    .then(({accessToken}) => { ... })
    .catch(() => {})
    .finally(() => setIsLoading(false))
}, [])
```

Note: `registrationEnabled` has its own loading state (`null` = loading). `isLoading` still tracks only auth refresh. Do
NOT add a second `setIsLoading(false)` for the config fetch — that would race with the auth one.

Expose it in the Provider value:

```tsx
<AuthContext.Provider value={{...auth, isLoading, registrationEnabled, setRegistrationEnabled, setAuth, clearAuth}}>
```

Add `setRegistrationEnabled` to the context value so `AdminUsersPage` can update it after the mutation (optional but
allows the login page to react without polling). Actually — skip this; the login page reads from context which is
already updated if the admin is on a different browser/tab. The Apollo cache update is sufficient for the admin's own
view.

### Frontend: `AdminUsersPage` Toggle Implementation

Add at the top of the component (after existing `useState` declarations):

```tsx
const {data: configData, loading: configLoading} = useQuery(getApplicationConfigQuery)
const [setRegistrationEnabled, {loading: toggleLoading}] = useMutation(setRegistrationEnabledMutation, {
  update(cache, {data: mutData}) {
    if (mutData?.setRegistrationEnabled) {
      cache.writeQuery({
        query: getApplicationConfigQuery,
        data: {applicationConfig: mutData.setRegistrationEnabled},
      })
    }
  },
})
```

Render above the "Create user" Button (not in the table):

```tsx
<Box sx={{mb: 2, display: 'flex', alignItems: 'center', gap: 2}}>
  <FormControlLabel
    control={
      <Switch
        checked={configData?.applicationConfig?.registrationEnabled ?? false}
        disabled={configLoading || toggleLoading}
        onChange={(_, checked) =>
          setRegistrationEnabled({variables: {enabled: checked}})
        }
      />
    }
    label="Allow public registration"
  />
  <Button variant="contained" onClick={() => setCreateOpen(true)}>
    Create user
  </Button>
</Box>
```

Import: `FormControlLabel, Switch` from `@mui/material`.

### Frontend: `LoginPage` Adaptive Render

Current `page.tsx` always renders `<Link href="/auth/register">Register</Link>`.

Change the bottom of the `LoginForm` component:

```tsx
const {registrationEnabled} = useAuth()

// Replace the existing Register link:
{registrationEnabled === true && (
  <Link component={NextLink} href="/auth/register">Register</Link>
)}
{registrationEnabled === false && (
  <Typography color="text.secondary" variant="body2">
    Contact your admin to get access
  </Typography>
)}
// registrationEnabled === null: render nothing (config still loading)
```

`useAuth()` is already imported. This uses the value populated in `AuthContext` by the parallel config fetch.

### What NOT to Build

- Error Snackbar/toast for toggle failures — project has no toast pattern (UX-DR13); silent failure is acceptable for
  the toggle; the Switch snaps back on error because the cache update only happens on success
- Confirmation dialog before toggling registration — not in ACs; immediate toggle is expected
- Polling the config after toggle for the login page — the login page reads from React context; an admin on the same
  browser tab would need to reload `/auth` to see the change; this is acceptable in v1
- Admin-accessible "registrationEnabled" public query (no backend GQL changes) — use the existing `applicationConfig`
  query (admin-only) for the admin toggle and a REST endpoint for the login page
- New GQL subscription for config changes — not in ACs

### File Structure

New files:

```
bp_front/src/lib/config/Queries.tsx
```

Modified files:

```
bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt  (add GET /auth/config)
bp_front/src/lib/auth/authApi.ts                                     (add getConfig)
bp_front/src/lib/auth/AuthContext.tsx                                (add registrationEnabled)
bp_front/src/app/admin/users/page.tsx                               (add toggle Switch)
bp_front/src/app/auth/page.tsx                                       (conditional Register link)
bp_front/src/__generated__/graphql.ts                               (auto-generated by npm run generate)
bp_front/src/__generated__/gql.ts                                   (auto-generated)
bp_front/src/__generated__/fragment-masking.ts                      (auto-generated)
```

### Previous Story Learnings (from 2.3)

- **Apollo cache update pattern for queries:** `cache.writeQuery({ query, data })` is the correct approach — use it for
  the `getApplicationConfigQuery` cache update after `setRegistrationEnabled` mutation
- **Import path for Apollo hooks:** `import {useQuery, useMutation} from '@apollo/client/react'` (not `@apollo/client`)
- **`@/` imports mandatory:** Never use relative `../` chains (was caught as review finding in 2.3)
- **TypeScript strict:** No explicit type annotation on `update` callbacks — let inference from typed document node
  handle it
- **`ConfirmDialog` is available** at `@/app/admin/ConfirmDialog` — not needed here (toggle is immediate, no confirm),
  but available if design changes
- **Admin layout guard** is in `bp_front/src/app/admin/layout.tsx` — AdminUsersPage is already guarded; no additional
  guard needed in this story
- **`null` data before query resolves** — always use `?? fallback` on query data (e.g.,
  `configData?.applicationConfig?.registrationEnabled ?? false`)
- **No `npm run lint` script** — use `npx tsc --noEmit` to verify TypeScript

### Git Context (Recent Work)

Last commit (`4c49e53`) implemented Story 2.3: added user management GraphQL APIs and the AdminUsersPage. The
`adminUsersPage` is fully working. The patterns established there (Apollo hooks, ConfirmDialog, cache updates) apply
directly to this story.

### References

- [epics.md §Story 2.4] — authoritative ACs (registration-toggle UI + adaptive login screen)
- [epics.md §AR2] — `applicationConfig` query and `setRegistrationEnabled` mutation are GQL (admin-only)
- [ux-design-specification.md §UX-DR2] — LoginPage: conditional Register link, "Contact admin" text when registration
  off
- [ux-design-specification.md §UX-DR6] — AdminUsersPage includes Switch with FormControlLabel for registration toggle
- [ux-design-specification.md §UX-DR11] — form patterns; no confirm dialog for toggle
- [ux-design-specification.md §UX-DR13] — no success toasts; immediate UI update confirms action
- [ux-design-specification.md §UX-DR15] — FormControlLabel provides visible text label (required for Switch
  accessibility)
- [project-context.md §Next.js/Apollo] — `useQuery`/`useMutation` from `@apollo/client/react`, `@/` path alias,
  `"use client"` required
- [project-context.md §Ktor/graphql-kotlin] — `authenticate(authMethod)` wraps all GQL routes; REST routes in
  `configureAuthRoutes` bypass GQL auth
- [AuthContext.tsx] — current `AuthState`, `useAuth()` API, `AuthProvider` useEffect pattern
- [authApi.ts] — existing `refresh()`, `login()` functions; add `getConfig()` here
- [admin/users/page.tsx] — existing AdminUsersPage to extend with toggle
- [auth/page.tsx] — existing LoginPage to extend with conditional rendering
- [AuthRoutes.kt] — add `get("/auth/config")` inside `rateLimit` block
- [ApplicationConfigApi.kt] — existing GQL query/mutation signatures
- [2-3-admin-user-management-ui.md §Dev Notes] — Apollo cache update patterns, dialog state patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
