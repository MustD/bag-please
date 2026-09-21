---
title: 'EXPERIENCE.md — the information architecture and behaviour Bag Please actually ships'
epic: 8
story: '8.7'
status: 'current'
supersedes:
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-design-specification-epic-4.md
verified_at_commit: '15ec65b5d90f3fc3e837d6d1a5d4fc16670fcddb'
verified_on: '2026-09-16'
---

# EXPERIENCE.md — Bag Please information architecture & behaviour

**This document DESCRIBES what is deployed. It does not prescribe.** Every factual claim names the file it can be
checked against, with the line as of the verification commit. A claim that has no code anchor because it was a
*decision* rather than an implementation is labelled **RULING** and carries the `epics.md` identifier that decided
it. Both kinds appear below and neither substitutes for the other: a code anchor says a thing is true today, a ruling
says a thing was chosen and why re-opening it is a decision rather than a refactor.

**Verified at commit `3af2d575e852ca186467c67a051e5ddc77a6fe6d`** (`git rev-parse HEAD`, 2026-09-09), working tree
clean, `git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` empty.

**Line numbers will drift.** Anchor to the construct named beside the number; the number is a convenience as of the
commit above, not the claim. See `DESIGN.md`'s opening note for the worked example of what happens otherwise.

The visual half of this contract — palette, tokens, type, surfaces, PWA colours — is
[`DESIGN.md`](./DESIGN.md), verified at the same commit.

---

## 1. The route map

The complete routing table is `bp_front/src/App.tsx` — **35 lines**, one `<Routes>`, seven paths plus a catch-all.
There is no nested router, no lazy boundary, and no second `<Routes>` anywhere in `src/`.

| Path | Element | Guards | Anchor |
| --- | --- | --- | --- |
| `/auth` | `AuthPage` | **none — the only public route** | `App.tsx:17` |
| `/` | `HomeRedirect` | `RouteGuard` → `AppShell` | `App.tsx:21-23` |
| `/lists` | `ListsPage` (index / management) | `RouteGuard` → `AppShell` | `App.tsx:24` |
| `/lists/:id` | `ListDetailPage` (**manage** one list) | `RouteGuard` → `AppShell` | `App.tsx:25` |
| `/list/:id` | `ListShoppingPage` (**use** one list) | `RouteGuard` → `AppShell` | `App.tsx:26` |
| `/account/password` | `ChangePasswordPage` | `RouteGuard` → `AppShell` (+ an in-component admin bounce) | `App.tsx:27` |
| `/admin/*` | `AdminPage` | `RouteGuard` → `AppShell` → **`AdminGuard`** | `App.tsx:28` |
| `*` | `<Navigate to="/" replace/>` | `RouteGuard` → `AppShell` | `App.tsx:30` |

Two structural facts worth stating explicitly because they are easy to misread from the table:

