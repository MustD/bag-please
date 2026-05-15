# Story 2.3: Admin User Management UI

Status: ready-for-dev

## Story

As an admin,
I want a dedicated user management page to view and control all user accounts,
So that I can manage the user base on mobile or desktop without touching the database.

## Acceptance Criteria

**AC1 — User table renders:**
Given the admin is authenticated and navigates to `/admin/users`,
When the page renders,
Then a Paper-wrapped MUI Table lists all users with username and role columns,
And each row has a reset-password `IconButton` and a delete `IconButton` (both with `title` props),
And a "Create user" Button is visible above the table.

**AC2 — Loading state:**
Given the user list is loading,
When the data fetch is in progress,
Then a `CircularProgress` is shown centred in the table area while the table header remains visible.

**AC3 — Empty state:**
Given no users have been created yet,
When the table renders,
Then a single row with muted text "No users yet. Create the first one." is displayed.

**AC4 — Create user dialog:**
Given the admin clicks "Create user",
When the `ConfirmDialog` opens,
Then it contains username and password `TextField` inputs,
And the Cancel button receives initial focus,
And on successful submit the new user appears in the table immediately without a page reload.

**AC5 — Delete user dialog:**
Given the admin clicks the delete `IconButton` for a user,
When the `ConfirmDialog` opens,
Then the title is "Delete user?" and the body states "This cannot be undone.",
And the Cancel button receives initial focus and the confirm button uses `color="error"`,
And confirming removes the user from the table immediately.

**AC6 — Reset password dialog:**
Given the admin clicks the reset-password `IconButton` for a user,
When the `ConfirmDialog` opens,
Then it contains a new-password `TextField` and warns that the user's current session will be invalidated,
And confirming sends the request and closes the dialog with no success Snackbar.

**AC7 — Admin guard:**
Given a non-admin user navigates to `/admin/users`,
When the admin guard evaluates,
Then the user is redirected to `/`.

**AC8 — Navigation menu entry:**
Given an admin opens the navigation menu,
When the menu renders,
Then a "User Management" MenuItem is visible and links to `/admin/users`,
And this item is NOT rendered for non-admin users.

## Tasks / Subtasks

- [ ] Task 1: Add GraphQL operations for user admin (AC: 1, 4, 5, 6)
    - [ ] Create `bp_front/src/lib/user/Queries.tsx` with `getUsersQuery`, `createUserMutation`, `deleteUserMutation`,
      `resetUserPasswordMutation`
    - [ ] Run `npm run generate` from `bp_front/` to regenerate `__generated__/graphql.ts` (requires backend on `:2080`
      with valid JWT in `codegen.ts`)

- [ ] Task 2: Create `ConfirmDialog` component (AC: 4, 5, 6)
    - [ ] Create `bp_front/src/app/admin/ConfirmDialog.tsx`
    - [ ] Props: `open`, `title`, `message`, `confirmLabel`, `confirmColor` (`"error" | "primary"`), `onConfirm`,
      `onCancel`, optional `children`
    - [ ] `maxWidth="xs"`, initial focus on Cancel, confirm button shows `CircularProgress` and is disabled during async
      operation
    - [ ] Escape closes dialog (MUI Dialog default — no extra code needed)

- [ ] Task 3: Create admin route guard (AC: 7)
    - [ ] Create `bp_front/src/app/admin/layout.tsx` — client component using `useAuth()` to check `role === 'admin'`;
      redirect to `/` if not admin or if loading is done and role is not admin

- [ ] Task 4: Create `AdminUsersPage` (AC: 1–6)
    - [ ] Create `bp_front/src/app/admin/users/page.tsx`
    - [ ] Use `useQuery(getUsersQuery)` with Apollo Client; derive list from `data.users`
    - [ ] Render `CircularProgress` centred in table area while `loading` is true; keep table header visible
    - [ ] Empty state: single row with muted `Typography` "No users yet. Create the first one."
    - [ ] "Create user" `Button` above table; opens create dialog
    - [ ] Per-row: reset-password `IconButton` (title="Reset password") and delete `IconButton` (title="Delete user")
    - [ ] `useMutation` for `createUserMutation` — optimistic update: append returned user to `data.users`
    - [ ] `useMutation` for `deleteUserMutation` — optimistic update: remove user from `data.users` by id
    - [ ] `useMutation` for `resetUserPasswordMutation` — no UI update needed; just close dialog

- [ ] Task 5: Add "User Management" nav item to Navigation (AC: 8)
    - [ ] Edit `bp_front/src/app/Navigation.tsx` — add a `MenuItem` linking to `/admin/users`, rendered only when
      `role === 'admin'`

- [ ] Task 6: Verify with lint
    - [ ] From `bp_front/`: `npm run lint` — no new lint errors

## Dev Notes

### Critical: GraphQL Types Not Generated Yet

