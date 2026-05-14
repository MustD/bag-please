# Story 1.3: Frontend Theme & Auth Infrastructure

Status: done

## Story

As a user of the app,
I want the application to have a consistent visual identity and to keep me signed in transparently,
so that the app feels polished and authentication is invisible during normal use.

## Acceptance Criteria

1. **AC1 — Theme applied globally:** Any page loads with background `#0e0e10`, primary accent `#4db6a8`, Inter font.
   All MUI Buttons render with sentence-case text (`textTransform: "none"`) and `borderRadius: 6`. No visual style
   (colour, typography, border, shadow) is applied via inline `sx` in component files — only layout/spacing `sx` is
   used. `ThemeProvider` is registered in root layout — no per-component theme import needed.

2. **AC2 — Silent 401 + refresh:** When a GraphQL HTTP request returns 401 and a valid refresh cookie exists,
   the frontend silently calls `POST /api/auth/refresh`, retries the original request with the new access token.
   The user sees no loading state or interruption.

3. **AC3 — Refresh failure → redirect:** When the refresh attempt fails (expired or absent refresh cookie),
   auth context is cleared (username and role set to null), and the user is redirected to `/auth?expired=1`.

4. **AC4 — Logout wiring:** When the logout action fires, `POST /api/auth/logout` is called, the access token is
   removed from auth context, and the user is immediately redirected to `/auth`.

5. **AC5 — Auth route guard:** An unauthenticated user navigating to any route other than `/auth` or
   `/auth/register` is redirected to `/auth`. While the initial session-restore attempt is in progress, the guard
   renders nothing (no flash of protected content or premature redirect).

6. **AC6 — Theme globally available:** ThemeProvider registered in root layout — any page renders with the custom
   theme without a per-component import.

## Tasks / Subtasks

- [x] Task 1: Create `src/lib/theme.ts` — full dark theme (AC: 1, 6)
    - [x] Replace existing `src/app/theme.ts` content with the full theme at new path `src/lib/theme.ts`
    - [x] Delete `src/app/theme.ts` after updating the import in `layout.tsx`
    - [x] Palette: `mode: "dark"`, `background.default #0e0e10`, `background.paper #1a1a1d`,
      `primary.main #4db6a8`, `primary.dark #3a9d96`, `error.main #d9534f`, `text.primary #e8e8e8`,
      `text.secondary #9e9e9e`, `divider #2e2e32`
    - [x] Typography: Inter loaded via `next/font/google` (subsets: `['latin']`); `fontFamily: inter.style.fontFamily`
    - [x] Component defaults in `theme.components`:
        - `MuiButton`: `styleOverrides.root` → `{ borderRadius: 6, textTransform: "none" }`
        - `MuiTextField`: `defaultProps` → `{ variant: "outlined" }`
        - `MuiPaper`: `styleOverrides.root` → `{ border: "1px solid", borderColor: "#2e2e32" }`
        - `MuiAppBar`: `defaultProps` → `{ elevation: 0 }`

- [x] Task 2: Create `src/lib/auth/AuthContext.tsx` (AC: 2, 3, 4, 5)
    - [x] Define `AuthState` interface:
      `{ username: string | null, role: "admin" | "user" | null, accessToken: string | null }`
    - [x] Define `AuthContextValue` interface extending `AuthState` with `setAuth(state: AuthState): void`,
      `clearAuth(): void`, `isLoading: boolean`
    - [x] Create `AuthContext` via `createContext<AuthContextValue>` with a sensible default (all null, isLoading true)
    - [x] Create `AuthProvider` component:
        - Uses `useState` for auth state, initialized to `{ username: null, role: null, accessToken: null }`
        - Uses `useState<boolean>` for `isLoading`, initialized to `true`
        - In `useEffect([])` (mount only): calls `authApi.refresh()`, on success parses JWT with `parseJwt()` to
          extract `username` and `role`, calls `setAuth()`; on any failure just sets `isLoading = false`; finally
          always sets `isLoading = false`
        - `setAuth` replaces the entire state; `clearAuth` sets everything to null and `isLoading = false`
        - Exposes `useAuth()` hook: `export function useAuth(): AuthContextValue { return useContext(AuthContext) }`
    - [x] Add `parseJwt(token: string): { username: string, role: string }` utility (file-local, not exported):
      decodes JWT payload via `atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))` and `JSON.parse`
    - [x] Components ALWAYS call `useAuth()` — never `useContext(AuthContext)` directly

