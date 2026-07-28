---
title: 'Story 5.5 — Lists Management'
type: 'feature'
created: '2026-07-21'
status: 'done'
baseline_revision: '3d72cb874db066b4bde328d0e2ef7c3305c6b3fc'
final_revision: '5ce5267726c4081303d457b4421898015c45bcd5'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/5-4-admin-user-management.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** The Epic-5 reframe frontend (Vite + MUI) has auth, account, and admin surfaces but no way to manage lists. Users (FR34/35/37/46/50/51) cannot see, create, or delete their lists, nor add/remove the categories and items inside them.

**Approach:** Add a `/lists` index (owned + member lists, zero-state onboarding, create, owner-only delete) and a `/lists/:id` management detail (add/remove categories, add/remove items, all via modal overlays). Consume the existing GraphQL list/category/item contract unchanged, mirroring the Story 5.4 admin panel and dialog conventions.

## Boundaries & Constraints

**Always:**
- Consume the backend GraphQL contract as-is; author operations in `src/lib/lists/listsQueries.ts` with `graphql()` from `@/__generated__`, derive all response types from `@/__generated__/graphql`, then regenerate with `npm run generate`.
- Single Apollo client via `useQuery`/`useMutation` from `@apollo/client/react`; token injected automatically — never create a second client.
- Errors shown inline via MUI `<Alert role="alert">` using `graphqlErrorMessage` (from `@/lib/admin/adminErrors`, a generic helper); never toasts/Snackbars. Dialogs: controlled state, validate-on-submit, `if (loading) return` re-entry guard, real `try/catch/finally`, Enter-submits via `<form onSubmit>`, `helperText ?? ' '`.
- Client-generate UUIDs (`crypto.randomUUID()`) for new categories/items (GraphQL `id: ID!` is client-supplied on upsert).
- Owner-only delete: offer list deletion only when `list.ownerUsername === useAuth().username`.
- Every scenario ships a UI-driven, FR-mapped Playwright E2E, manually exercised first, green on `chromium` + `mobile`. Register a fresh unique regular user in-test (`lists_e2e_${project}_${Date.now()}`) — admin is blocked from lists and there is no seeded `mia/mia` account.
- Styling via MUI theme + `sx` only; one default export per file; PascalCase components; no `console.log` in components.

**Block If:**
- Any change to `bp_back/` is required to satisfy a criterion (e.g. adding a `List.description` field, or a distinct "list not found" error code). Backend is frozen — HALT with status `blocked` and surface the needed change for `md`.

**Never:**
- Do not implement the **list description** field (FR34 optional description) — the frozen backend has no such field; defer it (see Design Notes / deferred-work).
- Do not build the shopping view: no check/uncheck, category/checked/text filters, list switcher, `/` redirect-to-oldest-list, `store`/`addedBy` display, or real-time subscriptions (all Story 5.6). Do not build sharing/invites/member management (Story 5.7).
- Do not add one-timer (FR42) or recurring (FR43) item UI; send `recurring: null`.
- Do not touch `/`, `AuthPage`, `AdminGuard`, `RouteGuard`, or `ApolloProvider`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zero lists | Regular user, `lists.lists` empty | `/lists` shows onboarding zero-state prompting first-list creation | No error expected |
| Create list | Name (required, ≤100 chars), optional emoji | List appears in index after refetch; dialog closes | Empty/too-long name → inline field error (client-side; blocks submit) |
| Delete list (owner) | Owner clicks delete → confirm dialog | List removed from index; items/categories cascade server-side | Mutation error → inline `<Alert>`, dialog stays open |
| Delete list (non-owner) | User is member, not owner | Delete affordance not rendered for that list | N/A (UI-gated; owner-only enforced) |
| Add category | Category name (required) within a list | Category appears under the list detail after refetch | Empty name → inline field error |
| Add item | Item name (required) + chosen category, within a list | Item appears under its category after refetch; `checked:false`, `recurring:null` | Empty name / no category selected → inline field error |
| Remove item / category | Confirm dialog on `/lists/:id` | Row disappears after refetch | Mutation error → inline `<Alert>` |
| Admin opens `/lists` | Logged in as `admin` | Graceful inline notice ("admin cannot access list resources"); no crash | `lists` query returns `FORBIDDEN` — caught and surfaced inline |

</intent-contract>

## Code Map