- **The catch-all lives INSIDE the guarded subtree** (`App.tsx:29-30`, comment: "Unknown client routes fall back into
  the guarded tree"). An unknown URL from a signed-out visitor therefore hits `RouteGuard` first and lands on `/auth`,
  not on a 404 and not on `/`. **One exception: `/admin/*` is a splat** (`App.tsx:28`), so it matches any path under
  `/admin` before `*` is reached — `/admin/nope` renders `AdminPage` for an admin and is bounced to `/` by
  `AdminGuard` for anyone else. It never reaches the catch-all.
- **`/lists/:id` and `/list/:id` differ by one character** and are two different products. See §4.

### 1.1 `AppShell` is the only chrome

Everything under `RouteGuard` renders inside `AppShell` (`App.tsx:22`), which is a sticky top `AppBar` plus an
`<Outlet/>` (`AppShell.tsx:96-243`). There is no bottom navigation, no drawer, no sidebar and no breadcrumb anywhere
in `src/`. `/auth` is outside the shell entirely and has no app bar at all.

The bar holds exactly three things: the **"Bag Please" home link** (`AppShell.tsx:126-165`), the **username identity
chip** that opens the menu (`AppShell.tsx:167-198`), and the **overflow menu** (`AppShell.tsx:200-236`).

**Menu contents, and their conditions** (`AppShell.tsx:208-235`):

| Item | Shown | Anchor |
| --- | --- | --- |
| Lists → `/lists` | always | `AppShell.tsx:208-213` |
| Change password → `/account/password` | `role !== 'admin'` | `AppShell.tsx:214-221` |
| Admin → `/admin` | `role === 'admin'` | `AppShell.tsx:222-229` |
| Logout | always; `disabled` while the logout call is in flight | `AppShell.tsx:230-235` |

Change password is hidden for admin because "the backend 403-forbids that account from that endpoint"
(`AppShell.tsx:25-27`); the Admin item is "the sole entry point to `/admin`" (`AppShell.tsx:27-28`). Logout
invalidates the server session then calls `clearAuth()`, and does **not** navigate — flipping `username` to `null`
makes `RouteGuard` do the redirect, so there is one navigator (`AppShell.tsx:77-92`).

---

## 2. Guards

### 2.1 `RouteGuard` — authentication

`bp_front/src/routes/RouteGuard.tsx:11-31`. Three states:

1. **Bootstrap in flight** (`isLoading`) → renders `null`. **No spinner and no flash of the redirect**
   (`RouteGuard.tsx:29`, comment at `:5-7`).
2. **Settled and unauthenticated** → `navigate(..., {replace: true})` from an effect (`RouteGuard.tsx:15-27`).
   `replace`, never push, "avoids a back-button loop" (`:7`).
3. **Authenticated** → `<Outlet/>` (`RouteGuard.tsx:31`).

The redirect has three destinations, and this component is deliberately their **single owner** so nothing can race
and strip the state (`RouteGuard.tsx:8-10, 18-20`). They are **not parallel — `passwordChanged` wins**
(`RouteGuard.tsx:21-25` is an `if/else`, not three branches), so a session that is both password-changed and expired
gets the password-changed confirmation and **no `?expired=1`**:

| # | Condition | Destination | Anchor |
| --- | --- | --- | --- |
| 1 | `passwordChanged` — checked FIRST, regardless of `expired` | `/auth` with `state: {passwordChanged: true}` | `RouteGuard.tsx:21-22` |
| 2 | else `expired` (Apollo error link cleared auth) | `/auth?expired=1` | `RouteGuard.tsx:24` |
| 3 | else plain sign-out | `/auth` | `RouteGuard.tsx:24` |

`/auth` renders only one of the two banners anyway — its own gate is `passwordChanged && !expired`
(`AuthPage.tsx:222`) — so the precedence here and the gate there agree by construction rather than by coincidence.

### 2.2 `AdminGuard` — role

`bp_front/src/routes/AdminGuard.tsx:9-22`. Sits **inside** the authenticated subtree, so it only enforces role
(`:5-8`). Non-admin → `navigate('/', {replace: true})` from an effect (`:13-17`) and `null` in the meantime (`:19`) —
the same no-flash shape as `RouteGuard`.

### 2.3 The third guard, which is not a guard component

`ChangePasswordPage.tsx:40` — `if (role === 'admin') return <Navigate to="/" replace/>`, placed after the hooks so
hook order stays stable (`:37-39`). This is why `/account/password` shows only one guard in the route table but is
effectively admin-proof twice over (the menu item is also hidden at `AppShell.tsx:214`).

---

## 3. How `/` resolves — five branches, one implementation

`/` is not a screen. It is `HomeRedirect` (`HomeRedirect.tsx:22-39`), which renders a spinner or a `<Navigate …
replace/>`. The **decision** lives in one hook, `useHomePath` (`bp_front/src/lib/lists/homePath.ts:31-49`), so that
"two implementations of 'which list is home' is the defect class this hook exists to close"
(`homePath.ts:9-13`).

| # | Condition | Result | Anchor |
| --- | --- | --- | --- |
| 1 | `role === 'admin'` | `/admin` — and the lists query is **skipped entirely**, because the backend forbids admin from every list resource | `homePath.ts:41`, skip at `:37` |
| 2 | lists query errored | `/lists` — graceful; the index surfaces its own notice | `homePath.ts:45` |
| 3 | no data yet (`!data`) | `null` → HomeRedirect shows a spinner | `homePath.ts:46`; spinner `HomeRedirect.tsx:28-34` |
| 4 | data, zero lists | `/lists` | `homePath.ts:48` |
| 5 | data, ≥1 list | `` `/list/${oldest.id}` `` — oldest by `byCreatedAtAsc` | `homePath.ts:49` |

**Branch order is load-bearing** and the code says so (`homePath.ts:26-30`): `!data` must precede the empty-list
check, or a cold cache in `observe` mode reads as `[]` → `/lists` and the app bar goes inert on `/lists` for a user
who actually owns lists.

**Two modes, one hook** (`homePath.ts:15-24, 36-39`):

- `'resolve'` — `HomeRedirect`, which *performs* the redirect: `fetchPolicy: 'cache-first'`, so it fetches and shows
  its spinner while the answer is unknown.
- `'observe'` — `AppShell`'s title link, which only *decorates* an answer that already exists:
  `fetchPolicy: 'cache-only'`, so the app bar never fires the membership-gated lists request itself. A cold cache
  yields `null`, which reads as **not already-home**, so the link stays live. That direction is deliberate: "fail
  toward navigating, never toward a dead control" (`homePath.ts:23-24`, UX-DR-E7-4).

Every redirect is `replace` so `/` never lingers in history (`HomeRedirect.tsx:21,39`). The one-time `welcome` signal
is forwarded on **both** `/lists` branches (2 and 4) and on neither of the others (`HomeRedirect.tsx:36-39`).

> **RULING — the app bar must never re-derive home.** **AR-E6-7**, restated as **AR-E7-8** (`epics.md:599-605`). The
> code anchor for compliance is `homePath.ts:38` (`'observe'` ⇒ `cache-only`) and `AppShell.tsx:48`.

---

## 4. The manage-vs-use split

> **RULING — this is `md`'s decision, not an implementation detail.** Carried in `epic-8-context.md` under
> "UX & Interaction Patterns" (`epic-8-context.md:132-133`): "**The manage-vs-use boundary is deliberate:**
> `/lists/:id` manages a list, `/list/:id` shops it. The two screens differ on purpose in places, and those
> differences stay." It has no single code anchor because it is a rule *about* the code; what follows is the code it
> produced.

| | `/lists/:id` — **manage** | `/list/:id` — **use** |
| --- | --- | --- |
| Component | `ListDetailPage.tsx` (477 lines) | `ListShoppingPage.tsx` (507 lines) |
| Purpose comment | `ListDetailPage.tsx:42-48` | `ListShoppingPage.tsx:225-231` |
| Add / edit / delete categories & items | **yes** — 5 dialogs | **no** — read + check only |
| Check / uncheck an item | **no** | **yes** (`ListShoppingPage.tsx:373-386`) |
| Checked-status filter (All / To buy / Done) | **no** (props omitted) | **yes** (`ListShoppingPage.tsx:445-446`) |
| Category filter + name search | **yes** (`ListDetailPage.tsx:197-204`) | **yes** (`ListShoppingPage.tsx:440-447`) |
| Realtime subscription | **no** — refetch-driven | **yes** — two `subscribeToMore` |
| List switcher chips | **no** | **yes** (`ListShoppingPage.tsx:414-436`) |
| Forbidden viewer | inline `severity="info"` notice | `<Navigate to="/lists" replace/>` |
| `document.title` | untouched | set to `<list> · Bag Please` (`ListShoppingPage.tsx:320-325`) |

### 4.1 What the two screens SHARE — one definition each, by contract

Three modules exist specifically so the two screens cannot drift back into reading one list two different ways.
NFR-E8-5 is the requirement; these are the implementations.

- **`bp_front/src/lib/lists/itemFilter.ts`** — the filter's value, predicate and state.
  `EMPTY_ITEM_FILTER` (`:26`), `CheckedFilter` (`:34`), `matchesItemFilter` (`:44-52`), `isItemFilterActive`
  (`:57-59`), `useItemFilter` (`:72-106`). **Empty selection means ALL, not none** (`:19-23`) — that reading is
  depended on by every branch. Search is trimmed and case-insensitive (`:49-50`), so `'   '` is not a filter.
  The module's own header records the drift it closed (`:8-12`): before Story 8.4, `/lists/:id` had no filter at all
  while `/list/:id` could select only ONE category.
- **`bp_front/src/components/ListFilters.tsx`** — the filter UI, one definition, two call sites. Strictly
  presentational: no query, no mutation, no subscription (`:38-41`), which is what lets the refetch-driven management
  screen mount the same component as the subscription-driven shopping screen. The category control is a `multiple`
  `Select` with checkboxes in the menu and a **text summary** in the closed control (`:98-133`) — **RULING
  UX-DR-E8-4**: not a chip row, because a chip row grows the block by a line per selection and pushes the list off
  the fold at the 320px floor (`ListFilters.tsx:43-46`).
- **`bp_front/src/lib/lists/order.ts`** — ordering and grouping. `byCreatedAtAsc` (`:51-59`), `byName` (`:75-77`),
  the non-exported `byNameThenId` (`:91-93`), `UNCATEGORIZED_KEY` / `UNCATEGORIZED_NAME` (`:97-98`),
  `groupItemsByCategory` (`:132-174`).

### 4.2 `keepEmpty` — the ONE deliberate difference

`groupItemsByCategory` takes `{keepEmpty: boolean}` (`order.ts:138`) and its own comment names it "the ONLY
difference between the two surfaces, and it is a deliberate product difference, not an accident"
(`order.ts:120-128`):

- **`/list/:id` passes `false`, always** (`ListShoppingPage.tsx:359-361`). "A category with nothing to buy is noise
  while shopping" — whatever the filter says.
- **`/lists/:id` passes `!filterActive`** (`ListDetailPage.tsx:92-96`). Unfiltered, an empty category still renders
  with its "No items yet." row and its add-item affordance, "because this is a management screen and a category you
  cannot see is a category you cannot fill" (`ListDetailPage.tsx:83-88`). While a filter or search is active, a card
  with zero matching items is dropped.

**The synthetic `Uncategorized` bucket is never subject to `keepEmpty`** (`order.ts:129-131`): it is only created
when it has members, so "no orphans ⇒ no group" holds on both screens by construction. It always sorts **last**,
never alphabetically among the real categories, because "an orphan is an exception state, not a peer"
(`order.ts:163-164`). Its `category` field is `null`, and that null is the entire interface for "render no
category-level controls here" (`order.ts:105-108`, consumed at `ListDetailPage.tsx:276`).

Ordering itself is identical on both screens: categories and items by `byNameThenId` (`order.ts:155,160,170`). The
id tiebreak is not cosmetic — `Array.prototype.sort` is stable, but the input is the backend's map order, which is
not (`order.ts:79-87`: "three consecutive pre-fix runs of the FR62 ordering spec returned three different
sequences"). The filter menu deliberately sorts with plain `byName` instead (`ListFilters.tsx:66`), with the
consequence stated so it is not met as a surprise: two same-named categories can order differently in the menu than
in the list underneath (`ListFilters.tsx:59-65`).

---

## 5. Screen states, route by route

Every content route renders exactly one of a small set of branches, each carrying a stable `data-testid`. The
branch order is itself part of the contract — error before loading before empty before content — and is written as a
single nested ternary on each screen so no two branches can co-occur.

### 5.1 `/lists` — the index (`ListsPage.tsx`)

| Branch | testid | Anchor |
| --- | --- | --- |
| error | `lists-notice` — `<Alert severity="info" role="alert">` | `ListsPage.tsx:114-117` |
| loading | `lists-loading` — centred `CircularProgress`, `py: 6` | `:118-121` |
| empty | `lists-empty` — "No lists yet" + a create CTA | `:122-138` |
| content | a `Paper` + `List` of rows, `list-row-<name>` | `:139-207` |

Above the branch, always mounted: the one-time welcome banner (`:86-88`) and the pending-invites section (`:112`) —
see §5.1.1, both are shipped surfaces of their own.
A row's whole body is a `ListItemButton` navigating to `/lists/**:id**` — the **management** screen (`:189-192`).
Owner rows carry share + delete; member rows carry leave (`:149-187`). Ownership is decided client-side by
`list.ownerUsername === username` (`:143`).

The **admin case is a first-class state, not a crash**: the backend forbids admin from list resources, which arrives
as a FORBIDDEN query error and renders as the calm `severity="info"` notice above (`ListsPage.tsx:38-41`).

#### 5.1.1 Pending invites, and where sharing lives

Two membership surfaces hang off `/lists`. Neither has a route of its own, which is why they are easy to miss.

**Pending invites** — `bp_front/src/components/PendingInvites.tsx` (112 lines), mounted unconditionally at
`ListsPage.tsx:112` and fed from `data.lists.pendingInvites` (`ListsPage.tsx:48`). It **renders `null` when there are
no invites** (`PendingInvites.tsx:41`), so it is invisible rather than empty — there is no zero-state for it. When
there are invites it is a `Paper` titled "Pending invites" (`:59-62`) holding one `ListItem` per invite showing
`{emoji} {name}` and "Invited by {ownerUsername}" (`:97-106`), each with **Accept** (contained) and **Decline**
(`color="inherit"`) buttons (`:76-93`).

Its behaviour: a single in-flight guard, `busyListId`, no-ops re-entry and disables **only that row's two buttons**
(`:36-38, 43-44, 79, 88`); a failure sets an inline `pending-invites-error` `Alert` and clears the busy flag
(`:49-53`, rendered `:63-67`); a success clears it and calls `onChanged()`, which is `ListsPage`'s `refresh()`
(`:54-55`, `ListsPage.tsx:61-63,112`). **There is no realtime path** — the component's own comment states it: "an
invite appears only on the invitee's next /lists load or refetch" (`:31-32`), which is the consumer-side face of the
missing membership subscription (§10).

Testids: `pending-invites-section` (`:59`), `pending-invites-error` (`:64`), and three **name-keyed** ones —
`pending-invite-<listName>` (`:72`), `accept-invite-<listName>` (`:81`), `decline-invite-<listName>` (`:90`). Those
three belong to the collision defect in §9.2.

**Sharing** is the owner's half of the same relationship and lives in a dialog, not a page:
`ShareMembersDialog.tsx` (218 lines), opened from the `manage-members-<name>` `IconButton` on an owned row
(`ListsPage.tsx:152-161`) and held **by list id**, not by object, so an open dialog re-derives from fresh data after
a refetch rather than showing a stale snapshot (`ListsPage.tsx:53-59`). It invites by username (`share-username-input`
/ `share-submit`), lists the owner (`member-owner-row`) and each member (`member-row-<username>`) with a
`remove-member-<username>` control, and surfaces failures inline at `share-error`. Its testids deviate from the
dialog convention in §9.2. The member's counterpart to removal is the **Leave** control on a non-owned row
(`ListsPage.tsx:174-186`), confirmed through the shared `ConfirmDialog` as `leave-list-dialog`
(`ListsPage.tsx:245-262`).

### 5.2 `/lists/:id` — management (`ListDetailPage.tsx`)

Always present: a "Back to lists" link (`:117-125`), the header (`:137-176`) and the filter row when gated in
(`:197-204`).

| Branch | testid | Anchor |
| --- | --- | --- |
| error | `list-detail-notice` — `<Alert severity="info" role="alert">` | `:213-216` |
| loading | `list-detail-loading` | `:217-220` |
| genuinely empty (`groups.length === 0 && !filterActive`) | `list-detail-empty` — "No categories yet" | `:221-229` |
| filtered to nothing (`groups.length === 0`) | `list-detail-no-matches` | `:230-235` |
| content | category `Paper` cards, `category-row-<name>` | `:236-381` |

**The notice severity is `info`, not `error`** (`:214`) — a FORBIDDEN list is a "you are not a member" fact, not a
fault. This is the difference from `/list/:id`, which uses `severity="error"` for its query notice
(`ListShoppingPage.tsx:456`); recorded as measured, and the two screens genuinely differ here.

**Both empty branches key off `groups`, not `categories`** (`:206-212`): a list can hold zero categories while
pre-cascade orphaned items still exist, and the old gate showed "No categories yet" over an item that was right
there. Since Story 9.3 the producer of that state is legacy data rather than a stale client, but the branch stays —
the data it guards against is still on disk.

**The filter row's gate is three clauses, and the third is a dead-end guard**
(`:178-196`, condition at `:197`): `!error && (categories.length > 0 || items.length > 0 || filterActive)`. It is
deliberately *not* gated on `loading`, because `notifyOnNetworkStatusChange` defaults to `true` in Apollo Client 4 so
every post-mutation refetch would unmount the row mid-interaction. `|| filterActive` exists because the filter value
outlives the content that justified showing the row — remove the last category while a search term is set and both
counts hit zero, and without this clause the page would sit on `list-detail-no-matches` with nothing on screen able
to clear it.

**Category-level controls appear only when `group.category` is non-null** (`:276-312`) — three `IconButton`s in a
fixed order: add-item, **rename**, remove. The destructive control stays last, and the rename was inserted *between*
rather than appended for exactly that reason (`:287-291`). On the synthetic `Uncategorized` bucket all three are
absent; each orphaned item keeps its own edit and remove controls, and that pair is the recovery path that justifies
rendering the bucket on this screen at all (`:269-275`). Since Story 9.3 the bucket serves pre-existing orphans only.

**Mutation feedback is refetch, not optimism**: every dialog's success callback calls `refetch()` unawaited
(`:388-390, 399-401, 412-414, 424-426, 453, 471`), so "a failed refetch is never reported as a failed mutation".

**Remove-category is a SERVER-side cascade** (Story 9.3). The confirm handler sends exactly one mutation —
`deleteCategory` — and then refetches; there is no item loop here any more. The server verifies membership, deletes
the category, removes every item of it (soft-deleted rows included) and emits **one** event, the category `DELETED`.
That event is authoritative for the category's children: `/list/:id` prunes them from its own `ItemsQuery` cache
locally, because the item flow is one-slot / `DROP_OLDEST` and a per-item fan-out would arrive truncated.

**The failure residue is a deleted category with some items still present.** The server's two writes (Mongo, then the
in-memory cache) are independent, with no session — the same non-transactional shape `deleteList` has, and the same
absence of any atomicity claim. What it is NOT any more is an orphan factory: the loop it replaced walked only the
items the removing CLIENT happened to hold, so anything a co-member had added since that client's last refetch
outlived its category. `/lists/:id` is refetch-driven with no subscription (AR-E8-6), so that set was stale by
construction whenever anyone else had written.

Creating a fresh orphan is closed off at the other end too: `saveItem` rejects a category that is not on the target
list on the CREATE branch as well as the UPDATE branch, and `uncheckItem` refuses to resurrect an item whose category
is gone. The `Uncategorized` bucket therefore surfaces **pre-existing** orphans in practice — data written before this
cascade shipped. No ordinary use of the app adds to it: no successful call on the item surface can leave an item under
a category that is not on its list. It is not sealed, though — `saveCategory` still has no `listId`-stability guard, so
re-saving a category onto another list strands the first list's items, and the cascade is not transactional. Both are
recorded in `deferred-work.md`; neither is reachable by clicking.

### 5.3 `/list/:id` — shopping (`ListShoppingPage.tsx`)

Always present: back link (`:393-401`), header (`:403-411`), switcher chips (`:414-436`), filter row (`:440-447`),
and the action-error alert when set (`:449-453`).

| Branch | testid | Anchor |
| --- | --- | --- |
| forbidden | **no branch — `<Navigate to="/lists" replace/>`** | `:369-371` |
| query error | `shopping-notice` — `<Alert severity="error" role="alert">` | `:455-458` |
| loading | `shopping-loading` | `:459-462` |
| empty (`items.length === 0`) | `shopping-empty` — "Nothing to shop yet", pointing at the management screen | `:463-471` |
| filtered to nothing | `shopping-no-matches` | `:472-477` |
| content | group `Paper`s, `shopping-group-<name>`, rows divided | `:478-503` |

The empty state's copy — "Add categories and items from the list management screen" (`:469`) — is the manage-vs-use
split surfacing as guidance rather than as a control.

#### 5.3.1 The row is one control

`ShoppingItemRow` (`ListShoppingPage.tsx:61-223`). The row **element** is the checkbox: `role="checkbox"` (`:80`),
`aria-checked={item.checked}` (`:81`), `` aria-label={`Toggle ${item.name}`} `` (`:82`),
`aria-describedby` (`:83`), `tabIndex={0}` (`:84`). There is deliberately no interactive element inside it — the MUI
`Checkbox` that used to live here rendered a real `<input>`, i.e. a control nested in a control: two tab stops, two
names, two states (`:46-51`). The visible box is now a presentational icon (`:151-164`).

Activation is a **pointer pair with a movement threshold**, not a click:

- `MOVE_TOLERANCE_PX = 10` (`:39`), with the reason at `:35-38` — "a tap and the first moments of a scroll are the
  SAME gesture on a touch screen".
- `onPointerDown` (`:85-101`): primary button and primary pointer only; `setPointerCapture` so down/up are strictly
  paired on this row.
- `onPointerUp` (`:105-113`): beyond the tolerance the gesture was a scroll, and nothing toggles.
- `onPointerCancel` (`:102-104`) clears the origin.
- `onClick` (`:114-125`) fires **only** for a synthetic click — `e.detail === 0`, which is what assistive technology
  and voice control dispatch. Every real mouse or finger click has `detail >= 1`, so this coexists with `onPointerUp`
  without double-firing.
- `onKeyDown` (`:126-135`): Space or Enter, ignoring autorepeat and Ctrl/Meta/Alt, `preventDefault()` so Space does
  not scroll the page under the focused row.

Because `role="checkbox"` makes the row's children presentational and the author-supplied `aria-label` displaces
name-from-content, the store chips and the `addedBy` name would otherwise be announced by nothing at all. They come
back as the row's accessible **description** via a visually-hidden span (`:72-75`, `:202-220`), which leaves the
accessible **name** exactly `` `Toggle ${item.name}` ``.

**Story 9.6 made the store PLURAL and changed nothing else about the row.** An item carries a list of stores, so the
single chip became a wrapping row of chips inside the same `minWidth: 0` text column as the item name — they grow the
row DOWNWARDS, never sideways, which is what keeps the check glyph and the name on screen at the 320px floor
(`narrow-viewport.spec.ts`, "an item in three stores does not push the shopping row off the floor"). The description
segment is `` `Stores: A, B` `` and is **omitted entirely** when the item has none — no empty segment, and no chip
container either. The accessible **name** is still exactly `` `Toggle ${item.name}` `` (`shopping.spec.ts` pins the
string verbatim), and the chips are still presentational: activating one toggles the item, like any other part of the
row.

> **RULING — the shopping row is a CLOSED surface. AR-E8-8a** (`epics.md:853-858`). "Once the whole row is one
> control, the store chips and the `addedBy` avatar inside it can no longer become affordances of their own — a
> filter-by-store chip, or a 'show me what Anna added' avatar — without breaking the single-control rule FR60 exists
> to create." Both live inside the row today (store chips — one per store since Story 9.6 — and `addedBy`) and are
> inert by design.
> A later epic wanting either affordance is **re-opening a decision**, not treating the row as free space.

#### 5.3.2 Toggling: no optimistic update

`handleToggle` (`:373-386`) awaits `checkItem` / `uncheckItem` and, on failure, does nothing to the cache — "the
normalized cache is untouched on failure, so the row's indicator reverts to the server state automatically"
(`:382-383`) — and surfaces the reason inline as `shopping-action-error` (`:449-453`). Revert-by-cache plus an inline
alert, never a toast, never a rollback animation.

### 5.4 `/admin` (`AdminPage.tsx`)

Two `Paper` panels: the registration toggle (`:92-126`) and the users table (`:129-238`).

| Branch | testid | Anchor |
| --- | --- | --- |
| config error | `registration-config-error` (`Alert severity="error"`) | `:100-103` |
| config unresolved (`enabled === null`) | a small `CircularProgress` — **never the switch rendered "off"** | `:104-107` |
| config resolved | `registration-toggle` `Switch` with a stateful label | `:108-120` |
| toggle failure | `registration-toggle-error` — the switch stays at its last confirmed value, no optimistic flip | `:121-125`, `:78-81` |
| users loading | `admin-users-loading` | `:173-176` |
| users empty | `admin-users-empty` — gated `users.length === 0 && !usersError` (`:177`), so on a users-query error with zero rows this is **suppressed** and the empty `Table` renders under the error alert instead | `:177-185` |
| users error | `admin-users-error` (rendered above, not instead of, the table) | `:167-171` |
| users content | `Table` of `admin-user-row-<username>` | `:186-237` |

**The delete confirmation states the cascade (Story 9.4).** `DeleteUserDialog` reads `ownedListCount` off the row it
was opened with (`shown`, the retained copy that survives MUI's close transition — never `user`, which is already null
while the dialog fades), and when it is greater than zero appends one sentence to the existing copy: *"This also
deletes the N list/lists they own, with their items and categories."* At zero the sentence is omitted and the copy is
unchanged. The number is a field on the `User` GraphQL type, joined at the GQL boundary from the in-memory list cache
(`UserAdminQueries.users`), not stored on the domain user — so the page pays one cache scan, not one query per row. It
is truthful only as of the page's last fetch, which is why the panel re-reads on every create and delete.

The toggle mutation writes the server-confirmed value straight into the cache with `writeQuery` rather than
refetching, so there is no desync window in which a failed refetch strands the UI on the old value (`:44-63`).

### 5.5 `/auth` (`AuthPage.tsx`) and `/account/password` (`ChangePasswordPage.tsx`)

**One route, two modes.** `/auth` toggles Sign in / Create account in place (`AuthPage.tsx:15,45,97-105`) — there is
no `/register` route. The Create-account affordance is **adaptive** and tri-state (`:56-75`, rendered `:296-320`):
the page takes its own fresh read of the registration flag with one retry, and while it is `null` it renders
**nothing** rather than flashing the "Contact your admin" branch on a visit where registration is actually enabled
(`:298-301`). Resolved-true → "Create one"; resolved-false or failed → `contact-admin`.

**Register is one user action, not two** (`:169-189`): register, then chain a login. If the chained login fails, the
page switches to Sign in and says "Your account was created. Please sign in." rather than leaving the user in an
ambiguous state.

**Two one-shot banners share one slot** and never co-occur (`:211-231`): `session-expired-alert`
(`severity="warning"`, driven by `?expired=1`) and `password-changed-message` (`severity="success"`, driven by
navigation state). Both are consumed once and scrubbed — the query param is dropped with `replace` (`:82-88`), the
navigation state is read into local state on mount and then cleared (`:34-43`) — and both dismiss the moment the user
engages a field or toggles mode (`:90-95, 107-117`).

**`/account/password` ends in a clean sign-out, deliberately** (`ChangePasswordPage.tsx:22-25, 73-80`): the backend
kills every session, so the page calls `clearAuth(false, true)` and lets `RouteGuard` — the single redirect owner —
carry `passwordChanged` to `/auth`. It does **not** navigate itself, because an imperative navigate here is deferred
by react-router, loses the race to the guard, and would strip the state (`:77-79`). There is no on-form success
banner anywhere in the flow. A wrong current password (400) shows in **both** the field and the alert region; any
other fault shows in the alert region only, never misattributed to the field (`:82-93`).

---

## 6. Feedback conventions

### 6.1 No toast. Anywhere.

> **RULING — UX-DR-E8-10** (`epics.md:1243-1245`): "Nothing in this epic adds a toast, a snackbar or a banner. The
> project's standing convention is that state changes are confirmed by the UI changing… Carried forward from
> UX-DR-E7-7." **UX-DR-E7-7** (`epics.md:1157-1161`) is the earlier form and extends it to the service worker: "no
> update toast, no 'reload to update' prompt, no version banner."

**Measured this pass:** `grep -rniE 'snackbar|toast' bp_front/src` returns **11 lines across 10 files, every one of
them a comment asserting the convention** — `main.tsx:22`, `ConfirmDialog.tsx:31`, `CreateUserDialog.tsx:33`,
`ChangePasswordPage.tsx:20`, `AdminPage.tsx:38`, `AdminPage.tsx:70`, `ResetPasswordDialog.tsx:20`,
`ListsPage.tsx:41`, `CreateListDialog.tsx:31`, `adminErrors.ts:16`, `ListDetailPage.tsx:48`. **No `Snackbar` is
imported or rendered in `src/`.** The convention is upheld by the code, not merely by the ruling.

**Three in-flow banners do ship, and they are not a contradiction.** `WelcomeBanner.tsx` — a dismissible
`Alert severity="success" variant="outlined"`, one-time post-registration (Story 5.3, FR5), mounted at
`ListsPage.tsx:86-88` — plus `/auth`'s `session-expired-alert` (`AuthPage.tsx:211-220`) and
`password-changed-message` (`:222-231`). The rulings forbid **adding** one — "*Nothing in this epic adds* a toast, a
snackbar or a banner" (`epics.md:1243`) — and all three predate them by two epics. More to the point, none is a
notification *layer*: each is an ordinary `Alert` in the document flow (not floating, not auto-dismissing, not
stacked), and each is a **one-shot transition receipt** about something the UI cannot otherwise show — you just
registered, your session expired, your password changed — rather than a confirmation of a state change already
visible on screen. Each is consumed once and cannot return (`ListsPage.tsx:70-81`, `AuthPage.tsx:34-43, 82-95`).
That is the case the rulings' own rationale carves out; a NEW banner confirming a mutation outcome would violate
them, and none exists.

The service-worker half is upheld too, with a caveat the code records honestly (`main.tsx:17-26`): `autoUpdate` is
silent — no prompt — but it is **not** "applied on next launch". The generated client calls
`window.location.reload()` when a new worker activates, so a deploy reloads open tabs and can discard unsaved dialog
input. That is filed rather than patched, because suppressing it would deviate from the mechanism the epic mandates
by name.

### 6.2 The inline-`Alert` idiom, and its three deviations

The idiom: an error is an `<Alert severity="error" role="alert" data-testid="…">` rendered **in the surface that
caused it** — last inside `DialogContent` for a dialog, or in the panel for a page. `grep -rn 'role="alert"'
bp_front/src` returns 23 lines, of which **22 are rendered attributes**; the 23rd is a prose comment
(`ConfirmDialog.tsx:31`). As in the toast census above, comments are excluded from the count.

Three places deviate, all measured this pass and recorded rather than harmonised:

| Deviation | What it does instead | Anchor |
| --- | --- | --- |
| `/auth` top-level error | a bare `<Typography role="alert" color="error" variant="body2">`, not an `Alert` | `AuthPage.tsx:283-293` |
| `/account/password` top-level error | the same bare `Typography role="alert"` | `ChangePasswordPage.tsx:193-203` |
| `/admin` reset-password confirmation | `<Alert severity="success" role="status" onClose=…>` — the **only** `role="status"` in `src/`, and the only dismissible alert outside the welcome banner | `AdminPage.tsx:155-165` |

The first two are consistent with each other (both are the 360px form column, both were written to the Story 5.2
conventions) and inconsistent with everything else. The third is arguably the correct one — a success confirmation is
a status, not an alert — and the comparison it invites is narrow: **exactly one other `role="alert"` sits on
success-shaped content**, `/auth`'s `password-changed-message` (`severity="success"` at `AuthPage.tsx:224`,
`role="alert"` at `:225`). The remaining 20 are error or warning alerts, for which `role="alert"` is the right role
and nothing is out of step. So the open question is only which role the two success confirmations should share, not a
sweep of the idiom. Filed in `deferred-work.md` under Story 8.7; **not** changed by this story.