- [x] Task 3: Create `src/lib/auth/authApi.ts` (AC: 2, 3, 4)
    - [x] `login(username: string, password: string): Promise<{ accessToken: string, username: string, role: string }>`
      — POST `/api/auth/login`, throws on non-OK
    - [x] `logout(): Promise<void>` — POST `/api/auth/logout`, no body, ignore errors (best-effort)
    - [x] `refresh(): Promise<{ accessToken: string }>` — POST `/api/auth/refresh`, no body,
      throws on non-OK (401 = expired/absent cookie)
    - [x] All calls use plain `fetch()` — no Apollo, no axios
    - [x] Request bodies use `Content-Type: application/json`; response bodies parsed via `res.json()`

- [x] Task 4: Update `src/lib/apollo/ApolloWrapper.tsx` (AC: 2, 3)
    - [x] Remove `ApolloWrapperProps` type and `onAuthError` prop entirely
    - [x] Add `"use client"` directive is already present — keep it
    - [x] Import `useAuth` from `@/lib/auth/AuthContext` and `authApi` from `@/lib/auth/authApi`
    - [x] Import `useRouter` from `next/navigation`; import `Observable` from `rxjs` (Apollo Client 4 uses rxjs)
    - [x] Use `useRef` pattern for live token access in the link closure (see Dev Notes — Apollo Ref Pattern)
    - [x] `makeLink` becomes a module-level function taking refs:
      `function makeLink(accessTokenRef, setAuthRef, clearAuthRef, router)`
    - [x] `SetContextLink` reads `accessTokenRef.current` (not `localStorage`)
    - [x] Replace `authErrorLink` with 401-retry logic using `ServerError.is(error)` (Apollo Client 4 API)
    - [x] Keep GraphQL error logging unchanged (`CombinedGraphQLErrors` block stays)
    - [x] `ApolloWrapper` component creates refs, syncs them every render, passes to `makeLink` via
      `useState(() => makeLink(...))`

- [x] Task 5: Update `src/app/layout.tsx` (AC: 1, 5, 6)
    - [x] Change theme import from `'./theme'` to `'@/lib/theme'`
    - [x] Import `AuthProvider` from `@/lib/auth/AuthContext`
    - [x] Import `ApolloWrapper` from `@/lib/apollo/ApolloWrapper` (move from `store/layout.tsx` scope to root)
    - [x] Import `RouteGuard` from `@/app/RouteGuard` (new file — see Task 6)
    - [x] Wrap the tree: `AuthProvider` → `ApolloWrapper` → `RouteGuard` → existing `Box/AppHeader/Box(children)`
      structure
    - [x] Remove the `inter` font declaration from `layout.tsx` — Inter is now loaded inside `theme.ts`
      and applied via `fontFamily`; remove `className={inter.className}` from `<body>`
    - [x] Final structure (see Dev Notes — layout.tsx Structure)

- [x] Task 6: Create `src/app/RouteGuard.tsx` (AC: 5)
    - [x] `"use client"` directive
    - [x] Reads `const { username, isLoading } = useAuth()` and `const pathname = usePathname()`
    - [x] Public routes that bypass guard: `/auth` and `/auth/register`
    - [x] `useEffect`: if `!isLoading && !username && !isPublicRoute(pathname)` → `router.replace('/auth')`
    - [x] Renders: `if (isLoading && !isPublicRoute(pathname)) return null` (no flash); otherwise renders `{children}`

- [x] Task 7: Update `src/app/store/layout.tsx` (AC: 5)
    - [x] Remove `ApolloWrapper` import and usage (now at root)
    - [x] Remove `useRouter` and `onAuthError` (route guard is now at root)
    - [x] Remove `useEffect` localStorage auth check
    - [x] Simplify to a plain Server Component passthrough:
      `export default function StoreLayout({children}) { return <>{children}</> }`

- [x] Task 8: Update `src/app/auth/Logout.tsx` (AC: 4)
    - [x] Replace `localStorage.getItem("username")` with `const { username, clearAuth } = useAuth()` — remove the
      `useState` + `useEffect` that read from localStorage
    - [x] Remove `localStorage.removeItem` calls on logout
    - [x] On logout: call `await authApi.logout()` (best-effort, ignore errors), then `clearAuth()`,
      then `router.push('/auth')`
    - [x] Import `authApi` from `@/lib/auth/authApi` and `useAuth` from `@/lib/auth/AuthContext`
    - [x] The "Login" branch and `handleLogin` function can remain as-is (redirects to `/auth`)

