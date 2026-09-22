# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic lets users tell the admin what they want from inside the app, and gives the admin a place to read and
triage it. It also clears a backlog of feedback-driven fixes gathered from real use of the deployed app: items can
carry every store they are sold in (not just one), an item can be added straight from the shopping screen, the
category filter menu can be closed on a phone, Home is reachable from the account menu, and the admin's user list is
paginated instead of growing forever. Underneath, deleting a category or a user no longer leaves orphaned data
behind, and the E2E gate waits for a backend that is actually ready, instead of aborting cold starts with zero tests
run.

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

- A regular user sends free-text feedback (required, max 2000 trimmed characters) from any authenticated screen via
  an account-menu entry; submission stores the trimmed text with the submitter's username and server time, confirms
  in-flow, and returns the user to the same screen with its state intact. A user never sees, edits, or deletes their
  own feedback afterward; the admin never sees the Feedback entry or can send feedback.
- The admin reviews all feedback newest-first (text, username, time; text never interpreted as markup) and deletes
  entries after confirmation; deletion is permanent; deleting a user does not delete their feedback. The admin's
  scope stays restricted to user management, app config, and feedback review — no list access at all.
- An item carries zero, one, or several stores (case-insensitive dedupe, trimmed, casing of first occurrence kept);
  no existing single-store value is lost when the schema changes. The shopping row shows all stores as
  non-interactive chips without changing its single toggle-everywhere activation target or accessible name.
- The admin's user list is server-paginated (20/page, username ascending) with total count and page controls; a
  freshly created or deleted user keeps the admin on a correct, non-stale page.
- The shared category filter menu gets an explicit, always-visible confirm control so it can be closed on a small
  screen; selections apply live as toggled, and outside-tap/Escape still close it too.
- A Home entry in the account menu reaches the same destination as the app-bar title link, and only closes the menu
  when already home.
- An "Add item" floating button on the shopping view opens the existing add-item dialog against the current list;
  it and the last item row stay usable at all scroll positions and at the 320px floor.
- Deleting a category deletes every item in it (including soft-deleted ones) on the server and every subscribed
  client, via one event, not a per-item loop. Deleting a user removes every membership row, deletes lists they
  owned (with items/categories), and invalidates their sessions, in an order that can't be raced by the user acting
  mid-delete.
- An `/api/health` endpoint (Mongo ping, 2s timeout) backs the E2E suite's readiness wait.
- Every story: Kotest + Testcontainers backend proof, E2E against the production artifact on desktop and the 320px
  floor, UI-driven (no login fixture/storageState), schema changes regenerate codegen in the same story, no
  toast/snackbar anywhere, `DESIGN.md`/`EXPERIENCE.md` kept in sync with any screen they describe.

## Technical Decisions

- Feedback is a new vertical slice (`entity/feedback/`: service, Mongo-backed repository, GQL api) — no cache, no
  subscription, following the user/config pattern. Server generates the id, author and time; client sends only text.
- The two private admin-check copies collapse into one shared `requireAdmin()` helper used by every admin-gated API,
  including feedback.
- `stores: [String!]!` replaces `store` in every layer (schema, Mongo model/mapper, GQL types, repository save,
  frontend fragment, codegen, E2E GraphQL) in one story, shipped as one app version. Normalization (trim, dedupe by
  lowercase key, keep first-seen casing) is server-authoritative; the frontend mirrors the same key logic but
  treats "changed" by exact string equality.
- Two independent, self-recording startup migrations run in order; the store migration merges legacy `store` into
  `stores` per item and is idempotent on rerun.
- User pagination is `users(limit, offset, around): UserPage!`, sorted by username, `limit`/`offset` clamped
  server-side, `around` locates the page containing a named user; the unpaginated field is removed; the admin
  client uses `cache-and-network` and evicts+GCs `users` after every create/delete.
- Category delete cascades server-side (category service → item service), emitting one `DELETED` event only;
  clients prune matching cached items instead of receiving per-item events. `saveItem`/`uncheckItem` reject a
  category that doesn't belong to the target list.
- User deletion runs in a fixed order — block further list actions, then purge memberships and cascade-delete
  owned lists through the same private cascade the owner-initiated delete uses, then invalidate sessions — and the
  purge step is idempotent and the sole caller-less list-mutating entry point.
- One private check-state transition function is shared by check/uncheck/save-update: checked one-timer
  soft-deletes, checked recurring stamps `checkedAt` only if unset, checked with no cadence stamps nothing,
  unchecked clears all three fields; every other server-owned field survives any save.
- The health route sits outside auth/rate-limit, answers Mongo `ping` under a 2s timeout with 200/503, and the E2E
  config's `webServer.url` points at it; the service worker's `/api` denylist stays untouched.
- One add-item dialog only: the shopping-screen FAB reuses the existing dialog with the current list fixed as
  target; the store field becomes one multi-value component shared by both item dialogs; the account menu's new
  entries and the feedback dialog are all hosted once in the shell component.

## UX & Interaction Patterns

- No toast/snackbar exists or is added. Success is an in-flow `role="status"` alert; a delete is confirmed by the
  row disappearing; a failed submit keeps the dialog open with the entered text and an inline error.
- New dialogs follow the existing canonical form-dialog convention (submit-on-Enter form, validate-on-submit,
  same-tick re-entry guard, spinner on submit, `fullWidth maxWidth="xs"`, visible label, character counter).
- Account menu order becomes: Home, Lists, Change password (non-admin) / Admin (admin), Feedback (non-admin only),
  Logout — each new entry a small-icon `MenuItem`, keyboard-reachable.
- Shopping row: accessible name stays exactly `Toggle <name>`; stores go in the accessible description alongside
  the existing author info, omitted when there are none; chips stay presentational, never separate activation
  targets, and must not push content off-row at 320px.
- The add button follows standard FAB conventions (named, fixed, safe-area aware, never permanently covering the
  last row); a no-categories state shows guidance and a link to list management instead of a disabled form.
- The category filter menu's confirm control is pinned reachable at 320px without scrolling, defined once so both
  list surfaces share it.
- `/admin` gains a feedback panel matching the existing panel's state shape (error/loading/empty/content) and
  pagination controls usable at 320px with no overflow.
- Any story touching a route, the shell, the E2E config, shared list code, or the theme must correct
  `DESIGN.md`/`EXPERIENCE.md` in the same commit; the dark-only visual language is otherwise unchanged.

## Cross-Story Dependencies

- The health endpoint (9.1) should land first — every later story's E2E run depends on the readiness gate.
- User pagination (9.2) should land early: an existing user-creation E2E flake grows with every suite run against
  the persistent database.
- The category cascade (9.3) should land before or with the shopping-screen add button (9.11): its create-branch
  category check is what stops the add button creating items in a just-deleted category.
- The multi-store change (9.6) is one indivisible story — schema, mappers, repository, migration, codegen, and E2E
  GraphQL all ship together; it must not be split.
- Small cleanups (9.12) should run last, after every shell-touching story, since it removes only theme tokens still
  unused by then.
- Stories 9.7 (Home) and 9.9 (feedback) both add entries to the same account menu and must keep one shared order.
- Stories 9.5 and 9.6 both touch the item save/update path; the check-state extraction in 9.5 is what 9.6 builds on.