### 6.3 Error text has one source

`bp_front/src/lib/admin/adminErrors.ts` — `graphqlErrorMessage` is what every inline alert renders, and
`isForbiddenError` is what `/list/:id` branches its redirect on (`ListShoppingPage.tsx:369`). The module's own
comment states the convention: "Errors are shown inline (dialog/panel alert) — never a toast" (`adminErrors.ts:16`).

---

## 7. Navigation model

### 7.1 Affordances, per route

| Route | In-app exits |
| --- | --- |
| `/lists` | app-bar home link; app-bar menu (Lists / Admin / Change password / Logout) |
| `/lists/:id` | its own "Back to lists" link (`ListDetailPage.tsx:117-125`) + app bar |
| `/list/:id` | its own "Back to lists" link (`ListShoppingPage.tsx:393-401`), the switcher chips (`:414-436`) + app bar |
| `/account/password` | **app bar only** |
| `/admin` | **app bar only** |
| `/auth` | none — it is the exit |

The two back links are deliberately the same idiom so there is one back-link pattern
(`ListShoppingPage.tsx:391-392`).

The **list switcher** (`ListShoppingPage.tsx:414-436`) is chips for every list the caller owns or is a member of,
ordered by the shared `byCreatedAtAsc` so the chips cannot order two lists differently from `/` (`:240-246`). The
active chip is `filled` + `primary` + `aria-current="true"` and carries **no `onClick`** (`:429-430`) — the same
inert-but-present shape as the app-bar home link, one level down. Switching re-renders the same route element in
place without unmounting, which is exactly why `useItemFilter` carries a list-switch reset
(`itemFilter.ts:79-88`).

