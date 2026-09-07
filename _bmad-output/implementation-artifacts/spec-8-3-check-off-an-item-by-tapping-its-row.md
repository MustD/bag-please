---
title: 'Story 8.3: Check Off an Item by Tapping Its Row'
type: 'feature'
created: '2026-09-07'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: 'bf92619b9d625cf6eb405f53e468e591ed10174c'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      MOVE_TOLERANCE_PX = 10 — the threshold that decides whether a one-handed tap in a shop
      registers as an activation or is discarded as a scroll — is validated only in Chromium
      emulation, never against real hardware.
    evidence: |-
      The value is the figure the spec named; the FR60 scroll-guard spec exercises it with a
      synthetic 170px CDP drag and a stationary tap, which are the two extremes, not the margin.
      What would settle it: hold a real phone, check items off one-handed while walking, and
      record how far the pointer actually travels on an intended tap versus the start of a scroll.
      If real taps routinely drift past 10px, the guard silently swallows deliberate check-offs.
    location: >-
      bp_front/src/routes/ListShoppingPage.tsx (MOVE_TOLERANCE_PX)
    severity: medium (unverified)
  - summary: >-
      Four admin specs go flaky on the mobile project in a full-suite run because the shared
      test database has accumulated 5,490 users and the admin panel is unpaginated.
    evidence: |-
      Not caused by this story — it touches no admin surface and `git diff` shows no change to
      admin code or specs. Measured 2026-09-07 against the compose stack: users 5490, lists 3988,
      refresh_tokens 7287. The failure is always `createUserViaUi` timing out on
      `expect(create-user-dialog).toHaveCount(0)` while the refetch renders the whole table; the
      same specs pass in isolation and pass on retry (`--retries=2`: 0 failed, 4 flaky). This is
      the already-OPEN "AdminUsers is unpaginated" item reaching the gate rather than a new defect.
      What would settle the product half: pagination, or a suite that prunes its own users.
    location: >-
      bp_front/e2e/admin.spec.ts:49 (createUserViaUi)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** On `/list/:id` the ~40px `Checkbox` is the only thing that toggles an item; the name, store chip,