The `__generated__/graphql.ts` file does **not** yet contain `User`, `users` query, `createUser`, `deleteUser`, or
`resetUserPassword` types. Story 2.2 implemented the backend GQL layer but codegen was never run on the frontend side. *
*Task 1 (running `npm run generate`) is a hard prerequisite for all other tasks** — without it, TypeScript compilation
will fail.

Steps to regenerate:

1. Ensure backend is running: `docker compose up mongo router` then from `bp_back/`: `../gradlew run -t`
2. Obtain a JWT: `POST http://localhost:2080/api/login` with `{"username":"admin","password":"admin"}`
3. Copy JWT into `codegen.ts` Authorization header
4. From `bp_front/`: `npm run generate`

The generated types will include:

- `User` type: `{ id: string, username: string, role: string }`
- `UsersQuery` / `UsersQueryVariables`
- `CreateUserMutation` / `CreateUserMutationVariables`
- `DeleteUserMutation` / `DeleteUserMutationVariables`
- `ResetUserPasswordMutation` / `ResetUserPasswordMutationVariables`

### GraphQL Operations to Define in `src/lib/user/Queries.tsx`

```tsx
import {graphql} from "@/__generated__";

export const getUsersQuery = graphql(`query GetUsers {
    users {
        id
        username
        role
    }
}`);

export const createUserMutation = graphql(`mutation CreateUser($username: String!, $password: String!) {
    createUser(username: $username, password: $password) {
        id
        username
        role
    }
}`);

export const deleteUserMutation = graphql(`mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
        id
        username
        role
    }
}`);

export const resetUserPasswordMutation = graphql(`mutation ResetUserPassword($id: ID!, $newPassword: String!) {
    resetUserPassword(id: $id, newPassword: $newPassword) {
        id
        username
    }
}`);
```

### Apollo Cache Update Pattern

The `users` query returns a flat list. After mutations, update the Apollo cache directly to avoid refetching. Use
`update` callback in `useMutation`:

**createUser** — append to list:

```tsx
update(cache, {data}) {
  const existing = cache.readQuery({query: getUsersQuery})
  if (existing && data?.createUser) {
    cache.writeQuery({
      query: getUsersQuery,
      data: {users: [...existing.users, data.createUser]},
    })
  }
}
```

**deleteUser** — filter out by id:

```tsx
update(cache, {data}) {
  const existing = cache.readQuery({query: getUsersQuery})
  if (existing && data?.deleteUser) {
    cache.writeQuery({
      query: getUsersQuery,
      data: {users: existing.users.filter(u => u.id !== data.deleteUser.id)},
    })
  }
}
```

**resetUserPassword** — no cache update needed; password is not in the cache.

### Admin Layout Guard Implementation

The admin guard must handle the `isLoading` state to avoid a flash-redirect on page load before auth is resolved:

```tsx
// bp_front/src/app/admin/layout.tsx
'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {useAuth} from '@/lib/auth/AuthContext'

export default function AdminLayout({children}: React.PropsWithChildren) {
  const {role, isLoading} = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && role !== 'admin') {
      router.replace('/')
    }
  }, [role, isLoading, router])

  if (isLoading) return null
  if (role !== 'admin') return null

  return <>{children}</>
}
```

This mirrors the pattern in `RouteGuard.tsx` — return null during loading, redirect after loading resolves.

### ConfirmDialog Props Interface

```tsx
interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmColor: 'error' | 'primary'
  onConfirm: () => Promise<void>
  onCancel: () => void
  children?: React.ReactNode
}
```

The `onConfirm` is async — the dialog tracks loading state internally:

```tsx
const [loading, setLoading] = useState(false)
const handleConfirm = async () => {
  setLoading(true)
  try {
    await onConfirm()
  } finally {
    setLoading(false)
  }
}
```

Cancel button must use `autoFocus` to satisfy the "initial focus on Cancel" requirement:

```tsx
<Button onClick={onCancel} variant="outlined" autoFocus>Cancel</Button>
<Button onClick={handleConfirm} variant="contained" color={confirmColor} disabled={loading}>
  {loading ? <CircularProgress size={20} color="inherit" /> : confirmLabel}
</Button>
```

### AdminUsersPage Dialog State Pattern

Three separate dialogs require separate state management. Use a single `dialogState` object or separate `useState` per
dialog. The recommended pattern (aligns with existing component style — simple `useState` per concern):

```tsx
const [createOpen, setCreateOpen] = useState(false)
const [deleteTarget, setDeleteTarget] = useState<{id: string; username: string} | null>(null)
const [resetTarget, setResetTarget] = useState<{id: string; username: string} | null>(null)
const [newUsername, setNewUsername] = useState('')
const [newPassword, setNewPassword] = useState('')
const [resetPassword, setResetPassword] = useState('')
```

Clear form state when closing dialogs (reset `newUsername`, `newPassword`, `resetPassword` to `''`).

### MUI Component Usage Notes

