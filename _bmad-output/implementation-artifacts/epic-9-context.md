# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 9 turns a round of real user feedback into shipped behaviour. Users can send an idea or problem to the admin from
inside the app, and the admin can read and clear it. An item carries every store it is sold in instead of one, with no
existing store lost. Items can be added from the shopping screen, Home appears in the account menu, the category filter
menu can be dismissed on a phone, and the admin's user list is paged instead of growing without bound. Underneath,
deleting a category or a user stops leaving orphaned data behind, an item checked through an edit still feeds the
recurring-item scheduler, and the E2E gate waits for a backend that actually answers. It matters because these are the
frictions real use surfaced, and because several of them (orphans, phantom memberships, an unpaginated admin table) are
correctness and scaling defects, not just polish.

## Stories

- Story 9.1: The test run waits until the backend is ready
- Story 9.2: The admin's user list is paged instead of growing forever
- Story 9.3: Deleting a category deletes its items for everyone
- Story 9.4: Deleting a user leaves no phantom memberships
- Story 9.5: Checking an item through an edit keeps the scheduler working
- Story 9.6: An item can be in several stores
- Story 9.7: Home is in the account menu
- Story 9.8: The category filter menu can be closed on a phone
- Story 9.9: A user can send feedback from any screen
- Story 9.10: The admin reviews and clears feedback
- Story 9.11: An item can be added from the shopping screen
- Story 9.12: Small cleanups

## Requirements & Constraints

- **Feedback.** A signed-in non-admin user sends free text (trimmed, non-blank, at most 2000 UTF-16 code units) from any
  authenticated screen without navigating away; the author and timestamp are server-set, never client-supplied. The
  admin is excluded from sending. The admin reads all entries newest first with username and time, and deletes
  individually with confirmation. Feedback text is rendered literally — never as markup or markdown. Feedback outlives
  its author: deleting a user does not delete their feedback.
