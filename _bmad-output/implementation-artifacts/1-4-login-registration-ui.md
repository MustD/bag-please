# Story 1.4: Login & Registration UI

Status: done

## Story

As a new or returning user,
I want clear, mobile-friendly login and registration screens with honest feedback,
so that I can get into the app quickly and understand exactly what happened when something goes wrong.

## Acceptance Criteria

1. **AC1 — Login layout:** An unauthenticated user visiting `/auth` sees an edge-to-edge layout (no `Paper` card
   wrapper), `maxWidth: 360` centred on desktop (`mx: "auto", px: 2, py: 5`), full-width on mobile. Username and
   password fields have visible associated labels (not placeholder-only). Pressing Enter from either field submits the
   form. A "Register" link is visible.

2. **AC2 — Login error inline:** When the login form is submitted with wrong credentials and the server returns an
   error, an inline `FormHelperText` with `error` prop appears below the password field. No Snackbar or floating Alert
   is shown for this error. The submit button re-enables.

3. **AC3 — Session expiry alert:** When the user was redirected to `/auth` due to session expiry (`?expired=1` query
   param present), an `Alert severity="warning"` is shown above the form heading with the text "Your session has
   expired. Please sign in again."

4. **AC4 — Register page layout:** The user visiting `/auth/register` sees an edge-to-edge layout matching the login
   page. Username and password fields have visible labels. A link back to sign-in is visible.

5. **AC5 — Registration success + auto-login:** When registration succeeds and auto-login completes, the user lands on
   the home page (`/`) with the `WelcomeBanner` shown: text includes the username, e.g. "Welcome, [username]! You now
   have your own account." The banner has a dismiss `IconButton`.

6. **AC6 — WelcomeBanner one-time only:** When the `WelcomeBanner` was dismissed or the user navigated away, returning
   to the home page in the same session does NOT show the banner again.

7. **AC7 — Registration error inline:** When registration fails because the username is already taken, an inline
   `FormHelperText` error appears below the username field.

8. **AC8 — Loading state:** When any form submit is in progress (pending async operation), the primary action button
   shows `CircularProgress` (replacing button text) and is disabled.

9. **AC9 — Error clears on edit:** When a field has a visible error and the user modifies that field's value, the error
   clears immediately.

## Tasks / Subtasks

- [x] Task 1: Update `src/app/auth/layout.tsx` — Remove Paper wrapper (AC: 1, 4)
    - [x] Remove `Paper` and `Box` wrappers; replace body with `<>{children}</>` (or minimal `Box` without Paper)
    - [x] Remove React import if no longer needed; convert to a plain Server Component