- `bp_front/src/App.tsx` -- route table; `/lists` currently renders `HomePage` placeholder (line ~21). Swap to `ListsPage`; add `/lists/:id` → `ListDetailPage`, both under existing `RouteGuard`→`AppShell` (no new guard).
- `bp_front/src/components/AppShell.tsx` -- dropdown user `Menu`; add a `menu-lists` `MenuItem` → `navigate('/lists')`, following the existing `menu-*` item pattern.
- `bp_front/src/routes/AdminPage.tsx` -- **structural reference** (useQuery/useMutation, Container/Paper, table + row `IconButton`s, state-driven dialogs, inline `Alert`, `refetch()` into dialogs).
- `bp_front/src/components/{CreateUserDialog,DeleteUserDialog}.tsx` -- **dialog convention reference** (boolean-open form dialog; confirm dialog; `void onXxx()` background refetch after success; inline errors).
- `bp_front/src/lib/admin/adminQueries.ts` / `adminErrors.ts` -- GraphQL-op authoring + generic `graphqlErrorMessage` (reuse) reference.
- `bp_front/src/lib/auth/AuthContext.tsx` -- `useAuth()` → `username`, `role`.
- `bp_front/e2e/admin.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts` -- E2E harness/conventions (UI login, unique per-run usernames, chromium+mobile, assert only on self-created rows).

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/src/lib/lists/listsQueries.ts` -- author `graphql()` ops: `Lists` query (`lists { lists { id name emoji ownerId ownerUsername createdAt } }`), `CreateList`, `DeleteList`, `Categories`(`getCategories`), `Items`(`getItems`), `SaveCategory`, `DeleteCategory`, `SaveItem`, `DeleteItem`; export derived types from `@/__generated__/graphql`. -- typed single source for list ops.
- [x] `bp_front/src/__generated__/**` -- regenerate via `CODEGEN_TOKEN=… npm run generate` **immediately after** the ops above (dialogs/pages import these generated types); commit, never hand-edit. -- typed docs.
- [x] `bp_front/src/components/CreateListDialog.tsx` -- form dialog: name (required, maxLength 100) + optional emoji; `createList`; `void onCreated()` refetch. -- FR34/FR46.
- [x] `bp_front/src/components/ConfirmDialog.tsx` -- reusable confirm overlay (title, description, confirmLabel, `loading`, `onConfirm`); used for delete-list (cascade warning copy), remove-category, remove-item. -- FR37 + destructive-action UX.
- [x] `bp_front/src/components/AddCategoryDialog.tsx` -- form dialog: name (required); `crypto.randomUUID()` id; `saveCategory({id,name,listId})`. -- FR46.
- [x] `bp_front/src/components/AddItemDialog.tsx` -- form dialog: name (required) + category `Select` (from the list's categories, required); `saveItem({id,name,checked:false,category,listId})`. -- FR46.
- [x] `bp_front/src/routes/ListsPage.tsx` -- `/lists` index (root testid `lists-page`): `useQuery(Lists)`; loading/zero-state (FR50) / list rows; create button + `CreateListDialog`; owner-only delete via `ConfirmDialog`; row → `navigate('/lists/:id')`; catch `FORBIDDEN` (admin) into an inline notice. -- FR35/FR34/FR37/FR50.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- `/lists/:id` (root testid `list-detail-page`): `useQuery(Categories)`+`useQuery(Items)` for the id; render categories with their items; add-category / add-item buttons (overlays); remove-category / remove-item via `ConfirmDialog`; back to `/lists`. -- FR46/FR51.
- [x] `bp_front/src/App.tsx` -- point `/lists` at `ListsPage`; add `/lists/:id` → `ListDetailPage`. -- routing.
- [x] `bp_front/src/components/AppShell.tsx` -- add `menu-lists` nav item. -- discoverability.
- [x] `bp_front/e2e/lists.spec.ts` -- UI-driven scenarios (register unique regular user; golden path create→add category→add item→remove item→remove category→delete list; zero-state; owner-only delete), FR-mapped, chromium+mobile. -- verification.

**Acceptance Criteria:**
- Given a regular user with no lists, when they open `/lists`, then a zero-state onboarding prompt to create a first list is shown. (FR50)
- Given the create-list overlay, when a name is submitted, then the list appears in the index and the overlay closes without a page navigation/scroll reset. (FR34/FR51)
- Given a list the user owns, when they confirm deletion, then it disappears from the index; given a list where the user is only a member, then no delete affordance is offered. (FR37)
- Given `/lists/:id`, when the user adds then removes a category and adds then removes an item via overlays, then each change is reflected after refetch and every new category/item is scoped to that list. (FR46/FR51)
- Given the app, when a signed-in user opens the user menu, then a "Lists" navigation entry routes to `/lists`.
- Given `npm run build` and `npm run lint`, then both pass clean with no hand-edits to `src/__generated__/`.

## Spec Change Log

_No `bad_spec` loopback occurred; the `<intent-contract>` and spec sections were sufficient. Review findings were resolved as localized code patches (see Review Triage Log)._

## Review Triage Log

### 2026-07-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 1, low 2)
- defer: 1
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` Removing a category stranded its items — the backend `deleteCategory` does not cascade, so items were orphaned (dangling category id → hidden by the group filter, unremovable) while the confirm copy falsely claimed "items are removed with it." Fixed: remove-category now cascades client-side (delete the category's items, then the category), honouring the copy; added an E2E scenario (FR46) proving no orphan remains.
  - `[low]` `[patch]` Fire-and-forget post-mutation `refetch()`/`onCreated`/`onAdded` calls left floating promise rejections (contradicting the code's own "a failed refetch must not fail the mutation" intent). Fixed: all background refetches now `.catch(() => {})` at the ListsPage/ListDetailPage call sites.
  - `[low]` `[patch]` ConfirmDialog title/description blanked during MUI's close transition (parent nulls its target as `open` flips false), flashing an empty name on destructive dialogs. Fixed: ConfirmDialog captures title/description at the open transition and renders the retained values (mirrors the 5.4 pattern). Also hardened `lists.spec.ts`'s registration helper against the documented shared registration-flag race (reload `/auth` until the Register link appears) so the new tests stay stable rather than flaky.
- rejected (noteworthy): non-FORBIDDEN query errors rendered as `severity="info"` (FORBIDDEN is the dominant, intended graceful path — cosmetic); combined loading/error blanks the detail screen on partial failure (both queries share auth+listId → fail/succeed together; fail-closed acceptable); duplicate-name testids & AddItem stale-`defaultCategoryId` out-of-range (React keys already use `id`; triggers need duplicate names or concurrent cross-session category removal — unreachable in the single-user 5.5 flow; E2E uses unique names); `crypto.randomUUID` on an insecure origin (localhost + the HTTPS domain are both secure contexts); deep-link `/lists/:id` "List" title fallback and inconsistent dialog reset idioms (cosmetic/latent, no manifesting bug); FR35 admin-message coupling (verified exact against the frozen backend and passing).

## Design Notes

- **List detail vs shopping view:** `/lists/:id` is a *management* surface (categories + their items, add/remove only). The Story-5.6 *shopping* view lives at the separate `/list/:id` route and adds check/uncheck, filters, switcher, and real-time — out of scope here. Keep them distinct.
- **Category is a first-class entity** (own UUID, scoped by `listId`); an `Item.category` is that category's UUID string. So add-item requires an existing category — the golden-path order (category → item) reflects this. There is no `addCategory`/`removeCategory`; use `saveCategory`(upsert) / `deleteCategory`.
- **Error codes:** the only stable `extensions.code` from list/item/category flows is `FORBIDDEN` (admin-blocked, not-member, not-owner). "List not found" is indistinguishable from "not a member". Everything else (empty/overlong name, bad UUID) is an *uncoded* generic error — so validate name presence and ≤100 chars client-side to avoid hitting it. `graphqlErrorMessage` already strips the graphql-kotlin `Exception while fetching data (...) :` wrapper.
- **Deferred (record in `deferred-work.md`):** list **description** (FR34) — needs a backend `List.description` field + `createList` arg; backend frozen. Not shipped.
- **Dialog success pattern (copy from 5.4):** on success `reset()` → `onClose()` immediately → `void onDone()` (background refetch); a failed refetch must NOT be reported as a failed mutation.

## Verification

**Commands:**
- `cd bp_front && CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate` -- expected: `src/__generated__/graphql.ts` gains the List/Category/Item operation + schema types; no hand-edits.
- `cd bp_front && npm run build` -- expected: `tsc -b && vite build` succeed with no type errors.
- `cd bp_front && npm run lint` -- expected: eslint clean.
- `cd bp_front && npm run test:e2e` -- expected: `lists.spec.ts` green on both `chromium` and `mobile`; no regression in other specs.

**Manual checks (if no CLI):**
- Manually exercise (reframe rule 1) on `:2080` as a fresh regular user before writing the E2E: create a list, open it, add a category, add an item under it, remove the item, remove the category, delete the list; confirm a second (non-owner) member sees no delete affordance; confirm `admin` opening `/lists` sees the graceful notice, not a crash.

## Auto Run Result

Status: **done**

### Summary
Delivered Story 5.5 Lists Management on the Epic-5 reframe frontend (Vite + MUI + Apollo), backend untouched. Added a `/lists` index (owned/member lists, loading + zero-state onboarding, create overlay, owner-only delete, row → detail, graceful admin-`FORBIDDEN` notice) and a `/lists/:id` management detail (categories with their items; add-category / add-item overlays; remove-category / remove-item confirmations), a `menu-lists` nav entry, list/category/item GraphQL operations (codegen-regenerated), and a UI-driven Playwright suite. List **description** (FR34) is deferred — the frozen backend has no such field.

### Files changed
**Added**
- `bp_front/src/lib/lists/listsQueries.ts` — 9 list/category/item GraphQL operations + derived types
- `bp_front/src/routes/ListsPage.tsx` — `/lists` index
- `bp_front/src/routes/ListDetailPage.tsx` — `/lists/:id` management detail (client-side item cascade on category removal)
- `bp_front/src/components/ConfirmDialog.tsx` — reusable destructive-confirm overlay (retains title/desc through close)
- `bp_front/src/components/CreateListDialog.tsx` — create-list form (name ≤100 + optional emoji)
- `bp_front/src/components/AddCategoryDialog.tsx` — add-category form (client UUID)
- `bp_front/src/components/AddItemDialog.tsx` — add-item form (name + category Select)
- `bp_front/e2e/lists.spec.ts` — 5 UI-driven, FR-mapped scenarios (× chromium + mobile)
- `_bmad-output/implementation-artifacts/epic-5-context.md` — compiled epic context
**Modified**
- `bp_front/src/App.tsx` — `/lists` → ListsPage; `/lists/:id` → ListDetailPage
- `bp_front/src/components/AppShell.tsx` — `menu-lists` nav item
- `bp_front/src/__generated__/gql.ts`, `graphql.ts` — regenerated (also re-synced admin ops that were committed stale/non-compiling on this branch)
- `_bmad-output/implementation-artifacts/deferred-work.md` — description deferral + getItems `deleted`-flag note for 5.6

### Review findings
- **Patches applied (3):** category-removal now cascades to its items client-side (fixes orphaned/invisible items + a false confirm message; medium); background refetches swallow rejections (low); ConfirmDialog retains title/description through the close transition (low). Plus test hardening: registration helper reloads `/auth` past the shared-flag race.
- **Deferred (1):** `getItems` doesn't select/filter `Item.deleted` — harmless in 5.5, must be handled by Story 5.6's shopping view.
- **Rejected (10):** cosmetic/latent or unreachable-in-scope (error-alert severity, partial-failure blanking, duplicate-name testids, stale `defaultCategoryId`, `crypto.randomUUID` on insecure origin, deep-link title fallback, reset-idiom inconsistency, admin-message coupling).

### Verification
- `npm run build` (`tsc -b && vite build`) — clean; `npm run lint` (eslint) — clean.
- Codegen against live `:2080` schema — 9 ops emitted; `src/__generated__/` changed only via `npm run generate`; `bp_back/` untouched (git-verified).
- E2E: all **10** lists tests (5 scenarios × chromium + mobile) pass; full suite green under the project's CI retry policy (`--retries=2`: 39 passed, 1 flaky — the **pre-existing** `auth.spec` register test losing the documented shared registration-flag race, healed on retry, unrelated to this story).

### Residual risks
- The shared global `registrationEnabled` flag (admin-toggle test) can still flake the pre-existing `auth.spec` register test under local `retries:0`; the new lists tests are hardened against it. Pre-existing, accepted (Story 5.4), CI-healed.
- Category removal deletes its items (client-side cascade) to match the confirm copy and avoid orphaned/unremovable items; a partial failure mid-cascade leaves the category intact for retry.
- `sprint-status.yaml` was not modified (sprint tracking is owned by a separate flow); the dev-auto result is recorded here via `status: done`.
