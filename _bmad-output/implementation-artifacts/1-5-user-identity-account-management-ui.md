# Story 1.5: User Identity & Account Management UI

Status: done

## Change Log

- 2026-05-11: Implemented all tasks — UserChip in AppHeader, Change Password nav link, ChangePasswordPage,
  authApi.changePassword. Build passes.

## Story

As an authenticated user,
I want to see my name in the app bar and be able to change my password,
so that the app feels like mine and I can maintain my own account.

## Acceptance Criteria

1. **AC1 — UserChip in AppBar:** An authenticated user loading any page sees a `UserChip` in the AppBar showing a
   rounded avatar with the user's first-letter initial and the username. It is styled entirely via theme (no inline `sx`
   for visual style — only layout/spacing `sx` is allowed). It is absent when the user is not authenticated.

2. **AC2 — ChangePasswordPage layout:** Navigating to `/account/password` shows a "Current password" field, a "New
   password" field, and a submit button. All fields have visible labels (not placeholder-only). Pressing Enter from the
   last field submits the form.

3. **AC3 — Success state:** When the form is submitted with the correct current password and the server returns success,
   an inline success message appears on the page and both password fields are cleared.

4. **AC4 — Error state:** When the form is submitted with an incorrect current password and the server returns an error,
   an inline `FormHelperText` error appears below the current-password field. No Snackbar is shown.

5. **AC5 — Loading state:** While the form submit is pending, the submit button shows `CircularProgress` (replacing
   button text) and is disabled until the response resolves.

6. **AC6 — Navigation link:** When any authenticated user opens the navigation menu, a link to `/account/password` is
   visible.

## Tasks / Subtasks

- [x] Task 1: Modify `src/app/AppHeader.tsx` — Add UserChip (AC: 1)
    - [x] Add `"use client"` directive (currently a Server Component; useAuth hook requires client boundary)
    - [x] Import `useAuth` from `@/lib/auth/AuthContext`
    - [x] Create `UserChip` using MUI `styled()` API with theme tokens — visual style in styled components, NOT inline
      sx
    - [x] Consult `mcp__mui-mcp__useMuiDocs` for MUI v9 `styled()` API before writing
    - [x] Render `UserChip` in Toolbar conditionally only when `username` is non-null; place between title and
      Navigation

- [x] Task 2: Modify `src/app/Navigation.tsx` — Add Change Password link (AC: 6)
    - [x] Add `MenuItem` that calls `router.push('/account/password')` — visible to all authenticated users, no role
      check
    - [x] Position logically near other account-related items (near Logout)

- [x] Task 3: Create `src/app/account/password/page.tsx` — ChangePasswordPage (AC: 2, 3, 4, 5)
    - [x] Create directory `bp_front/src/app/account/password/`
    - [x] Add `"use client"` directive
    - [x] Import `useAuth` from `@/lib/auth/AuthContext` and `authApi` from `@/lib/auth/authApi`
    - [x] Form state: `currentPassword`, `newPassword`, `currentError`, `newPasswordError`, `successMessage`,
      `isSubmitting`
    - [x] Errors clear when user modifies the relevant field (onChange)
    - [x] On submit: validate non-empty fields, guard if `!accessToken`, call
      `authApi.changePassword(currentPassword, newPassword, accessToken)`
    - [x] On success: show inline success message, clear both password fields
    - [x] On error: set `currentError` below current-password field (AC4: error goes below current-password, not
      new-password)
    - [x] Submit button shows `CircularProgress size={20} color="inherit"` replacing text while submitting; disabled
      while submitting
    - [x] `Box component="form" noValidate onSubmit={handler}` — Enter from any field submits
    - [x] Add `id` and `name` attributes to TextFields for password manager autofill (lesson from 1.4 review)
    - [x] Layout: `Stack sx={{ maxWidth: 360, mx: 'auto', px: 2, py: 5 }} spacing={2}` (matches auth pages)
    - [x] Consult `mcp__mui-mcp__useMuiDocs` for MUI v9 TextField and Alert APIs before writing

- [x] Task 4: Modify `src/lib/auth/authApi.ts` — Add changePassword method (AC: 3, 4)
    - [x] Add `changePassword(currentPassword, newPassword, accessToken)` method
    - [x] `POST /api/auth/change-password` with `Authorization: Bearer {accessToken}` header
    - [x] Body: `JSON.stringify({ currentPassword, newPassword })` — verify exact field names against backend DTO (see
      Dev Notes)
    - [x] Throw with `data.error` message on non-OK response (matches existing authApi error pattern)