### 7.2 The home link is inert-but-PRESENT

`AppShell.tsx:127-164`. When the resolved home is the current route (`alreadyHome`, `:53`), the link:

- keeps its `href`, its link role, its focusability, its focus ring and its type scale;
- gains `aria-current="page"` and nothing else (`:134`);
- suppresses the navigation with `preventDefault()` **only for a plain primary activation** — `button === 0` and no
  Ctrl/Cmd/Shift/Alt (`:135-147`). Modified clicks mean "open home in a new tab" and keep working; middle click fires
  `auxclick` and never reaches `onClick` at all. Enter on a focused anchor dispatches a `button: 0` click, so keyboard
  activation is covered by the same line.

> **RULING — AR-E7-8** (`epics.md:599-605`): the inert state "must be inert-but-PRESENT — never removed, never
> hidden, never `disabled`", and the link "stays a real anchor, reachable by Tab and activated by Enter (NFR-E6-3),
> never a `Button` and never an imperative `navigate()`."
>
> **RULING — AR-E7-8a** (`epics.md:606-630`) is *why* that is a hard requirement rather than a styling preference.
> An installed WebAPK at `display: 'standalone'` (`vite.config.ts:30`) has no URL bar and no browser back button; the
> only navigation is the Android system back gesture, which exits the app once history is exhausted. `HomeRedirect`
> redirects with `replace`, so a launch at `start_url: '/'` leaves history exactly **one** entry deep. On
> `/account/password` and `/admin` the app-bar link is the screen's **only** in-app exit — invisible as a risk in a
> browser, single-point-of-failure without chrome. And for the admin account home resolves to `/admin`
> (`homePath.ts:41`), so the inert guard fires on the very route with no other affordance: harmless only by
> coincidence, which is precisely why a vanishing title would never have been caught.
>
> The rationale is repeated verbatim in the code at `AppShell.tsx:119-125`, which is the reason it survived.

