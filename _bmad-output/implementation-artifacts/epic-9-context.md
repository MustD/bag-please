# Epic 9 Context: User Feedback Pass

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 9 turns collected user feedback into shipped changes. Users get a way to tell the admin what they want from inside
the app, and the admin gets a place to read and clear it. Items stop being single-store and carry every store they are
sold in, with no existing store value lost. Adding an item becomes possible from the shopping screen, the category
filter menu becomes closable on a phone, Home appears in the account menu, and the admin's user list is paged instead of
growing without bound. Underneath, deleting a category or a user no longer leaves orphaned data, the E2E gate waits for a
backend that is actually ready, and routed hygiene items are cleared. These are the friction points users hit daily plus
the data-integrity and tooling debt that would otherwise keep undermining the test gate.

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

- **Feedback:** a regular user sends free text (required, max 2000 characters after trimming) from the account menu on
  any authenticated screen; it is stored with the submitter's username and server time. Users never see, edit or delete
  it afterwards. The admin never sends feedback and never sees the entry point.
- **Feedback review:** the admin sees all entries newest-first with text, username and time; text renders as plain text,
  never markup. Deletion is permanent and needs explicit confirmation. No status, reply or tagging. Deleting a user
  account does not delete that user's feedback.
- **Multi-store items:** zero, one or many stores per item. Both item dialogs offer a multi-value store field that
  suggests existing names and accepts new ones. Names are trimmed; names differing only in case are the same store and
  are not held twice. The shopping row shows every store, all inside the row's single check target. Existing
  single-store data must survive with no loss.
- **Admin pagination:** at most 20 users per page, stable username-ascending order, page controls and a visible total.
  Creating or deleting a user leaves the admin on a valid page.
- **Navigation:** no authenticated screen is a dead end; one action returns the user home, from both the app-bar title
  and an account-menu entry.
- **Filtering:** the open category menu needs an explicit confirm control that closes it; selections apply as toggled, so
  there is no cancel-and-revert (outside tap and Escape still close).
- **Add from shopping view:** a floating button opens the same add-item dialog fixed to the current list; the new item
  reaches other members live and the button never permanently covers the last row or its controls. With no categories
  yet, the dialog explains one is needed and offers a route to list management.
- **Cascades:** deleting a category removes its items for everyone (soft-deleted ones included); deleting a user removes
  every membership row, strips them from other members' lists, and deletes lists they own with full cascade.
- **Gate, binding on every story:** Playwright E2E against the production artifact on a desktop and a phone viewport,
  UI-driven with per-spec fresh registration (no login fixture, no storageState, no faked sessions); every new test
  observed failing first; 320px asserted mechanically, never by eye; accessible labels, keyboard operation and
  field-associated errors on new dialogs; membership verified before any list-scoped read or write.

## Technical Decisions

- Keep the per-entity slice layout and one-way GQL → Service → Storage → Repository flow; reuse existing forbidden /
  invalid-input / not-found error types. Schema changes regenerate codegen in the same story; backend and frontend ship
  as one app version, with backend rules proven by Kotest + Testcontainers.
- Feedback is a new entity slice with no cache, no shared flow, no subscription — the user/config pattern. It stores a
  plain username copy, not a user reference, which is why user deletion never touches it.
- The duplicated admin-check helpers collapse into one shared GraphQL auth helper used by user-admin, config and feedback
  APIs.
- The single-store field becomes a list in every layer in one indivisible story: model, Mongo document, GraphQL types,
  both mappers, repository write (set new field and unset old in one update), all frontend documents via the shared item
  fragment, and the raw GraphQL used by E2E.
- The server is the normalization authority for store names — trim, drop empties, dedupe case-insensitively keeping
  first-occurrence casing and order, on create and update. The client mirrors this only for immediate feedback; the
  server result wins. Suggestions return one name per case-insensitive key.
- A one-time idempotent startup migration converts existing single-store items. The migration runner must check each
  migration's own completion record instead of returning early on the first. A database dump precedes that release;
  rollback is restore plus previous image.
- Check-state handling unifies into one helper shared by check, uncheck and the item-save update branch, so checking via
  an edit behaves identically to checking on the row while other server-owned fields survive the merge.