## Dev Notes

### Current State — What Exists and What's Breaking

- **`src/app/theme.ts`** — EXISTS with Roboto, minimal dark mode only. Replace with full theme at `src/lib/theme.ts`
  and delete `src/app/theme.ts`.
- **`src/lib/apollo/ApolloWrapper.tsx`** — EXISTS, reads `localStorage.getItem('token')`. Token is now
  in AuthContext — localStorage reads MUST be removed. `onAuthError` prop MUST be removed.
- **`src/app/store/layout.tsx`** — EXISTS, wraps children with `ApolloWrapper` and has a localStorage-based
  auth guard in `useEffect`. Both must be removed; ApolloWrapper moves to root layout.
- **`src/app/auth/Logout.tsx`** — EXISTS, uses localStorage for username tracking and clears localStorage on
  logout. Must migrate to `useAuth()` + `authApi.logout()`.
- **`src/app/auth/page.tsx`** — EXISTS, calls old `/api/login` endpoint (REMOVED in story 1.2) and uses
  `localStorage`. DO NOT touch this file in this story — it will be replaced entirely in story 1.4. It is
  currently broken but will not be called since the auth guard redirects there.
- **`src/app/auth/layout.tsx`** — EXISTS, wraps auth pages with Paper card. Do NOT touch — 1.4 redesigns login.

### Files to Create / Modify / Delete

| File                               | Action | Notes                                                                                    |
|------------------------------------|--------|------------------------------------------------------------------------------------------|
| `src/lib/theme.ts`                 | CREATE | Full dark theme per UX-DR1                                                               |
| `src/lib/auth/AuthContext.tsx`     | CREATE | AuthProvider, AuthContext, useAuth()                                                     |
| `src/lib/auth/authApi.ts`          | CREATE | Plain fetch calls to auth REST endpoints                                                 |
| `src/app/RouteGuard.tsx`           | CREATE | Client route guard component                                                             |
| `src/app/theme.ts`                 | DELETE | Replaced by lib/theme.ts                                                                 |
| `src/app/layout.tsx`               | MODIFY | Theme import, AuthProvider + ApolloWrapper + RouteGuard wrapping, remove inter className |
| `src/lib/apollo/ApolloWrapper.tsx` | MODIFY | Remove localStorage/onAuthError, add AuthContext + 401 retry                             |
| `src/app/store/layout.tsx`         | MODIFY | Remove ApolloWrapper and localStorage guard, simplify                                    |
| `src/app/auth/Logout.tsx`          | MODIFY | Use useAuth() + authApi.logout()                                                         |

**Do NOT touch:**

- `src/app/auth/page.tsx` — broken but intentionally untouched until story 1.4
- `src/app/auth/layout.tsx` — redesigned in story 1.4
- `src/__generated__/` — auth is REST, no schema changes, no `npm run generate`
- `src/lib/item/Queries.tsx`, `src/lib/category/Queries.tsx` — existing GQL operations unchanged
- Backend code — this story is frontend-only

### Theme File Pattern

```typescript
// src/lib/theme.ts
'use client'
import { Inter } from 'next/font/google'
import { createTheme } from '@mui/material/styles'

const inter = Inter({ subsets: ['latin'] })

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0e0e10', paper: '#1a1a1d' },
    primary: { main: '#4db6a8', dark: '#3a9d96' },
    error: { main: '#d9534f' },
    text: { primary: '#e8e8e8', secondary: '#9e9e9e' },
    divider: '#2e2e32',
  },
  typography: {
    fontFamily: inter.style.fontFamily,
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 6, textTransform: 'none' } } },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiPaper: { styleOverrides: { root: { border: '1px solid', borderColor: '#2e2e32' } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
  },
})

export default theme
```

### AuthContext Pattern

```typescript
// src/lib/auth/AuthContext.tsx — shape the dev agent must match exactly
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from './authApi'

export interface AuthState {
  username: string | null
  role: 'admin' | 'user' | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: () => void
  isLoading: boolean
}

// parseJwt — decode JWT payload without a library
function parseJwt(token: string): { username: string; role: string } {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

// Always consume via useAuth() — never useContext(AuthContext) directly in components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
```

On mount, `AuthProvider` calls `authApi.refresh()`. If the refresh cookie is valid (user returning within 30 days),
the backend returns `{ accessToken }`. Decode the JWT to extract `username` and `role` claims.