`addedBy` avatar and all the space between them are inert in a 300px+ row. One-handed, in a shop, that is the wrong
target (FR60, report #1, UX-DR-E8-1).

**Approach:** Make the row itself the single control — one accessible name, one checked state, one tab stop, one
mutation per activation — with the `Checkbox` demoted to a presentational indicator. `handleToggle` takes the next
state explicitly instead of reading it off a DOM event (AR-E8-4). Because a tap and the start of a scroll are the same
gesture, activation is pointer-based with a movement threshold so a scroll begun on a row never checks an item.

## Boundaries & Constraints

**Always:**
- The row is a control, never a control **containing** a control. After the change no interactive element remains
  inside the row: exactly one tab stop, one accessible name (``Toggle ${item.name}``, moved off the checkbox onto the
  row), one checked state.
- Activation is by pointer down/up with a small movement threshold, **plus** a keyboard handler (Space and Enter).
  Do **not** also attach `onClick` — a `click` fires after a moved touch and would both double-fire and defeat the
  scroll guard.
- The row keeps its default `touch-action`: it must still scroll.
- Reuse `CheckItemMutation` / `UncheckItemMutation` unchanged. Failure behaviour is preserved exactly: the normalised
  cache is untouched, the indicator reverts to server state on its own, the reason surfaces in the existing inline
  `shopping-action-error` alert.
- **Selector decision (settles the open "shopping-checkbox selector split" in `deferred-work.md`): one selector.**
  The row keeps `data-testid={`shopping-item-${item.name}`}` and *is* the checkbox; the
  `shopping-item-checkbox-${item.name}` testid is deleted. All 10 `getByTestId('shopping-item-…').getByRole('checkbox')`
  sites and `navigation.spec.ts:257` become the row locator itself — a descendant `getByRole('checkbox')` no longer
  matches anything and would fail silently as a `toHaveCount(0)`-style pass in some phrasings, so every site must be
  visited, not grepped past.
- Every new assertion is manually exercised and observed failing against the pre-fix build before acceptance
  (NFR-E8-6), except assertions that are guards which hold pre-fix by construction — those are labelled as guards at
  their call site (the Story 8.2 exemption).

**Never:**
- No change under `bp_back/`; `git diff bp_back/` must be empty. No schema change, no codegen.
- No optimistic UI flip — the indicator stays server-state driven.
- No toast, snackbar or banner (epic-wide, UX-DR-E8-10).
- The store chip and the `addedBy` avatar do **not** become affordances of their own; the row is now a closed
  extension surface (AR-E8-8a).
- No new filter, ordering or layout work — 8.4/8.5 own those.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stationary tap on any row region | unchecked item; pointer down/up within threshold on name, chip, avatar, or gap | `checkItem` issued exactly once; row renders checked | No error expected |
| Second stationary tap | checked item | `uncheckItem` issued exactly once; row renders unchecked | No error expected |
| Keyboard | row focused, Space or Enter | toggles exactly once; page does not scroll on Space | No error expected |
| Scroll started on a row | pointer down, move past threshold, up (mobile project, real touch) | checked state unchanged; **zero** check/uncheck requests | No error expected |
| `pointercancel` mid-gesture | browser takes the gesture over | pending activation discarded | No error expected |
| Mutation rejects | server returns an error | cache untouched; indicator reverts to server state; message in `shopping-action-error` | Existing `graphqlErrorMessage` path, unchanged |
| One-timer item checked | item seeded with `recurring: ONE_TIME` | `SAVED` with `deleted: true` arrives; the row disappears, exactly as through the checkbox today | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/routes/ListShoppingPage.tsx` -- **the whole change.**
  - `:237` `handleToggle(item, event: ChangeEvent<HTMLInputElement>)` reads `event.target.checked`. New signature takes
    the next state explicitly (`handleToggle(item, nextChecked)`); call sites pass `!item.checked`. Drop the now-unused
    `ChangeEvent` import if nothing else uses it (`MouseEvent` is still used by `handleCheckedFilter` at `:253`).
  - `:408-412` the row `Box` (`display:flex`, `alignItems:center`, `gap:1.5`, `px:2`, `py:1`) carrying
    `data-testid={`shopping-item-${item.name}`}` — this element becomes the control: `role="checkbox"`,
    `aria-checked={item.checked}`, `tabIndex={0}`, ``aria-label={`Toggle ${item.name}`}``, pointer + key handlers,
    and a focus-visible outline plus `cursor: 'pointer'` / `userSelect: 'none'`.
  - `:413-418` the `Checkbox` — MUI always renders a real `<input>`, so it cannot stay: replace with presentational
    `CheckBoxIcon` / `CheckBoxOutlineBlankIcon` (`@mui/icons-material`, matching the current ~40px box and
    primary-when-checked colour). Delete the `Checkbox` import and the `shopping-item-checkbox-…` testid.
  - `:419-441` name Typography + `shopping-item-store-…` chip, `:443-455` `shopping-item-addedby-…` Stack — unchanged
    markup; they are the "any part of the row" regions AC1 asserts individually.
  - `:88-108` the `ItemUpdates` `updateQuery` (`drop = type === 'DELETED' || item.deleted`) — **read-only**; AC5 proves
    it still fires through the new surface.
- `bp_front/e2e/shopping.spec.ts` -- **change.** 7 `getByRole('checkbox')` sites (`:31,:43,:46,:83,:192,:198` and the
  `:37` click) migrate to the row locator. Home for the new FR60 specs.
- `bp_front/e2e/item-editing.spec.ts` -- **change.** `:216`, `:233`.
- `bp_front/e2e/navigation.spec.ts` -- **change.** `:253` already holds `row`; `:257` drops the separate testid.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `createListAndOpen`, `addCategory`,
  `addItem`, `openListsViaMenu`, `PASSWORD`, `uniqueUsername`.
- `bp_front/e2e/support/api.ts` -- **reuse, do not change.** `loginApi` + `gql` seed the ONE_TIME item (AC5);
  `saveItem(item: {id,name,checked,category,listId,recurring:"ONE_TIME"})` is the shape (`GqlItemInput`).
- `bp_front/playwright.config.ts` -- **read-only.** The `mobile` projects keep `devices['Pixel 7']`'s touch emulation
  at 320px; AC4's real gesture depends on it. `test.skip(testInfo.project.name !== 'mobile', …)` is the established
  project guard (see `e2e/narrow-viewport.spec.ts`).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- **change.** Close the "Shopping-checkbox selector split"
  item with the decision recorded above.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/shopping.spec.ts` -- add the FR60 specs (four-region toggle, single-tab-stop/single-name/single-state,
  one-mutation-per-activation by request count, keyboard, mobile scroll guard + stationary-tap control, one-timer
  removal) and run them **first, red**, against the pre-fix build -- NFR-E8-6.
- `bp_front/src/routes/ListShoppingPage.tsx` -- rework `handleToggle` to take `nextChecked` explicitly -- AC3.
- `bp_front/src/routes/ListShoppingPage.tsx` -- make the row the single control (role/aria/tabIndex/label, pointer +
  key activation with movement threshold and `pointercancel` reset) and demote the checkbox to a presentational icon
  -- AC1, AC2, AC4.
- `bp_front/e2e/shopping.spec.ts`, `bp_front/e2e/item-editing.spec.ts`, `bp_front/e2e/navigation.spec.ts` -- migrate all
  10 checkbox reaches to the row locator -- the selector decision; each site visited, not sed'd.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close the selector-split item with the decision.
- spec Implementation Notes -- record the observed pre-fix reds, the post-fix greens, and the measured request counts
  -- AC6.

**Acceptance Criteria:**
- Given a row ≥300px wide, when a stationary activation lands on the name, the store chip, the `addedBy` avatar, or the
  empty space between them, then the item toggles — each of the four regions asserted individually.
- Given the row, when it is inspected, then it exposes exactly one accessible name (``Toggle ${item.name}``), one
  checked state and one tab stop; no `checkbox`-role descendant and no focusable descendant remain inside it.
- Given a focused row, when Space or Enter is pressed, then the item toggles exactly once.
- Given a single pointer activation, when the network is observed, then exactly **one** check-or-uncheck request is
  issued — counted, not inferred from the settled state, since a check+uncheck double-fire settles correct while being
  wrong.
- Given the `mobile` project, when a real touch goes down on a row, moves past the threshold and lifts, then the
  checked state is unchanged and no check/uncheck request is issued; and a stationary touch in the same test still
  toggles, so the guard is proven not to have over-fired.
- Given a `recurring: ONE_TIME` item seeded via the API, when the row is activated, then the `SAVED`+`deleted:true`
  subscription path removes the row exactly as it does through the checkbox today.
- Given the completed story, when the suite runs on `chromium` and `mobile` against the production image, then it is
  green, `npm run lint` and `npm run build` pass, and `git diff bp_back/` is empty.

## Spec Change Log

## Review Triage Log

### 2026-09-07 — Review pass

- verdicts: 37 findings — high 11, medium 8, low 15, false 2, maybe-false 1
- findings:
  - `[medium]` `[patch]` `role="checkbox"` + `aria-label` on the row is children-presentational, so the store chip and `addedBy` are announced by nothing — real: ARIA grades `checkbox` Children Presentational: True, and the author label also displaces name-from-content. Fixed with `aria-describedby` on a visually-hidden span (`Store: X. Added by Y`), which keeps the accessible name exactly `Toggle ${item.name}` that AC2 pins.
  - `[high]` `[patch]` `onPointerUp` filters on neither `e.button` nor `e.isPrimary`, so right/middle-click toggles the item — confirmed; the removed `Checkbox` answered only to primary activation. Both handlers now return early on non-primary button or pointer.
  - `[medium]` `[patch]` held Space repeat-fires one mutation per key repeat, and the notes' "not a regression" claim is wrong — confirmed by the verification-gap layer in this project's own Chromium (native `<input>` = 1 activation, the handler = 5). `e.repeat` is now ignored.
  - `[low]` `[patch]` nothing tied the VISIBLE indicator to the checked state; every assertion read `aria-checked` — real coverage gap on the only visual signal. A new spec compares the icon geometry and colour across a toggle plus the name's `text-decoration-line`.
  - `[high]` `[patch]` the regenerated `epic-8-context.md` deleted the `## Reports` section against an explicit in-file "carry this section across" note — confirmed in the diff. The regeneration was reverted wholesale; the file is back to its hand-maintained state.
  - `[high]` `[patch]` the regenerated 320px constraint dropped the measured-clipping exception, contradicting shipped, ratified Story 8.2 behaviour — confirmed. Resolved by the same revert.
  - `[medium]` `[patch]` `epic-8-context.md` was rewritten wholesale inside a Story 8.3 diff, declared nowhere in the story — real, and it is how the Reports section was lost once before. Same revert; the file no longer appears in this diff at all.
  - `[low]` `[reject]` the AC's "row ≥300px" premise is relaxed to 270px on the `mobile` project — real disagreement, but its only fix is to edit this build's spec, which triage does not do.
  - `[low]` `[reject]` the Spec Change Log is empty and the Code Map still calls `playwright.config.ts` read-only — same reason: the fix edits this build's spec.
  - `[low]` `[patch]` the three documents disagree on where the migrated selector sites are, and `deferred-work.md` cites `navigation.spec.ts:316` for a testid that is at `:257` — real. The closure note was corrected against the measured diff (7/2/1).
  - `[low]` `[reject]` six `waitForTimeout(500)` settle windows were added — real dead time, but `expect.poll` to 1 passes the moment the first request lands and would stop proving that no SECOND one follows, which is the whole point of the counted assertions. The fix trades the assertion away.
  - `[low]` `[reject]` the two CDP sessions are never detached and the payload is cast `as never` — real, but the sessions die with the test process and the fix adds a `finally` plus a type import for no user- or developer-visible harm.
  - `[low]` `[reject]` `userSelect: 'none'` removes text selection without a recorded rationale — real behaviour change, but the only fix is documenting it in this build's spec.
  - `[low]` `[reject]` `seedItems` interpolates names into GraphQL unescaped and issues serial round trips — setup-only, with fully controlled inputs (`Filler N <timestamp>`); escaping adds a helper for a case nothing reaches.
  - `[high]` `[patch]` right/middle-click toggles the item (non-primary button) — same defect as above; grouped, one fix.
  - `[medium]` `[patch]` a pointer released off the row leaves `down.current` populated, so a later stray `pointerup` on that row is measured against a stale origin — real; the row took no pointer capture. `setPointerCapture` on `pointerdown` now pairs down/up strictly.
  - `[medium]` `[patch]` `e.repeat` burst — same defect as the held-Space finding; grouped.
  - `[high]` `[patch]` a second simultaneous finger measures the first `pointerup` against the wrong origin — same root cause as the button finding (no primary-pointer filter); grouped, resolved by the `isPrimary` guard.
  - `[high]` `[patch]` a bare synthetic `click` — what assistive-technology and voice activation dispatch — did nothing, because activation was `pointerup` + `keydown` only. Confirmed from the handlers: no `click` listener existed. An `onClick` gated on `e.detail === 0` now handles it without double-firing on real clicks (detail ≥ 1) or defeating the scroll guard (a moved touch produces no click).
  - `[low]` `[reject]` a second activation before the first mutation resolves sends `checkItem` twice where the old control sent check-then-uncheck — real divergence, but the outcome is idempotent server-side, visible on screen, corrected by another tap, and the fix adds a pending-state ref.
  - `[low]` `[patch]` Space/Enter with Ctrl/Meta/Alt held also toggles, where the keystroke belongs to the browser or OS — real; folded into the keydown patch already being made, so it cost one condition.
  - `[high]` `[patch]` the deleted `## Reports` section — same finding as above; grouped.
  - `[false]` `[reject]` "`playwright.config.ts` is an undeclared file touched" — the file's own comment mandates a dated row per test-count change, so editing it is required, not a deviation; the arithmetic was independently confirmed correct.
  - `[low]` `[patch]` the `deferred-work.md` closure's per-file breakdown misstates where the sites were — same finding as above; grouped.
  - `[medium]` `[patch]` (pre-verified) held Space fires N mutations — grouped with the keydown entry; the layer demonstrated 1 vs 5 in the bundled Chromium.
  - `[high]` `[patch]` (pre-verified) right- and middle-click toggle the row — grouped with the button entry; the layer demonstrated two handler firings.
  - `[medium]` `[patch]` stale pointer origin with no pointer capture — grouped with the capture entry.
  - `[high]` `[patch]` the 320px rule lost its filed exception — grouped with the epic-context entry. The same layer refuted the *orphan* half of the Reports claim (the numbering is also defined at `epics.md:1663`), but the in-file instruction not to drop the section stands, so the revert was made anyway.
  - `[low]` `[patch]` `deferred-work.md` still points at `ListShoppingPage.tsx:451` for the `noWrap` + numeric-cap construct, which this change moved — real; corrected to the measured line.
  - `[false]` `[reject]` the layer's closing "verified as accurate, for the record" block (selector closure complete, no stray testid, collection invariant correct) — not a finding; independently re-confirmed here.
  - `[high]` `[patch]` intent-alignment: activation lives at the pointer surface while the intent's expectations live at the platform-activation surface, so AT activation is unreachable — grouped with the synthetic-click entry.
  - `[medium]` `[patch]` intent-alignment: the container `aria-label` suppresses the subtree the intent treated as row content — grouped with the `aria-describedby` entry.
  - `[low]` `[reject]` intent-alignment: the movement guard is pointer-type-agnostic, so a drifting mouse press is inert and `userSelect: none` removes selection — grouped with the userSelect entry; documenting it edits this build's spec.
  - `[low]` `[reject]` intent-alignment: AC1's 300px premise does not hold on the project representing the real user — grouped with the 270px entry; same reason.
  - `[low]` `[reject]` intent-alignment: AC6's evidence exists only as prose in Implementation Notes — true of every story in this repo's format, and the fix edits this build's spec.
  - `[maybe-false]` `[defer]` intent-alignment: `MOVE_TOLERANCE_PX = 10` is validated only in emulation, and it decides whether a shaky one-handed tap registers — cannot be settled without a physical device; deferred as medium (unverified) with what would settle it.

## Design Notes

Activation, kept in one handler so the guard cannot be bypassed by a second path:

    const down = useRef<{x: number; y: number} | null>(null)
    const MOVE_TOLERANCE_PX = 10
    onPointerDown={e => {down.current = {x: e.clientX, y: e.clientY}}}
    onPointerCancel={() => {down.current = null}}
    onPointerUp={e => {
      const start = down.current; down.current = null
      if (!start) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) return
      void handleToggle(item, !item.checked)
    }}
    onKeyDown={e => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      void handleToggle(item, !item.checked)
    }}

