---
title: 'Fix list golden path: create list, add item, toggle'
type: 'bugfix' # feature | bugfix | refactor | chore
created: '2026-06-15'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
baseline_commit: 'a550ee502dc58ec6f84f7431a55dc0cfee73f9dd'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The core shopping loop is unusable. (1) **Create list is broken** — typing into the New-list name field pops a spurious "Discard changes?" dialog after the first character, so a list can never be created. Confirmed live: `BPSheet`'s history/back-gesture effect lists the unstable `onStateChange` callback in its deps, so it tears down and re-runs on every keystroke; its cleanup calls `window.history.back()`, firing a `popstate` the re-registered listener reads as a back-gesture → `onStateChange('closed')` → with a non-empty name → the discard dialog (and "Keep editing" re-triggers the same cascade). (2) **Add item is a stub** — the list page's add sheet only says "coming in Story 4.9", so no item can be added and therefore none can be toggled.

**Approach:** Fix `BPSheet` so the history effect depends only on `sheetOpen` by reading `onStateChange` through a ref (the code's own comment already states this intent). Then replace the add-item stub with a minimal name-only form that ensures a per-list "Uncategorized" category exists (reuse if present, else create via `saveCategory`) and saves the item via `saveItem`; the existing item subscription renders it and the existing check flow toggles it.

## Boundaries & Constraints

**Always:** Preserve `BPSheet`'s back-gesture/sentinel behavior, focus-on-open, focus-restore-to-trigger, and all a11y props. Generate client-side UUIDs for new item and category ids via `crypto.randomUUID()`. New items are saved with `checked:false`, `recurring:null`, `store:null`. Define all GraphQL ops in `src/lib/<entity>/Queries.tsx` and regenerate types with `npm run generate` — never hand-edit `src/__generated__/`. Use the `mia/mia` account for manual checks (admin is blocked from creating lists).

**Ask First:** Adding item fields beyond name (store, recurring/one-timer, category picker). Changing the sheet's open/peeked/closed state machine or swipe gestures. Any backend change.

**Never:** Do not edit `src/__generated__/` by hand. Do not reintroduce `onStateChange` into the `BPSheet` history effect deps. Do not build the full Story 4.9 item lifecycle. Do not alter the existing check/uncheck/undo logic or backend.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Type name in New-list sheet | keystrokes, sheet open, name non-empty | Text enters normally; NO discard dialog appears | N/A |
| Click Create with valid name | name="Groceries" | List created; sheet closes; navigates to `/list/{id}` | Snackbar "Couldn't create list · Retry" on failure |
| Add item, list has no category | name="Milk", 0 categories | "Uncategorized" category created once; item saved & appears under it | Surface error; sheet stays open |
| Add item, "Uncategorized" exists | name="Eggs", category present | Reuse existing category id; no duplicate category created | Surface error; sheet stays open |
| Toggle added item | tap its check control | Item checks off (existing optimistic + undo flow) | Existing error handling unchanged |

</frozen-after-approval>

## Code Map

- `bp_front/src/app/BPSheet.tsx` -- shared bottom-sheet; the history effect (`useEffect` ~L91, deps `[sheetOpen, onStateChange]`) whose cleanup `history.back()` causes the bug. Fix here benefits both sheets.
- `bp_front/src/app/SheetNewList.tsx` -- new-list form; passes inline `handleStateChange` (unstable). No change required once BPSheet is fixed; verify create works.
- `bp_front/src/app/list/[listId]/page.tsx` -- list page; replace the stub add sheet (~L340–349) with a real form + add handler; wire `saveItem`/`saveCategory`.
- `bp_front/src/lib/item/Queries.tsx` -- add `saveItemMutation`.
- `bp_front/src/lib/category/Queries.tsx` -- add `saveCategoryMutation`.
- Backend (reference only, no change): `entity/item/gql/ItemApi.kt` `saveItem(ItemInput)`, `entity/category/gql/CategoryApi.kt` `saveCategory(Category)`; both emit subscription SAVED events; `ItemInput` requires `{id,name,checked,category,listId,store?,recurring?}`; `saveItem` does not validate category existence.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/src/app/BPSheet.tsx` -- Capture `onStateChange` in a ref synced via a no-dep effect; have the popstate handler call `onStateChangeRef.current(...)`; reduce the history effect deps to `[sheetOpen]`. Also guard the cleanup `history.back()` so it only runs when the sentinel is still the top history entry. -- Stops per-render teardown and the rogue `history.back()` that triggers the discard dialog, and prevents the cleanup from clobbering a forward navigation.
- [x] `bp_front/src/lib/category/Queries.tsx` -- Add `saveCategoryMutation($id:ID!,$name:String!,$listId:ID!)` returning `{id name listId}`. -- Enables minimal category creation.
- [x] `bp_front/src/lib/item/Queries.tsx` -- Add `saveItemMutation($item: ItemInput!)` returning the same item fields as `getItemsQuery`. -- Enables adding items.
- [x] `bp_front/src/app/list/[listId]/page.tsx` -- Replace stub sheet body with a name `TextField` + Add button; on add, resolve the "Uncategorized" category id (find in `categoriesData` case-insensitively or a cached ref, else `saveCategory` with a new UUID), then `saveItem` with a new UUID, `checked:false`; clear input and close sheet on success. -- Makes add-item functional; relies on the existing item subscription to render the new item.
- [x] `bp_front/src/app/SheetNewList.tsx` -- On successful create, navigate to `/list/{newId}` WITHOUT first calling `onStateChange('closed')` (navigation unmounts the sheet; the BPSheet cleanup guard then skips the sentinel pop). -- Fixes create landing on `/lists` instead of the new list. (Added during verification.)
- [x] `bp_front` -- Run `npm run generate` so `SaveItem`/`SaveCategory` typed ops exist. (Codegen token in `codegen.ts` was expired; refreshed via `POST /api/auth/login` admin/admin.) -- Required before the new mutations type-check.

**Acceptance Criteria:**
- Given the New-list sheet is open with motion enabled, when the user types a multi-character name, then no discard dialog appears and the full text is retained.
- Given a freshly created empty list, when the user adds an item by name, then the item appears in the list under a category and is toggleable, and adding a second item does not create a duplicate "Uncategorized" category.
- Given the existing `list/[listId]` add sheet and `SheetNewList` both use `BPSheet`, when either opens/closes via FAB, swipe, or back gesture, then behavior is unchanged from intent (sentinel, focus-on-open, focus-restore).

## Spec Change Log

- **2026-06-15, review iteration 1 (no loopback — patches only):** Three adversarial reviewers ran. No intent_gap/bad_spec. Patches applied to the diff: (1) reset `uncategorizedIdRef` on `listId` change — `TodayPageInner` is reused across `/list/[listId]` navigations, so a cached id was attaching new items to the previously-viewed list's category (cross-list corruption); (2) guard `handleAddItem` with `if (addInFlight) return` to stop Enter-key re-entrancy creating duplicate items/categories; (3) reset the add-form name/error when its sheet closes (wrapped `onStateChange`) so stale state doesn't reappear; (4) added an idempotent Apollo cache `update` to `saveItem` so a new item appears immediately and survives a dropped subscription; (5) pass `store:null, recurring:null` explicitly for spec-letter conformance. Deferred (see deferred-work.md): BPSheet sentinel per-instance identity, orphan sentinel entry after create-navigate, `crypto.randomUUID` secure-context requirement (Epic 5 mobile), orphan empty category on partial add failure. All cross-list and add/toggle paths re-verified live in the browser; tsc clean; lint shows only 3 pre-existing errors.

## Design Notes

Two distinct `BPSheet` history-sentinel issues bit the create flow:
1. **Discard-on-keystroke (root cause):** the history effect's deps included the inline `onStateChange`, so it re-ran every render; its cleanup `history.back()` fired a `popstate` read as a back-gesture → close → discard dialog. Fixed by reading `onStateChange` via a ref and depending only on `[sheetOpen]`.
2. **Create not navigating:** `submit()` closed the sheet then `router.push`-ed; the close's cleanup `history.back()` raced and undid the push (Next's `router.push` updates history asynchronously, so a "sentinel-on-top" guard alone wasn't enough). Fixed by navigating WITHOUT closing first — navigation unmounts the sheet, by which point history is the new route, so the guarded cleanup skips the pop.

## Verification

**Commands:**
- `cd bp_front && npm run generate` -- expected: regenerates `__generated__/` with `SaveItem`/`SaveCategory`; no errors.
- `cd bp_front && npx tsc --noEmit` -- expected: type-checks clean.
- `cd bp_front && npm run lint` -- expected: no new errors.

**Manual checks (Playwright MCP, full stack on `:2080`, login `mia/mia`):**
- Lists → Create FAB → type a name → no discard dialog → Create → lands on `/list/{id}`.
- On the new list → Add FAB → type item name → Add → item appears → tap its check → it toggles off (Undo snackbar shows).
- Add a second item → only one "Uncategorized" group exists.

## Suggested Review Order

**Create-list root-cause fix (start here)**

- Entry point — read `onStateChange` via a ref so the history effect no longer thrashes per keystroke.
  [`BPSheet.tsx:58`](../../bp_front/src/app/BPSheet.tsx#L58)

- History effect now depends only on `sheetOpen`; cleanup pops the sentinel only when it is still on top.
  [`BPSheet.tsx:131`](../../bp_front/src/app/BPSheet.tsx#L131)

- Create success navigates without closing first, so the cleanup `history.back()` cannot clobber the push.
  [`SheetNewList.tsx:131`](../../bp_front/src/app/SheetNewList.tsx#L131)

**Add-item feature**

- Add handler: in-flight guard, resolve/create "Uncategorized", save item, idempotent cache write.
  [`page.tsx:222`](../../bp_front/src/app/list/[listId]/page.tsx#L222)

- Category resolution — reuse existing/cached "Uncategorized" or create one (single category per list).
  [`page.tsx:208`](../../bp_front/src/app/list/[listId]/page.tsx#L208)

- Reset cached category id on list switch — prevents cross-list category corruption.
  [`page.tsx:105`](../../bp_front/src/app/list/[listId]/page.tsx#L105)

- Reset add-form on close via wrapped state handler — no stale name/error on reopen.
  [`page.tsx:110`](../../bp_front/src/app/list/[listId]/page.tsx#L110)

**Supporting — GraphQL operations**

- New `saveItem` mutation (full item field set).
  [`item/Queries.tsx:11`](../../bp_front/src/lib/item/Queries.tsx#L11)

- New `saveCategory` mutation.
  [`category/Queries.tsx:11`](../../bp_front/src/lib/category/Queries.tsx#L11)