**`isLoading` is mandatory** — without it, the route guard immediately redirects on page refresh
(auth is null at init, before the refresh attempt completes). Set `isLoading = true` initially;
set to `false` in a `finally` block after the refresh attempt.

### Apollo Ref Pattern (Critical for ApolloWrapper)

The `makeClient` closure is created once. Links inside it must read the LATEST auth values on every
request — not the values at creation time. Use mutable refs that are synced every render:

```typescript
// In ApolloWrapper component body (before return):
const auth = useAuth()
const router = useRouter()

const accessTokenRef = useRef(auth.accessToken)
const setAuthRef = useRef(auth.setAuth)
const clearAuthRef = useRef(auth.clearAuth)

// Sync refs every render — assignment, not useEffect (no delay)
accessTokenRef.current = auth.accessToken
setAuthRef.current = auth.setAuth
clearAuthRef.current = auth.clearAuth

// Create client ONCE — stable across re-renders
const [client] = useState(() => makeLink(accessTokenRef, setAuthRef, clearAuthRef, router))
```

`makeLink` signature:

```typescript
function makeLink(
  accessTokenRef: React.MutableRefObject<string | null>,
  setAuthRef: React.MutableRefObject<(state: AuthState) => void>,
  clearAuthRef: React.MutableRefObject<() => void>,
  router: ReturnType<typeof useRouter>
): ApolloClient<NormalizedCacheObject>
```

Inside `makeLink`, `SetContextLink` reads `accessTokenRef.current`:

```typescript
const authLink = new SetContextLink((prevContext) => ({
  ...prevContext,
  headers: {
    ...(prevContext.headers as Record<string, string>),
    authorization: `Bearer ${accessTokenRef.current ?? ''}`,
  },
}))
```

### 401 Retry Pattern (ApolloWrapper authErrorLink)

Replace the current `authErrorLink` with retry logic. Use `Observable` from `@apollo/client`:

```typescript
import { Observable } from '@apollo/client'
import type { ServerError } from '@apollo/client/link/http'

// In makeLink, replace authErrorLink with:
const authErrorLink = new ErrorLink(({ networkError, operation, forward }) => {
  const isUnauthorized =
    networkError && 'statusCode' in networkError &&
    (networkError as ServerError).statusCode === 401

  if (isUnauthorized) {
    if (operation.getContext().retried) {
      // Already retried — give up, clear auth, redirect
      clearAuthRef.current()
      router.push('/auth?expired=1')
      return
    }

    return new Observable(observer => {
      authApi.refresh()
        .then(({ accessToken }) => {
          const payload = parseJwtForApollo(accessToken)  // decode JWT inline
          setAuthRef.current({ username: payload.username, role: payload.role, accessToken })
          accessTokenRef.current = accessToken
          operation.setContext({ ...operation.getContext(), retried: true })
        })
        .then(() => {
          const sub = forward(operation)
          sub.subscribe({
            next: v => observer.next(v),
            error: e => observer.error(e),
            complete: () => observer.complete(),
          })
        })
        .catch(() => {
          clearAuthRef.current()
          router.push('/auth?expired=1')
          observer.complete()
        })
    })
  }
  // GraphQL error logging (keep existing block):
  if (CombinedGraphQLErrors.is(error)) { ... }
})
```

**Anti-pattern:** Do NOT pass `parseJwt` from AuthContext — define a local copy inside ApolloWrapper
or export it from a shared utility. The ref pattern already handles the auth state update.

**`retried` flag is mandatory** — omitting it causes an infinite retry loop on persistent 401 errors.

### RouteGuard Pattern

```typescript
// src/app/RouteGuard.tsx
'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

const PUBLIC_ROUTES = ['/auth', '/auth/register']

export default function RouteGuard({ children }: React.PropsWithChildren) {
  const { username, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublic = PUBLIC_ROUTES.some(r => pathname === r)

  useEffect(() => {
    if (!isLoading && !username && !isPublic) {
      router.replace('/auth')
    }
  }, [username, isLoading, isPublic, router])

  // While loading on a protected route — render nothing (no flash of content or redirect)
  if (isLoading && !isPublic) return null

  return <>{children}</>
}
```

