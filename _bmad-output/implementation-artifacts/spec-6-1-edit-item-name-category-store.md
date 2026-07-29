---
title: 'Story 6.1 — Edit an Item: Name, Category & Store with Suggestions'
type: 'feature'
created: '2026-07-28'
status: 'done'
baseline_revision: 'f643b82'
final_revision: '62dec3b'
review_loop_iteration: 0
followup_review_recommended: false  # discharged 2026-07-29 at the Epic 6 retro (action item B7) — the recommended follow-up review was performed; no further findings
followup_review_completed: '2026-07-29'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: [multiple-goals, oversized]
---

<intent-contract>

## Intent

**Problem:** An item that already exists cannot be changed — fixing a typo, moving it to the right category, or setting a
store all require deleting and retyping it. `AddItemDialog` hardcodes `store` out of the payload entirely, so the store
field the backend and the shopping-view chip already support (`shopping-item-store-<name>`, Story 5.6) is unreachable
from the UI.

**Approach:** Add an `EditItemDialog` to the list *management* screen `/lists/:id` (name, category, store), and a shared
store field with suggestions used by both the add and edit dialogs. Frontend only: `ItemInput.store` and the
`itemStoreSuggestions(listId: ID!): [String!]!` query already exist in the frozen schema — only new operation documents,
regenerated types, and UI are needed. Ship FR40/FR44-tagged Playwright coverage on both viewport projects.

## Boundaries & Constraints

**Always:**

- Frontend only. `git diff` shows **no change under `bp_back/`** and no GraphQL *schema* change. `src/__generated__/` is
  regenerated via `npm run generate`, never hand-edited.
- **`saveItem` is a full-document upsert, not a patch** (`GqlItemMapper.mapItemFromInput` builds a fresh `Item` from the
  input alone; `ItemRepository.save` `Updates.set`s every field). The edit payload MUST carry forward every field it does
  not render — `checked`, `store`, `recurring` — or they are silently wiped. This is the epic's highest-risk defect class
  and needs explicit regression tests, not careful coding.
- `recurring` is currently selected by **no** frontend document, so it cannot be carried forward until `ItemsQuery`
  selects it. Widening that selection set is part of this story.
- Editing is a **member** right, not an owner right (`ItemService.saveItem` → `verifyMembership`); add no client-side
  owner check. `admin` stays blocked from every list surface.
- Store is optional and free-form: trimmed on save, empty/whitespace → `null` (never `''`). One shared
  `normalizeStore` used by both dialogs.
- Epic 5 form conventions verbatim: `if (loading) return` re-entry guard first, validate on **submit only**, a real
  `catch` on every async branch setting an inline error and returning (dialog stays open), errors via
  `<Alert role="alert">` / `helperText={err ?? ' '}`, no toasts, no success toast, and on success `onClose()` **then**
  `void onSaved()` unawaited.
- Dialog seeding is a **render-phase adjustment on the closed→open transition** (`prevOpen` compare, per
  `ResetPasswordDialog.tsx:42-53`) — never a syncing effect; `react-hooks/set-state-in-effect` forbids it.
- MUI v9 APIs looked up via `mcp__mui-mcp__fetchDocs` before writing. Theme + `sx` only. Input test ids via
  `slotProps={{htmlInput: {'data-testid': …}}}`.
- Every flow manually exercised in a real browser (desktop **and** ~360px) against `:2080` before its test is written.
- E2E green on **both** `chromium` and `mobile`; each spec registers its own fresh user through the UI and asserts only on
  data it created. `npm run lint` and `npm run build` pass.

**Block If:**

- Any change under `bp_back/` or to the GraphQL schema turns out to be required (AR-E6-0 backend freeze) — stop and
  escalate rather than working around it.