- **`useQuery` / `useMutation`** come from `@apollo/client` — already a project dependency
- **`Table`, `TableBody`, `TableCell`, `TableContainer`, `TableHead`, `TableRow`** — MUI table family, use for the user
  list
- **`Paper`** — wrap the table in `Paper` as specified in UX-DR6
- **`IconButton`** — always include `title` prop (accessibility rule from UX-DR15)
- **`Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`** — MUI dialog components for `ConfirmDialog`
- **`CircularProgress`** — `size={20}` inline in button; `size={40}` centred in table loading area

For table loading state, centre `CircularProgress` while keeping the header row:

```tsx
<TableBody>
  {loading ? (
    <TableRow>
      <TableCell colSpan={3} align="center" sx={{py: 4}}>
        <CircularProgress />
      </TableCell>
    </TableRow>
  ) : users.length === 0 ? (
    <TableRow>
      <TableCell colSpan={3}>
        <Typography color="text.secondary">No users yet. Create the first one.</Typography>
      </TableCell>
    </TableRow>
  ) : users.map(user => (
    // ... row
  ))}
</TableBody>
```

**IMPORTANT:** Before writing any MUI component code, use `mcp__mui-mcp__fetchDocs` / `mcp__mui-mcp__useMuiDocs` to look
up the v9 APIs for Dialog, Table, and IconButton — the project is on MUI v9.0.0 which may differ from v5/v6 memory.

### Navigation Update

In `Navigation.tsx`, the `useAuth()` hook already provides `role`. Add the admin menu item conditionally after the
existing items:

```tsx
const {username, role} = useAuth()

// Inside the Menu, after existing items:
{role === 'admin' && <>
  <Divider/>
  <MenuItem onClick={() => {
    onClose()
    router.push('/admin/users')
  }}>
    <Typography>User Management</Typography>
  </MenuItem>
</>}
```

### What NOT to Build

- Registration toggle Switch — that's Story 2.4 (`2-4-registration-toggle-ui-adaptive-login-screen`)
- Snackbar/toast on success — UX-DR13 forbids success toasts; mutations confirmed by immediate UI update
- Direct MongoDB writes — never; use GQL mutations only
- `useSubscription` for real-time user list updates — not in ACs; real-time is not required for admin user list
- Error display as Snackbar — show inline in dialog or console only; project uses no toast pattern
- Any backend changes — this is a frontend-only story

### File Structure

New files:

```
bp_front/src/lib/user/Queries.tsx
bp_front/src/app/admin/ConfirmDialog.tsx
bp_front/src/app/admin/layout.tsx
bp_front/src/app/admin/users/page.tsx
```

Modified files:

```
bp_front/src/app/Navigation.tsx
bp_front/src/__generated__/graphql.ts  (auto-generated by npm run generate)
```

### Previous Story Learnings (from 2.2)

- Backend GQL: `users` query, `createUser`, `deleteUser`, `resetUserPassword` mutations are fully implemented and tested
- The admin account (env `KTOR_ADMIN_LOGIN`) is NOT in the `users` query response — data model enforces this
- `deleteUser` and `resetUserPassword` both invalidate the target user's refresh tokens server-side
- Review patches from 2.2 that affect this story: `createUser` now throws `GraphQLConflictException` with a structured
  error code (not a bare `RuntimeException`) — handle `errors` in the GraphQL response gracefully in the UI
- The `role` field comes from the JWT payload; `AuthContext.tsx` already parses and exposes it as
  `'admin' | 'user' | null`

### References

- [epics.md §Story 2.3] — authoritative ACs
- [ux-design-specification.md UX-DR6] — AdminUsersPage layout spec
- [ux-design-specification.md UX-DR7] — ConfirmDialog spec
- [ux-design-specification.md UX-DR10] — Navigation update spec
- [ux-design-specification.md UX-DR12] — admin guard redirect rule
- [ux-design-specification.md UX-DR13] — button hierarchy, no success toasts
- [ux-design-specification.md UX-DR14] — mobile-first, `sx` only for spacing
- [ux-design-specification.md UX-DR15] — accessibility: `title` on IconButton, `label` on TextField
- [project-context.md §Next.js/Apollo] — `useQuery`, `subscribeToMore` rules, no second Apollo client, `__generated__`
  usage
- [project-context.md §TypeScript] — strict mode, `@/` imports, `"use client"` on hook-using components
- [project-context.md §Code Quality Frontend] — `sx` only, PascalCase files, one default export per file
- [AuthContext.tsx] — `useAuth()` provides `{username, role, isLoading}` — use for admin guard and nav conditionality
- [RouteGuard.tsx] — pattern for `isLoading` + redirect guard; admin layout should mirror this
- [Navigation.tsx] — existing menu structure to extend with admin item
- [ChangePasswordPage] — reference pattern for form with loading state, error handling, `"use client"`
- [2-2-admin-user-management-backend.md] — complete backend API details, error codes, GQL mutation signatures

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

## Change Log