`down` is per-row state; hooks cannot be called inside the `groups.map` callback, so extract the row into a small
component in the same file rather than reaching for a `useRef` in a loop.

Counting mutations in a spec — assert the count, never the settled state:

    let calls = 0
    page.on('request', r => {
      if (r.method() === 'POST' && r.url().includes('/api/graphql') &&
          /checkItem|uncheckItem/.test(r.postData() ?? '')) calls++
    })

## Verification

**Commands:**
- `cd bp_front && npx playwright test --retries=0` -- expected: green, no new skips.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `git diff --stat bp_back/` -- expected: empty.

**Manual checks:**
- `/list/:id` on desktop and at 320px: tap the gap between name and avatar; scroll a long list by dragging from a row;
  Tab through the list and confirm one stop per row; a screen reader announces one name and one state per row.

## Implementation Notes

### The pre-fix reds (NFR-E8-6)

The six FR60 specs were written and run FIRST, against the build of `bf92619`
(`docker compose up -d --build`, production image on :2080). Command:

    cd bp_front && npx playwright test shopping.spec.ts --retries=0 --grep "FR60" --reporter=line

Result: **11 failed, 1 skipped, 0 passed** (6 specs x 2 viewport projects, minus the mobile-only scroll-guard
test which skips on `chromium`). Every failure was on the behaviour under test, not on setup:

