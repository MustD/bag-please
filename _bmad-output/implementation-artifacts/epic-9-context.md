# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can tell the admin what they want from inside the app, and the admin can read and clear it. Items carry every
store they are sold in, with none lost in the conversion. An item can be added from the shopping screen without
leaving it. The category filter menu can be closed on a phone, Home is reachable from the account menu, and the
admin's user list is paginated instead of growing forever. Underneath, deleting a category or a user no longer leaves
orphaned data behind, and the E2E gate waits for a backend that is actually ready. This is one feedback-driven
maintenance epic (source: `docs/feedback.md`, relayed by the product owner) rather than a new feature arc — one
branch, one release, one retro.

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

- Admin user list is server-paginated: 20/page, username ascending, prev/next controls plus a total count; creating or
  deleting a user keeps the admin on a valid page (deleting the last user on the last page moves back one page).
- Any non-admin user can assign an item to zero, one, or several stores from both the add and edit dialogs. Names are
  trimmed; names differing only by letter case count as one store and are not duplicated on an item. The shopping-view
  row shows every store the item carries, all inside the row's single check target. No existing single-store data is
  lost in conversion; the conversion runs once and never re-runs.
- The admin is restricted to user management, application configuration, and reviewing feedback — rejected on every
  list-related operation (create/view/share/delete lists, items, categories, subscriptions) and cannot send feedback.
- Any non-admin user can send feedback (free text, required, max 2000 chars) from an account-menu entry on any screen.
  Submission stores text + submitter username + timestamp, confirms success, and returns the user to their prior
  screen with its state intact; cancelling sends nothing. Users never see, edit, or delete their own past feedback.
- The admin reviews feedback in the admin area: all entries newest-first, each showing text as plain text (never
  interpreted as markup), submitter username, and submission time. Deletion requires explicit confirmation and is
  permanent; feedback has no status/reply/tagging. Deleting a user does not delete their feedback.
- From any authenticated screen, one action reaches the home destination: the app-bar title links to `/`, resolving
  via existing logic; the shopping view keeps its back-to-lists affordance; the account menu gets a matching Home
  entry (on the home route it just closes the menu). No screen is a dead end.
- Category filter/search stays consistent across both list surfaces (categories + free-text name search, AND
  combined); the shopping view keeps its checked-status toggle, not added to management. Empty categories show on
  management only when no filter/search is active; shopping always hides empty groups. The filter menu needs an
  explicit, reachable confirm/close control (it covers most of a phone screen); selections still apply live; outside
  tap and Escape still close it.
- The shopping view gets a floating add button opening the existing add-item dialog with the current list fixed (no
  list picker); the new item appears immediately and reaches other members live. The button stays reachable while
  scrolling and never permanently covers the last row. No categories yet → the dialog explains one is needed first and
  links to list management, without rendering a disabled form.
- Destructive admin actions require explicit confirmation, per existing admin confirm-dialog conventions.
- Every FR is covered by UI-driven Playwright E2E on desktop and a 320px viewport against the production artifact
  (Caddy + backend + Mongo); sessions are never faked; a new test is observed failing before it's accepted. 320px
  assertions are mechanical and cover `/admin`, the feedback dialog, the FAB, and the multi-store row. Every input has
  a visible label, forms are keyboard-navigable, errors are associated with their field.
- Explicitly deferred: one-timer/recurring scheduling mechanics beyond what's touched here, Phase 3 single-store
  shopping mode, Mongo transactions for cascades, username reuse after deletion, feedback pagination/rate limit, a
  max-stores-per-item limit, `/admin` page number in the URL.

## Technical Decisions

- Backend keeps the per-entity slice layout (`entity/<name>/{Service,Storage,gql/,mongo/}`), one-way
  GQL → Service → Storage → Repository, reusing existing `GraphQLForbiddenException` /
  `GraphQLInvalidInputException` / `GraphQLNotFoundException` (no new error envelope); proven with Kotest +
  Testcontainers. Schema-changing stories regenerate GraphQL codegen in the same story; backend and frontend version
  numbers stay in lockstep.
- New `entity/feedback/` slice modeled on the user/config entities: no cache, no reactive stream, no subscription.
  Fields: string UUID `_id`, `text`, `username` (plain copy, no user-id reference), `createdAt`. User deletion never
  touches this collection. `sendFeedback` rejects the admin, trims and bounds text (max 2000 UTF-16 chars, blank
  rejected); `feedback` returns all entries newest-first, unpaginated; `deleteFeedback` returns the deleted id; both
  admin-only. The two duplicated `requireAdmin()` checks (user admin, app config) are consolidated into one shared
  helper also used by feedback.