- [x] Task 5: Build validation (AC: all)
    - [x] `cd bp_front && npm run build` — must pass with zero TypeScript errors

## Dev Notes

### MANDATORY: Consult MUI Docs First

Per project rules (`CLAUDE.md`): always use `mcp__mui-mcp__fetchDocs` / `mcp__mui-mcp__useMuiDocs` before writing or
editing MUI components. Do not guess v9 APIs from memory.

---

### Task 1 — AppHeader.tsx: Adding UserChip

**Current state** (`bp_front/src/app/AppHeader.tsx`): Server Component (no `"use client"`), renders `<AppBar>` +
`<Toolbar>` with title Typography and `<Navigation/>`.

**Why `"use client"` is required:** `useAuth()` is a React hook — hooks cannot run in Server Components. Adding
`"use client"` is safe; `Navigation` (already `"use client"`) continues to work as a nested client component.

**UserChip implementation — styled via MUI `styled()` API** (NOT inline sx for visual properties):

```tsx
'use client'

import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import {styled} from '@mui/material/styles'
import Navigation from '@/app/Navigation'
import {useAuth} from '@/lib/auth/AuthContext'

// Visual style defined in styled() — NOT in sx props below
const ChipContainer = styled(Box)(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  borderRadius: 20,
  padding: theme.spacing(0.5, 1.5),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}))

const AvatarCircle = styled(Box)(({theme}) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: theme.palette.background.default,
}))

function UserChip({username}: { username: string }) {
  return (
    <ChipContainer>
      <AvatarCircle>{username[0].toUpperCase()}</AvatarCircle>
      <Typography variant="body2">{username}</Typography>
    </ChipContainer>
  )
}

export default function AppHeader() {
  const {username} = useAuth()
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
            Bag please
          </Typography>
          {username && <UserChip username={username}/>}
          <Navigation/>
        </Toolbar>
      </AppBar>
    </Box>
  )
}
```

**Rule:** `sx` on the styled components themselves must be layout-only (`sx={{ flexGrow: 1 }}`). Colors, borders,
borderRadius, font weights all go in `styled()`.

---

### Task 2 — Navigation.tsx: Change Password Link

**Current state** (`bp_front/src/app/Navigation.tsx`): Already `"use client"`, `useRouter` imported, menu items include
Home, To Buy List, Logout. No `useAuth` import.

**No role check needed** — the Change Password link is visible to all authenticated users (admin and regular user). The
route guard handles unauthenticated access.

**No new imports required** — `router.push('/account/password')` uses the already-imported `useRouter`.

Suggested menu order (top to bottom): Logout → Home → To Buy List → [store sub-items] → **Change Password**

```tsx
<MenuItem onClick={() => { onClose(); router.push('/account/password') }}>
  <Typography>Change Password</Typography>
</MenuItem>
```

Add a `<Divider/>` before it to separate from store navigation items.

---

### Task 3 — ChangePasswordPage Implementation

**New directory required:** `bp_front/src/app/account/password/`

**Key implementation structure:**

```tsx
'use client'

import {useState} from 'react'
import {Alert, Box, Button, CircularProgress, Stack, TextField, Typography} from '@mui/material'
import {authApi} from '@/lib/auth/authApi'
import {useAuth} from '@/lib/auth/AuthContext'

export default function ChangePasswordPage() {
  const {accessToken} = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentError, setCurrentError] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setCurrentError('')
    setNewPasswordError('')
    setSuccessMessage('')
    let valid = true
    if (!currentPassword) {
      setCurrentError('Enter current password');
      valid = false
    }
    if (!newPassword) {
      setNewPasswordError('Enter new password');
      valid = false
    }
    if (!valid || !accessToken) return

    setIsSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword, accessToken)
      setSuccessMessage('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Password change failed'
      setCurrentError(msg)  // AC4: error goes below current-password field
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack sx={{maxWidth: 360, mx: 'auto', px: 2, py: 5}} spacing={2}>
        <Typography variant="h6">Change Password</Typography>
        {successMessage && (
          <Alert severity="success">{successMessage}</Alert>
        )}
        <TextField
          label="Current password"
          type="password"
          id="current-password"
          name="current-password"
          value={currentPassword}
          error={!!currentError}
          helperText={currentError}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setCurrentError('')
          }}
        />
        <TextField
          label="New password"
          type="password"
          id="new-password"
          name="new-password"
          value={newPassword}
          error={!!newPasswordError}
          helperText={newPasswordError}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setNewPasswordError('')
          }}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={20} color="inherit"/> : 'Change Password'}
        </Button>
      </Stack>
    </Box>
  )
}
```