| Spec | Pre-fix failure |
|------|-----------------|
| stationary activation on ANY region | `expect(row).toBeChecked()` after clicking the item name — the name was inert |
| the row is ONE control | `expect(row).toHaveRole('checkbox')` — *Received: ""* (the row was a bare `div`) |
| Space and Enter | `expect(row).toBeChecked()` after `keyboard.press(' ')` on the focused row |
| exactly ONE request | `expect(row).toBeChecked()` after `row.click()` |
| touch-scroll guard (mobile) | `expect(row).not.toBeChecked()` — *"Not a checkbox or radio button"* |
| ONE_TIME removal | `expect(row).toBeVisible()` held, then `row.click()` removed nothing |

Note the shape of the scroll-guard red: pre-fix its *drag* half was vacuously true (nothing toggled because
nothing could toggle), and it failed on the assertion that the row is a checkbox at all. Its
falsifiability comes from the **stationary-touch half in the same test**, which is what proves post-fix that the
guard did not simply refuse every gesture.

### The post-fix greens and the measured counts

Same command after the change, rebuilt image: **10 passed, 1 skipped, 1 failed** — the scroll-guard test, and the
failure was in the *test*, not the app. The drag half passed (`scrollY > 0`, row still unchecked, **0** requests);
the stationary tap that follows it missed, because the touch fling keeps scrolling after `touchEnd` and had carried
the row **out of the viewport** by the time `boundingBox()` was read — confirmed by inserting
`expect(row).toBeInViewport()`, which reported *viewport ratio 0*. Fixed in the spec by scrolling the row back
(`scrollIntoView({block: 'center'})`), waiting for two consecutive equal `scrollY` reads, and only then tapping.

