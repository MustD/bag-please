---
title: 'Story 5.6 — List View, Shopping & Real-Time'
type: 'feature'
created: '2026-07-21'
status: 'done'
baseline_revision: '43f0cc3519eabe9b15a87229198d601c5473a585'
final_revision: 'dfd837a0d0a500107f6daa9617ad2bfc75b1412b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-5-lists-management.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** Users can create lists and manage their categories/items (Story 5.5), but there is no shopping surface: no way to open a list, check items off, filter, see who added what, switch lists, or see collaborators' changes live. `/` is still a placeholder home.

**Approach:** Add a `/list/:id` shopping view (items grouped by category, check/uncheck, category/checked/search filters, store + addedBy display) with a list-switcher chip row and **per-list real-time** via `subscribeToMore` over the existing Apollo WebSocket link. Make `/` redirect to the user's oldest list (or `/lists` when none; `/admin` for the admin), relocating the one-time welcome banner. Backend consumed as-is.

## Boundaries & Constraints

**Always:**
- Consume the frozen backend contract as-is; author operations in `src/lib/lists/listsQueries.ts` with `graphql()` from `@/__generated__`, derive types from `@/__generated__/graphql`, then `npm run generate`. Single Apollo client; `useQuery`/`useMutation`/`subscribeToMore` from `@apollo/client/react`.
- **Real-time uses `subscribeToMore` on the parent `useQuery`** (never a separate `useSubscription`, never a second client). Subscriptions run over the already-wired split link to `/api/subscriptions` with the JWT in `connectionParams`.
- **Idempotent realtime merge (self-echo safe):** the backend echoes the caller's OWN actions and a `getItemUpdates` `SAVED` event can carry `item.deleted === true` (one-timer check). Merge rule: `DELETED` → remove by id; `SAVED` with `deleted` truthy → remove by id; `SAVED` with `deleted` falsy → replace-or-append by id. Category updates: `SAVED` → upsert by id, `DELETED` → remove by id.
- **Client sorts** — neither `lists.lists` nor `getItems` is ordered by the backend. Sort lists by `createdAt` (ISO) ascending for "oldest"; sort items/categories by name for display.
- Errors shown inline via MUI `<Alert>` (never toasts) using `graphqlErrorMessage` (`@/lib/admin/adminErrors`). The only stable `extensions.code` from list flows is `FORBIDDEN`; treat FORBIDDEN on a list resource as "not authorized" (admin-blocked or non-member), not "empty list".
- Styling via MUI theme + `sx` only; one default export per file; PascalCase; no `console.log` in components; `@/` imports.
- Every scenario ships a UI-driven, FR-mapped Playwright E2E (manually exercised first), green on `chromium` + `mobile`. Register fresh unique users per run/project; assert only on self-created data.

**Block If:**
- Any change to `bp_back/` is required to satisfy a criterion. Backend is frozen — HALT with status `blocked` and surface the needed change for `md`.

**Never:**
- No item CRUD on the shopping view — add/remove/edit items and categories stay on the Story-5.5 management view (`/lists/:id`). (Editing via `saveItem` would overwrite `addedBy` and reset check/delete metadata — do not use it here.)
- No one-timer (FR42) / recurring (FR43) UI. No sharing/invite/member-management UI (Story 5.7) — the shopping view only reads membership implicitly.
- Do not modify `AuthPage`, `RouteGuard`, `AdminGuard`, or the auth token model. Do not permanently `dispose()` the WS on logout (that would break re-subscribe after re-login without a reload) — rely on `subscribeToMore` lifecycle teardown (see Design Notes).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open list (member) | `/list/:id`, caller is owner/member | Items grouped by category (with an "Uncategorized" group for items whose category id is unknown locally); switcher shows the active list; header shows `{emoji} {name}` | — |
| Deep-link / not a member | `/list/:id`, caller not a member (or unknown list) | `getItems`/`getCategories` return `FORBIDDEN` → redirect to `/lists` (graceful), not a broken/empty view | FORBIDDEN caught → `<Navigate to="/lists" replace>` |
| Admin opens a list | admin at `/list/:id` | FORBIDDEN ("Admin cannot access list resources") → redirect to `/lists` (which shows the graceful notice) | as above |
| Check / uncheck | click an item's checkbox | `checkItem`/`uncheckItem`; the row reflects checked immediately (normalized cache) and persists | mutation error → inline `<Alert>`; checkbox reverts to server state |
| Filters | pick category, toggle checked-status, type search text | Item list filters client-side by all active filters combined (AND); category filter scopes visible groups | — |
| Real-time item add/check/delete | another member changes an item | The change appears live (≤ a moment) without refresh via `getItemUpdates` `subscribeToMore` merge | subscription error tolerated; view still usable |
| `/` redirect | authenticated visit to `/` | Has lists → `/list/:oldest` (min `createdAt`); no lists → `/lists`; admin → `/admin` | lists query error (non-admin) → fall back to `/lists` |
| Logout while subscribed | user logs out from `/list/:id` | Shopping page unmounts → `subscribeToMore` unsubscribes → the lazy WS socket closes; no post-logout subscription frames | — |

