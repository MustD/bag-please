# Epic 5 Context: Frontend Reframe — Vite + MUI + Caddy

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The frontend is rebuilt from scratch as a Vite + React + TypeScript single-page app styled with Material UI and served by Caddy, replacing the old Next.js app (`bp_front`) and the nginx reverse proxy (`routing/`). The existing Ktor/GraphQL backend is the system of record and is consumed unchanged — no backend code may be modified without explicit confirmation. On the new stack, the epic re-delivers every in-scope frontend requirement across authentication, account management, admin user management, list management, the list/shopping view, and list sharing, while keeping real-time collaboration. This matters because the previous frontend shipped unverifiable and broken (no E2E, broken mobile login); the reframe trades stabilization for a clean, simpler stack the team controls end-to-end, with a hard rule that every feature ships a manually-validated, real-browser E2E test.

## Stories

- Story 5.1: Foundation — Vite + MUI + Caddy + Apollo Shell
- Story 5.2: Authentication
- Story 5.3: User Account
- Story 5.4: Admin User Management
- Story 5.5: Lists Management
- Story 5.6: List View, Shopping & Real-Time
- Story 5.7: Sharing & Membership

## Requirements & Constraints

- Backend is off-limits: the GraphQL schema and REST auth endpoints are consumed as-is; the old frontend and nginx are removed outright (no parity-gated cutover, no fallback).
- Every feature story ships a UI-driven (no API-only shortcuts), FR-mapped Playwright E2E test that is manually exercised in a real browser before the test is written.
- Auth surface delivered on the new stack: register with auto-login (no separate login step), login, logout, silent access-token refresh, and session-expiry redirect carrying an expiry message. Any auth failure returns one uniform, non-distinguishing message; rate-limit throttling must be surfaced.
- The Register affordance is conditional on the runtime registration toggle; when disabled it is hidden and replaced with "contact your admin" guidance.
- Admin area is admin-only (non-admins redirected); provides a users table (with loading/empty states), create user, delete user and reset password (each behind an explicit confirmation dialog, reset including a new-password field), and the registration toggle whose effect is immediate on the auth page.
- List management: lists index with zero-state onboarding; create list (name required, emoji/icon, optional description) and owner-only delete (cascades to items and categories); category and item add/remove always scoped to a list; create/edit happen in overlays without losing scroll position.
- List view/shopping: items grouped by category with check/uncheck; filters by category, checked status, and free-text search; rows show optional store and the `addedBy` user; per-list real-time updates via subscription.
- Sharing: share by exact username creates a pending invite (specific errors for unknown user, existing member, or self); invitee accepts/declines and has no access until accepted; all members get full peer write access; owner can remove members and non-owners can leave; the admin account is blocked from all list operations and this must be surfaced gracefully.
- Deferred: one-timer (FR42) and recurring (FR43) item UI affordances are postponed; backend support (including the hourly scheduler) remains.

## Technical Decisions

- Stack: Vite + React + TypeScript + Material UI; client-side routing via React Router with auth and admin route guards.
- Routing/topology: Caddy serves `/*` with SPA fallback to `index.html`, proxies `/api/subscriptions` to the backend WebSocket, and `/api/*` to backend HTTP. Caddy must match `/api/subscriptions` before the broader `/api/*` rule. `/api/subscriptions` maps to the backend's existing mount, so no backend routing change is needed.
- Apollo Client uses a split link: an HTTP terminating link to `/api/graphql` for queries/mutations and a WebSocket link to `/api/subscriptions` for subscriptions. GraphQL codegen is retargeted to the new Vite source tree.
- Auth model: access token held in memory only (React context) — never in `localStorage`; refresh token lives in an httpOnly cookie. Auth context exposes `username`, `role`, `accessToken`, and `setAuth`/`clearAuth`. WebSocket subscriptions supply the JWT via `connectionParams` (`Authorization: Bearer <token>`); on logout the WS client is disposed before auth state is cleared.
- Route conventions: `/auth` (and register) for unauthenticated flows; `/admin/*` admin-guarded; `/list/[listId]` is the shopping view with the active list reflected in title and URL; `/` redirects to the user's oldest list, or to the lists index if they have none.
- This reframe supersedes the prior frontend architecture (Next.js App Router pages, nginx, localStorage tokens) and the heavy Epic 4 UX component spec (BPSheet, BPBottomNav, ProgressStrip, etc.); those are not carried forward. Backend architecture is unchanged.

## UX & Interaction Patterns

- Visual style comes from `design/Bag Please.html` and the sibling `design/` assets (palette, typography, look-and-feel) — a style reference for the MUI theme, not a functional prototype. Behavior, flows, and component structure follow the FRs and story ACs, not the mockup. Concrete palette/accent/density tokens live in `design/theme.js`.
- Form conventions carried from prior epics: inline field errors (no error Snackbars); mutations confirmed by immediate UI change rather than success toasts; primary action buttons show a loading state and disable during async work.

## Cross-Story Dependencies

- Story 5.1 (foundation: scaffold, Caddy/Compose swap, Apollo split link, auth context + guards, Playwright harness) is a hard prerequisite for all other stories.
- Story 5.4's registration toggle drives Story 5.2's conditional Register link.
- Story 5.7 (sharing/membership) builds on the lists (5.5) and list-view/real-time (5.6) surfaces.
- Test accounts: use `mia/mia` for list-feature browser/E2E flows; the `admin` account is blocked from list operations.