- [x] Task 2: Rewrite `src/app/auth/page.tsx` — Complete LoginPage overhaul (AC: 1, 2, 3, 8, 9)
    - [x] Add `"use client"` directive
    - [x] Import `useAuth` from `@/lib/auth/AuthContext` and `authApi` from `@/lib/auth/authApi`
    - [x] Import `useSearchParams` from `next/navigation` (and wrap usage in Suspense if needed)
    - [x] Read `?expired=1` from `useSearchParams()` to show session-expiry `Alert`
    - [x] Form state: `username`, `password`, `usernameError`, `passwordError`, `serverError`, `isSubmitting`
    - [x] Error clears per-field when the user types (only clear the relevant field's error)
    - [x] On submit: validate non-empty fields (inline errors per field), then call `authApi.login()`
    - [x] On success: call `setAuth({ username, role, accessToken })` from `useAuth()`, then `router.push('/')`
    - [x] On failure: set `serverError` displayed as `FormHelperText error` below the password field
    - [x] Edge-to-edge layout: `Box component="form"` → `Stack` with `sx={{ maxWidth: 360, mx: "auto", px: 2, py: 5 }}`
    - [x] Session expiry `Alert severity="warning"` above the heading when `expired` param is present
    - [x] "Register" link (MUI `Link` from `@mui/material` or Next.js `Link`) pointing to `/auth/register`
    - [x] Submit button shows `CircularProgress` (size 20) instead of text while `isSubmitting`; button disabled while
      submitting
    - [x] Wrap component in `Suspense` at page level to allow `useSearchParams()` — or use `React.Suspense` around the
      content that reads search params

- [x] Task 3: Create `src/app/auth/register/page.tsx` — New RegisterPage (AC: 4, 5, 7, 8, 9)
    - [x] Create `bp_front/src/app/auth/register/` directory
    - [x] Add `"use client"` directive
    - [x] Import `authApi` from `@/lib/auth/authApi` and `useAuth` from `@/lib/auth/AuthContext`
    - [x] Form state: `username`, `password`, `usernameError`, `passwordError`, `isSubmitting`
    - [x] Error clears per-field when the user types
    - [x] On submit: validate non-empty fields, then call `authApi.register(username, password)` (see Dev Notes —
      authApi.register shape)
    - [x] On registration success: call `authApi.login(username, password)` for auto-login
    - [x] On auto-login success: call `setAuth()` from `useAuth()`, then `router.push('/?welcome=1')`
    - [x] On registration failure (username taken): set `usernameError` as `FormHelperText error` below username field
    - [x] Edge-to-edge layout matching LoginPage: `Box component="form"` → `Stack` with
      `sx={{ maxWidth: 360, mx: "auto", px: 2, py: 5 }}`
    - [x] Link back to sign-in (`/auth`) visible at bottom
    - [x] Submit button shows `CircularProgress` (size 20) instead of text while `isSubmitting`; disabled while
      submitting
    - [x] Add `register` method to `src/lib/auth/authApi.ts` (see Dev Notes)

- [x] Task 4: Create `src/app/WelcomeBanner.tsx` — Dismissible welcome banner (AC: 5, 6)
    - [x] Props: `username: string`, `onDismiss: () => void`
    - [x] Render a `Box` with teal tint background (`bgcolor: 'primary.dark'`)
    - [x] Welcome text: `"Welcome, {username}! You now have your own account."`
    - [x] Dismiss button: `IconButton` with `title="Dismiss"` and `CloseIcon`
    - [x] `Stack direction="row"` layout with text flex-growing and button on the right
    - [x] Style entirely via `sx` for layout/spacing only — no visual style hardcoded

- [x] Task 5: Update `src/app/page.tsx` — Add WelcomeBanner to home page (AC: 5, 6)
    - [x] Add `"use client"` directive (page is currently already `"use client"`)
    - [x] Import `useSearchParams` from `next/navigation`
    - [x] Import `WelcomeBanner` from `@/app/WelcomeBanner`
    - [x] On mount: read `?welcome=1` from search params; if present, set `showBanner = true` and call
      `router.replace('/')` to clean the URL
    - [x] Render `{showBanner && <WelcomeBanner username={username} onDismiss={() => setShowBanner(false)} />}` above
      existing content
    - [x] Import `useAuth` to get `username` for the banner
    - [x] Wrap in `Suspense` if using `useSearchParams` (Next.js 16 requirement)

- [x] Task 6: Run build validation (AC: all)
    - [x] `cd bp_front && npm run build` — must pass with zero TypeScript errors
    - [x] Visually verify: login page edge-to-edge with Register link, session expiry alert, register page with back
      link, WelcomeBanner

### Review Findings

- [x] [Review][Decision] Register catch attributes ALL errors to username field — spec pattern accepted; dismissed
- [x] [Review][Patch] AC9: `serverError` not cleared when username field is edited [bp_front/src/app/auth/page.tsx]
- [x] [Review][Patch] WelcomeBanner dismiss `IconButton` uses `title` instead of `aria-label` — accessibility
  regression [bp_front/src/app/WelcomeBanner.tsx]
- [x] [Review][Patch] Two separate `import ... from 'next/navigation'` statements — merge into
  one [bp_front/src/app/auth/page.tsx]
- [x] [Review][Patch] `Suspense` wrappers missing `fallback` prop — blank screen during
  suspension [bp_front/src/app/auth/page.tsx, bp_front/src/app/page.tsx]
- [x] [Review][Patch] TextFields missing `id`/`name` attributes — breaks password manager autofill and browser
  autocomplete [bp_front/src/app/auth/page.tsx, bp_front/src/app/auth/register/page.tsx]
- [x] [Review][Patch] `useEffect` suppresses deps with `eslint-disable` comment — `router` and `searchParams` missing
  from deps array [bp_front/src/app/page.tsx]
- [x] [Review][Defer] `LoginForm`/`RegisterPage` near-identical duplication — architectural refactor beyond story
  scope — deferred, pre-existing
- [x] [Review][Defer] Unsafe `role as 'admin' | 'user'` cast in both pages — cross-cutting TypeScript concern, matches
  existing pattern — deferred, pre-existing
- [x] [Review][Defer] `authApi.register` success response JSON parse unguarded — matches existing `authApi.login`
  pattern — deferred, pre-existing
- [x] [Review][Defer] `WelcomeBanner` reappears if `username` repopulates after auth expiry while `showBanner` is still
  true — edge case, acceptable for v1 — deferred, pre-existing

## Dev Notes

### Current State — What Exists and What's Broken

- **`src/app/auth/page.tsx`** — EXISTS but is entirely broken: uses bare `fetch('/api/auth/login')` (old endpoint format
  that became `/api/auth/login` in story 1.2), stores `token` and `username` in `localStorage` (removed in story 1.3),
  and wraps with an IconButton instead of a Button. MUST be completely rewritten.
- **`src/app/auth/layout.tsx`** — EXISTS, wraps children in `Box > Paper sx={{p:1}}`. This Paper wrapper conflicts with
  the edge-to-edge layout required by AC1/AC4. MUST be simplified to a passthrough layout.
- **`src/app/auth/register/`** — DOES NOT EXIST. Create directory and `page.tsx`.
- **`src/app/WelcomeBanner.tsx`** — DOES NOT EXIST. Create it.
- **`src/app/page.tsx`** — EXISTS, already `"use client"`, renders a simple Box+Paper placeholder. Will be extended to
  show WelcomeBanner.
- **`src/lib/auth/authApi.ts`** — EXISTS with `login`, `logout`, `refresh`. Needs `register` added.

### authApi.register Shape (Add to `src/lib/auth/authApi.ts`)

```typescript
register: async (username: string, password: string) => {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Registration failed')
  }
  return res.json() as Promise<{ username: string; role: string }>
},
```

The backend returns `{"error": "..."}` on failure. Throw to surface the error to the register form.

### Login Page Rewrite Pattern

```tsx
// src/app/auth/page.tsx — key structure (not a paste-as-is)
'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { authApi } from '@/lib/auth/authApi'
import { Alert, Box, Button, CircularProgress, FormHelperText, Link, Stack, TextField, Typography } from '@mui/material'

function LoginForm() {
  const searchParams = useSearchParams()
  const expired = searchParams.get('expired') === '1'
  const { setAuth } = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // clear server error on each submit attempt
    setServerError('')
    let valid = true
    if (!username) { setUsernameError('Enter username'); valid = false }
    if (!password) { setPasswordError('Enter password'); valid = false }
    if (!valid) return

    setIsSubmitting(true)
    try {
      const data = await authApi.login(username, password)
      setAuth({ username: data.username, role: data.role as 'admin' | 'user', accessToken: data.accessToken })
      router.push('/')
    } catch {
      setServerError('Invalid username or password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack sx={{ maxWidth: 360, mx: 'auto', px: 2, py: 5 }} spacing={2}>
        {expired && (
          <Alert severity="warning">Your session has expired. Please sign in again.</Alert>
        )}
        <Typography variant="h6">Sign in</Typography>
        <TextField
          label="Username"
          value={username}
          error={!!usernameError}
          helperText={usernameError}
          onChange={(e) => { setUsername(e.target.value); setUsernameError('') }}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          error={!!passwordError || !!serverError}
          helperText={passwordError || serverError}
          onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setServerError('') }}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
        </Button>
        <Link href="/auth/register">Register</Link>
      </Stack>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

**`Suspense` wrapper is required** — Next.js 16 requires components that call `useSearchParams()` to be wrapped in
`Suspense`, otherwise the build fails with a static-generation error.

### Register Page Pattern

```tsx
// src/app/auth/register/page.tsx — key structure
'use client'
import { useAuth } from '@/lib/auth/AuthContext'
import { authApi } from '@/lib/auth/authApi'
// ...

export default function RegisterPage() {
  const { setAuth } = useAuth()
  // state: username, password, usernameError, passwordError, isSubmitting

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // validate non-empty
    setIsSubmitting(true)
    try {
      await authApi.register(username, password)
      // auto-login
      const data = await authApi.login(username, password)
      setAuth({ username: data.username, role: data.role as 'admin' | 'user', accessToken: data.accessToken })
      router.push('/?welcome=1')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setUsernameError(msg)  // username-taken errors go below username field
    } finally {
      setIsSubmitting(false)
    }
  }
  // Layout: same maxWidth/mx/px/py as LoginPage
}
```

**Auto-login sequence:** register → then immediately login (the backend does NOT auto-issue tokens on register; the
frontend must call login separately after a successful registration). Both calls happen inside a single try/catch.

### WelcomeBanner — Teal Tint Background

MUI does not have an out-of-the-box "teal tint" background token. Options:

1. Use `bgcolor: 'primary.dark'` (the darker teal from the palette) — simplest approach
2. Use MUI's `alpha` utility: `import { alpha } from '@mui/material/styles'` then
   `bgcolor: alpha(theme.palette.primary.main, 0.15)` — requires `useTheme()` inside the component
3. Use a hardcoded teal with opacity in `sx` (avoid — hardcoded hex)

**Recommended:** Use `bgcolor: 'primary.dark'` for simplicity (avoids useTheme hook), and adjust opacity via
`sx={{ opacity: ... }}` if needed. Or use `bgcolor: 'rgba(77,182,168,0.15)'` inline — but per rules, visual style
belongs in theme. For v1, `bgcolor: 'primary.dark'` is acceptable as it uses a theme token.

The banner `sx` layout:

```tsx
<Box sx={{ p: 2, borderRadius: 1, bgcolor: 'primary.dark', mb: 2 }}>
  <Stack direction="row" alignItems="center" spacing={1}>
    <Typography sx={{ flex: 1 }}>Welcome, {username}! You now have your own account.</Typography>
    <IconButton title="Dismiss" onClick={onDismiss} size="small">
      <CloseIcon fontSize="small" />
    </IconButton>
  </Stack>