### layout.tsx Structure After Changes

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
    <body>   {/* Remove inter.className — font applied via theme.typography.fontFamily */}
      <AppRouterCacheProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <ApolloWrapper>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <AppHeader />
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, bgcolor: 'background.default' }}>
                  <RouteGuard>
                    {children}
                  </RouteGuard>
                </Box>
              </Box>
            </ApolloWrapper>
          </AuthProvider>
        </ThemeProvider>
      </AppRouterCacheProvider>
    </body>
    </html>
  )
}
```

**Wrapping order is mandatory:** `AuthProvider` MUST wrap `ApolloWrapper` (Apollo reads auth state via
`useAuth()`). `ApolloWrapper` MUST be inside `AuthProvider`. `RouteGuard` reads auth state and MUST be
inside `AuthProvider`.

### authApi.ts Shape

```typescript
// src/lib/auth/authApi.ts
export const authApi = {
  login: async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('Login failed')
    return res.json() as Promise<{ accessToken: string; username: string; role: string }>
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  },

  refresh: async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' })
    if (!res.ok) throw new Error('Refresh failed')
    return res.json() as Promise<{ accessToken: string }>
  },
}
```

- `logout` is best-effort (catch swallowed) — cookie deletion may still succeed on the backend
- `refresh` throws on failure so `AuthProvider.useEffect` and the Apollo 401 handler can distinguish
  authenticated vs unauthenticated
- These are the ONLY places that call auth REST endpoints — no bare `fetch('/api/auth/...')` in components

### Backend API Reference (Story 1.2 Implementation)

- `POST /api/auth/login` → `{ accessToken, username, role }` + httpOnly `refresh_token` cookie (30 days)
- `POST /api/auth/refresh` → `{ accessToken }` (uses httpOnly cookie automatically)
- `POST /api/auth/logout` → HTTP 200 (clears refresh_token MongoDB record)
- JWT payload claims: `username` (string), `role` ("admin" | "user")
- Access token expiry: 15 minutes (short-lived; refresh happens transparently via cookie)

### Story 1.2 Debug Learnings Applicable Here

- **RefreshToken includes `role`** — when the backend issues a new access token from `/auth/refresh`,
  it correctly includes the `role` claim from the stored RefreshToken document. Decoding the JWT after
  refresh reliably yields both `username` and `role`.
- **Endpoint paths use `/api/` prefix** — nginx rootPath is `api`, so all auth endpoints are
  `/api/auth/...` (visible in browser as `/api/auth/login` etc.).

### MUI v9 Theme Notes

- `createTheme` API is stable; `theme.components` for defaults is the same as v5/v6
- `'use client'` is required on theme.ts because it calls `Inter()` from `next/font/google`
- `Inter()` must be called at module level (outside components) — cannot be called in a render function
- `MuiTextField defaultProps variant: "outlined"` sets the default for all TextFields globally;
  individual components can override with explicit `variant` prop
- `MuiPaper border` override: use `borderColor` token from palette, not hardcoded hex

### TypeScript Notes

- All components using auth context need `"use client"` directive
- `parseJwt` return type: `{ username: string; role: string }` (no runtime validation needed — JWT from
  our own backend is trusted)
- `AuthState.role` type: `"admin" | "user" | null` — use string literal union, never `string`
- `useRef` ref type for functions: `React.MutableRefObject<(state: AuthState) => void>`

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — "Frontend AuthContext Pattern",
  "Apollo 401 Retry Pattern", "Route Guards" section
- UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md` — "Design System Foundation",
  "Color System" table, UX-DR1 through UX-DR4
- Story 1.2 dev notes: `_bmad-output/implementation-artifacts/1-2-login-token-system-session-security-backend.md`
  — backend endpoint shapes, RefreshToken role fix
- Existing ApolloWrapper: `bp_front/src/lib/apollo/ApolloWrapper.tsx` — current link chain to preserve/extend
- Existing layout: `bp_front/src/app/layout.tsx` — current structure to extend

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Apollo Client 4 removed `Observable` export — must import from `rxjs` directly
- `ServerError` in Apollo Client 4 is in `@apollo/client/errors`, not `@apollo/client/link/http`
- `ApolloClient` in Apollo Client 4 is no longer generic (no `<NormalizedCacheObject>`)
- Apollo Client 4 `ErrorLink` callback has `{ error, result, operation, forward }` — no `networkError` field; use
  `ServerError.is(error)` to detect 401
- `next lint` removed in Next.js 16; `npm run build` (TypeScript check) used as validation instead

### Completion Notes List

- Created `src/lib/theme.ts` with full dark palette, Inter font, and MUI component defaults; deleted old
  `src/app/theme.ts`
- Created `src/lib/auth/AuthContext.tsx`: `AuthProvider`, `useAuth()`, `AuthState` types, `parseJwt` utility,
  refresh-on-mount with `isLoading` gate