</intent-contract>

## Code Map

- `bp_front/src/lib/lists/listsQueries.ts` -- **extend** `Items` query to also select `store`, `addedBy`; **add** `CheckItem`, `UncheckItem` mutations and `ItemUpdates`(`getItemUpdates`), `CategoryUpdates`(`getCategoryUpdates`) subscriptions. `ListItem`/`ListCategory` derived types widen automatically.
- `bp_front/src/App.tsx` -- route table. Add `/list/:id` → `ListShoppingPage`; change `/` from `HomePage` to `HomeRedirect`; remove the `HomePage` import/route.
- `bp_front/src/routes/HomePage.tsx` -- **delete** (its role — `/` landing + welcome — is replaced by `HomeRedirect` + welcome relocated to `ListsPage`). Confirm no other references (`WelcomeBanner.tsx` comment only).
- `bp_front/src/routes/ListsPage.tsx` -- **owns the one-time welcome banner now**: read `location.state.welcome` once, render `WelcomeBanner`, scrub history state (mirror the deleted HomePage logic exactly). New users land here after registration (via `/` redirect forwarding `welcome`).
- `bp_front/src/routes/ListDetailPage.tsx` -- reference for per-list querying + category/item grouping (management view; do not change beyond what the widened `ListItem` type forces — it doesn't use `store`/`addedBy`).
- `bp_front/src/components/AppShell.tsx` -- AppBar (`app-bar` testid) wraps every guarded route; used as the route-agnostic "authenticated" signal in updated E2E. Logout path (`clearAuth`) — see Design Notes re FR53.
- `bp_front/src/lib/apollo/ApolloProvider.tsx` -- split link + lazy graphql-ws client already wired (JWT in `connectionParams`, `disposeWs` on the 401 path). No change unless the logout-socket-close verification fails (Design Notes).
- `bp_front/e2e/{auth,account,admin,lists}.spec.ts` -- **update** post-auth landing assertions (see Tasks); `e2e/global-setup.ts`, `playwright.config.ts` -- harness (chromium+mobile, UI login, unique names).

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/src/lib/lists/listsQueries.ts` -- extend `Items` (add `store`, `addedBy`); add `CheckItem(id,listId)`/`UncheckItem(id,listId)` (select `id name checked category listId store addedBy deleted`), and subscriptions `ItemUpdates($listId){ type item{ id name checked category listId store addedBy deleted } }` and `CategoryUpdates($listId){ type item{ id name listId } }`. -- realtime + shopping data.
- [x] `bp_front/src/__generated__/**` -- regenerate via `CODEGEN_TOKEN=… npm run generate` immediately after (pages import these types); commit, never hand-edit. -- typed docs incl. subscriptions.
- [x] `bp_front/src/routes/ListShoppingPage.tsx` -- `/list/:id` shopping view (root testid `list-shopping-page`): `useQuery(Items)` + `useQuery(Categories)` for `:id`; `subscribeToMore` on each (idempotent merge per Always-rules); group items by category with an "Uncategorized" fallback group; per-item `Checkbox` → `checkItem`/`uncheckItem`; show `store` + an `addedBy` avatar/label; filters (category `Select`/chips, checked-status toggle, free-text search `TextField`) applied client-side (AND); list-switcher `Chip` row (from `Lists` query) navigating to other `/list/:id`, active chip highlighted; header shows `{emoji} {name}` of the active list (also set `document.title`); redirect to `/lists` on FORBIDDEN. -- FR36/FR40/FR44/FR45/FR49/FR52/FR53.
- [x] `bp_front/src/routes/HomeRedirect.tsx` -- `/` redirect: if `role === 'admin'` → `<Navigate to="/admin" replace>`; else `useQuery(Lists)` — loading → spinner; error → `<Navigate to="/lists" replace>`; empty → `<Navigate to="/lists" replace state={{welcome}}>` (forward `location.state.welcome`); else → `<Navigate to="/list/:oldestByCreatedAt" replace>`. -- FR38.
- [x] `bp_front/src/routes/ListsPage.tsx` -- render the one-time `WelcomeBanner` from `location.state.welcome` (read-once + scrub history state, copied from the deleted HomePage); keep all existing 5.5 behavior/testids. -- FR5 continuity under FR38.
- [x] `bp_front/src/App.tsx` -- add `/list/:id` → `ListShoppingPage`; point `/` → `HomeRedirect`; remove `HomePage` import + route. -- routing.
- [x] `bp_front/src/routes/HomePage.tsx` -- delete (dead after `/` change). -- cleanup.
- [x] `bp_front/e2e/lists.spec.ts` -- update `registerViaUi` landing assertion to route-agnostic (`await expect(page).not.toHaveURL(/\/auth$/)` + `app-bar` visible) since new users now land on `/lists`; fix any `toHaveURL(/\/$/)` reliance (line ~216). -- keep suite green.
- [x] `bp_front/e2e/auth.spec.ts` -- update the register + re-login landing assertions (`toHaveURL(/\/$/)` + `home-page`) to the route-agnostic authenticated check. -- keep suite green.
- [x] `bp_front/e2e/account.spec.ts` -- update post-auth `home-page` assertions to route-agnostic; update the FR5 welcome test: banner now appears on `/lists` (assert `lists-page` + `welcome-banner` count 1 after register; absent on re-login). -- keep suite green.
- [x] `bp_front/e2e/admin.spec.ts` -- update admin + managed-user landing assertions (`home-page`/`toHaveURL(/\/$/)`) to route-agnostic authenticated checks (admin lands via `/`→`/admin`; managed users → `/lists`). -- keep suite green.
- [x] `bp_front/e2e/shopping.spec.ts` -- new UI-driven, FR-mapped scenarios (chromium+mobile): (a) open a list → check then uncheck an item; (b) each filter (category, checked-status, search); (c) `/` redirects an authenticated user with a list to `/list/:oldest`; (d) **two-actor realtime**: register two users, create a list+category+item as owner (UI), seed membership via backend `shareList`+`acceptInvite` mutations using each user's `POST /api/auth/login` token (setup only, not the asserted behavior), then actor A views `/list/:id` while actor B checks the item via UI → actor A sees it checked live without reload. -- FR36/FR38/FR40/FR49/FR52/FR53 verification.

**Acceptance Criteria:**
- Given a member at `/list/:id`, when the page loads, then items appear grouped by category, each showing its store (if any) and the addedBy user, and the switcher + header reflect the active list. (FR36/FR44/FR45/FR49)
- Given an item, when its checkbox is toggled, then it becomes checked/unchecked and the state persists across a reload. (FR40)
- Given active filters, when a category / checked-status / search term is applied, then only matching items are shown (filters combine). (reframe 7.1)
- Given two members viewing the same list, when one checks an item, then the other sees the change live without refreshing. (FR52)
- Given a logged-in user, when they visit `/`, then they are redirected to their oldest list, or to `/lists` if they have none (and the admin to `/admin`). (FR38)
- Given a user subscribed on `/list/:id`, when they log out, then the WebSocket socket closes and no further subscription frames arrive. (FR53)
- Given a non-member (or the admin) deep-links `/list/:id`, then they are redirected to `/lists` rather than shown a broken/empty view.
- Given `npm run build`, `npm run lint`, and `npm run test:e2e`, then all pass (E2E green on chromium + mobile; existing specs updated, no regressions).

## Spec Change Log

_Empty — no bad_spec loopback yet._

## Review Triage Log

### 2026-07-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 3, low 1)
- defer: 0
- reject: 12
- addressed_findings:
  - `[medium]` `[patch]` Switching lists via the switcher chip re-rendered the same route element in place, so `categoryFilter`/`search`/`checkedFilter` state carried across lists — the previous list's category id matched nothing, stranding the view on "no items match". Fixed with a render-phase reset on `listId` change (plus dropping a category filter that no longer matches any current category, which also covers a live category deletion → out-of-range MUI Select). Added an FR36 E2E asserting the switcher changes header/URL and resets the filter.
  - `[medium]` `[patch]` The Apollo `lists` cache was never reset on logout; because HomeRedirect and the switcher now navigate/render off it, a second user logging in in the same tab (no reload) was mis-redirected to the first user's list and briefly saw their list names. Fixed: `ApolloProvider` calls `apolloClient.clearStore()` on the logout transition (username → null).
  - `[medium]` `[patch, test]` Two guard-redirect assertions had been weakened to `not.toHaveURL(...)` + `app-bar`, which would pass on a wrong-target regression. Restored FR-specific destinations: admin bounced from `/account/password` → asserts `/admin`; non-admin bounced from `/admin` → asserts `/lists`.
  - `[low]` `[patch]` HomeRedirect dropped the one-time `welcome` signal on its lists-query-error branch (banner lost for a new user on a transient error). Fixed: forward `state={{welcome}}` there too.
- rejected (noteworthy): partial query-failure blanks the surface (both queries share auth+listId → fail/succeed together; fail-closed acceptable); `updateQuery` returning falsy on no-data (standard Apollo no-op); `subscribeToMore` dep stability (AC4-stable; the `listId` dep correctly re-targets the subscription on switch); realtime-readiness race in FR52 (the member's own navigation latency closes the window; passed reliably — documented residual); doomed WS subscribe before the FORBIDDEN redirect (rejected+cleaned-up, no impact); toggle-FORBIDDEN not redirecting (mid-session revocation is Story-5.7 territory; inline error acceptable); unknown list id (backend returns FORBIDDEN, which redirects); `createdAt` lexical sort (ISO-8601, chronologically correct); rapid check/uncheck ordering (server-controlled + subscription self-corrects); duplicate-name testids (React keys use `id`; E2E uses unique names).

## Design Notes

- **FR53 / WS disposal (primary mechanism = lifecycle):** the graphql-ws client is lazy (connects on first subscribe, closes when the last subscription ends). Wiring realtime via `subscribeToMore` on the shopping page's `useQuery` means logout → `RouteGuard` redirect to `/auth` → page unmounts → subscription unsubscribes → socket closes. So **no logout-path code change is required**; do NOT add a permanent `dispose()` on logout (it would break re-subscribe after re-login without a reload). During the manual pass and E2E, VERIFY (browser Network/WS panel or absence of post-logout frames) that the socket actually closes on logout. Only if it demonstrably lingers, close it non-destructively on the `username` non-null→null transition inside `ApolloProvider` via `wsClient.terminate()` (not `dispose()`), preserving re-login.
- **Realtime merge (the subtle part):** `subscribeToMore.updateQuery` for `Items` — build the next `getItems` array from `prev`: index by `id`; on `DELETED` or `SAVED&&item.deleted` → drop that id; on `SAVED&&!item.deleted` → replace if present else append. Return a new array (immutably). Field changes (e.g. `checked` by another user) also arrive as `SAVED` and Apollo normalizes the `item{...}` entity, but the array merge is still needed for adds/removes. For `Categories`, upsert/remove by id. Because the stream echoes the caller's own actions, the merge MUST be idempotent (keying by id makes it so).
- **Check/uncheck cache:** `checkItem`/`uncheckItem` return the updated `Item`; with `nonOptionalTypename` codegen, Apollo normalizes by id so the checkbox reflects the new `checked` without manual cache writes. Items created in Story 5.5 are `recurring: null`, so `checkItem` just sets `checked=true` (the row stays visible) — no disappearing-on-check behavior to handle here.
- **`/` + welcome relocation:** `AuthPage` still navigates to `/` with `state.welcome` after registration (unchanged). `HomeRedirect` forwards `welcome` to `/lists` (a new user has no lists), and `ListsPage` renders the one-time banner. This keeps FR5 intact while `/` becomes a redirect. Delete `HomePage`.
- **Landing-assertion churn:** existing specs assert `toHaveURL(/\/$/)` + `home-page` after auth. Replace each with a route-agnostic authenticated check — `await expect(page).not.toHaveURL(/\/auth$/)` + `await expect(page.getByTestId('app-bar')).toBeVisible()` — because the landing route now varies (regular users → `/lists` or a list; admin → `/admin`).
- **Two-actor E2E membership seeding:** sharing UI is Story 5.7, so make the second user a member via the backend `shareList`(owner token)+`acceptInvite`(invitee token) GraphQL mutations, tokens obtained via `POST /api/auth/login` — this is test *setup*, mirroring `global-setup`'s API use; the asserted realtime behavior (check in one browser → appears in the other) stays fully UI-driven.
- **Group ordering / Uncategorized:** sort categories and items by name for stable rendering; render an "Uncategorized" group for items whose `category` id has no matching category (covers live category deletion and a realtime item arriving in a not-yet-known category), so items never silently vanish from the shopping view.

## Verification

**Commands:**
- `cd bp_front && CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate` -- expected: `graphql.ts` gains `Items`(with store/addedBy), `CheckItem`, `UncheckItem`, `ItemUpdates`, `CategoryUpdates`; no hand-edits.
- `cd bp_front && npm run build` -- expected: `tsc -b && vite build` clean.
- `cd bp_front && npm run lint` -- expected: eslint clean.
- `cd bp_front && npm run test:e2e` -- expected: `shopping.spec.ts` green on chromium + mobile; updated `auth`/`account`/`admin`/`lists` specs green; no regressions (the pre-existing shared registration-flag flake in `auth.spec` is CI-retry-healed, per Story 5.4/5.5 — not a 5.6 regression).

**Manual checks:**
- Manually exercise on `:2080` before writing the E2E (reframe rule 1): as a regular user with a list, open `/list/:id`; check/uncheck an item; apply each filter; switch lists via the chip row (header + URL update); confirm store/addedBy render. In a second browser as a co-member, check an item and confirm it updates live in the first. Confirm `/` redirects (with a list → oldest list; brand-new user → `/lists` with the welcome banner; admin → `/admin`). Log out from `/list/:id` and confirm (Network/WS panel) the subscription socket closes with no further frames.

## Auto Run Result

Status: **done**

### Summary
Delivered Story 5.6 on the Epic-5 reframe frontend (backend untouched). Added the `/list/:id` shopping view (items grouped by category with an "Uncategorized" fallback, per-item check/uncheck, store + addedBy display, category/checked/search filters, a list-switcher chip row, active-list header + `document.title`, FORBIDDEN→`/lists`) with per-list real-time via `subscribeToMore` (items + categories, idempotent self-echo-safe merge over the existing JWT WebSocket). Made `/` a redirect (`HomeRedirect`: admin→`/admin`; oldest list by `createdAt`; else `/lists`), relocated the one-time welcome banner from the deleted `HomePage` to `ListsPage`, and updated the auth/account/admin/lists E2E landing assertions accordingly.

### Files changed
**Added:** `bp_front/src/routes/ListShoppingPage.tsx`, `bp_front/src/routes/HomeRedirect.tsx`, `bp_front/e2e/shopping.spec.ts` (5 scenarios × chromium+mobile).
**Modified:** `bp_front/src/lib/lists/listsQueries.ts` (Items +store/+addedBy; CheckItem, UncheckItem, ItemUpdates, CategoryUpdates), `src/__generated__/{gql,graphql}.ts` (regenerated), `src/lib/admin/adminErrors.ts` (+`isForbiddenError`), `src/lib/apollo/ApolloProvider.tsx` (clearStore on logout), `src/routes/ListsPage.tsx` (welcome banner), `src/components/WelcomeBanner.tsx` (comment), `src/App.tsx` (routes), and `e2e/{auth,account,admin,lists}.spec.ts` (route-agnostic landing + strengthened guard-redirect assertions).
**Deleted:** `bp_front/src/routes/HomePage.tsx`.

### Review findings
- **Patches (4):** filter-state carried across list switches → reset on `listId`/stale-category (medium, +FR36 E2E); Apollo cache not cleared on logout → cross-user mis-redirect, fixed with `clearStore()` (medium); weakened guard-redirect assertions restored to FR-specific targets (medium, test); welcome signal dropped on HomeRedirect error branch (low). **Deferred:** 0. **Rejected:** 12 (verified noise or out-of-scope edges).

### Verification
- `npm run build` + `npm run lint`: clean. `bp_back/` untouched; `codegen.ts` pristine; `src/__generated__/` only via `npm run generate` (git-verified).
- E2E: **50 tests** (5 shopping + updated existing, × chromium+mobile + smoke). Green under CI retry parity (`--retries=2`: 49 passed, 1 flaky = pre-existing `auth.spec` shared registration-flag race, retry-healed — not a 5.6 regression). FR40 check/uncheck, reframe-7.1 filters, FR36 switcher, FR38 `/`-redirect, and the two-actor FR52 realtime test all pass.

### Residual risks
- **FR53 (WS on logout)** relies on `subscribeToMore` lifecycle teardown + the lazy graphql-ws client closing on unmount (verified in the manual pass via the WS panel); no explicit disposal was added.
- **`ApolloProvider.clearStore()` on logout** is a foundational behavior change (clears all cached queries on sign-out); verified green including same-user logout→login flows, but noted for awareness.
- **FR52 realtime E2E** has a theoretical subscription-readiness window (member acts before the owner's subscription is established); closed in practice by the member's navigation latency and passed reliably, but could flake on an unusually slow backend.
- Mid-session member removal returns a FORBIDDEN inline error on toggle rather than a redirect (Story-5.7 territory); `sprint-status.yaml` not modified (separate flow).