</Box>
```

### Welcome Flag via URL Parameter

The `?welcome=1` URL parameter is the mechanism for passing the "show welcome banner" flag from the register page to the
home page without a shared context or localStorage.

**Home page pattern:**

```tsx
// src/app/page.tsx (simplified)
'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import WelcomeBanner from '@/app/WelcomeBanner'

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { username } = useAuth()
  const [showBanner, setShowBanner] = useState(() => searchParams.get('welcome') === '1')

  // Clean URL after reading param (fire-once via useEffect)
  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      router.replace('/')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      {showBanner && username && (
        <WelcomeBanner username={username} onDismiss={() => setShowBanner(false)} />
      )}
      <Paper sx={{ p: 1 }}>
        {/* existing content */}
      </Paper>
    </Box>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
```

**Critical:** Initialize `showBanner` state with a lazy initializer (`useState(() => ...)`) so it reads the param once
at mount, not on every re-render. The `router.replace('/')` removes `?welcome=1` from the URL so a page refresh won't
re-show the banner (AC6 — banner not shown again after navigation).

### auth/layout.tsx Simplification

The current `AuthLayout` wraps children in `Box > Paper`. This conflicts with edge-to-edge design.
Change to a minimal passthrough:

```tsx
// src/app/auth/layout.tsx — after change
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
```

No `"use client"` needed — this is a Server Component. The existing `React` import can be removed.

### MUI v9 Notes

- `TextField` with `label` prop automatically renders the visible label — never use `placeholder` as a substitute
- `FormHelperText` with `error` prop sets `aria-describedby` automatically — use `helperText` prop on `TextField` (not a
  separate `FormHelperText`)
- `CircularProgress` inside a `Button`: set `color="inherit"` so it takes the button's text color; use `size={20}` for
  inline fit
- `Alert severity="warning"` renders with `role="alert"` automatically — no manual ARIA needed
- `Link` from `@mui/material` renders as an anchor; for Next.js navigation use `component={NextLink}` pattern OR use
  `Link` from `next/link` styled with MUI's `sx` — either works; the simplest:
  `<MuiLink component={NextLink} href="/auth/register">Register</MuiLink>` where `NextLink` is imported as
  `import NextLink from 'next/link'`

### TypeScript Notes

- `useSearchParams()` returns `ReadonlyURLSearchParams | null` in some Next.js versions — check for null:
  `searchParams?.get('welcome') === '1'`
- `authApi.login()` return type is `Promise<{ accessToken: string; username: string; role: string }>` — cast role:
  `data.role as 'admin' | 'user'`
- `WelcomeBanner` props must be fully typed: `interface WelcomeBannerProps { username: string; onDismiss: () => void }`

### Form Patterns (from UX spec)

- Validation fires on submit only — NOT on blur or keystroke
- Errors clear when user modifies the field value (onChange handler clears the specific field's error)
- Enter from any field in a single-column form submits (`Box component="form" noValidate onSubmit={handler}`)
- Primary action shows `CircularProgress` replacing button text and is disabled while loading
- One `variant="contained"` primary button per screen
- No Snackbar or toast for any auth error
- Session expiry uses `Alert severity="warning"`, not `severity="error"`

### Backend API Reference (from story 1.2)

- `POST /api/auth/register` → `{"username": "...", "role": "user"}` on success, `{"error": "..."}` on failure (HTTP 400)
- `POST /api/auth/login` → `{"accessToken": "...", "username": "...", "role": "admin"|"user"}` on success, HTTP 401 on
  failure
- JWT payload claims: `username` (string), `role` ("admin" | "user")
- All endpoints are under nginx rootPath `/api/` — no direct `:4000` calls from frontend

### Files to Create / Modify

| File                                      | Action | Notes                                                                              |
|-------------------------------------------|--------|------------------------------------------------------------------------------------|
| `bp_front/src/app/auth/layout.tsx`        | MODIFY | Remove Paper wrapper; passthrough only                                             |
| `bp_front/src/app/auth/page.tsx`          | MODIFY | Complete rewrite — edge-to-edge, authApi.login, error inline, session-expiry alert |
| `bp_front/src/app/auth/register/page.tsx` | CREATE | New RegisterPage — register + auto-login                                           |
| `bp_front/src/app/WelcomeBanner.tsx`      | CREATE | Dismissible teal-tinted banner with username                                       |
| `bp_front/src/app/page.tsx`               | MODIFY | Add WelcomeBanner, read ?welcome=1                                                 |
| `bp_front/src/lib/auth/authApi.ts`        | MODIFY | Add `register` method                                                              |

**Do NOT touch:**

- `src/lib/auth/AuthContext.tsx` — AuthProvider, useAuth, parseJwt all stable from story 1.3
- `src/lib/apollo/ApolloWrapper.tsx` — no changes needed
- `src/app/layout.tsx` — no changes needed
- `src/app/RouteGuard.tsx` — no changes needed
- `src/app/auth/Logout.tsx` — no changes needed
- `src/__generated__/` — auth is REST, no schema changes
- Backend code — this story is frontend-only

### Testing (Frontend)

No Playwright e2e framework is set up yet (story 1.6 scope). Validation for this story:

- `cd bp_front && npm run build` — TypeScript strict mode check; zero errors required
- Manual verification of the golden path: visit `/auth`, submit wrong credentials (see inline error), visit
  `/auth/register`, register new user (see WelcomeBanner on redirect), dismiss banner (does not reappear)

### References

- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.4 AC section, UX-DR2, UX-DR3, UX-DR5
- UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md` — "Edge-to-Edge" direction, "Form Patterns", "
  Feedback Patterns"
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Frontend Architecture, Route Guards
- Story 1.3 dev notes: `_bmad-output/implementation-artifacts/1-3-frontend-theme-auth-infrastructure.md` — AuthContext
  pattern, authApi shape, ApolloWrapper ref pattern
