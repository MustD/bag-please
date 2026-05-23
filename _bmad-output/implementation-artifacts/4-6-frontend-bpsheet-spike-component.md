# Story 4.6: Frontend — BPSheet Spike & Component

Status: ready-for-dev

## Story

As a developer building Epic 4 sheet interactions,
I want a validated three-state bottom sheet component,
so that all create, edit, and share flows have a reliable, accessible interaction layer before any sheet story is estimated or built.

## Acceptance Criteria

**AC1 — State machine transitions:**
Given `BPSheet` is implemented wrapping MUI `SwipeableDrawer` with three states: `'closed'`, `'peeked'`, `'open'`
When `state` prop changes or the user gestures
Then the sheet transitions: `CLOSED → PEEKED → OPEN → PEEKED → CLOSED`
And swipe-down from `OPEN` moves to `PEEKED` (not directly to `CLOSED`)
And a second swipe-down from `PEEKED` moves to `CLOSED`
And back gesture follows the same two-step: `OPEN → PEEKED`, then `PEEKED → CLOSED`, with no route change and no history entry consumed on either step.

**AC2 — Spike validation (manual, 4 criteria):**
Given the BPSheet spike is run on a real device or browser DevTools mobile emulation
When all four spike acceptance criteria are evaluated
Then (1) scroll inside an OPEN sheet on iOS Safari does not accidentally close the sheet
And (2) the iOS virtual keyboard viewport push does not fight the OPEN state focus trap
And (3) the PEEKED → OPEN height transition completes in under 16ms frame time on a mid-range Android device (Chrome DevTools CPU 4x throttle as proxy)
And (4) the back-gesture contract is correctly implemented: OPEN + back → PEEKED (no route change, no history entry consumed); PEEKED + back → CLOSED.

**AC3 — Escape two-step:**
Given `BPSheet` is in `OPEN` state
When the `Escape` key is pressed
Then the first `Escape` transitions `OPEN → PEEKED` via `onKeyDown` + `event.stopPropagation()` — MUI Modal's default one-press close is suppressed
And a second `Escape` from `PEEKED` allows MUI Modal close behaviour → `CLOSED`.

**AC4 — Focus trap:**
Given `BPSheet` is in `OPEN` state
When the sheet is open
Then a focus trap is active — `Tab` cycles within sheet content only
And `disableEnforceFocus={false}` and `disableRestoreFocus={false}` are set on the underlying Modal (not overridden).

**AC5 — Focus restore on close:**
Given `BPSheet` accepts a `triggerRef?: React.RefObject<HTMLElement>` prop
When the sheet transitions to `CLOSED`
Then `triggerRef.current?.focus()` is called, restoring focus to the element that opened the sheet.

**AC6 — Focus on transitionEnd (not mount):**
Given `BPSheet` is opened
When the sheet enter animation completes (`transitionEnd`)
Then focus moves to the first focusable element inside the sheet — not on mount, on `transitionEnd`.

**AC7 — Reduced-motion crossfade:**
Given `prefers-reduced-motion: reduce` is active
When `BPSheet` opens or closes
Then the translate/slide transition is replaced with an opacity crossfade — not an instant snap
And no spatial movement occurs.

**AC8 — Scrim tap closes sheet:**
Given `BPSheet` is open and the scrim is tapped
When the tap registers
Then the sheet closes (transitions to `CLOSED`).

**AC9 — ARIA roles:**
Given `BPSheet` has `role="dialog"`, `aria-modal="true"`, and `aria-label="{sheet title}"`
When a screen reader navigates to the open sheet
Then it announces the sheet as a dialog with the provided label.

**AC10 — Spike fallback decision:**
Given the spike concludes and criteria 1 or 3 fail
When the fallback decision is made
Then the fallback is a full-screen MUI `Dialog`; downstream sheet stories (4.7, 4.8, 4.9, 4.10) must be re-scoped before any are estimated; the decision is documented in a spike completion note appended to this story.

## Tasks / Subtasks

- [ ] **Task 1: Install `react-swipeable` if needed** (AC: 2)
  - [ ] Run `cd bp_front && npm ls react-swipeable` — check if already installed
  - [ ] If absent: `npm install react-swipeable`
  - [ ] Verify no peer dependency conflicts with React 19.2.5

