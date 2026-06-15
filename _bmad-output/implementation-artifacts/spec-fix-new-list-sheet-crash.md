---
title: 'Fix new-list sheet crash and emoji-picker drawer blinking'
type: 'bugfix'
created: '2026-06-15'
status: 'done'
baseline_commit: 'defd1bc9791e0a8fb156d9f1a83901fded78c171'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Opening the "New list" sheet and touching the name input throws `TypeError: Cannot read properties of undefined (reading 'contains')` from MUI `SwipeableDrawer.handleBodyTouchStart`, and clicking the emoji button makes the drawer "blink". Root cause: (1) `BPSheet` passes a `ref` callback through `slotProps.paper`, which MUI's `mergeSlotProps` spreads *after* its own internal `{ref: paperRef}`, clobbering it — so `paperRef.current` stays `undefined` and crashes on the body `touchstart` handler; (2) `emoji-picker-react`'s root element runs its own `height` transition whose `transitionend` bubbles to the Paper's `onTransitionEnd`, which has no `target === currentTarget` guard, so it re-steals focus on every emoji-picker height animation.

**Approach:** Stop overriding MUI's internal paper ref — remove the `ref` from `slotProps.paper` and obtain the Paper node from `e.currentTarget` inside the transition-end handler instead. Add a `e.target === e.currentTarget` guard to `handleTransitionEnd` so bubbled child transitions (the emoji picker) no longer trigger focus steals.

## Boundaries & Constraints

**Always:** Preserve the existing focus-on-open behavior (first focusable element in the sheet receives focus once the Paper's own height transition completes). Keep all current accessibility props (role=dialog, aria-modal, aria-label, escape handling, focus restore to trigger). Use MUI MCP docs before changing MUI slot wiring.

**Ask First:** Any change that alters the sheet's open/peeked/closed state machine or swipe gesture behavior. Bumping or changing the MUI version.

**Never:** Do not edit `src/__generated__/`. Do not introduce a second ref-forking workaround that still passes `ref` into `slotProps.paper`. Do not touch backend or the list/[listId] sheet behavior beyond what is shared via `BPSheet`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Touch/click name input while sheet open | `touchstart` fires on body, drawer open | No exception; input focuses normally | N/A |
| Open emoji picker, interact with it | picker root animates height, `transitionend` bubbles | Drawer does NOT re-focus/blink | N/A |
| Sheet opens (peeked→open height transition) | Paper's own `height` transitionend | First focusable element focuses once | N/A |
| Reduced motion (Fade, no height transition) | sheet opens | Behavior unchanged from current (no regression) | N/A |

</frozen-after-approval>

## Code Map

- `bp_front/src/app/BPSheet.tsx` -- shared bottom-sheet wrapper around MUI `SwipeableDrawer`; holds the offending `slotProps.paper.ref` override and `handleTransitionEnd`. Used by both `SheetNewList` and `list/[listId]/page.tsx`.
- `bp_front/src/app/SheetNewList.tsx` -- new-list form rendered inside `BPSheet`; hosts the `EmojiPicker` whose height transition bubbles. No change expected.
- `bp_front/node_modules/@mui/material/utils/mergeSlotProps.mjs` -- reference only: confirms external slot `ref` overrides internal `paperRef` (not forked).

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/src/app/BPSheet.tsx` -- Remove the `ref` callback from `slotProps.paper` and delete the now-unused `paperRef` ref. In `handleTransitionEnd`, add `if (e.target !== e.currentTarget) return` as the first guard and read the Paper node via `e.currentTarget.querySelector(...)` instead of `paperRef.current`. -- Stops clobbering MUI's internal paperRef (fixes crash) and ignores bubbled emoji-picker transitions (fixes blink), while keeping focus-on-open.

**Acceptance Criteria:**
- Given the New list sheet is open, when the user clicks/taps the name input, then no `TypeError` is thrown and the input receives focus.
- Given the emoji picker is open, when it animates (open/category/search/emoji interactions), then the drawer does not steal focus or blink.
- Given the sheet opens with motion enabled, when the Paper's own height transition completes, then the first focusable element is focused exactly as before.
- Given the existing `list/[listId]` page uses `BPSheet`, when it opens, then it behaves unchanged.

## Verification

**Commands:**
- `cd bp_front && npm run lint` -- expected: no new errors (unused `paperRef`/imports removed cleanly).
- `cd bp_front && npx tsc --noEmit` -- expected: type-checks; `e.currentTarget` typed as the Paper element.

**Manual checks:**
- Run full stack on `:2080`, log in (mia/mia), go to Lists, tap the Create FAB, tap the name field → no console error. Open the emoji picker and interact → no drawer blink. Pick an emoji → focus returns to the name field.

## Suggested Review Order

- Crash fix: removing the paper `ref` lets MUI populate its own internal `paperRef`.
  [`BPSheet.tsx:153`](../../bp_front/src/app/BPSheet.tsx#L153)

- Blink fix: guard drops bubbled child `transitionend` (emoji picker) — only Paper's own transition acts.
  [`BPSheet.tsx:128`](../../bp_front/src/app/BPSheet.tsx#L128)

- Focus-on-open preserved: Paper node now read from `e.currentTarget` instead of the removed ref.
  [`BPSheet.tsx:131`](../../bp_front/src/app/BPSheet.tsx#L131)