- **Multi-store items.** An item holds a list of stores rather than one. Names are trimmed, blanks dropped, and
  duplicates refused by case-insensitive key (first occurrence's casing and position win). Stores show on the shopping
  row and are editable from both item dialogs, with suggestions drawn from stores already in use. Existing single-store
  data must convert with nothing lost, idempotently, on a startup migration.
- **Admin pagination.** The user list is server-paginated (20 per page in the UI) with a total count and prev/next
  controls, sorted by username ascending. After a create the UI lands on the page holding the new user; after a delete
  it clamps to the last valid page. No client ever fetches an unpaginated user list.
- **Data integrity.** Deleting a category deletes every item in it server-side, soft-deleted items included. Deleting a
  user removes every membership row in any status, deletes the lists they own with their contents, and invalidates
  their sessions — with the user record removed *before* the purge so no in-flight write re-creates state. Both are
  idempotent and admin- or member-gated.
- **Readiness.** A credential-free `GET /api/health` returns 200 when Mongo answers and 503 within a 2-second bound when
  it does not; the E2E runner waits on it instead of racing a cold start.
- **Quality bar binding every story.** Backend rules proven with Kotest + Testcontainers; E2E driven through the UI
  against the production artifact on both desktop and the 320px floor; every new test observed failing first; schema
  changes regenerate codegen in the same story; no horizontal overflow or clipped controls at 320px; visible labels and
  full keyboard operation on new controls; the design/experience documents corrected in the same commit as the screen
  they describe; each discharged deferred-work entry closed in place and sprint status reconciled at story close.

## Technical Decisions

- **Slice layout.** Backend stays a layered monolith of per-entity vertical slices with one-way calls
  GQL → Service → Storage (optional cache) → Mongo repository. Epic 9 adds exactly one slice (`feedback`), changes one
  field's shape (`Item.store` → `stores`), and adds one plain HTTP route. No new dependency, no version upgrades.
- **Feedback slice.** Repository-backed only: no storage cache, no SharedFlow, no subscription. Document holds a string
  UUID id, text, a copied username string (not a user reference), and a server-set instant. GraphQL surface is
  `sendFeedback(text)`, `feedback` (createdAt descending, unpaginated), `deleteFeedback(id)` returning the id, with a
  missing id reported as not found.
- **One admin gate.** The two private `requireAdmin()` copies collapse into a single `DataFetchingEnvironment`
  extension in the GraphQL auth plugin, checking the JWT role claim, used by the user-admin, config and feedback APIs.
- **Store normalization.** The server is authoritative: trim, drop empties, dedupe by lowercased key keeping the first
  occurrence. Store identity is the lowercased key; stored casing is display data. Suggestions return one name per key,
  lowest by (lowercase, then natural order). The frontend mirrors the normalizer for dedupe but compares "changed"
  by exact string equality, so a casing-only edit still saves.
- **One indivisible multi-store story.** Domain model, Mongo document, both mappers, GraphQL type and input, repository
  save (set `stores` and unset `store` in one update), the migration, codegen, and the raw GraphQL in the item-editing
  E2E spec all change together, with backend and frontend versions bumped in lockstep.
- **Migrations.** Startup migrations run in declared order, each checking only its own record, none short-circuiting the
  others. The store conversion keys on the legacy field's presence, processes documents one at a time, and writes its
  completion record last — before any storage cache is populated. The release carrying it is deployed after a database
  dump, with restore-plus-previous-image as the rollback.
- **Pagination contract.** `users(limit, offset, around)` returns a page object with users, total count and the
  effective offset. The server clamps limit and offset, and `around: <username>` returns the page containing that user,
  ignoring offset. Admin collections use `cache-and-network` with the field evicted and garbage-collected after every
  successful mutation. The unpaginated field is removed from the schema.
- **Cascades.** Cascades stay ordered, non-transactional Mongo deletes followed by cache eviction. A category cascade
  emits only the parent DELETED event — clients treat it as authoritative for children and prune locally; the
  client-side per-item delete loop goes away. List deletion (by owner or by purge) emits nothing; other members are
  redirected on their next Forbidden. Only the list service writes membership data, and the user purge is the single
  caller-less, idempotent entry point, writing through list storage and the member repository rather than bulk updates.
  Owner delete and purge share one private list-cascade helper.
- **Orphan prevention.** Item save rejects a category outside the target list on both create and update branches;
  uncheck rejects an item whose category is gone; both item dialogs surface that error through the same mapped path.
  Pre-existing orphans still render in an `Uncategorized` group keyed by a frontend-only sentinel id, with their edit
  and remove controls intact. Category naming rules are unchanged.
- **Single check-state transition.** One private `applyCheckState(stored, checked, recurring, now)` serves check,
  uncheck and the save update branch: one-time checked items are soft-deleted with a timestamp, recurring checked items
  keep or receive a check-off time, no-cadence checked items stamp nothing, and unchecking clears all three fields.
  Every other server-owned field survives a save.
- **Health route.** Declared relative (`get("/health")`) inside routing, outside authentication and rate limiting, and
  served at `/api/health` via the root path. It pings Mongo inside a 2-second timeout. The service worker must keep
  `/api` out of its cache/fallback so the probe reaches the backend, and no probe binary is added to the backend image.
- **Frontend data conventions.** Every operation returning an item spreads one shared item fragment; no hand-written
  field lists; generated types are never edited by hand. There is one Apollo client; the access token stays in memory.
- **Errors and events.** Reuse the existing forbidden / invalid-input / not-found exceptions — no new error envelope.
  List-scoped mutations emit on their service's flow after the write; feedback, users and list deletion emit nothing.

## UX & Interaction Patterns

- **No toast, snackbar or notification layer exists or is added.** A success confirmation is an in-flow success alert
  with `role="status"` rendered in the surface that caused it (the account-shell hosts the feedback confirmation). A
  delete is confirmed by the row disappearing. A failed submit keeps the dialog open with the text intact and the
  reason inline at the bottom of the dialog content.
- **Form dialogs follow the existing canonical shape:** native form with submit-on-Enter (a multi-line field needs an
  explicit decision and test for its submit key), validate on submit with errors clearing on typing, a same-tick
  re-entry guard, inline mapped GraphQL errors, cancel disabled in flight, a spinner on submit, extra-small max width,
  a visible associated label, and a character counter against the trimmed limit. Test ids are namespaced per dialog.
- **Account menu** gains Home (first) and Feedback (non-admin only, after Change password / Admin, before Logout), each
  a menu item with a small icon, keyboard reachable. On the resolved home route the Home entry only closes the menu and
  adds no history entry. The app-bar title link's existing inert-but-present behaviour is untouched.
- **Admin screen** gains a feedback panel matching the existing panel shape, with the standard branch order
  error → loading → empty → content, rows keyed by id, text wrapping without truncation at 320px, and a destructive
  icon button opening the shared confirm dialog. Pagination adds labelled prev/next controls, a page indicator and a
  total, all usable at 320px. The delete-user dialog names the owned-list cascade in prose.
- **Store field** becomes multi-value in both item dialogs: selected stores as removable chips, suggestions from
  existing stores, free entry, case-insensitive duplicate prevention, keyboard-operable at 320px. It is deliberately
  not an autocomplete today (to avoid a second combobox in the dialog) — a story either keeps that constraint or
  records why it no longer applies.
- **Shopping row** shows stores as non-interactive chips inside the closed row surface; activating anywhere on the row,
  chips included, toggles the item. The row's accessible name stays exactly the toggle phrasing, and the store list goes
  in the row's accessible *description*, omitted entirely when the item has no stores. Long store names must not push
  the check glyph or the name out of a 320px viewport.
- **Shopping add button** is a floating action button fixed bottom-right with safe-area inset, labelled "Add item",
  reachable while scrolling, with page padding reserved so it never covers the last row. Adding becomes a shopping-view
  action; editing and deleting stay management-only. Empty-state copy is revised to point at it when the list has
  categories but no items, and keeps the management guidance when there are no categories. With no categories, the
  add dialog shows guidance and a link to list management instead of a form.
- **Category filter menu** gains a sticky confirm control inside the multi-select menu, defined once so both list
  screens get it; selections still apply live, outside-tap and Escape still close without reverting, and focus returns
  to the category control on confirm. An explicitly selected empty category stays visible on the management screen.
- **Visual language is unchanged:** dark-only theme, system fonts, the existing component overrides, outlined icons for
  destructive and secondary actions, error colour on destructive controls, a label on every icon-only control. No new
  palette key or theme override.

## Cross-Story Dependencies

- The health endpoint (9.1) lands first: every later story is verified against a gate that can otherwise abort on a
  cold start.
- Pagination with its test-data hygiene mechanism (9.2) lands early, because the user-creation E2E helper's flake grows
  with every suite run against a persistent database.
- The category cascade (9.3) lands before or with the shopping add button (9.11): its create-branch category check is
  what stops the new button creating items in a just-deleted category.
- The multi-store change (9.6) is indivisible — schema, mappers, repository, migration, codegen and E2E GraphQL ship in
  one story and one app version. It depends on the shared check-state transition (9.5) for its save update branch.
- Stories 9.7, 9.9 and 9.11 all touch the app shell's account menu and the shared add-item dialog; 9.2 and 9.10 both
  touch the admin screen and the shared admin gate; 9.3 and 9.4 both touch item and list cascade paths. Expect to
  coordinate rather than duplicate these surfaces.
- Small cleanups (9.12) run last, after every app-shell story, so only tokens still unconsumed at that point are
  removed.