- [ ] **Task 2: Implement `BPSheet` component** (AC: 1, 3, 4, 5, 6, 7, 8, 9)
  - [ ] Create `bp_front/src/app/BPSheet.tsx`
  - [ ] Implement `BPSheetProps` interface exactly as specified (see Dev Notes)
  - [ ] PEEKED state: `SwipeableDrawer open={true}` with `PaperProps.sx.height = peekHeight` (default 200px)
  - [ ] OPEN state: `SwipeableDrawer open={true}` with `PaperProps.sx.height = '92%'`
  - [ ] CLOSED state: `SwipeableDrawer open={false}`
  - [ ] Add drag handle pill at top of Paper (see Dev Notes — anatomy)
  - [ ] Implement swipe-down from OPEN → PEEKED (use `onClose` intercept + track swipe distance)
  - [ ] Implement swipe-down from PEEKED → CLOSED
  - [ ] Implement Escape two-step via `onKeyDown` + `stopPropagation` (AC3)
  - [ ] Set `disableEnforceFocus={false}` and `disableRestoreFocus={false}` on underlying Modal (AC4)
  - [ ] Implement `triggerRef` focus restore on CLOSED transition (AC5)
  - [ ] Implement focus-on-transitionEnd (AC6) — use `transitionend` event listener on Paper
  - [ ] Apply `prefers-reduced-motion` detection: replace slide with opacity crossfade (AC7)
  - [ ] Wire `role="dialog"` `aria-modal="true"` `aria-label={title}` on SwipeableDrawer's Paper (AC9)
  - [ ] Z-index: use `theme.zIndex.drawer` (1200) to sit above BPBottomNav

- [ ] **Task 3: Implement back-gesture interception** (AC: 1, 2 criterion 4)
  - [ ] Add `history.pushState` sentinel entry on PEEKED/OPEN state entry (see Dev Notes — back-gesture approach)
  - [ ] Listen for `popstate` event to intercept back gesture
  - [ ] OPEN + popstate → onStateChange('peeked'); re-push sentinel; prevent route change
  - [ ] PEEKED + popstate → onStateChange('closed'); clean up sentinel; no history entry consumed
  - [ ] Clean up sentinel entries on unmount

- [ ] **Task 4: Manual spike validation** (AC: 2)
  - [ ] Run the dev stack: `docker compose up mongo router` + `cd bp_front && npm run dev`
  - [ ] Create a temporary test page (e.g. `app/bpsheet-test/page.tsx`) with buttons that open BPSheet in peeked/open states
  - [ ] Test criterion 1: open DevTools mobile emulation → iOS Safari simulation; scroll inside OPEN sheet; confirm sheet does not close
  - [ ] Test criterion 2: open OPEN state on mobile emulation; focus a text input inside; confirm virtual keyboard does not fight focus trap
  - [ ] Test criterion 3: open Chrome DevTools Performance panel; CPU throttle 4x; trigger PEEKED→OPEN transition; verify no frame >16ms
  - [ ] Test criterion 4: open OPEN state; press browser back; verify → PEEKED (no route change); press back again; verify → CLOSED
  - [ ] Document pass/fail results for all 4 criteria in spike completion note (see Dev Agent Record section)
  - [ ] Delete `app/bpsheet-test/` after spike validation is complete

- [ ] **Task 5: Apply fallback decision if spike fails** (AC: 10)
  - [ ] If criteria 1 or 3 fail: swap `BPSheet` implementation to wrap MUI `Dialog` (full-screen)
  - [ ] Document fallback decision in story completion notes
  - [ ] Note that stories 4.7, 4.8 must be re-scoped — document in sprint-status.yaml comment

- [ ] **Task 6: TypeScript verification** (AC: all)
  - [ ] `cd bp_front && npx tsc --noEmit` — zero errors

## Dev Notes

### Dependency State

`react-swipeable` is **NOT** in `bp_front/package.json`. Install it before implementing. Current relevant packages:
- `@mui/material` 9.0.0 — `SwipeableDrawer` is available
- `react` 19.2.5 — verify react-swipeable peer dep compatibility
- `@emotion/styled` 11.14.1 — available for `styled()`

### Props Interface (exact — do not deviate)

```ts
interface BPSheetProps {
  state: 'closed' | 'peeked' | 'open'
  onStateChange: (state: 'closed' | 'peeked' | 'open') => void
  peekHeight?: number   // defaults to 200px
  title: string         // used for aria-label
  triggerRef?: React.RefObject<HTMLElement>
  children: ReactNode
}
```

### Component Anatomy

```
┌──────────────────────────────────┐
│     ── (drag handle pill, 4×36px, theme.custom.bp.ter) ──     │
│                                  │
│  {children}                      │
│                                  │
└──────────────────────────────────┘
```

Drag handle pill: `Box` with `width: 36px, height: 4px, borderRadius: 2, bgcolor: theme.custom.bp.ter, mx: 'auto', mt: 1, mb: 0`.
Content area padding: `4px 16px 16px` (UX spec).

### State Machine Implementation