- `itemStoreSuggestions` or `ItemInput.store` is absent from the running schema after `npm run generate`.
- Codegen cannot be run (stack won't come up on `:2080`, or no admin token can be minted).
- Delivering the edit affordance appears to require touching `/list/:id` item rows.

**Never:**

- No edit, delete, or swipe affordance on the shopping view `/list/:id` — it stays check-off-only.
  `navigation.spec.ts:322-325` asserts `row.getByRole('button')` count `0` there and must keep passing.
- No lifecycle control (one-timer / recurring) in the item editor — deferred, blocked on the server-side `checkedAt` fix.
- **No `Autocomplete`/combobox for the store field.** A second `role=combobox` inside `add-item-dialog` breaks the
  strict-mode selectors at `lists.spec.ts:109`, `lists.spec.ts:162` and `shopping.spec.ts:79`
  (`getByTestId('add-item-dialog').getByRole('combobox')`). Suggestions are clickable chips.
- No store display added to the `/lists/:id` item row (outside epic scope — the store is verified via the existing
  shopping-view chip). No `subscribeToMore` added to `ListDetailPage` (it is refetch-driven by design).
- No second Apollo client, no cache `typePolicies`, no subscription or merge change.
- No `useEffect` state sync, no keystroke/blur validation, no Snackbar.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rename + recategorize | item `Milk` in `Dairy`, edit → `Whole milk` / `Fridge` | one `saveItem` with the same `id`, new `name`/`category`, unchanged `checked`/`store`/`recurring`; row moves category | No error expected |
| Set store | store field empty → `"Aldi"` | `store: "Aldi"`; `shopping-item-store-<name>` chip renders `Aldi` | No error expected |
| Clear store | store `"Aldi"` → `""` or `"   "` | `store: null` (never `''`); chip absent | No error expected |
| Store trimmed | `"  Aldi  "` | `store: "Aldi"` | No error expected |
| Checked item edited | `checked: true`, rename only | `checked: true` resent; item still checked on the shopping view after the edit | No error expected |
| Recurring item edited | `recurring: "WEEKLY"` (API-seeded), rename only | `recurring: "WEEKLY"` resent unchanged | No error expected |
| No-op save | nothing changed (after normalization) | **no mutation issued**; dialog closes exactly as on success | No error expected |
| Empty name | name cleared | inline `Name is required` on the field; no mutation | Field `helperText` |
| Mutation rejected | non-member / revoked membership → `FORBIDDEN` | dialog stays open, `edit-item-error` alert shows `graphqlErrorMessage(err)` verbatim | `catch` → inline alert |
| Refetch fails after save | `saveItem` succeeded, `onSaved()` refetch throws | dialog already closed; failure swallowed, never shown as a failed save | `void onSaved().catch(() => {})` |
| List has no stores | fresh list, dialog opened | suggestion row absent entirely — no container, no placeholder | No error expected |
| Suggestion clicked | chip `Aldi` clicked | store field becomes `Aldi`, still freely editable | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/lib/lists/listsQueries.ts` — **edit.** `ItemsQuery` (153-165) selects `id name checked category listId
  store addedBy` → add `recurring`. `SaveItemMutation` (185-195) returns `id name checked category listId` → add `store
  addedBy recurring` so the normalized cache is not left stale. Add a new `ItemStoreSuggestionsQuery`. `ListItem` type is
  exported at line 28 and re-exported to components (dialogs import from here, never from `@/__generated__` directly).
- `bp_front/src/components/StoreField.tsx` — **new.** Shared controlled store input + suggestion chips. Owns the
  `ItemStoreSuggestionsQuery`.
- `bp_front/src/lib/lists/storeValue.ts` — **new.** `normalizeStore` + `STORE_MAX`. Separate from `StoreField.tsx`
  because `react-refresh/only-export-components` forbids a component file exporting a plain function (deviation 1).
- `bp_front/src/components/EditItemDialog.tsx` — **new.** Modeled on `AddItemDialog.tsx` (form/submit shape) +
  `ResetPasswordDialog.tsx:42-53` (nullable-record prop, `shown` retained through the close transition).
- `bp_front/src/components/AddItemDialog.tsx` — **edit.** State block 46-51, open-transition seeding 53-65, submit handler
  93-118 (currently hardcodes `recurring: null` and omits `store`), category `Select` 141-164, testid wiring at 139.
- `bp_front/src/routes/ListDetailPage.tsx` — **edit.** State 62-69; `refetch` at 60; item row 187-213 whose
  `secondaryAction` holds a single `Tooltip` (needs a wrapper for two buttons); name `Typography` has
  `maxWidth: {xs: 200, sm: 420}`; `AddItemDialog` rendered 232-241; overlays 223-288.
- `bp_front/src/routes/ListShoppingPage.tsx` — **read-only.** The store chip already exists (429-438,
  `shopping-item-store-<name>`) and `subscribeToMore` (85-134) already upserts `SAVED` events by id — an edit propagates
  live with no change here. Do not modify.
- `bp_back/.../entity/item/gql/ItemApi.kt:36` + `ItemService.kt:74-77` — **reference only.**
  `itemStoreSuggestions(listId: ID!): [String!]!`, membership-gated, `mapNotNull { it.store }.distinct()`, **unsorted**
  and not deduped against `''`.
- `bp_front/e2e/item-editing.spec.ts` — **new.** No shared E2E helpers exist; copy the helper block from
  `shopping.spec.ts:14-64` + `:88-109` (`uniqueUsername`, `registerViaUi` **including** its `expect(...).toPass()`
  wrapper, `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`, `loginApi`, `gql`) with a
  `item_editing_e2e_` prefix.
- `_bmad-output/implementation-artifacts/deferred-work.md` — **edit.** Append a section; heading idiom
  `## Deferred from: planning of 6-1-edit-item-name-category-store (2026-07-28)`.

## Tasks & Acceptance

**Execution:**

- [x] `bp_front/src/lib/lists/listsQueries.ts` — add `recurring` to `ItemsQuery`; add `store addedBy recurring` to
  `SaveItemMutation`'s selection; add `ItemStoreSuggestionsQuery` = `query ItemStoreSuggestions($listId: ID!) {
  itemStoreSuggestions(listId: $listId) }` (scalar list, no sub-selection) — the edit form can only carry forward what it
  fetched, and a widened mutation result keeps the cache from holding a stale `store`.
- [x] `bp_front/` — run `npm run generate` (stack on `:2080` + fresh `CODEGEN_TOKEN`) **before** writing the components
  that import the new document — the generated result types are what the components consume.
- [x] `bp_front/src/components/StoreField.tsx` — new shared component: props `{listId, value, onChange, testIdPrefix,
  disabled}`; a `TextField label="Store"` (`slotProps={{htmlInput: {'data-testid': \`${testIdPrefix}-store\`, maxLength:
  100}}}`, `helperText=' '`, `autoComplete="off"`); `useQuery(ItemStoreSuggestionsQuery, {variables: {listId},
  fetchPolicy: 'cache-and-network'})`; client-side trim, drop empties, dedupe, sort alphabetically; render chips only when
  the result is non-empty. Export `normalizeStore(raw: string): string | null` — one component and one normalizer imported
  by both dialogs so a later validation change cannot land in one and miss the other.
- [x] `bp_front/src/components/EditItemDialog.tsx` — new dialog: props `{item: ListItem | null, listId, categories,
  onClose, onSaved}`, `open = Boolean(item)`, `shown` + `prevOpen` render-phase seeding from `item` (`name`,
  `category`, `store ?? ''`, errors cleared), name/category validation identical to `AddItemDialog`, and a submit that
  short-circuits to the success path when nothing changed, otherwise sends the **full** input `{id: shown.id, listId,
  name: name.trim(), category: categoryId, checked: shown.checked, recurring: shown.recurring ?? null, store:
  normalizeStore(store)}` — a partial payload would wipe check-off state and cadence.
- [x] `bp_front/src/components/AddItemDialog.tsx` — add a `store` state seeded to `''` on the open transition, render
  `<StoreField testIdPrefix="add-item">` inside the `<Dialog>` (leave `keepMounted` off so the suggestions query fires per
  open), and send `store: normalizeStore(store)` — a store no longer needs a second trip through an editor.
- [x] `bp_front/src/routes/ListDetailPage.tsx` — add `editItemTarget` state; inside the item row's `secondaryAction` wrap
  the existing remove `Tooltip` and a new edit `IconButton` (`aria-label={\`Edit item ${item.name}\`}`,
  `data-testid="edit-item-button"`, `EditOutlinedIcon fontSize="small"`) in a `Stack direction="row"`; narrow the name
  `Typography` `maxWidth` xs value so two controls fit at ~360px; render `<EditItemDialog>` alongside the other overlays
  with `onSaved={() => { void refetch().catch(() => {}) }}` — item-specific accessible names in the established idiom,
  and the page stays refetch-driven.
- [x] `bp_front/dist/` via `docker compose up -d --build` — rebuild the production image and manually exercise rename,
  recategorize, set/change/clear store, suggestion click, and an edit of a checked item in a real browser at desktop width
  **and** ~360px, before writing any test — the project's stated gate, which has caught bugs no type check reaches.
- [x] `bp_front/e2e/item-editing.spec.ts` — new FR40/FR44-tagged spec covering: rename + recategorize with a reload to
  prove persistence; store set → change → clear asserted via the existing `shopping-item-store-<name>` chip; suggestions
  absent on a store-less list then present and clickable; **checked-state preservation across an edit**; recurring
  preservation (API-seeded, see Design Notes); the no-op save issuing no `SaveItem` request; a co-member seeing an edit
  live on `/list/:id`; and the ~360px two-control fit. Reach `/list/:id` by `page.goto` — never through Story 6.2's new
  links, or 6.1 cannot be completed on its own.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — file **BUG-E6-1** (`saveItem` re-attributes `addedBy` to
  the editor, `ItemApi.kt:52` — a co-member's edit steals authorship on the shopping view's `addedBy` avatar; fix:
  preserve the stored `addedBy` on update server-side) and **BUG-E6-2** (`saveItem` resets `checkedAt` to `null`,
  `Item.kt:6-18` + `GqlItemMapper.kt:26-41` — an edit clears the check-off clock the recurring scheduler reads; fix: merge
  onto the stored item instead of constructing a fresh one), marking BUG-E6-2 a **prerequisite for undeferring the
  one-timer/recurring UI** — filing is an acceptance criterion, not a note; a prior requirement recorded only in story
  prose was orphaned across a workflow handoff.

**Acceptance Criteria:**

- Given an item row on `/lists/:id`, when it renders, then it exposes an edit control named `Edit item {name}` beside the
  existing `Remove item {name}`, and opening it seeds the dialog with that item's current name, category and store with
  focus in the name field. (AC1)
- Given the shopping view `/list/:id`, when item rows render, then they still offer check-off only — no edit, no delete,
  no swipe — and `navigation.spec.ts`'s zero-button assertion still passes. (AC2)
- Given a co-member (not the owner) on a shared list, when they edit any item including one a co-member added, then the
  save succeeds — no owner-only gate is introduced client-side. (AC3)
- Given an edit is saved, when the change propagates, then `/lists/:id` reflects it after its refetch and any other
  member already on `/list/:id` sees it **without reloading**, through the existing subscription and cache merge. (AC4)
- Given the story is complete, then `npm run lint` and `npm run build` pass, `git diff` shows no change under `bp_back/`,
  the only `src/__generated__/` change is codegen output, and the new spec passes on **both** `chromium` and `mobile`.
  (AC5)
- Given the epic's two known defects, when the story closes, then both are recorded in `deferred-work.md` with cause,
  user-visible impact and proposed fix, with the `checkedAt` reset marked a prerequisite for the deferred lifecycle
  UI. (AC6)
- Given ~360px, when an item row renders on `/lists/:id`, then both controls are visible and reachable, the name
  truncates rather than wrapping, and the document does not scroll horizontally. (AC7)

## Spec Change Log

## Review Triage Log

### 2026-07-28 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 5, low 4)
- defer: 2: (high 0, medium 2, low 0)
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` The carry-forward fields (`checked`, `recurring`) were read from the open-time `shown` snapshot,
    so a co-member's check-off (or the hourly recurring scheduler) landing while the dialog sat open was silently reverted
    by the save — the exact defect class the story exists to prevent, reintroduced one level up. They now read from the
    live `item` prop. The *change comparison* deliberately still uses `shown`: "did the user change anything" is about
    what they were shown, so a concurrent rename is left alone rather than clobbered.
  - `[medium]` `[patch]` A third defect of the BUG-E6-1/E6-2 family was unfiled, and it is the one this story newly
    exposes: `ItemStorage.delete` is a hard delete while `ItemRepository.save` upserts, so before Story 6.1 no UI path
    ever issued `saveItem` for an existing id. A stale open dialog can now resurrect a deleted item, or write a dangling
    `category` that makes the item render under no group on either screen. Filed as **BUG-E6-3** with both outcomes, the
    partial mitigation above, and the server-side fix.
  - `[medium]` `[patch]` The "no suggestions on a store-less list" assertion fired while the `cache-and-network` query was
    still in flight, so it passed whether the row was absent because the list had no stores or because the response had
    not arrived — it could not detect the one failure mode it was written for. It now awaits the `ItemStoreSuggestions`
    response first, and also asserts the error notice is absent.
  - `[medium]` `[patch]` The I/O matrix's "Empty name" row had no coverage. Added an FR40 test proving validation is
    on-submit-only (no error before Save is pressed), that the dialog stays open with the inline field error, that **no**
    `SaveItem` is sent, and that the error clears on the next field change.
  - `[medium]` `[patch]` The I/O matrix's "Mutation rejected" row had no coverage — the suite's only reference to
    `edit-item-error` asserted its *absence*, so the `catch` branch that every Epic 5 form convention exists to protect
    was never executed. Added a two-actor FR40 test that revokes the editor's membership while the dialog is open and
    asserts the inline `role="alert"` message, the dialog staying open, and the item unchanged for the owner.
  - `[low]` `[patch]` Dialog seeding keyed only on the open transition, so an item→item retarget without an intervening
    `null` would have kept saving under the previous item's id. Unreachable today (the modal backdrop blocks the other
    rows) but free to harden: the re-seed condition now also fires on an `item.id` change.
  - `[low]` `[patch]` `StoreField` discarded the query's `error`, so a FORBIDDEN or network failure rendered identically
    to "this list has no stores yet" — against the project's inline-feedback convention. A quiet "Store suggestions
    unavailable" caption now renders in the suggestion slot; the field stays typable and the no-stores case still renders
    nothing at all.
  - `[low]` `[patch]` The suggestion chips were an anonymous run of buttons to assistive tech. The container now carries
    `role="group"` + `aria-label="Store suggestions"`.
  - `[low]` `[patch]` The Code Map still claimed `StoreField.tsx` exports `normalizeStore` after deviation 1 moved it to
    `src/lib/lists/storeValue.ts` — corrected, with the `react-refresh/only-export-components` reason recorded.
  - `[medium]` `[defer]` `bp_front/e2e/` is covered by neither ESLint (`eslint src/`) nor `tsc` (`tsconfig.app.json`
    includes only `src`), so the suite that *is* the project's quality gate has no static verification.
  - `[medium]` `[defer]` The E2E helper block is now copy-pasted into a fourth spec file with no shared fixture module;
    `registerViaUi`'s `registrationEnabled` race workaround will drift between copies.

Notable rejections, with reasons (so they are not re-raised): the two-actor test's actor assignment was called a
spec deviation, but the implementation's arrangement covers strictly more on `mobile` — the observer's live-update render
is the only piece not already exercised at Pixel 7 by six sibling tests, whereas the non-owner edit it "loses" is a
viewport-independent authorization check. `edge="end"` on the rightmost of two buttons is what compensates the group's
outer edge, not a bug. `store` over-length needs no error message because no backend cap exists. `void onSaved()` without
a local `.catch` matches `AddItemDialog`'s established idiom and the parent supplies the catch. The no-op save's refetch
is required *by* the spec ("closes exactly as on success") rather than contrary to it.

## Design Notes

**Why chips, not an `Autocomplete`.** Three existing specs select the category `Select` as
`getByTestId('add-item-dialog').getByRole('combobox')`. A second combobox in that dialog is a strict-mode violation, so
adding an `Autocomplete` would break `lists.spec.ts:109`, `lists.spec.ts:162` and `shopping.spec.ts:79`. Clickable
`Chip`s (`role=button`) also match the epic's UX spec — a freely typable field with suggestions below it — and keep the
suggestion row trivially absent when there is nothing to suggest:

```tsx
{suggestions.length > 0 && (
  <Box data-testid={`${testIdPrefix}-store-suggestions`} sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
    {suggestions.map(s => (
      <Chip key={s} size="small" variant="outlined" label={s}
            data-testid={`${testIdPrefix}-store-suggestion-${s}`} onClick={() => onChange(s)}/>
    ))}
  </Box>
)}
```

**The suggestions query needs client-side hygiene.** `getStoreSuggestions` is `mapNotNull { it.store }.distinct()` over a
`ConcurrentHashMap` — unsorted, and `''` survives `mapNotNull` (no backend trim exists anywhere in the store path). Trim,
drop empties, dedupe and sort in `StoreField` so the rendered order is deterministic for tests.

**No-op comparison normalizes both sides**: `normalizeStore(store) === normalizeStore(shown.store ?? '')`, alongside
`name.trim() === shown.name` and `categoryId === shown.category`. Comparing a raw `shown.store` against a normalized
input would treat legacy `''` data as a change.

**Two E2E assertions need a named justification, because both invariants are invisible in the UI:**

1. *No-op save issues no mutation.* Attach a `page.on('request')` listener counting `POST /api/graphql` bodies containing
   `"SaveItem"`, and assert it stays at `0` across the open→submit→close. This observes traffic; it does not fake or
   substitute for the behavior under test, so the UI-driven rule holds.
2. *`recurring` survives an edit.* `recurring` has **no** UI surface (the lifecycle control is deferred) and no UI path
   can set or read it. Seed `recurring: "WEEKLY"` through the API — permitted setup — rename via the UI, then read the
   value back through the API. This single read-back is the one non-UI assertion in the spec, justified because it guards
   *invisible data loss*, which is precisely why no UI path can cover it. Valid values are
   `ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY` (`Recurring.kt`); an unknown string throws server-side.

**Two-actor viewport trap.** `browser.newContext()` does **not** inherit the project's `use` block (documented at
`navigation.spec.ts:329-333`), so a hand-built context silently runs at a desktop viewport on the `mobile` project. Put
the **observer** (the co-member on `/list/:id`, whose rendering is what the mobile gate must cover) on the `page` fixture,
and the editing owner in the hand-built context. Seed membership via `loginApi` + `gql(shareList)` + `gql(acceptInvite)`
as `shopping.spec.ts:278-281` does — membership is setup here, not the asserted behavior.

**Accepted trade-off (not a defect to fix here):** a store-only edit produces no visible change on `/lists/:id`, since
the epic deliberately routes store verification to the shopping-view chip and adds no store display to the management
row. The dialog closing remains the confirmation, per convention.

### Implementation deviations (Story 6.1, dev-auto — read before reviewing)

**1. `normalizeStore` lives in `src/lib/lists/storeValue.ts`, not in `StoreField.tsx`.** The Code Map placed it as a
named export alongside the component. That fails `npm run lint`: `react-refresh/only-export-components` rejects a
component file that also exports a plain function ("Fast refresh only works when a file only exports components"), and
0 errors / 0 warnings is an AC. It is still **one** normalizer (plus one `STORE_MAX`) imported by `StoreField`,
`AddItemDialog` and `EditItemDialog`, so the invariant the spec cared about — a later validation change cannot land in
one dialog and miss the other — is fully preserved. A re-export from `StoreField` would have re-triggered the same rule.

**2. `ItemUpdatesSubscription` gained `recurring` in its selection set.** This was not in the Code Map and is adjacent
to "no subscription or merge change", so it needs justifying. Adding `recurring` to `ItemsQuery` (a required task) makes
`tsc -b` fail in `ListShoppingPage.tsx:102-104` — that `updateQuery` writes the subscription event's `item` **straight
into the `Items` result**, so the subscription payload must remain a structural superset of `ItemsQuery`'s item shape.
Without the widening, the only alternatives were editing `ListShoppingPage.tsx` (explicitly forbidden) or leaving the
build broken (AC5). It is the same class of change the spec already mandates for `SaveItemMutation`'s selection, it is
also a correctness fix (a subscription-delivered item would otherwise land in the cache missing a field `ItemsQuery`
reads), and **no** merge logic, subscription wiring, client, or `typePolicies` changed.

**3. The two carry-forward regression tests were verified to actually fail.** Since "silently wipes a field" is a defect
a passing test can trivially miss, the carry-forward was temporarily broken in `EditItemDialog`
(`checked: false, recurring: null`), the production image rebuilt, and both
`FR40 — editing a checked item keeps it checked` and `FR40 — editing an item preserves its recurring cadence` were
confirmed to fail on **both** `chromium` and `mobile`, then the code was restored. They are not vacuous.

**4. BUG-E6-2 was observed, not inferred.** During the manual pass an item checked off through the UI came back
`checked: true, checkedAt: null` after a UI rename, confirming the `checkedAt` reset live before it was filed.

## Verification

**Commands:**

- `cd bp_front && CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate`
  — expected: `src/__generated__/graphql.ts` gains `ItemStoreSuggestionsQuery` types and `Items`/`SaveItem` result types
  gain `recurring`/`store`/`addedBy`; no other diff in that directory.
- `cd bp_front && npm run lint` — expected: 0 errors, 0 warnings.
- `cd bp_front && npm run build` — expected: `tsc -b` clean, bundle emitted.
- `docker compose up -d --build` — expected: `:2080` serves the rebuilt SPA (manual pass runs against this).
- `cd bp_front && npm run test:e2e` — expected: the new `item-editing.spec.ts` tests pass on **both** `chromium` and
  `mobile`; the pre-existing suite stays at its known baseline (the `registrationEnabled` race may need a retry — do not
  paper over it further).
- `git diff --stat -- bp_back/` — expected: empty output.

## Auto Run Result

Status: `done`

### Implemented change

An item on the list management screen `/lists/:id` can now be edited — name, category, and a free-form store with
suggestions drawn from the list's own data — and a store can be set while *adding* an item, so it no longer needs a second
trip through an editor. Frontend only: `ItemInput.store` and `itemStoreSuggestions(listId: ID!): [String!]!` already
existed in the frozen schema, so the change is new operation documents, regenerated types, and UI. The shopping view
`/list/:id` is untouched and stays check-off-only; its existing store chip and per-list subscription render and propagate
edits with no change.

The story's central hazard is that `saveItem` is a full-document upsert, not a patch: any field absent from the input is
written back as its default. The edit payload therefore carries `checked` and `recurring` forward, which required widening
`ItemsQuery` to select `recurring` at all (a field no frontend document had ever fetched).

### Files changed

- `bp_front/src/lib/lists/listsQueries.ts` — `recurring` added to `ItemsQuery`; `store addedBy recurring` added to
  `SaveItemMutation`'s result so Apollo's by-id normalization cannot hold a stale value after a save; new
  `ItemStoreSuggestionsQuery`; `recurring` added to `ItemUpdatesSubscription` to keep its payload a superset of the item
  shape `ListShoppingPage` writes into the cache.
- `bp_front/src/components/EditItemDialog.tsx` — **new.** Name / category / store, seeded on the closed→open transition,
  no-op saves send no mutation, carry-forward fields read from the live prop.
- `bp_front/src/components/StoreField.tsx` — **new.** Shared store input + suggestion chips (deliberately not an
  `Autocomplete`), owning the suggestions query and its client-side trim/dedupe/sort.
- `bp_front/src/lib/lists/storeValue.ts` — **new.** `normalizeStore` (blank → `null`, never `''`) + `STORE_MAX`.
- `bp_front/src/components/AddItemDialog.tsx` — store state, `StoreField`, normalized `store` in the payload.
- `bp_front/src/routes/ListDetailPage.tsx` — edit control per item row, `editItemTarget` state, `EditItemDialog`, and a
  narrowed name width so two controls fit at ~360px.
- `bp_front/src/__generated__/{gql,graphql}.ts` — codegen output only; verified to mirror the document edits exactly.
- `bp_front/e2e/item-editing.spec.ts` — **new.** 10 FR40/FR44 tests × 2 viewport projects.
- `_bmad-output/implementation-artifacts/deferred-work.md` — BUG-E6-1, BUG-E6-2 (AC6) and BUG-E6-3 filed, plus two
  deferred review findings.

### Review findings

9 patches applied, 2 deferred, 11 rejected; 0 intent gaps and 0 spec defects, so no repair loopback ran. Full breakdown
and the reasoning for each rejection are in the Review Triage Log above.

### Verification performed

- `npm run generate` — succeeded against the live schema; the generated diff contains only the four document changes.
- `npm run lint` — clean (0 errors, 0 warnings), run again after the review patches.
- `npm run build` — `tsc -b` clean; only the pre-existing >500 kB chunk-size advisory.
- `docker compose up -d --build` — the served bundle hash was checked against the fresh local build to confirm `:2080`
  runs the code under test, both before and after the review patches.
- Manual browser pass on the production image at desktop width and 360px, before any test was written — rename,
  recategorize, set/change/clear store, whitespace-only clear, trim, suggestion click, editing an already-checked item,
  empty-name validation, no-op save. No console errors; exactly one `combobox` in the add dialog, so the existing
  strict-mode category selectors are safe.
- `npm run test:e2e` — **104 passed** on both `chromium` and `mobile` (100 before the review patches added two tests). One
  earlier run had a single failure with `alert: "Registration is disabled"` inside `registerViaUi`: the documented
  pre-existing `registrationEnabled` race (`admin.spec.ts` really flips the shared flag while both projects run
  concurrently), not story code. Confirmed from the error context, and green at `--retries=2` — the CI setting — as the
  project's known baseline. No other spec was modified to accommodate it.
- The two carry-forward regression tests were proven non-vacuous by temporarily breaking the payload to
  `checked: false, recurring: null` and confirming both fail on both projects before restoring.
- `git diff --stat -- bp_back/` — empty. `ListShoppingPage.tsx` untouched.

### Residual risks

- **BUG-E6-3 is mitigated, not closed.** `/lists/:id` is refetch-driven by design, so nothing refreshes while the edit
  dialog is open. Reading carry-forward fields from the live prop narrows the window; a concurrent delete or category
  removal inside one dialog's open window can still resurrect an item or orphan it. The real fix is server-side and is
  filed with the other two frozen-backend defects.
- **BUG-E6-1 and BUG-E6-2 ship by epic decision.** An edit re-attributes `addedBy` to the editor, and clears `checkedAt`.
  BUG-E6-2 is recorded as a prerequisite for undeferring the one-timer / recurring UI.
- **`e2e/` has no static verification** (deferred) — the largest new file in this change is outside both lint and `tsc`.
- The `registrationEnabled` race is unchanged and this story adds ~20 more UI registrations per full run, widening its
  window slightly. It remains an open Epic 5 retro action item.
- `followup_review_recommended: true` — the review changed data-write semantics (the carry-forward source), added a UI
  branch, and added two behavioural tests, which is more than a few localized cosmetic fixes.