Measured mutation counts (`page.on('request')` filtered to `POST /api/graphql` whose body matches
`/checkItem|uncheckItem/`, read after a 500 ms settle so a racing second request cannot land after the read):

| Activation | check/uncheck requests |
|------------|------------------------|
| one `row.click()` (check) | **1** |
| second `row.click()` (uncheck) | **2** cumulative |
| Space on the focused row | **1** |
| Enter on the focused row | **2** cumulative |
| touch drag past the 10px threshold | **0** |
| stationary `touchscreen.tap` after that drag | **1** |

The last two are the whole point of the pointer-based activation: the same row, the same finger down, and only the
gesture that stayed put fires a mutation.

### Full-suite verification

- `cd bp_front && npx playwright test --retries=0` — **163 passed, 17 skipped, 0 failed** (1.2 min), against the
  production image on :2080.
- `npm run lint` — exit 0. `npm run build` (`tsc -b && vite build`) — exit 0.
- `git diff -- bp_back/` — **empty** (0 lines). No schema change, no codegen.
- Collection invariant: `180 = 89 / 89 / 1 / 1` (was `168 = 83 / 83 / 1 / 1`; +6 untagged tests x 2 runs = +12).
  **17 skips: 16 chromium** (15 mobile-only narrow-viewport + the new FR60 touch-scroll guard) **and 1 mobile**
  (the above-the-breakpoint header test). Recorded as a dated row in `playwright.config.ts` — that file's own
  comment requires a row per change, and the Code Map's "read-only" was read as "no behavioural config change",
  which this is not.