**Consequence, measured and knowingly accepted** (`AppShell.tsx:40-47`): on a cold page load of the home route the
app bar reads an empty cache for ~100ms, so the link is live in that window and a click inside it still costs a
history entry. Closing it would mean the app bar issuing its own request, which AR-E7-8 forbids. **Any test asserting
the inert state must synchronise on `aria-current` rather than race it** — two of the six specs failed 2-of-6 runs
before they did.

> **RULING — UX-DR-E7-6b** (`epics.md:1153-1155`): nothing about the installed app may depend on being able to read
> or edit the URL. That promotes every graceful-redirect branch from politeness to the only recovery path:
> `homePath.ts:45` (lists-query error → `/lists`) and `ListShoppingPage.tsx:369-371` (FORBIDDEN → `/lists`). Neither
> may be narrowed.

---

## 8. Dialog conventions

Ten dialogs, all `fullWidth maxWidth="xs"`: `CreateListDialog`, `AddCategoryDialog`, `EditCategoryDialog`,
`AddItemDialog`, `EditItemDialog`, `ShareMembersDialog`, `CreateUserDialog`, `DeleteUserDialog`,
`ResetPasswordDialog`, `ConfirmDialog`.

**`CreateListDialog.tsx` is the canonical form dialog.** Its shape, and what each part is for:

| Convention | Anchor |
| --- | --- |
| A native `<Box component="form" onSubmit=… noValidate>` wrapping title/content/actions — so **Enter submits** | `CreateListDialog.tsx:92` |
| Validate on **submit**, not on change; errors clear as the user types | `:54-66`, `:99-102` |
| A same-tick re-entry guard (`if (loading) return`), because `disabled` only applies next render | `:70` |
| Length limits enforced **twice** — in `validate()` and as a native `maxLength` | `NAME_MAX = 100` at `:25`, used at `:60-62` and `:109` |
| A real `catch` that surfaces `graphqlErrorMessage(err)` inline, never a toast | `:79-82`, `:122-126` |
| The error `Alert` is **last inside `DialogContent`**, below the fields | `:122-126` |
| Success closes immediately, *then* refetches in the background — so a failed refetch is never a failed create | `:83-87` |
| Testids are `{dialog}-{field\|cancel\|submit\|error}` | `:109,119,123,129,132` |
| Cancel is disabled while in flight; submit shows a `CircularProgress size={20}` | `:129,132-134` |

**`ConfirmDialog.tsx` is the destructive counterpart** and differs on one point deliberately: **it has no `<form>`**
(`:84-109`). The mutation fires only from the confirm button — confirmation-first (`:28-31`). It stays open on
failure, showing `{testId}-error` inline (`:89-93`). Its callers pass a description that names the cascade in prose
("Items in this category are removed with it. This cannot be undone." — `ListDetailPage.tsx:432-437`).

**The multi-value store field's commit key is Enter — the one per-field exception to "Enter submits."** `StoreField`
(shared by `AddItemDialog` and `EditItemDialog`) is a chip input: the user types a name and it becomes a removable
chip. Both dialogs are native forms that submit on Enter (the canonical shape above), and Enter is also the gesture
users expect from a chip input, so the store input `preventDefault()`s and **commits the draft instead of submitting**
(Story 9.6, UX-DR-E9-6). **Blur commits the same draft**, which is what keeps "type Lidl, click Save" from silently
dropping the name: the button's `pointerdown` blurs the input, React flushes the commit, and the click then submits a
payload that already holds it. A duplicate by case-insensitive key is refused with an inline message and no save
attempt. The field is deliberately **not** an `Autocomplete`: the category `Select` must stay the only
`role=combobox` in either dialog, which is what the E2E helpers' scoped `getByRole('combobox')` depends on. Story 9.6
re-examined that constraint and **kept** it.

**The open-transition seeding pattern.** A dialog whose props are cleared by the parent the instant it closes must
retain what it was showing, or the content blanks out during MUI's close animation. Both implementations adjust state
**during render**, keyed off the closed→open transition — never in an effect, because the project's lint
(`eslint-plugin-react-hooks` 7.x, `react-hooks/set-state-in-effect`) forbids it and an effect would also paint one
frame of the wrong content:

- `ConfirmDialog.tsx:47-62` — `prevOpen` sentinel; retains `shownTitle` / `shownDescription`.
- `EditItemDialog.tsx:67-81` — the same sentinel plus an id clause, so a dialog retargeted from one row to another
  without closing could not save against the previous item's id. The reasoning is at `:56-66`.

---

## 9. Test contract: the narrow floor, and testid conventions

These are part of the experience contract because the E2E suite is how every behaviour above is held in place.

### 9.1 The responsive contract and where the gate lives

**The floor is 320px CSS width, and it is a single constant, not a habit.** `NARROW_FLOOR_PX = 320` is declared once
at `bp_front/e2e/support/layout.ts:32` and imported by `bp_front/playwright.config.ts:2`, which builds
`PIXEL_7_AT_FLOOR` from it (`playwright.config.ts:29-32`): the Pixel 7 device descriptor is spread — touch emulation
and device scale factor are what Story 8.3's scroll guard depends on — with `viewport.width` and `screen.width`
overridden to the constant. `screen` is set alongside `viewport` deliberately (`:17-20`): Pixel 7's real screen is
412×915, so overriding the viewport alone would leave `window.screen.width` at 412 for anything that branches on it.
Two of the four projects use `PIXEL_7_AT_FLOOR` (`:200`, `:235`); the rest render at desktop Chrome.

The requirement behind it is **NFR-E8-1** (`epics.md:349`) — the app is usable down to 320px, nothing overflows
horizontally — and **NFR-E8-2** (`:355`), which says the floor is covered by the E2E gate rather than by inspection.
**RULING UX-DR-E8-9** (`epics.md:1237-1241`) is why 320 and not 344 or 360: a Galaxy Z Fold 5 cover screen is ~344px
and every "mobile" assertion the project had ever run was at 412px, so the floor was set below the reported device
"so the requirement outlives one handset".