- Created `src/lib/auth/authApi.ts`: plain `fetch` calls for login/logout/refresh — single source of truth for auth REST
  endpoints
- Updated `src/lib/apollo/ApolloWrapper.tsx`: removed `onAuthError`/localStorage, added ref pattern for live token
  access, 401 retry with `rxjs` Observable and `ServerError.is()`, refresh-on-retry with JWT decode
- Updated `src/app/layout.tsx`: `AuthProvider → ApolloWrapper → RouteGuard` wrapping order, removed `inter.className`
  from body
- Created `src/app/RouteGuard.tsx`: public route bypass `/auth`/`/auth/register`, `isLoading` gate prevents flash,
  `router.replace` on unauthenticated access
- Updated `src/app/store/layout.tsx`: simplified to Server Component passthrough (no more ApolloWrapper/localStorage
  guard)
- Updated `src/app/auth/Logout.tsx`: migrated from localStorage to `useAuth()` + `authApi.logout()` + `clearAuth()`
- All changes compile clean with `npm run build` (TypeScript strict mode)

### File List

- `bp_front/src/lib/theme.ts` — CREATED
- `bp_front/src/lib/auth/AuthContext.tsx` — CREATED
- `bp_front/src/lib/auth/authApi.ts` — CREATED
- `bp_front/src/app/RouteGuard.tsx` — CREATED
- `bp_front/src/app/theme.ts` — DELETED
- `bp_front/src/app/layout.tsx` — MODIFIED
- `bp_front/src/lib/apollo/ApolloWrapper.tsx` — MODIFIED
- `bp_front/src/app/store/layout.tsx` — MODIFIED
- `bp_front/src/app/auth/Logout.tsx` — MODIFIED

### Review Findings

- [x] [Review][Patch] `Logout` shows Login button during loading flash — add `isLoading` guard to `Logout.tsx` so it
  renders a neutral/disabled state while `AuthProvider` is resolving the initial refresh [
  `bp_front/src/app/auth/Logout.tsx`]
- [x] [Review][Patch] Concurrent 401 refresh — no singleton lock: two simultaneous GraphQL 401s each call
  `authApi.refresh()` independently, risking backend cookie rotation that invalidates both and logs the user out [
  `bp_front/src/lib/auth/authApi.ts`]
- [x] [Review][Patch] `observer.complete()` called instead of `observer.error()` on refresh failure — Apollo treats the
  operation as successful with no data; components receive `{ data: undefined, error: undefined }` silently [
  `bp_front/src/lib/apollo/ApolloWrapper.tsx`]
- [x] [Review][Patch] `parseJwt` throws unguarded on malformed JWT — `split('.')[1]` returning `undefined`, non-base64
  chars in `atob`, or invalid JSON each throw, crashing the Observable chain with no recovery (`.catch(() => {})` in
  AuthProvider swallows it silently) [`bp_front/src/lib/auth/AuthContext.tsx`,
  `bp_front/src/lib/apollo/ApolloWrapper.tsx`]
- [x] [Review][Patch] `router` not in a ref — captured by value at `makeLink` call time via `useState`, never updated;
  three other auth values use refs but `router` is frozen to the first-render instance [
  `bp_front/src/lib/apollo/ApolloWrapper.tsx`]
- [x] [Review][Defer] `auth/page.tsx` still calls bare `fetch('/api/login')` + writes `localStorage` — intentional per
  spec; full replacement is story 1.4 scope — deferred, pre-existing
- [x] [Review][Defer] `AuthProvider` refresh failure silently swallowed in `.catch(() => {})` — intentional design per
  spec ("on any failure just sets isLoading = false"); no user-visible error message — deferred, pre-existing
- [x] [Review][Defer] No inverse guard: authenticated users can freely visit `/auth` — not specified in AC5; redirect of
  authenticated users is out of scope for this story — deferred, pre-existing
- [x] [Review][Defer] `isLoading` stays `true` on `AuthProvider` unmount before refresh resolves — React StrictMode
  double-invoke in dev causes two parallel refresh calls; no `AbortController` cleanup — deferred, pre-existing

## Change Log

- 2026-05-09: Initial implementation — full dark theme, AuthContext/AuthProvider, authApi, ApolloWrapper 401 retry,
  RouteGuard, layout restructuring, Logout migration from localStorage to AuthContext
- 2026-05-09: Code review — 4 patch findings, 2 decisions needed, 4 deferred, 10 dismissed