### Decisions taken while implementing

- **`ShoppingItemRow` is a new component in the same file.** `down` (the pointer-down origin) is per-row state and
  hooks cannot be called inside the `groups.map` callback. The row markup moved verbatim; only the outer `Box` and
  the checkbox changed.
- **The MUI `Checkbox` is gone entirely**, replaced by `CheckBoxIcon` / `CheckBoxOutlineBlankIcon` with `m: 1`
  (24px icon + 8px margin = the ~40px box the `Checkbox` occupied), `color="primary"` when checked and
  `color="action"` when not — the same two colours the `Checkbox` used. It cannot merely be made non-focusable:
  MUI always renders a real `<input>`, which is a control inside a control.
- **No `onClick`.** A `click` still fires after a moved touch, so attaching it would both double-fire alongside
  `onPointerUp` (breaking the counted-requests AC) and defeat the scroll guard.
- **`touch-action` untouched**, so the row still scrolls; the guard is entirely in the JS movement threshold.
- Focus is visible via `&:focus-visible` with a `-2px` inset outline, so the ring is not clipped by the row divider.

### Not done / risks

- **The scroll-guard test drives CDP `Input.dispatchTouchEvent` directly**, because Playwright's `touchscreen` API
  only taps. This is the same input pipeline a real touch uses (it really scrolls the page, which is the point),
  but it is a lower-level API than the rest of the suite uses and is Chromium-specific.
- **`MOVE_TOLERANCE_PX = 10` is not tuned against real hardware.** It is the spec's figure and it separates a
  deliberate tap from a scroll in emulation; a shaky hand on a real phone has not been measured.
- ~~**Holding Space repeats.**~~ **Wrong, and fixed at review.** A native `<input type=checkbox>` activates ONCE for
  a held key; this handler fired once per repeat, so it was a regression against the removed control AND a breach of
  the one-mutation-per-activation contract. `e.repeat` is now ignored, as are Ctrl/Meta/Alt-modified Space and Enter
  (those keystrokes belong to the browser or the OS). Covered by
  *"holding Space autorepeats the key but issues exactly ONE request"*, which drives CDP `Input.dispatchKeyEvent`
  with `autoRepeat: true` — Playwright's keyboard API cannot set that flag.
- The manual checks in Verification (screen-reader announcement, physical device) were **not** performed; the
  accessible-name/role/state and single-tab-stop assertions in `shopping.spec.ts` stand in for the first, and the
  `mobile` project at the 320px floor for the second.

### Matrix test audit — two rows closed after the implementation pass

The I/O matrix's `pointercancel` and *mutation rejects* rows had no covering test in the implementation pass; both
were added and the suite re-run:

- **`FR60 — a pointercancel discards the pending activation`** (mobile only). CDP `touchStart` then `touchCancel` on
  a **stationary** touch, so the 10px threshold is provably not what saves it — a `pointerup` never arrives. Asserts
  the row is unchecked with **0** requests, then that a normal tap afterwards still toggles (**1**), proving the
  cancel cleared the pending origin rather than wedging the row.
- **`FR60 — a rejected check leaves the row unchecked and surfaces the reason inline`** (both projects).
  `page.route` fails **only** `checkItem`, letting every other operation through so the normalized cache stays live.
  Asserts the exact backend message in `shopping-action-error` and that the row reverted to server state.

