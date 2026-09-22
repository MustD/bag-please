# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can tell the admin what they want from inside the app, and the admin can read and clear it. Items carry every
store they are sold in, with no existing store lost. An item can be added from the shopping screen without leaving it.
The category filter menu can be closed on a phone, Home is reachable from the account menu, and the admin's user list
is paginated. Underneath, deleting a category or a user no longer leaves orphaned data behind, and the E2E test gate
waits for a backend that is actually ready. This is a single feedback-driven maintenance epic (source: user feedback
items relayed by the product owner) rather than a new feature arc — one branch, one release.

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

- Admin user list must be server-paginated: 20 users per page, stable username-ascending order, page controls plus a
  total-count display; creating/deleting a user keeps the admin on a valid page (deleting the last user on the last
  page moves back one page).
- Users can assign an item to zero, one, or several stores from both the add and edit item dialogs. Names are trimmed;
  names differing only by letter case are treated as the same store and not duplicated on one item. The shopping-view
  item row shows every store the item carries, and all remain inside the row's single check target.
- No existing per-item store data may be lost when converting to multiple stores; an item that had one store keeps it
  as its only store on first startup of the release, run once, never re-run.
- The admin account is restricted to user management, application configuration, and reviewing feedback; admin
  callers are rejected on every list-related operation (create/view/share/delete lists, items, categories,
  subscriptions) and cannot send feedback.
- Any authenticated user (not the admin) can send feedback — free text, required, max 2000 characters — from an
  account-menu entry available on any screen. Submission stores the text, submitter username, and timestamp; confirms
  success; returns the user to their prior screen. Cancelling sends nothing. Users cannot see, edit, or delete their
  own past feedback.
- The admin reviews feedback in the admin area: all entries newest-first, each showing text (rendered as plain text,
  never as markup), submitter username, and submission time. The admin can delete an entry after explicit
  confirmation (permanent, no undo). Feedback has no status/reply/tagging. Deleting a user does not delete their
  feedback.
- From any authenticated screen, one action returns to the application's home destination: the app-bar title links to
  `/`, which resolves via existing logic (oldest owned/member list, lists index if none, admin area for the admin).
  The shopping view also keeps its back-to-lists affordance. The account menu carries a matching Home entry (on the
  home route itself it just closes the menu). No screen is a navigational dead end.
- Category filtering/search stays consistent across both list surfaces (categories AND free-text name search); the
  shopping view keeps its checked-status toggle, not added to the management screen. Empty categories show on the
  management screen only when no filter/search is active; the shopping view always hides empty groups. Because the
  open category filter menu covers most of a phone screen, it needs an explicit, reachable confirm/close control;
  selections still apply live as toggled (no cancel-and-revert); outside-tap and Escape still close it too.
- The shopping view offers a floating add button that opens the same add-item dialog used by list management, with
  the current list fixed as the target (no list picker); the new item appears immediately and reaches other members
  live. The button must stay reachable while scrolling and never permanently cover the last item row/controls. If the
  list has no categories, the dialog explains a category is needed first and links to list management instead of
  showing a disabled form.
- Destructive admin actions (delete feedback, delete user, etc.) require explicit confirmation, consistent with
  existing admin confirm-dialog patterns.
- Every FR must be covered by UI-driven Playwright E2E on both a desktop and a 320px mobile viewport, run against the
  production artifact (Caddy-served SPA + backend + Mongo); sessions are never faked (no login fixture, no
  storageState, no request interception for the behavior under test); a new test must be observed failing before it's
  accepted. 320px assertions are mechanical (no eyeballing) and cover the admin page, feedback dialog, FAB, and
  multi-store row — nothing overflows, is pushed off-screen, or is clipped without a recorded, measured decision.
  Every input has a visible associated label, forms are fully keyboard-navigable, and error messages are associated
  with their field.
- Deferred, explicitly out of scope for this epic: recurring/one-time item soft-delete and scheduler restore
  mechanics beyond what's touched here, Phase 3 single-store shopping mode, Mongo transactions for cascades,
  username reuse within the token window after deletion, feedback pagination, a feedback rate limit, a max
  stores-per-item limit, an `/admin` page number in the URL.

## Technical Decisions

- Backend stays in the existing per-entity slice layout (`entity/<name>/{Service,Storage,gql/,mongo/}`), one-way
  GQL → Service → Storage → Repository; errors reuse the existing `GraphQLForbiddenException` /
  `GraphQLInvalidInputException` / `GraphQLNotFoundException` types (no new error envelope). Backend rules are proven
  with Kotest + Testcontainers. Schema-changing stories regenerate GraphQL codegen in the same story (never hand-edit
  generated code); backend and frontend version numbers stay in lockstep and ship together.
- New `entity/feedback/` slice (`Feedback`, `FeedbackService`, `mongo/FeedbackRepository` in a `feedback` collection,
  `gql/FeedbackApi`), modeled on the existing user/config entities: no cache, no reactive stream, no subscription.
  Document fields: UUID `_id` (as string), `text`, `username` (plain copied string, no user-id reference), `createdAt`.
  User deletion never touches this collection. `sendFeedback(text)` rejects the admin caller, trims and length-checks
  text (max 2000 UTF-16 chars, blank rejected); `feedback` query returns all entries newest-first unpaginated;
  `deleteFeedback(id)` returns the deleted id. Both admin-only. The two existing duplicated `requireAdmin()` checks
  are consolidated into one shared auth helper used by user admin, app config, and feedback.
