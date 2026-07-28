# Epic 6 Context: Item Editing & Home Navigation

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 6 closes two gaps the Epic 5 frontend reframe left behind, both purely frontend. First, a list member can change an
item that already exists — fix its name, move it to the right category, set, change or clear its store — instead of the
delete-and-retype workaround that is the only option today; the same store field with suggestions also becomes available
while *adding* an item, so a store no longer requires a second trip through an editor. Second, no screen is a
navigational dead end: the app-bar title becomes a link to home on every guarded screen, and the shopping view gains the
back-to-lists affordance its sibling management screen already has. After this epic the item lifecycle is complete in the
UI (create → edit → check → delete) and the app is navigable without the browser back button.

## Stories

- Story 6.1: Edit an Item — Name, Category & Store with Suggestions
- Story 6.2: Back to Home & Back to Lists Navigation

## Requirements & Constraints

- **Backend frozen.** Both stories are frontend-only: no Kotlin file and no GraphQL schema change. This was challenged
  in review and re-affirmed. Any backend need discovered mid-story stops the story and is escalated, rather than being
  worked around. `git diff` must show no change under `bp_back/`.
- **Item editing is a member right, not an owner right.** Every accepted member can edit any item on the list, including
  items a co-member added; there is no owner/member distinction for item operations.
- **Store is optional and free-form.** It may be set, changed or cleared; the editor offers suggestions derived from the
  list's own existing item data while still accepting an arbitrary typed value. Empty or whitespace-only input means "no
  store" (null), never an empty string.
- **Edits must survive round-trip.** Editing a field the form exposes must not silently reset fields it does not expose
  (notably an item's checked state and recurring cadence). This is the epic's highest-risk defect class and requires an
  explicit regression test, not just careful coding.
- **Home resolution is a single existing behavior.** Home means: the user's oldest list by creation date, the lists index
  if they have none, and the admin area for the admin account. The navigation affordance must delegate to the existing
  home resolution rather than re-deriving it.
- **Admin stays out of lists.** The admin account is rejected by all list operations and must gain no list-related
  affordance; use a freshly registered regular user for every list flow and test.
- **One-timer and recurring item UI remain deferred.** The item editor ships without a lifecycle control. Undeferring
  them is blocked until the server-side fix for the reset-on-edit defect lands.
- **Two known defects ship with the epic by decision** — an edit re-attributes the "added by" user, and an edit clears
  the check-off timestamp. Both are unfixable from the frontend and both have a diagnosed server-side fix. They must be
  filed in the cross-workflow deferred-work ledger with cause, user-visible impact and proposed fix, with the timestamp
  bug marked a prerequisite for the deferred lifecycle features. Filing them is an acceptance criterion, not a note —
  a prior requirement recorded only in story prose was orphaned across a workflow handoff.
- **Every story ships FR-tagged Playwright E2E passing on both the desktop and mobile (Pixel 7) projects** against the
  production image on `:2080`. Each flow is manually exercised in a real browser before its test is written. Each spec
  registers its own fresh user through the UI and asserts only on data it created.
- **Mobile viability at ~360px is a requirement, not a nicety** for both the item row's controls and the app bar.
- `npm run lint` and `npm run build` must pass for every story.

## Technical Decisions

- **Separation of intent.** `/lists/:id` is for *managing* a list; `/list/:id` is for *using* one. Item editing belongs
  to the manage surface only; the shopping loop stays check-off-only and gains no edit, delete, or swipe-to-delete
  affordance (swipe-to-delete is an explicit anti-pattern — accidental deletion while scrolling in-aisle).
- **The item save mutation is a full-document upsert keyed by id, not a partial patch.** Any field absent from the input
  reverts to its default. An edit is therefore the same operation as a create with the same id, and the edit form must
  carry forward the item's current values for every field it does not render.
- **The "added by" attribution is server-set from the caller's principal and is not part of the item input**, which is
  why an edit by a co-member re-attributes the item and why that defect cannot be fixed client-side.
- **Saving an unchanged item sends no mutation at all** — silently, indistinguishably from a successful save — because
  the request would only re-attribute a co-member's item for no benefit.
- **No new GraphQL schema surface, but one new operation document.** The store suggestions are read via a newly authored
  query document written against the existing schema; generated types are refreshed with the codegen script (stack on
  `:2080` plus a fresh admin token) and `src/__generated__/` is never hand-edited. All GraphQL types consumed by new
  components are imported from the generated module.
- **Real-time propagation reuses the existing per-list subscription and its existing cache merge.** No subscription,
  cache-merge or Apollo client change is introduced.
- **Navigation stays declarative**: router-link composition on MUI components, no new imperative navigation calls, and
  the route guard remains the sole owner of every auth-driven redirect. Affordances live inside the authenticated shell,
  so nothing renders for unauthenticated visitors.
- **Epic 5's form, feedback and styling conventions apply verbatim** — each was paid for by a real bug: validate on
  submit only (never on keystroke or blur), clear the error as soon as the field changes, an in-flight re-entry guard at
  the top of the submit handler, a real `catch` on every async branch, errors inline via an alert with a live role or via
  field helper text (never toasts), no success toast (the UI change is the confirmation), reserved helper-text lines so
  inline errors do not shift layout, and on success close the dialog before kicking off a non-awaited refresh so a failed
  refresh is never reported as a failed save.
- **MUI v9 APIs are looked up via the MUI docs MCP tool before writing components**, never recalled from v5/v6 memory.
  Styling is theme plus the `sx` prop only. Input test ids are passed through the input slot props.

## UX & Interaction Patterns

- The edit dialog opens seeded from the row it was opened on (name, category, store), with focus in the name field.
  Seeding is a render-phase adjustment on the closed→open transition (previous-open comparison), never a syncing effect —
  the lint rules forbid the effect form.
- Item-level controls carry item-specific accessible names in the established idiom (`Edit item {name}` alongside the
  existing `Remove item {name}`), never a bare verb.
- Store suggestions render as clickable values below a freely typable field, and the suggestion row is absent entirely
  when the list has no stores — no empty container, no placeholder text.
- The store input plus its suggestions is one shared component imported by both the add and edit dialogs, so a later
  validation change cannot land in one and miss the other.
- The app-bar title link keeps its current type scale, weight and colour: no underline at rest, visible hover and
  focus-visible states, a genuine link (tab-reachable, Enter-activated, exposed as a link), and not a button — no ripple,
  no uppercase transform, no padding shift. The username chip must not be displaced or truncated, and the bar must not
  wrap or scroll horizontally at ~360px.
- The shopping view's back-to-lists link copies the management screen's existing back-link structure and styling
  idiom-for-idiom (link plus small back arrow, its own test id), placed above the list title without disturbing the
  switcher chip row or filter bar spacing.

## Cross-Story Dependencies

- **The two stories share no file and neither blocks the other**; either can be implemented first. They are coupled only
  in experience — 6.2's navigation is the natural return path out of 6.1's edit flow.
- **Do not create a hidden forward dependency in the tests.** Story 6.1's specs that assert on the shopping view (the
  store chip and a co-member's live update) must reach `/list/:id` by URL using navigation that already shipped, never
  through Story 6.2's new title or back links — otherwise 6.1 cannot be completed on its own.
- Both stories build on surfaces delivered in Epic 5 (list management view, shopping view, add-item dialog, app shell,
  per-list subscription, home redirect) and on the unchanged backend item/list API.
- The deferred one-timer and recurring item work depends on the server-side fix for the check-off timestamp defect filed
  by Story 6.1.