Both are labelled **GUARD** at their call site under the NFR-E8-6 exemption ratified at Story 8.2 review Pass 2: the
pointercancel branch did not exist pre-fix (pre-fix every assertion errors on "not a checkbox", for an unrelated
reason), and the failure path is preserved behaviour that held pre-fix by construction.

**Final verification (after these two tests):**

- `cd bp_front && npx playwright test --retries=0` — **166 passed, 18 skipped, 0 failed** (1.3 min), production
  image on :2080.
- `npm run lint` — exit 0. `npm run build` — exit 0. `git diff -- bp_back/` — empty.
- Collection invariant updated to `184 = 91 / 91 / 1 / 1` (+8 untagged FR60 tests x 2 runs = +16 against 168);
  **18 skips: 17 chromium** (15 narrow-viewport + the touch-scroll guard + the pointercancel guard) **and 1 mobile**.
  The dated row in `playwright.config.ts` was corrected to match.

### Review round 1 — fixes and their evidence

Six defects, all in `ListShoppingPage.tsx`'s activation and accessibility, plus the specs that now pin them:

1. **Non-primary buttons and pointers activated the row.** A right-click, a middle-click or a second simultaneous
   finger toggled the item; the MUI `Checkbox` answered only to a primary activation. Both pointer handlers now
   return early on `e.button !== 0 || !e.isPrimary`.
2. **`down.current` could go stale.** The row took no pointer capture, so a gesture starting on row A and released
   elsewhere left A's origin populated, and a later stray `pointerup` on A was measured against it.
   `setPointerCapture` on `pointerdown` (in a `try`, since the pointer may already be gone) makes down/up strictly
   paired on the same element.
3. **Held Space fired one mutation per repeat** — see the corrected risk entry above.
4. **The row was dead to assistive technology.** Activation was `pointerup` + `keydown` only, so the bare synthetic
   `click` that AT and voice control dispatch did nothing. An `onClick` gated on `e.detail === 0` handles exactly
   that case: every click from a real mouse or finger carries `detail >= 1`, so there is no double-fire with
   `onPointerUp`, and a moved touch produces no click at all, leaving the scroll guard untouched.
5. **The store chip and `addedBy` name were announced by nothing.** `role="checkbox"` makes children presentational
   and the author-supplied `aria-label` displaces name-from-content. They are restored as the row's accessible
   DESCRIPTION (`aria-describedby` → a visually-hidden span reading `Store: X. Added by Y`), which is a separate
   computation and so leaves the accessible NAME exactly `Toggle ${item.name}`.
6. **Nothing tied the VISIBLE indicator to the checked state.** Every assertion went through `toBeChecked()`, which
   reads `aria-checked`; deleting the icon swap or the strikethrough would have left the suite green with an
   identical-looking row. The new indicator test compares the icon's `path` geometry AND its computed colour across
   the toggle, plus the name's `text-decoration-line`. It reaches the icon by a new
   `shopping-item-indicator-<name>` testid rather than MUI's own icon `data-testid`, because MUI strips those in a
   production build and the suite runs against the production image.

**All three new behavioural guards were observed RED against the pre-review handlers**, not merely asserted: the four
fixes were temporarily reverted in `ListShoppingPage.tsx`, the image rebuilt, and
`--grep "non-primary|holding Space|bare synthetic"` reported **3 failed** on `chromium` — the non-primary test on
`expect(row).not.toBeChecked()` receiving *"checked"*. Restored and rebuilt, the same three are green.

Post-fix run of everything touching the edited files —
`npx playwright test shopping.spec.ts item-editing.spec.ts navigation.spec.ts --retries=0` — **86 passed, 2 skipped,
0 failed**. `npm run lint`, `npx tsc -b` and `npm run build` all exit 0.

`deferred-work.md` corrections in the same round: the closure note said `shopping.spec.ts x5` where the diff migrates
**7** sites there (10 total, counted off the diff), and repeated the pre-existing entry's stale
`navigation.spec.ts:316` for the dedicated testid, which was at **`:257`**. Separately, the `noWrap` + numeric-cap
entries named `ListShoppingPage.tsx:451`; extracting `ShoppingItemRow` moved that construct — the `addedBy`
attribution `Typography` — to **`:215`**, and `:451` is now the back link (not a category-filter `MenuItem`, as the
review note guessed). All three corrected against the measured file.


## Auto Run Result

Status: done

### What was implemented