Two shared helpers carry the assertions — `expectNotClipped` and `expectInsideViewport` in `e2e/support/layout.ts` —
and the geometry consequences that follow from them (a clipped element does not widen its ancestors, so a
no-horizontal-overflow assertion cannot catch a truncated name) are in `DESIGN.md` §12. Two specs still call
`page.setViewportSize({width: 360})`, which in the retargeted `mobile` project **widens** rather than narrows; that
is filed, see §13.

### 9.2 Testid conventions

- **Page roots**: `{page}-page` — `auth-page`, `lists-page`, `list-detail-page`, `list-shopping-page`, `admin-page`,
  `change-password-page`.
- **Screen states**: `{screen}-{loading|empty|no-matches|notice|error}` — e.g. `list-detail-loading`,
  `shopping-no-matches`, `lists-notice`, `shopping-action-error`.
- **Dialogs**: `{dialog}-dialog` plus `{dialog}-{field}` / `-cancel` / `-error`, and for the primary action **either
  `-submit` or `-confirm`** — the two are not interchangeable and a spec must use the right one:
  - `-submit` on the form dialogs — `create-list-submit`, `add-category-submit`, `edit-category-submit`,
    `add-item-submit`, `edit-item-submit`, `create-user-submit`.
  - **`-confirm` on the destructive/confirmation dialogs** — `delete-user-confirm` (`DeleteUserDialog.tsx:100`, whose
    dialog keeps its bespoke shape and its `delete-user-dialog` / `-error` / `-cancel` / `-confirm` testids unchanged
    through Story 9.4; only the confirmation copy grew the cascade sentence),
    `reset-password-confirm` (`ResetPasswordDialog.tsx:117`), and every `ConfirmDialog` instance, which derives
    `${testId}-confirm` / `-cancel` / `-error` from its `testId` prop (`ConfirmDialog.tsx:17-18, 85, 90, 96, 104`) —
    so `delete-list-dialog-confirm`, `leave-list-dialog-confirm`, `remove-category-dialog-confirm`,
    `remove-item-dialog-confirm`.
  - **`ShareMembersDialog` deviates from both** (`ShareMembersDialog.tsx:99-189`): its invite action is
    `share-submit` with **no matching `share-cancel`** — the dismiss control is `share-members-close` — its field is
    `share-username-input` and its error is `share-error`, not `share-members-*`. It is the one dialog whose testids
    are not derived from its own root testid.
- **Per-store ids are keyed by NAME, nested under the owner's key** (Story 9.6). On the shopping row:
  `shopping-item-stores-<item>` on the chip container (absent when the item has no stores) and
  `shopping-item-store-<item>-<store>` per chip. In either item dialog, under the `{testIdPrefix}` the dialog passes
  (`add-item` / `edit-item`): `-store` (the text input), `-store-chips` (the selected-store container),
  `-store-chip-<name>`, `-store-chip-remove-<name>`, `-store-suggestions`, `-store-suggestion-<name>`,
  `-store-suggestions-error` and `-store-duplicate` (the inline refusal). They inherit the name-keying defect below.

- **Shared filter controls**: `filter-category`, `filter-category-option-all`,
  `filter-category-option-<name>`, `filter-search`, `filter-checked`, `filter-checked-{all|unchecked|checked}`
  (`ListFilters.tsx:117,119,127,144,146-148,158`). The *row* testid is passed in — `list-detail-filters` on
  `/lists/:id`, `shopping-filters` on `/list/:id` — and the component's own comment records that nothing in the suite
  asserts either; every spec reaches the individual controls (`ListFilters.tsx:19-23`).
- **Entity rows are keyed by NAME on both surfaces**: `list-row-<name>`, `item-row-<name>`,
  `category-row-<name>`, `shopping-item-<name>`, `shopping-group-<name>`, `switcher-chip-<name>`,
  `admin-user-row-<username>`, and the three membership ones on the pending-invites surface (§5.1.1) —
  `pending-invite-<listName>`, `accept-invite-<listName>`, `decline-invite-<listName>`
  (`PendingInvites.tsx:72,81,90`). `ShareMembersDialog` adds two more, keyed by username rather than list name:
  `member-row-<username>` and `remove-member-<username>` (`ShareMembersDialog.tsx:151,159`).

> **This is a known defect, decided and re-filed, not an oversight.** Story 8.4 decided to KEEP name-keyed testids
> (`deferred-work.md:1935-1949`): Epic 8's contract keys both surfaces by name, which is what makes a shopping-side
> and a management-side assertion about the same item comparable at all. The collision — two same-named items in
> different categories, or two same-named categories on one list, tripping Playwright strict mode — is **re-filed as
> OPEN and wants its own story** (`deferred-work.md:1951-1967`). A fix must re-key `item-row-<name>`,
> `shopping-item-<name>`, `filter-category-option-<name>` **and** `add-item-category-option-<name>` together across
> ~35 call sites. The `pending-invite-*` / `accept-invite-*` / `decline-invite-*` family is the same construct on a
> `listName`, and list names are no more unique than category names, so a sweep should take it too; a partial re-key would leave the two screens keyed differently, which is the drift class Epic 8
> exists to remove. This is also why `e2e/order.spec.ts` asserts the duplicate-name ordering case against the
> exported `groupItemsByCategory` rather than through the DOM.

---

## 10. Realtime

**One screen subscribes: `/list/:id`.** Two subscriptions, both consumed via `subscribeToMore` on an existing query
— "never a standalone `useSubscription` and never a second client" (`listsQueries.ts:264-266`):

| Subscription | Attached to | Anchor |
| --- | --- | --- |
| `ItemUpdates($listId)` | `ItemsQuery` | declared `listsQueries.ts:275-292`; wired `ListShoppingPage.tsx:259-284` |
| `CategoryUpdates($listId)` | `CategoriesQuery` | declared `listsQueries.ts:294-305`; wired `ListShoppingPage.tsx:286-308` |

`subscribeToMore` ties the socket to the query's lifecycle, so unmount (logout → redirect) unsubscribes and the lazy
socket closes with no explicit dispose (`ListShoppingPage.tsx:255-258`). The merge keys by id and is **idempotent**,
because the stream echoes the caller's own actions: `DELETED` or a `SAVED` carrying `item.deleted === true` (the
one-timer check) drops the row; a `SAVED` with `deleted: false` upserts (`ListShoppingPage.tsx:264-281`,
`listsQueries.ts:266-274`).

**A category `DELETED` event prunes TWO caches** (Story 9.3). `updateQuery` can only ever return the query it is
attached to, so the categories subscription returns the pruned `getCategories` *and* reaches across to
`ItemsQuery{listId}` through `client.cache.updateQuery`, dropping every item of the removed category. This is the
only `cache.` call in `src/`. It is deferred one microtask so the items write is not nested inside the cache
transaction Apollo is running for the categories update — a nested write can land without broadcasting, which would
leave the rows on screen under the synthetic `Uncategorized` bucket after their group had gone. The server emits no
per-item events for a cascade on purpose: the item flow is `extraBufferCapacity = 1` / `DROP_OLDEST`, so a fan-out
would be truncated for any subscriber not consuming instantly.

**`/lists/:id` is refetch-driven and deliberately has no subscription.** The code says so twice, at
`ListDetailPage.tsx:404-406` (item edits) and `:417-420` (category renames): "no `subscribeToMore` here; the shopping
view's existing per-list subscription already propagates an edit live to other members." This is why
`ListFilters` had to stay strictly presentational — the shared component must not assume the subscription only one
of its two hosts has (`ListFilters.tsx:38-41`, AR-E8-6).

**Membership has no subscription at all**, and that is recorded at the query rather than left to be discovered:
"There is no membership subscription — consumers refetch this query after every membership mutation"
(`listsQueries.ts:42-43`).