- Items move from a single `store` field to `stores: [String!]!` across every layer in one story/release, with a
  one-time migration folding any existing `store` into `stores` (idempotent, ordered after the prior migration via
  the existing tracking mechanism). The server is sole normalization authority: trim, drop empties, dedupe
  case-insensitively keeping first-occurrence casing/position; the frontend mirrors this for UX but the server result
  is authoritative. A pre-deploy database dump and documented rollback are required before shipping this migration.
- One shared check-state helper is used by check/uncheck and the item-edit save path so `checkedAt`/`deleted`/
  `deletedAt` behave consistently regardless of which mutation touched them.
- Admin `users` query becomes paginated (`limit`, `offset`, an `around`-username option) returning a page plus total
  count, sorted by username; server clamps limit/offset. Frontend fetches network-preferring and evicts/refetches
  after create/delete.
- Category deletion cascades: deleting a category deletes every item in it (including soft-deleted ones) for all
  members, via one authoritative category-delete event rather than per-item events (the realtime channel is
  capacity-limited); clients treat it as authoritative for pruning cached items. Item save/uncheck reject categories
  that don't belong to the target list.
- Deleting a user purges all their list memberships (any status, any list) and cascades deletion of lists they own
  (not transferred); session invalidation happens in the same flow. The delete-user confirmation states how many
  owned lists will be deleted.
- A backend health endpoint, outside auth/rate-limiting, lets the E2E runner poll before starting tests (checks Mongo
  reachability with a short timeout) — replacing the current cold-start flakiness source.
- Frontend: the shopping-view FAB reuses the existing add-item dialog (no second dialog) with the list id fixed; the
  store field becomes one reusable multi-value component (chips + suggestions + free entry) used by both item
  dialogs, deliberately not an autocomplete/combobox unless a story records a reason to change that. The account menu
  gains Home and Feedback entries (Feedback hidden for admin); Feedback opens as a dialog, not a route, so the
  underlying screen stays mounted.
- No toast/snackbar/notification layer anywhere in this epic — confirmations follow the existing inline-alert /
  disappearing-row idioms. New dialogs follow the canonical form-dialog conventions (native form + submit-on-Enter,
  validate on submit, errors clear on typing, in-flight disabling, inline error rendering).
- Any story touching core shared UI (app shell, routes, theme, shared list query/component library) must correct the
  project's living design/experience docs in the same commit. No new visual language, palette, or theme override.

## UX & Interaction Patterns

- Shopping-view rows keep their existing accessible name (toggle label naming the item); store info is added to the
  row's accessible description instead, omitted when the item has no stores. Store chips are presentational only,
  never separate affordances, and must not crowd out the check control or name at 320px.
- The FAB is bottom-right, fixed, reachable through scrolling, respects safe-area insets; the page reserves bottom
  padding so it never permanently obscures the last row. Adding an item is now a valid shopping-view action (editing
  and deleting stay management-only) — a deliberate change from the prior read-only-except-checking rule; the
  shopping empty-state copy is revised to point at the button.
- The category filter menu needs a clearly labeled, always-reachable close control inside the menu itself, shared by
  both list surfaces since the filter component is defined once.
- The feedback dialog and admin feedback panel follow existing dialog/panel conventions: a `Paper` panel with the
  standard error/loading/empty/content branch order; a standard modal form with a character counter against 2000.
- Admin pagination needs prev/next affordances, a page indicator, and a total count, operable at 320px with no
  horizontal overflow.

## Cross-Story Dependencies

- The health-check story (9.1) lands first — later stories are verified against a gate that can otherwise abort on a
  cold-started backend.
- Admin pagination (9.2) lands early — E2E data hygiene degrades further with every additional suite run.
- The category-deletion cascade (9.3) lands before or with the shopping-view add button (9.11): its category
  validation on item save is what stops the FAB creating items in a just-deleted category.
- The multi-store change (9.6) touches schema, mappers, repository, the one-time migration, codegen, and E2E GraphQL
  together as one indivisible story/release.
- Small cleanups (9.12) run last, after every AppShell-touching story, so only still-unconsumed tokens/dead code are
  removed.
- Feedback sending (9.9) and review (9.10) share the same backend feedback slice and admin-restriction rule; natural
  predecessor/successor but not mandated in strict order beyond the constraints above.
- The store-to-stores migration (9.6) is one-shot and non-repeatable — coordinate any later item-storage change with
  its timing.