The shopping-view item row on `/list/:id` is now a single control. The row element carries
`role="checkbox"`, `aria-checked`, `tabIndex={0}` and the accessible name `Toggle ${item.name}`;
the MUI `Checkbox` — which always renders a real `<input>`, i.e. a control inside a control — is
replaced by a presentational `CheckBoxIcon` / `CheckBoxOutlineBlankIcon`. Activation is
pointer-based with a 10px movement threshold (so a scroll begun on a row never checks an item),
plus a keyboard handler and a synthetic-click handler for assistive technology.
`handleToggle(item, nextChecked)` takes the next state explicitly instead of reading it off a DOM
event. Mutations, the normalized cache and the inline `shopping-action-error` failure path are
untouched. `git diff bp_back/` is empty.

### Files changed

- `bp_front/src/routes/ListShoppingPage.tsx` — new `ShoppingItemRow` component; the row is the
  control; presentational icons; explicit-next-state handler; primary-button/primary-pointer
  guards; pointer capture; auto-repeat and modifier guards; synthetic-click handling;
  `aria-describedby` carrying store + `addedBy` to assistive technology.
- `bp_front/e2e/shopping.spec.ts` — 12 FR60 specs, and 7 checkbox reaches migrated to the row.
- `bp_front/e2e/item-editing.spec.ts`, `bp_front/e2e/navigation.spec.ts` — the remaining 3 reaches.
- `bp_front/playwright.config.ts` — the dated collection-invariant row the file's own comment requires.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the shopping-checkbox selector split
  closed with the "one selector, the row" decision; two stale line references corrected.

### Review findings

37 findings across four layers → 11 high, 8 medium, 15 low, 2 false, 1 maybe-false; grouped into
8 patched entries (3 high, 4 medium, 1 low), 2 deferred, and 14 rejected. Every rejection and its
reason is recorded row-by-row in the Review Triage Log above; the rejections fall into three
groups: fixes that would edit this build's spec (the 300px premise, the empty change log, the
`userSelect` note, AC6's prose evidence), low-value test hygiene whose fix would weaken an
assertion or add complexity for no reachable harm (the settle windows, CDP detach, `seedItems`
escaping, double-activation), and one finding refuted outright (`playwright.config.ts` is required
reading, not an undeclared edit).

Patched: non-primary button/pointer activation (high), assistive-technology activation via a bare
click (high), the epic-context regeneration that destroyed hand-maintained content (high), the
children-presentational loss of store/`addedBy` (medium), auto-repeat and modified keystrokes
(medium), the stale pointer origin (medium), the unasserted visible indicator (low), and the
stale `deferred-work.md` references (low).

### Follow-up review recommended: true

Three high entries were patched on a first pass. The specific unverified risk: the
assistive-technology activation path is asserted only by `el.click()` in Chromium and the
`aria-describedby` text has never been heard by a screen reader, so whether real AT and voice
control reach this row — the thing the single-control rule exists for — remains untested. The
spec's manual screen-reader check was not performed.

### Verification

- `npx playwright test --retries=0` on this story's surface
  (`shopping`, `item-editing`, `navigation`, `narrow-viewport`): **104 passed, 18 skipped, 0 failed**.
- Full suite, `--retries=2` (CI's own setting): **0 failed, 4 flaky, 164 passed, 18 skipped**. The
  four flaky are `admin.spec.ts` on the mobile project, deferred above as a pre-existing
  unpaginated-admin-table problem at 5,490 accumulated users — not this story's surface, and they
  pass in isolation. At `--retries=0` the full suite fails on those admin specs and only those.
- `npm run lint` exit 0; `npm run build` exit 0; `git diff -- bp_back/` empty.
- Collection invariant re-measured, not quoted: `192 = 95 / 95 / 1 / 1`, 18 skips (17 chromium, 1 mobile).
- The three new behavioural guards were observed red before acceptance: the four handler fixes were
  temporarily reverted and the image rebuilt, and the non-primary, held-Space and synthetic-click
  specs each failed on the behaviour under test.

### Residual risks

- **One regression was introduced by the patch pass and caught here, not by the patch author's own
  run:** the visually-hidden description span used MUI's `sx` `width: 1`, which is the 0-1
  shorthand for `100%`, and scrolled the page horizontally at the 320px floor
  (`scrollWidth 352 > clientWidth 320`). Fixed to explicit pixels with a comment. It was caught
  only because the full suite was re-run against a rebuilt image — the patch pass ran the touched
  spec files against a stale container.
- The E2E suite reuses a running `:2080` stack (`reuseExistingServer`), so a code change is
  invisible to it until the image is rebuilt. Any future run that verifies without
  `docker compose up --build` is testing the previous bundle.
- `MOVE_TOLERANCE_PX` and the AT activation path are both deferred/flagged above.