- Items move from a single `store` field to `stores: [String!]!` across every layer (entity, Mongo doc, GraphQL type,
  input, mappers, repository) in one story/release, alongside a one-time migration converting any existing single
  `store` value into the `stores` list (idempotent, runs once via the existing migration-tracking mechanism, ordered
  after the prior migration). The server is the sole normalization authority for store names: trim, drop empties,
  dedupe case-insensitively while keeping first-occurrence casing and position; the frontend mirrors this logic for
  UX but the server result is authoritative. A pre-deploy database dump/backup is required before shipping this
  migration, with a documented rollback path.
- One shared check-state helper function is used by check/uncheck and by the item edit save path so check-related
  server-owned fields (checkedAt, deleted, deletedAt) behave consistently regardless of which mutation touched them.
- Admin `users` query becomes paginated (`limit`, `offset`, an `around`-username option), returning a page plus total
  count, sorted by username ascending; server clamps limit/offset to valid ranges. The frontend fetches with a
  network-preferring cache policy and evicts/refetches the users list after create/delete mutations.
- Category deletion cascades: deleting a category also deletes every item in that category (including already
  soft-deleted ones) for all list members, via a single authoritative event rather than per-item events (the
  real-time channel used is capacity-limited so bulk per-item events would be dropped) — clients treat the category
  deletion as authoritative for pruning their own cached items of that category. Item save/uncheck paths reject
  categories that don't belong to the target list.
- Deleting a user account fully purges their list memberships (all statuses, on any list) and cascades deletion of
  lists they own (not transferred) rather than leaving orphaned ownership; session invalidation happens as part of
  the same deletion flow. The delete-user confirmation states how many owned lists will be deleted as a consequence.
- A backend health endpoint is added outside authentication/rate-limiting for the E2E test runner to poll before
  starting tests, checking Mongo reachability with a short timeout; this replaces the current source of test-run
  flakiness on a cold-start backend.
- Frontend: the shopping-view floating add button reuses the existing add-item dialog (no second dialog) with the
  list id fixed; the store field becomes a single reusable multi-value component (chips + suggestions + free entry)
  used by both add and edit item dialogs, deliberately not an autocomplete/combobox pattern (to avoid a second
  combobox role inside the dialog) unless a story explicitly records a reason to change that. The account menu gains
  Home and Feedback entries (Feedback hidden for the admin role); Feedback opens as a dialog, not a route, so the
  underlying screen stays mounted.
- No toast/snackbar/notification layer is introduced anywhere in this epic — feedback send confirmation and admin
  delete results follow the existing in-flow inline alert / disappearing-row idioms already used elsewhere in the
  app. New dialogs follow the existing canonical form-dialog conventions (native form + submit-on-Enter, validate on
  submit, errors clear on typing, in-flight submit/cancel disabling, inline error rendering).
- Every story that touches core shared UI (App shell, routes, AppShell, theme, or the shared list query/component
  library) must correct the project's living design/experience documentation in the same commit — these docs
  describe the shipped app and must stay accurate. No new visual language, palette, or theme override is introduced.

## UX & Interaction Patterns

- Shopping-view item rows keep their existing accessible name (a toggle label naming the item); store information is
  added to the row's accessible description instead, alongside existing metadata, and is omitted when the item has no
  stores. Store chips inside the row are presentational only, never separate interactive affordances, and multiple
  stores must not visually crowd out the check control or item name on a narrow phone width.
- The floating add button is bottom-right, fixed, reachable through scrolling, respects safe-area insets, and the
  page must reserve enough bottom padding that it never permanently obscures the last row. Adding an item is now a
  valid shopping-view action even though editing/deleting remain management-screen-only actions — this is a
  deliberate change to the previous "shopping view is read-only except checking" rule, and the shopping empty-state
  copy needs to be revised to match (point users at the button, not just at list management).
- The category filter menu needs a clearly labeled, always-reachable "close/done" control inside the menu itself
  (not just outside-tap/Escape) so it's usable when the open menu covers most of a small screen; this control is
  shared by both list surfaces since the filter component is defined once.
- Feedback dialog and the admin feedback panel follow the existing dialog/panel visual conventions already
  established elsewhere (a `Paper` panel with the standard error/loading/empty/content branch order for the admin
  feedback list; a standard modal form for composing feedback with a character counter against the 2000-char limit).
- Admin pagination controls need previous/next affordances, a page indicator, and a total count, all operable at a
  320px viewport with no horizontal overflow.

## Cross-Story Dependencies

- The backend health-check story (9.1) should land first, since later stories are verified against an E2E gate that
  can currently abort spuriously on a cold-started backend.
- Admin pagination (9.2) should land early: end-to-end test data hygiene degrades further with every additional
  suite run, so delaying pagination compounds an existing test-flakiness problem.
- The category-deletion cascade (9.3) should land before or together with the shopping-view add button (9.11): the
  cascade's category-validation logic on item save is what prevents the add button from creating items in a
  just-deleted category.
- The multi-store change (9.6) touches schema, mappers, repository, the one-time migration, codegen, and E2E
  GraphQL together and ships as one indivisible unit within a single app release.
- The small-cleanups story (9.12) runs last, after every AppShell-touching story, so it only removes tokens/dead code
  that are actually unconsumed by that point.
- Feedback sending (9.9) and feedback review (9.10) share the same backend feedback slice and admin-restriction rule
  and are natural predecessor/successor work, though the epic does not mandate the exact ordering between them
  beyond the constraints above.
- Item store data must not be lost when the store-to-stores migration runs, and it is intentionally non-repeatable —
  any change to item storage in story 9.6 must coordinate with this one-shot migration timing.