- Existing authApi: `bp_front/src/lib/auth/authApi.ts`
- Existing AuthContext: `bp_front/src/lib/auth/AuthContext.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story)

### Debug Log References

- MUI v9 `Stack` does not accept `alignItems` as a direct prop; must use `sx={{ alignItems: ... }}` — fixed in
  WelcomeBanner.tsx after first build attempt.

### Completion Notes List

- AC1/AC4: `auth/layout.tsx` simplified to passthrough `<>{children}</>` Server Component; Paper wrapper removed.
- AC1/AC2/AC3/AC8/AC9: `auth/page.tsx` fully rewritten — edge-to-edge layout (maxWidth 360, mx auto, px 2, py 5),
  per-field inline errors, session-expiry Alert, CircularProgress loading state, Suspense wrapper for useSearchParams.
- AC4/AC5/AC7/AC8/AC9: `auth/register/page.tsx` created — mirrors login layout, auto-login sequence (register → login →
  setAuth → push /?welcome=1), username-field error for taken usernames.
- AC5/AC6: `WelcomeBanner.tsx` created — dismissible, `primary.dark` bg, CloseIcon, Stack row layout via sx.
- AC5/AC6: `page.tsx` updated — lazy useState initializer reads ?welcome=1 once at mount, router.replace('/') cleans
  URL, Suspense wrapper added.
- `authApi.ts` extended with `register` method matching the backend's POST /api/auth/register contract.
- `npm run build` passes with zero TypeScript errors.

### File List

- bp_front/src/app/auth/layout.tsx
- bp_front/src/app/auth/page.tsx
- bp_front/src/app/auth/register/page.tsx
- bp_front/src/app/WelcomeBanner.tsx
- bp_front/src/app/page.tsx
- bp_front/src/lib/auth/authApi.ts

## Change Log

- 2026-05-11: Implemented all tasks — auth layout passthrough, login page rewrite, register page created, WelcomeBanner
  created, home page updated with banner, authApi.register added. Build passes with zero TypeScript errors.