**The stale-selection consequence.** A realtime `CategoryUpdates` event can delete a category the user has selected
in the filter. `useItemFilter` prunes **every id that no longer exists and keeps the rest** (`itemFilter.ts:90-103`)
— dropping the whole selection would discard the user's other still-valid choices. The `some(...)` guard on that
render-phase update is load-bearing: an unconditional `setValue` would re-render forever (`itemFilter.ts:96-97`).

---

## 11. Auth UX, end to end

1. A signed-out visit to any path lands on `/auth` via `RouteGuard` — including unknown paths, since the catch-all is
   inside the guarded tree (`App.tsx:29-30`).
2. Sign in or Create account in one route, one action (§5.5).
3. `establishSession` decodes the token, publishes auth state and navigates to `/` with `replace`
   (`AuthPage.tsx:123-132`). Only the register→login path passes `welcome: true`.
4. `/` resolves through the five branches of §3.
5. Session expiry: the Apollo error link clears auth with `expired`; `RouteGuard` — the single navigator — sends the
   user to `/auth?expired=1` (`RouteGuard.tsx:8-10, 24`), and the banner clears the moment the user engages the form.
6. Password change ends in a clean sign-out with a confirmation on `/auth` (§5.5).
7. Logout invalidates the server session, then `clearAuth()` lets the guard redirect; the menu item is disabled while
   the call is in flight so it cannot double-fire (`AppShell.tsx:82-92`, `:230`).

The guard renders `null`, never a spinner, on every one of these transitions (`RouteGuard.tsx:29`,
`AdminGuard.tsx:19`), so the app never flashes a redirect.

---

## 12. The four AC2-mandated rulings, in one place

The story's AC2 names four decisions that must appear with the identifier that decided them, marked as rulings rather
than code facts. They are collected here because a reader cannot recover any of them from the code — only verify
them against it. **This is not the full set of rulings these documents lean on**; the others are cited inline where
they bear, and are listed after the table.

| Ruling | Identifier | Where it was decided | Its code today |
| --- | --- | --- | --- |
| **Manage vs. use** — `/lists/:id` manages a list, `/list/:id` shops it; the two screens differ on purpose and those differences stay | `md`'s ruling | `epic-8-context.md:132-133` ("UX & Interaction Patterns") | §4; `keepEmpty` at `order.ts:120-131` |
| **Inert-but-present home link** — never removed, hidden or disabled; `aria-current` is the only added attribute | **AR-E7-8**, with its rationale in **AR-E7-8a** | `epics.md:599-605`, `epics.md:606-630` | `AppShell.tsx:119-125, 134-147` |
| **No toast, snackbar or banner** — state changes are confirmed by the UI changing | **UX-DR-E8-10**, carried from **UX-DR-E7-7** | `epics.md:1243-1245`, `epics.md:1157-1161` | no `Snackbar` in `src/`; 11 comments asserting it |
| **The shopping row is a closed extension surface** — the store chips and `addedBy` avatar may not become affordances | **AR-E8-8a** | `epics.md:853-858` | `ListShoppingPage.tsx` — `ShoppingItemRow`, its chip block and its `addedBy` block |

**The other rulings cited inline**, each at the point it bears:

| Ruling | Identifier | Cited at |
| --- | --- | --- |
| The closing story writes this contract; describe, don't prescribe; the stale specs are marked superseded, not deleted | **AR-E8-8** (`epics.md:859-870`) | this document's premise; `DESIGN.md` §13 |
| Nothing about the installed app may depend on reading or editing the URL | **UX-DR-E7-6b** (`epics.md:1153-1155`) | §7.2 |
| A cold/unknown answer must fail toward navigating, never toward a dead control | **UX-DR-E7-4** (`epics.md:1125`) | §3 (`homePath.ts:23-24`) |
| The category filter is a multi-select with a text summary, not a chip row | **UX-DR-E8-4** (`epics.md:1202`) | §4.1 |
| The checked-status toggle is shopping-only; the shared component omits it rather than disabling it | **UX-DR-E8-7** (`epics.md:1220`) | §4, §4.1 |
| The shared filter must not assume the subscription only one of its two hosts has | **AR-E8-6** (`epics.md:829`) | §4.1, §10 |
| 320px is the floor, and the gate must render there | **UX-DR-E8-9** (`epics.md:1237-1241`), **NFR-E8-1/-E8-2** (`epics.md:349`, `:355`) | §9.1 |
| The dark theme, type scale and visual language are unchanged this epic; light mode, a token overhaul and Epic 4 bottom tabs are out of scope | **UX-DR-E8-11** (`epics.md:1247-1251`) | `DESIGN.md` §10, §11 |
| The app bar must never re-derive the home path | **AR-E6-7**, restated by AR-E7-8 | §3 |

---

## 13. Cross-reference: what Story 8.1's measurement filed rather than fixed

**AR-E8-2a** (`epics.md:772`) held that retargeting the mobile gate to 320px would surface defects beyond the two
reported, and that this was the point. It did. The narrow-viewport picture lives in `deferred-work.md:1852-1979` and
is collected **once, in `DESIGN.md` §12** — the measurements, the two uncorrected caps, the two 360px specs and the
recorded flake. It is deliberately not repeated here: two copies of a list of filed defects is exactly the drift these
documents exist to stop.

The one item on that list that is behavioural rather than visual, and therefore belongs to this document, is the
**name-keyed-testid collision** — see §9.2, where it is described with the decision that kept it.

---

## 14. How to check this document

Run **from the repository root** — the same base `DESIGN.md` §13 uses, so the two blocks can be pasted one after the
other:

```bash
git rev-parse HEAD
# compare against verified_at_commit in the frontmatter above

wc -l bp_front/src/App.tsx
# expect 35 — the whole route map

grep -rn 'subscribeToMore' bp_front/src
# expect 3 files: ListShoppingPage.tsx (the only WIRING, 2 useEffects)
# plus prose comments in listsQueries.ts and ListDetailPage.tsx

grep -rn 'useSubscription' bp_front/src
# expect 1 line, a comment in listsQueries.ts forbidding it

grep -rniE 'snackbar|toast' bp_front/src
# expect 11 lines across 10 files, every one a comment

grep -rn 'role="alert"' bp_front/src
# expect 23 lines: 22 rendered attributes + 1 comment (ConfirmDialog.tsx:31) — see §6.2

grep -rn 'maxWidth="xs"' bp_front/src/components
# expect 10 lines, one per dialog

grep -rn 'role="status"' bp_front/src
# expect AdminPage.tsx:236 only (was :158; the line moved when Story 9.2 added the pager)

grep -n 'NARROW_FLOOR_PX' bp_front/e2e/support/layout.ts bp_front/playwright.config.ts
# expect 5 lines: the single declaration (layout.ts:32), and in the config the import (:2),
# two uses (:31, :32) and one comment (:6). (Supersedes "6 lines … plus one comment there
# (:100)": re-measured at Story 9.1, layout.ts has no second NARROW_FLOOR_PX line.)
```

If a claim here disagrees with the source, **the source wins** and this document is stale: correct it, and name the
figure or claim it supersedes. That is the whole point of the anchors.

**Who re-verifies, and when.** These two documents supersede specs that went stale in silence, and the same fate is
the default. The trigger is therefore mechanical and shared with `DESIGN.md` §13: **re-run the block above and update
the verification commit at the start of any story that changes `bp_front/src/App.tsx`, a route component, a guard,
`AppShell.tsx`, `playwright.config.ts` or anything under `bp_front/src/lib/lists/`, and at every epic close**,
whichever comes first. A story that finds a claim here false corrects it in the same commit as the code.