PEEKED is synthetic — `SwipeableDrawer` only has two native states (open/closed). Implement as:
```ts
// CLOSED: open={false}
// PEEKED: open={true}, PaperProps.sx.height = peekHeight (default 200)
// OPEN:   open={true}, PaperProps.sx.height = '92%'
```

For PEEKED → OPEN transition via swipe-up: MUI `SwipeableDrawer.onOpen` fires when the user swipes up. Use this callback to call `onStateChange('open')` when current state is `'peeked'`.

For OPEN → PEEKED transition via swipe-down: MUI `SwipeableDrawer.onClose` fires on swipe-down or scrim tap. Use this to discriminate:
- If state is `'open'` and swipe-down → `onStateChange('peeked')` (do NOT close completely)
- If state is `'peeked'` and swipe-down or scrim tap → `onStateChange('closed')`

Pattern to suppress default onClose full-close when state is `'open'`:
```ts
const handleClose = () => {
  if (state === 'open') {
    onStateChange('peeked')
  } else {
    onStateChange('closed')
  }
}
```

### Back-Gesture Interception

Next.js App Router does not expose `popstate` natively. Use history sentinel approach:

```ts
useEffect(() => {
  if (state === 'closed') return
  // Push a sentinel so back button hits it instead of real history
  window.history.pushState({ bpSheetSentinel: true }, '')

  const handlePopState = (e: PopStateEvent) => {
    if (state === 'open') {
      onStateChange('peeked')
      // Re-push sentinel for next back press
      window.history.pushState({ bpSheetSentinel: true }, '')
    } else if (state === 'peeked') {
      onStateChange('closed')
      // No re-push — sentinel consumed, route history is clean
    }
  }

  window.addEventListener('popstate', handlePopState)
  return () => {
    window.removeEventListener('popstate', handlePopState)
  }
}, [state])
```

Important: clean up sentinel on unmount by calling `window.history.back()` if a sentinel was pushed and the component unmounts while open — otherwise history is polluted.

### Escape Key Two-Step

MUI `SwipeableDrawer` / `Modal` closes on first Escape by default. To implement two-step:

```ts
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (state === 'open') {
      e.stopPropagation() // prevents MUI Modal default close
      onStateChange('peeked')
    }
    // When state === 'peeked', don't stop propagation — MUI Modal fires onClose → handleClose → 'closed'
  }
}
```

Pass `onKeyDown={handleKeyDown}` to the `SwipeableDrawer`. The PEEKED → CLOSED path on second Escape relies on `handleClose` (same callback as scrim tap / swipe-down from PEEKED).

### Focus Management

**Focus on transitionEnd (AC6):**
```ts
const paperRef = useRef<HTMLDivElement>(null)

const handleTransitionEnd = () => {
  if (state !== 'closed') {
    const firstFocusable = paperRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }
}
// Pass to SwipeableDrawer PaperProps: { ref: paperRef, onTransitionEnd: handleTransitionEnd }
```

**Focus restore (AC5):**
```ts
useEffect(() => {
  if (state === 'closed') {
    triggerRef?.current?.focus()
  }
}, [state])
```

### Reduced Motion (AC7)

MUI `SwipeableDrawer` slide animation is CSS `transform: translateY`. To replace with opacity crossfade under reduced motion:
```ts
const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

// In SwipeableDrawer PaperProps.sx:
...(prefersReducedMotion && {
  transition: 'opacity 200ms ease-out !important',
  transform: 'none !important',
})
```

Or use MUI's `sx` with the `@media (prefers-reduced-motion: reduce)` CSS query in the sx prop object.

### Z-Index & BPBottomNav Interaction

BPBottomNav uses `theme.zIndex.appBar` (1100). BPSheet uses `theme.zIndex.drawer` (1200). Sheet sits above nav — correct.

When sheet is OPEN, the nav bar is visually covered by the sheet scrim/backdrop. No explicit hiding needed; the z-index ordering handles it.

### ARIA (AC9)

Pass to `SwipeableDrawer`:
```tsx
PaperProps={{
  role: 'dialog',
  'aria-modal': 'true',
  'aria-label': title,
}}
```

Note: `SwipeableDrawer` renders a `<div role="presentation">` wrapper around Paper. The `role="dialog"` must be on the Paper element specifically (not the outer wrapper) to satisfy screen readers.

### Dependency Note: Story 4.5 Not Yet Implemented

**Story 4.5 is `ready-for-dev` but not yet implemented.** The current `app/layout.tsx` still uses the OLD layout (AppHeader, 100vh, no BPBottomNav). Story 4.6 is isolated — it only creates `BPSheet.tsx` and does not touch `layout.tsx` or the theme. No dependency on Story 4.5 implementation for this story.

