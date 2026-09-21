# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 9 turns real user feedback into shipped behaviour. Users can send feedback to the admin from inside the app, and the admin can read and clear it. Items carry every store they are sold in, with no existing store lost. An item can be added from the shopping screen, Home is in the account menu, the category filter menu can be closed on a phone, and the admin's user list is paginated. Underneath, deleting a category or a user stops leaving orphaned data, an item checked through an edit still feeds the recurring scheduler, and the E2E gate waits for a backend that actually answers.

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

- **Feedback:** a signed-in non-admin sends free text (trimmed, non-blank, max 2000 UTF-16 units) from any authenticated screen without navigating away. Author and timestamp are server-set. The admin cannot send; reads all entries newest first with username and time; deletes individually after confirmation. Text renders literally, never as markup. Feedback outlives its author.
- **Multi-store items:** an item holds a list of stores. Names are trimmed, blanks dropped, duplicates refused case-insensitively (first casing and position win). Stores show on the shopping row and are editable in both item dialogs, with suggestions from stores already in use. Legacy single-store data converts losslessly and idempotently on startup.
- **Admin pagination:** server-paginated, 20 per page, total count, sorted by username. After a create, land on the page holding the new user; after a delete, clamp to the last valid page. No client fetches an unpaginated user list.
- **Data integrity:** deleting a category deletes all its items server-side, soft-deleted included. Deleting a user removes their memberships in any status, deletes the lists they own with contents, and invalidates sessions. Both idempotent and authorization-gated.
- **Readiness:** credential-free `GET /api/health` returns 200 when Mongo answers, 503 within 2 seconds when it does not; the E2E runner waits on it.
- **Bar for every story:** backend rules proven with Kotest + Testcontainers; E2E UI-driven against the production artifact on desktop and the 320px floor, with no horizontal overflow or clipped controls; each new test observed failing first; schema changes regenerate codegen in the same story; visible labels and keyboard operation on new controls; `DESIGN.md`/`EXPERIENCE.md` corrected in the same commit as the screen they describe; discharged deferred-work entries closed in place; `sprint-status.yaml` reconciled at story close.

## Technical Decisions

- Layered per-entity slices, one-way GQL → Service → Storage (optional cache) → Mongo repository. Epic adds one slice (`feedback`, repository-only: no cache, no flow, no subscription; string-UUID id, text, copied username, server instant), changes `Item.store` to `stores`, and adds one plain HTTP route. No new dependencies or version upgrades.
- Feedback API: `sendFeedback(text)`, `feedback` (createdAt desc, unpaginated), `deleteFeedback(id)` returning the id; missing id is not found.
- The two private `requireAdmin()` copies collapse into one `DataFetchingEnvironment` extension in the GraphQL auth plugin (JWT role claim), used by user-admin, config and feedback APIs.
- Store normalization is server-authoritative; identity is the lowercased key, stored casing is display data; suggestions return one name per key. The frontend mirrors dedupe but compares "changed" by exact string, so a casing-only edit still saves. The multi-store change (domain, document, mappers, GraphQL type/input, repository save that sets `stores` and unsets `store` together, migration, codegen, raw GraphQL in the item-edit E2E spec) ships as one story with backend and frontend versions bumped in lockstep.
- Startup migrations run in declared order, each checking only its own record. The store migration keys on the legacy field's presence, works document by document, writes its completion record last, and runs before any cache is populated. Deploy after a DB dump.
- `users(limit, offset, around)` returns `UserPage { users, totalCount, offset }`; the server clamps limit (1..100) and offset; `around: <username>` returns the page containing that user. Admin collections use `cache-and-network`, evicting and garbage-collecting the field after every successful mutation. The unpaginated `users` field is removed.
- Cascades are ordered, non-transactional Mongo deletes then cache eviction. A category cascade emits only the parent DELETED event (clients prune children locally, and the client per-item delete loop is removed); list deletion emits nothing. Only the list service writes membership data. The user purge is an idempotent, caller-less entry point that runs after `adminDeleteUser` (so the user record is gone first), sharing a private list-cascade helper with owner delete.
- Orphan prevention: item save rejects a category outside the target list on create and update; uncheck rejects an item whose category is gone; both dialogs surface it via the same mapped error path. Existing orphans render in an `Uncategorized` group (frontend-only sentinel id) with edit and remove controls.
- One private `applyCheckState(stored, checked, recurring, now)` serves check, uncheck and the save update branch; one-time checked items soft-delete with a timestamp, recurring ones keep or get a check-off time, unchecking clears the fields; all other server-owned fields survive a save.
- Health route: `get("/health")` outside `authenticate` and rate limiting, served at `/api/health` through `rootPath`; pings Mongo in a 2s timeout. The service worker must not cache or fall back on `/api`. No probe tool is added to the backend image.
- Frontend: every item-returning operation spreads the shared item fragment; generated types are never hand-edited; one Apollo client, access token in memory. Reuse existing forbidden/invalid-input/not-found exceptions; no new error envelope.

## UX & Interaction Patterns

- No toast or snackbar. Success is an in-flow `role="status"` alert in the causing surface (the account shell hosts feedback confirmation); a delete is confirmed by the row disappearing; a failed submit keeps the dialog open with text intact and an inline mapped error.
- Form dialogs follow the canonical shape: native form with submit-on-Enter (a multi-line field needs an explicit submit-key decision and test), validate on submit with errors clearing on typing, same-tick re-entry guard, cancel disabled in flight, spinner on submit, extra-small width, visible label, character counter against the trimmed limit, per-dialog test id namespace.
- Account menu order: Home first (on the home route it only closes the menu, no history entry), then existing entries, Feedback (non-admin only) before Logout. The app-bar title link is untouched.
- Admin screen: feedback panel in the existing panel shape (error → loading → empty → content, rows keyed by id, text wraps at 320px, destructive icon button opening the shared confirm dialog). Pager has labelled prev/next, page indicator and total. The delete-user dialog states the owned-list cascade count.
- Store field is multi-value chips with suggestions and free entry, keyboard-operable at 320px; deliberately not an autocomplete unless a story records why that no longer holds.
- Shopping row: stores as non-interactive chips inside the row surface; the whole row still toggles; accessible name stays the toggle phrasing, and stores go in the accessible description (omitted when empty). Long names must not push the check glyph or name off a 320px screen.
- Shopping add: a bottom-right FAB labelled "Add item" with safe-area inset and reserved page padding. Adding is a shopping-view action; edit and delete stay management-only. Empty-state copy points at the FAB when categories exist but no items. With no categories, the dialog shows guidance and a link to list management.
- Category filter menu gets a sticky confirm control defined once for both list screens; selections still apply live, outside-tap and Escape close without reverting, focus returns to the category control. Visual language unchanged (dark-only, no new palette keys or theme overrides, labels on icon-only controls).

## Cross-Story Dependencies

- 9.1 lands first; every later story is verified against its gate.
- 9.2 lands early because the user-creation E2E helper flake grows with each run.
- 9.3 lands before or with 9.11: its create-branch category check stops the FAB creating items in a just-deleted category.
- 9.6 is indivisible and depends on 9.5's shared check-state transition.
- 9.7, 9.9 and 9.11 share the account menu and add-item dialog; 9.2 and 9.10 share the admin screen and admin gate; 9.3 and 9.4 share cascade paths.
- 9.12 runs last, after every app-shell story, so only still-unconsumed tokens are deleted.