- User listing becomes a server-paginated page type carrying rows, total and offset, with the server clamping bounds and
  supporting "the page containing this username" after a create. Admin collections use cache-and-network with cache
  eviction after every successful mutation; the unpaginated field is removed.
- Category delete cascades server-side and emits only the category-deleted event (the item event channel is one-slot and
  would drop per-item events), so clients treat that event as authoritative for the category's children and prune
  locally; the client-side per-item delete loop goes away. Item save rejects a category outside the target list on both
  create and update branches.
- Only the list service writes membership data. User deletion runs user delete, then an idempotent list purge, then
  session invalidation, in that order; the confirmation states how many owned lists will be deleted, which needs an
  owned-list count on the user type.
- Readiness is a health route registered outside authentication and rate limiting, pinging Mongo under a short timeout,
  returning 200 or 503; the E2E runner waits on it instead of a plain port.
- The floating button reuses the existing add-item dialog (no second dialog); the store field becomes one multi-value
  component used by both dialogs; account-menu entries are added once in the shell, with the feedback dialog hosted by
  the shell rather than a route so the current screen stays mounted.
- Per-run E2E data hygiene is owed independently of pagination (the users collection grows every run and has already
  pushed a helper past its budget); a retry loop is not an acceptable answer.

## UX & Interaction Patterns

- **No toast or snackbar anywhere.** Success is an in-flow success alert with a status role in the surface that caused
  it (the admin reset-password confirmation is the precedent). A failed send keeps the dialog open with text intact and
  shows an inline error last in the dialog content; a deleted feedback row is confirmed by disappearing.
- The feedback dialog follows the canonical form-dialog convention already used for list creation: native form with
  submit-on-Enter semantics (decide and test the multi-line variant), validate on submit with errors clearing on typing,
  same-tick re-entry guard, inline error mapping, cancel disabled in flight, spinner on submit, extra-small width, a
  visible associated label and a counter on trimmed length.
- Account menu order: Home, Lists, Change password / Admin, Feedback (non-admin only), Logout, each with a small icon.
  On the resolved home route the Home entry only closes the menu and adds no history entry.
- The admin feedback panel matches the existing panel shape and the standard error → loading → empty → content branch
  order, keyed by entry id, wrapping text without truncation at 320px, with a destructive icon button opening the shared
  confirm dialog. Pagination controls carry accessible labels, a page indicator and the total, with no overflow at 320px.
- The store field shows selected stores as removable chips with suggestions and free entry. It is deliberately not an
  autocomplete today (avoiding a second combobox in the dialog) — keep that constraint or record why it changed.
- Store chips on the shopping row are presentational only. The row's accessible name is unchanged; stores go in the
  row's accessible description beside the adder's name, omitted when there are none.
- The floating button sits bottom-right with safe-area inset, reachable while scrolling, with bottom padding reserved.
  Adding becomes a shopping-view action while editing and deleting stay management-only; the shopping empty-state copy
  is revised to point at it when categories exist but items do not.
- The category filter confirm control is sticky at the menu bottom so it is reachable without scrolling at 320px, and is
  defined once so both list surfaces get it.
- Visual language is unchanged — no new palette key, no new theme override. The design and experience contract documents
  describe the shipped app, so any story changing the shell, a route component, list library code, the theme or the E2E
  config corrects them in the same commit.

## Cross-Story Dependencies

- Readiness (9.1) lands first: every later story is verified against a gate that can otherwise abort on a cold start.
- Pagination with per-run data hygiene (9.2) lands early — the user-creation helper's flake grows with every run.
- The category cascade (9.3) lands before or with the shopping-screen add button (9.11): the save-path category check is
  what stops that button creating items in a just-deleted category.
- Multi-store (9.6) is indivisible — schema, mappers, repository, migration, codegen and E2E GraphQL in one app version
  — and its store-field work in the add-item dialog is shared with 9.11.
- Home (9.7), feedback send (9.9) and the add button (9.11) all touch the app shell and the add-item dialog; 9.9 and 9.10
  share the feedback slice and the shared admin-check helper.
- Small cleanups (9.12) run last, after every shell story, so only still-unconsumed theme tokens are removed.
- Each routed deferred-work entry a story discharges is closed in place by that story, and sprint status is reconciled at
  story close.