However: when creating the temporary test page `app/bpsheet-test/page.tsx`, the layout will still have AppHeader. This is fine — spike testing is isolated to BPSheet behavior, not the full layout.

### File to Create

| File | Action |
|------|--------|
| `bp_front/src/app/BPSheet.tsx` | NEW — the BPSheet component |
| `bp_front/src/app/bpsheet-test/page.tsx` | NEW (temp) — spike test page; DELETE after Task 4 |

No existing files are modified in this story.

### Current File State Check

The following files are relevant but NOT modified in this story:
- `bp_front/src/app/layout.tsx` — currently has AppHeader (pre-4.5); no changes in 4.6
- `bp_front/src/lib/theme.ts` — currently dark theme (pre-4.5); no changes in 4.6; note `theme.custom.bp` does NOT yet exist until 4.5 runs
- `bp_front/package.json` — needs `react-swipeable` added (Task 1)

**Important:** `theme.custom.bp.ter` (used for drag handle color) does not exist yet until Story 4.5 runs. For the spike, use a hardcoded value `rgba(60,60,67,0.3)` inline in the styled component, or make the drag handle color a prop with a default. Add a TODO comment referencing Story 4.5 theme integration.

### UX Spec Reference

From `ux-design-specification-epic-4.md`:
- BPSheet state diagram: `CLOSED → PEEKED → OPEN`, swipe-down collapses by one level at a time
- Drag handle affordance is required to disambiguate sheet swipe from inner list scroll
- `disableDiscovery` and `onTouchStart` guard on inner scroll to prevent iOS momentum from closing sheet
- Tab bar must be hidden or covered when sheet is OPEN — handled by z-index ordering
- `peekHeight` default: 200px
- Sheet content padding: `4px 16px 16px`
- BPSheet governs ALL create/edit/share actions in stories 4.7, 4.8, and beyond

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, the dev agent must verify and explicitly check each item:

- [ ] **Mutation errors surface to the user** — N/A for this story (BPSheet is a pure UI component with no mutations)
- [ ] **Dialog does not close on error** — N/A for this story
- [ ] **Cancel remains interactive during in-flight requests** — N/A for this story
- [ ] **Client-side input validation** — N/A for this story
- [ ] **Concurrent write safety** — N/A for this story
- [ ] **Loading state prevents double-submit** — N/A for this story
- [ ] **State machine re-entrancy** — verify rapid state transitions (peeked → open → peeked within 100ms) do not leave the component in an inconsistent state; add a guard if needed
- [ ] **Sentinel cleanup on unmount** — verify `useEffect` cleanup correctly calls `removeEventListener` and does not leave orphaned history entries
- [ ] **Spike fallback documented** — if any criterion fails, the fallback decision is written in the Dev Agent Record before the story is submitted for review

### References

- [epics.md §Story 4.6 lines 1380–1468] — Full AC list, props interface, technical notes, test requirements (authoritative)
- [ux-design-specification-epic-4.md §BPSheet State Diagram] — State machine transitions, back-gesture, iOS scroll guard
- [ux-design-specification-epic-4.md §Component Strategy §BPSheet] — Implementation risk notes, spike acceptance criteria
- [project-context.md §TypeScript] — strict mode, path alias `@/*`, `"use client"` required (uses hooks)
- [project-context.md §MUI usage] — consult MUI MCP tools before writing/editing MUI components
- [project-context.md §Frontend Code Quality] — all styling via `sx` or `styled()`, no inline `style={}` attributes
- [bp_front/package.json] — `react-swipeable` absent, must install; React 19.2.5, MUI 9.0.0
- [bp_front/src/app/layout.tsx] — current layout (pre-4.5, not modified in 4.6)
- [bp_front/src/lib/theme.ts] — current dark theme (pre-4.5); `theme.custom.bp` not yet available

## Dev Agent Record

### Agent Model Used

### Spike Completion Note

*To be filled in by dev agent after Task 4 (manual spike validation):*

| Criterion | Result | Notes |
|-----------|--------|-------|
| 1. iOS Safari scroll in OPEN does not close | ☐ Pass / ☐ Fail | |
| 2. iOS keyboard viewport push vs focus trap | ☐ Pass / ☐ Fail | |
| 3. PEEKED→OPEN transition < 16ms frame time | ☐ Pass / ☐ Fail | |
| 4. Back-gesture contract (OPEN→PEEKED, PEEKED→CLOSED) | ☐ Pass / ☐ Fail | |

**Fallback decision:** ☐ Not needed (all pass) / ☐ Fallback to MUI Dialog (criteria 1 or 3 failed)

### Debug Log References

### Completion Notes List

### File List