**Notes:**

- No `Suspense` needed — page does not use `useSearchParams`
- `accessToken` may be null during the initial loading window; guard with `if (!accessToken) return` before the API call
- After password change, the backend invalidates all refresh tokens but the current access token remains valid for 15
  min — no forced logout in v1 (by design)
- No Snackbar — success and error messages are inline only (per UX spec)

---

### Task 4 — authApi.changePassword Method

**Verify backend DTO field names first:** Check `bp_back/src/main/kotlin/com/bagplease/features/auth/dto/` for the exact
`ChangePasswordRequest` data class field names (camelCase by default with Jackson). Likely `currentPassword` and
`newPassword` but confirm before implementing.

```typescript
changePassword: async (currentPassword: string, newPassword: string, accessToken: string) => {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Password change failed')
  }
},
```

**Backend API reference (Story 1.2):**

- `POST /api/auth/change-password`
- Requires: `Authorization: Bearer {accessToken}` header (JWT auth guard)
- Response 200: success (password updated, all refresh tokens invalidated)
- Response 400: `{ "error": "..." }` — wrong current password
- Response 401: `{ "error": "..." }` — missing or invalid token

---

### Form Pattern Rules (consistent with Story 1.4)

- Validation fires on **submit only** — NOT on blur or keystroke
- Errors clear when user **modifies the relevant field** (onChange handler clears that field's error only)
- Enter from any field submits: `<Box component="form" noValidate onSubmit={handler}>`
- Primary action shows `CircularProgress` replacing button text and is disabled while loading
- One `variant="contained"` primary button per screen
- **No Snackbar** for errors OR success — inline only
- `id` and `name` on TextFields — required for password manager autofill (caught in 1.4 review; do not skip)

---

### MUI v9 Patterns

- `TextField label` prop for visible labels — never `placeholder` as a substitute
- `helperText` + `error` prop on TextField handles `aria-describedby` automatically (no separate `FormHelperText`)
- `CircularProgress` inside Button: `color="inherit"` so it takes the button's text color; `size={20}` for fit
- `Alert severity="success"` for inline success — consistent with the `Alert severity="warning"` pattern from login
- `styled()` from `@mui/material/styles` (NOT `@emotion/styled`) for theme-integrated styled components
- Use `theme.spacing()` multiples for all spacing — no raw `px` values

---

### Learnings from Story 1.4 (Apply Here)

| Finding                                             | Where it applies in 1.5              |
|-----------------------------------------------------|--------------------------------------|
| `id` and `name` on TextFields required for autofill | All TextFields in ChangePasswordPage |
| `Suspense fallback` required with `useSearchParams` | Not needed here — no search params   |
| `aria-label` on IconButton (not just `title`)       | No new IconButtons in this story     |
| Merge imports from same package into one statement  | All imports in all files             |

---

### Scope Boundaries — What NOT to Build

- **Admin "User Management" nav link** → Story 2.3 scope; do NOT add to Navigation now
- **Registration toggle awareness on login page** → Story 2.4 scope
- **Admin route guard** → Story 2.3 scope
- **The existing Register link on login page** — leave as-is; Story 2.4 handles conditional display
- **Any backend changes** — this story is frontend-only

---

### Files to Create / Modify

| File                                         | Action | Notes                                                               |
|----------------------------------------------|--------|---------------------------------------------------------------------|
| `bp_front/src/app/AppHeader.tsx`             | MODIFY | Add `"use client"`, import `useAuth`, add `UserChip` via `styled()` |
| `bp_front/src/app/Navigation.tsx`            | MODIFY | Add "Change Password" MenuItem → `/account/password`                |
| `bp_front/src/app/account/password/page.tsx` | CREATE | New directory + ChangePasswordPage                                  |
| `bp_front/src/lib/auth/authApi.ts`           | MODIFY | Add `changePassword(currentPassword, newPassword, accessToken)`     |

**Do NOT touch:**

- `src/lib/auth/AuthContext.tsx` — stable from Story 1.3
- `src/app/ApolloWrapper.tsx` — no changes needed
- `src/app/layout.tsx` — no changes needed
- `src/app/RouteGuard.tsx` — no changes needed
- `src/app/auth/Logout.tsx` — no changes needed
- `src/lib/theme.ts` — UserChip uses `styled()` in AppHeader.tsx; no theme.ts changes needed
- `src/__generated__/` — auth is REST, no schema changes

### References

- Epics `_bmad-output/planning-artifacts/epics.md` — Story 1.5 ACs, UX-DR4, UX-DR8, UX-DR9, UX-DR10
- UX spec `_bmad-output/planning-artifacts/ux-design-specification.md` — UserChip, ChangePasswordPage, Form Patterns,
  Feedback Patterns, Button Hierarchy
- Architecture `_bmad-output/planning-artifacts/architecture.md` — Frontend Architecture section, Requirements→File
  Mapping (Story 1.5 row)
- Story 1.4 dev notes `_bmad-output/implementation-artifacts/1-4-login-registration-ui.md` — review findings, form
  patterns, authApi shape
- Existing `bp_front/src/app/AppHeader.tsx`
- Existing `bp_front/src/app/Navigation.tsx`
- Existing `bp_front/src/lib/auth/authApi.ts`
- Existing `bp_front/src/lib/auth/AuthContext.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story, dev-story)

### Debug Log References

### Completion Notes List

- AC1: `AppHeader.tsx` converted to Client Component; `UserChip` built with two `styled(Box)` components (
  `ChipContainer`, `AvatarCircle`) — all visual properties via theme tokens, only layout `sx` on Toolbar children.
  Conditionally rendered when `username` non-null.
- AC6: `Navigation.tsx` gains a `Change Password` `MenuItem` + preceding `Divider` at the bottom of the menu, calling
  `router.push('/account/password')`.
- AC2/3/4/5: `ChangePasswordPage` created at `src/app/account/password/page.tsx` — `Box component="form"` for
  Enter-submits, `id`/`name` on TextFields, inline `Alert severity="success"`, `FormHelperText` error via `helperText` +
  `error` props, `CircularProgress size={20} color="inherit"` in button while submitting.
- AC3/4: `authApi.changePassword` added — `POST /api/auth/change-password`, `Authorization: Bearer`, throws with
  `data.error` on non-OK.
- Build: `npm run build` passes — zero TypeScript errors, `/account/password` route compiled.

### File List

- `bp_front/src/app/AppHeader.tsx`
- `bp_front/src/app/Navigation.tsx`
- `bp_front/src/app/account/password/page.tsx`
- `bp_front/src/lib/auth/authApi.ts`

### Review Findings

- [x] [Review][Patch] UserChip crashes when username is empty string [`AppHeader.tsx:38`] — fixed: `username[0]` →
  `username.charAt(0)`
- [x] [Review][Patch] Change Password MenuItem and Divider render for unauthenticated users [`Navigation.tsx:113-117`] —
  fixed: wrapped in `{username && <>...</>}` after adding `useAuth` import
- [x] [Review][Patch] Stale success banner persists while user retypes [`account/password/page.tsx`] — fixed: added
  `setSuccessMessage('')` to both onChange handlers
- [x] [Review][Patch] Non-JSON error responses silently swallowed in `changePassword` [`authApi.ts:44-45`] — fixed:
  `data.error ?? res.statusText ?? 'Password change failed'`
- [x] [Review][Defer] Silent return when `accessToken` is null gives user no feedback [`account/password/page.tsx:33`] —
  deferred, spec-designed behavior (loading-window guard); UX improvement is post-scope
- [x] [Review][Defer] UserChip causes layout shift during hydration [`AppHeader.tsx`] — deferred, pre-existing concern
  beyond story scope; needs skeleton/loading state design
- [x] [Review][Defer] No client-side check that new password differs from current [`account/password/page.tsx:30-31`] —
  deferred, server-enforced
- [x] [Review][Defer] No minimum password length client validation [`account/password/page.tsx:31`] — deferred,
  server-enforced
- [x] [Review][Defer] Non-wrong-password server errors (401, 500) surfaced under "Current password" field [
  `account/password/page.tsx`] — deferred, only AC4 wrong-password case is spec'd; general error placement is post-scope
  design
- [x] [Review][Defer] No spacing `sx` between UserChip and Navigation icon in Toolbar [`AppHeader.tsx`] — deferred, no
  spec requirement for exact gap
