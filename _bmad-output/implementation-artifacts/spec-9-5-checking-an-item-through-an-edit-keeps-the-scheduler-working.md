---
title: 'Story 9.5: Checking an item through an edit keeps the scheduler working'
type: 'bugfix'
created: '2026-09-18'
status: 'done'
baseline_commit: '1fa3f32f9cc26dbc644f5429f74f2a5cb8e71444'
baseline_revision: '1fa3f32f9cc26dbc644f5429f74f2a5cb8e71444'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: true
warnings: [ oversized ]
deferred:
  - summary: >-
      `saveItem`'s CREATE branch never routes through `applyCheckState`, so a create carrying
      `checked: true` can still write a check state the three fixed paths cannot produce.
    evidence: |-
      The create branch returns the `Item` built by `GqlItemMapper.mapItemFromInput`, which takes
      `checked` from the input and leaves `checkedAt`/`deleted`/`deletedAt` at their defaults. A
      single `saveItem` create with `checked: true, recurring: "WEEKLY"` therefore writes
      `checked = true, checkedAt = null` — the row `findCheckedRecurringItems` returns and
      `runSchedulerCycle` drops at its `checkedAt == null` guard; a create with
      `checked: true, recurring: "ONE_TIME"` is never soft-deleted. Pre-existing and outside this
      story's intent, which names only `checkItem`, `uncheckItem` and `saveItem`'s UPDATE branch.
      No UI path sends `checked: true` on a create today (both add dialogs send false).
    location: >-
      bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt:63-86
    severity: medium
  - summary: >-
      The checked-and-recurring arm of `applyCheckState` does not clear `deleted`/`deletedAt`, so a
      checked ONE_TIME item edited to a recurring cadence stays soft-deleted and is hard-deleted.
    evidence: |-
      `Recurring.WEEKLY, BIWEEKLY, MONTHLY ->` writes only `checked`, `recurring` and `checkedAt`.
      Check a ONE_TIME item (`deleted = true`), then edit it to `recurring: WEEKLY, checked: true`:
      the row keeps `deleted = true`, stays out of `getItems`, and `findSoftDeletedToHardDelete`
      removes it an hour later. The pre-9.5 merge produced the same stranded state, so this is not
      introduced here, but it sits against the story's "one transition table" framing. Since the
      scheduler restore now routes through `applyCheckState`, such a row is at least repaired if it
      survives to its cadence. Settling it means deciding whether a cadence change may resurrect a
      soft-deleted row at all — a product question, not a mechanical fix.
    location: >-
      bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt:180-184
    severity: medium
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
---

<intent-contract>

## Intent

**Problem:** Check state is applied in three different places in `ItemService`. `checkItem` and `uncheckItem` each
hand-roll it, and `saveItem`'s update branch copies `checked` straight from the input while `checkedAt` is
server-owned. So an update that sends `checked: true` against a recurring item whose stored `checkedAt` is null
writes `checked = true, checkedAt = null`: `findCheckedRecurringItems` returns that row, `runSchedulerCycle` drops it
at the `checkedAt == null` guard, and the item is checked off and never restored, forever.

**Approach:** Collapse all three into one private `ItemService.applyCheckState(stored, checked, recurring, now)`
(AR-E9-11) that owns exactly `checked`, `recurring`, `checkedAt`, `deleted` and `deletedAt` and leaves every other
field on the stored row untouched. `checkItem`, `uncheckItem` and `saveItem`'s update branch all route through it, so
no path can produce a check state the others cannot. Separately, rewrite the four factually wrong comments in
`EditItemDialog.tsx` (AR-E9-12) — they still describe `saveItem` as a full-document upsert and cite a closed bug —
with no behaviour change.

## Boundaries & Constraints

**Always:**

- `applyCheckState` is the only writer of `checked`, `checkedAt`, `deleted` and `deletedAt` in `ItemService`. Callers
  pass `now = Instant.now()`; the function never calls the clock itself.
- The merge stays an allowlist: `saveItem`'s update branch copies only `name`, `category`, `store` onto the stored row
  and then applies check state. `addedBy` and every other server-owned field survive (FR58).
- `uncheckItem`'s `requireCategoryOnList` orphan guard runs before any state is applied, and its position and wording
  are unchanged (Story 9.3).
- Existing green tests stay green as written: `ItemLifecycleTest` AC4–AC11, the 7.4 AC1/AC5 cases, and the 9.3 cascade
  and orphan cases.

**Never:**

- No schema, GraphQL, or generated-type change — `ItemInput` and `GqlItem` are untouched, so no `npm run generate`.
- No new UI behaviour, test id, or E2E case: `EditItemDialog.tsx` changes comments only, so the Playwright counts
  ledger gains no row.
- Do not inject a `Clock` into `ItemService` or the scheduler. Tests control time the way the suite already does — by
  backdating the stored `checkedAt` in Mongo (`ItemLifecycleTest.kt:939-943`).
- Do not touch the `store` field: multi-store is Story 9.6's indivisible change.
- Do not close the "orphaned item's edit dialog closes silently" entry — that one still rides FR44 (Story 9.6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit checks a never-checked weekly item | stored WEEKLY, `checked=false`, `checkedAt=null`; save sends `checked: true` | `checkedAt = now`; a scheduler run 7 days later restores it (`checked=false`, `checkedAt=null`) | No error expected |
| Edit of an already-checked weekly item | stored WEEKLY, `checked=true`, `checkedAt=T`; save changes only `name`, or only `recurring` | `checkedAt` stays `T` | No error expected |
| Checked one-timer | `checked=true`, `recurring=ONE_TIME` by any path | `deleted=true`, `deletedAt=now`; row leaves `getItems` | No error expected |
| Checked, no cadence | `checked=true`, `recurring=null` | `checked=true` only; nothing stamped | No error expected |
| Unchecked by any path | `checked=false` | `checkedAt`, `deleted`, `deletedAt` all cleared | `uncheckItem` on an item whose category is gone still throws the unchanged orphan error |
| Merge fidelity | update by a co-member | `addedBy` and every non-input field survive | Category not on the list → unchanged `IllegalArgumentException`, nothing written |

</intent-contract>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/item/ItemService.kt:39-86` -- `saveItem`. The update branch `:51-57` is the bug site: `checked = item.checked`
  is copied with no `checkedAt` consequence. Replace `:51-57` with `applyCheckState(stored.copy(name = item.name,
  category = item.category, store = item.store), item.checked, item.recurring, Instant.now())`. The `:44-48` comment
  block and the whole create branch `:58-81` are unchanged; the `:49-50` comment is rewritten to name
  `applyCheckState`.
- `entity/item/ItemService.kt:95-106` -- `checkItem`: the `when (item.recurring)` at `:98-102` is the transition table
  to move into `applyCheckState`; the call becomes `applyCheckState(item, true, item.recurring, Instant.now())`.
- `entity/item/ItemService.kt:108-129` -- `uncheckItem`: keep `:110` (`getByListId` sync) and the `:112-124` orphan
  guard verbatim; `:125` becomes `applyCheckState(item, false, item.recurring, Instant.now())`.
- `entity/item/ItemService.kt:150-154` -- `requireCategoryOnList`, the neighbour to place `applyCheckState` beside.
  `:156-179` `runSchedulerCycle` -- **read-only**: `:167` is the `checkedAt == null` guard this story stops feeding,
  and `:168` is the restore that must fire on day 7+.
- `entity/item/Item.kt:6-18` -- the five fields at stake: `checked :9`, `recurring :13`, `deleted :15`,
  `deletedAt :16`, `checkedAt :17`. **Read-only.**
- `entity/item/mongo/ItemRepository.kt:51-67` `save` `$set`s every field (so a null `checkedAt` really is persisted),
  `:97-103` `findCheckedRecurringItems` filters on `checked` + cadence only. **Both read-only** — they are why the
  desync is invisible until the scheduler runs.
- `entity/item/gql/GqlItemMapper.kt:25-39` `mapItemFromInput` builds an `Item` with `checkedAt`/`deleted` at their
  defaults — the reason the merge, not the mapper, owns check state. **Read-only.**

**Tests** (`bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt`, 1252 lines)

- `:184-205` `buildItemService(db)` -- the out-of-band service used to drive `runSchedulerCycle` after the HTTP writes.
- `:111-140` helpers `saveItem(token, itemId, catId, listId, name, store, recurring, checked)` and
  `checkItem(...)`; `:906-954` **the template for the new case**: check → edit → backdate `checkedAt` relative to what
  the edit left behind → `buildItemService(db).runSchedulerCycle()` → assert restored. Copy that backdating idiom
  exactly; an absolute `Updates.set` would pass with the bug present.
- Cases that must stay green unchanged: `:282` AC4, `:315` AC5, `:349` AC6, `:382` AC7, `:450`/`:480` AC9, `:512` AC10,
  `:660` and `:697` (7.4 AC1), `:906` (7.4 AC5), `:1205` (9.3 uncheck orphan guard).
- `ListServiceTest.kt`, `ItemApiTest.kt` -- unaffected; run them anyway.

**Frontend** (`bp_front/src/components/EditItemDialog.tsx`, comments only)

- `:34-46` header block -- `:38-43` is wrong twice: `saveItem` is a **merge** of the stored row, not a full-document
  upsert built from the input, and the lifecycle control's blocker (`BUG-E6-2`, "the server-side `checkedAt` reset")
  is closed. Rewrite to describe the merge and `applyCheckState`.
- `:115-119` -- the `nothingChanged` short-circuit comment citing `BUG-E6-1`; `:125-130` -- "a full-document upsert
  turns any stale value into a silent overwrite"; `:140-141` -- "omitting either would reset it to its default
  server-side". All three repeat the upsert premise. Rewrite; the carry-forward of `checked`/`recurring` from the live
  `item` prop `:131,142-143` **stays exactly as it is** and the new comment must say why it still matters.

**Docs**

- `_bmad-output/implementation-artifacts/deferred-work.md:50` and `:53` (the "Rides FR44/FR69" index bullets) and the
  bodies at `:161-181` (7.4 `checked`/`checkedAt` desync) and `:479-499` (7-4 review, four wrong comments) -- close
  **both** in place with the `✅ CLOSED by Story 9.5 (2026-09-18): … Was: …` idiom used at `:40-46`. Leave the
  `:51-52` orphan-dialog bullet open.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:119` -- `9-5-…: backlog` → reconcile at story close.

## Tasks & Acceptance

**Execution:**

- [x] `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` -- **written FIRST, run red.** Add, following the
  `:906-954` idiom: (a) a never-checked WEEKLY item checked **through `saveItem`** (`checked: true`, no prior
  `checkItem`), backdated 8 days, restored by `runSchedulerCycle` — this is the regression case and it must fail on
  the current code; (b) a checked WEEKLY item with `checkedAt` T saved with only a new `name`, then saved with only a
  changed `recurring` value — `checkedAt` reads T both times; (c) a save that checks a `recurring: null` item stamps
  nothing (`checkedAt` stays null, `deleted` false); (d) an edit that unchecks a checked item clears `checkedAt`,
  `deleted` and `deletedAt`; (e) `addedBy` survives every one of the above. Record the red run output.
- [x] `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt` -- add
  `private fun applyCheckState(stored: Item, checked: Boolean, recurring: Recurring?, now: Instant): Item`
  implementing the AR-E9-11 table; route `checkItem`, `uncheckItem` and `saveItem`'s update branch through it; rewrite
  the `:49-50` merge comment to name it. No other behaviour change.
- [x] `bp_front/src/components/EditItemDialog.tsx` -- rewrite the four comment sites (`:34-46`, `:115-119`, `:125-130`,
  `:140-141`) to describe the merge and `applyCheckState`. Zero behavioural diff: same JSX, same handlers, same
  carry-forward.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close the two entries in place, index bullets and
  bodies, leaving the orphan-dialog entry open.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- set `9-5-…` at story close.

**Acceptance Criteria:**

- Given `checkItem`, `uncheckItem` and `saveItem`'s update branch, when any of them changes check state, then all
  three reach it through the one private `applyCheckState`, and no `checked`/`checkedAt`/`deleted`/`deletedAt`
  assignment remains outside it.
- Given the full backend suite, when it runs after the change, then every pre-existing case passes unmodified.
- Given `EditItemDialog.tsx`, when the story closes, then `git diff` on it shows comment lines only, and no comment
  cites `BUG-E6-2` or calls `saveItem` a full-document upsert.
- Given the two deferred-work entries named above, when the story closes, then both are marked closed in place and the
  orphan-dialog entry is still open.

## Spec Change Log

## Review Triage Log

### 2026-09-18 — Review pass

- verdicts: 32 findings — high 0, medium 17, low 14, false 1, maybe-false 0
- findings:
  - `[medium]` `[defer]` `saveItem`'s create branch bypasses `applyCheckState` — verified: the create branch returns the mapper-built item, so a create with `checked: true` writes `checkedAt = null`; pre-existing and outside the intent's named surface (update branch only). Deferred.
  - `[medium]` `[defer]` A checked ONE_TIME item edited to a recurring cadence keeps `deleted = true` — verified against the recurring arm; identical to pre-9.5 behaviour, so not caused by this change. Deferred.
  - `[low]` `[reject]` A checked recurring item edited to ONE_TIME keeps a stale `checkedAt` — real but inert: `findCheckedRecurringItems` filters on the cadence, and the row is soft-deleted, which is exactly what the intent mandates for a checked one-timer.
  - `[medium]` `[patch]` `deletedAt = now` unconditional restarted the one-hour purge window on every save of a checked one-timer — patched to `if (stored.deleted) stored.deletedAt ?: now else now`.
  - `[medium]` `[patch]` `runSchedulerCycle` still hand-wrote check state, falsifying the KDoc's "only writer" claim and leaving `deleted`/`deletedAt` set on a restored row — patched to route through `applyCheckState`.
  - `[low]` `[patch]` The KDoc's ownership sentence listed four fields while the helper writes five — patched to name `recurring` too.
  - `[medium]` `[patch]` The ONE_TIME leg of the save path and the two clock fixes were untested — patched: three cases added (soft-delete through a save plus purge-clock stability, scheduler restore clearing the soft delete, fresh stamp over a stale clock). The BIWEEKLY sub-point was rejected: it shares a `when` arm with WEEKLY.
  - `[low]` `[reject]` `epic-9-context.md` was rewritten wholesale and lost some requirement bullets — the file is a regenerable cache compiled from `planning-artifacts/`, which remains the source of truth; this run regenerated it because a planning artifact was newer, as the workflow requires.
  - `[low]` `[patch]` The frontend header asserted the missing lifecycle control is "a product decision, not a blocked one", which no artifact records — patched to say it is still deferred and no longer blocked.
  - `[low]` `[reject]` Spec metadata (`oversized` warning, empty logs, Code Map line numbers) — the fix would edit this build's spec.
  - `[low]` `[reject]` New tests never close the `MongoClient` from `connectToDb()` — the file's established idiom across ~20 existing cases; fixing it here alone buys nothing.
  - `[low]` `[reject]` `shouldNotContain` asserts against the whole response body — the file's established idiom; the new cases also assert the parsed Mongo document.
  - `[medium]` `[patch]` `deletedAt` restamped on re-save of a soft-deleted one-timer — same defect as the row above; patched with it.
  - `[medium]` `[defer]` Cadence change off ONE_TIME leaves `deleted = true` — same defect as the deferred row above.
  - `[low]` `[reject]` WEEKLY→ONE_TIME while checked soft-deletes the row and keeps a stale `checkedAt` — the soft-delete is exactly what the intent prescribes for a checked one-timer; the stale clock is unread on that row.
  - `[low]` `[reject]` Checked with `recurring = null` keeps prior residue — the intent explicitly says nothing is stamped for a cadence-less checked item.
  - `[medium]` `[patch]` `checkedAt = stored.checkedAt ?: now` reused a stale clock on a row that was not checked (the legacy `checked = false` + non-null `checkedAt` shape the pre-9.5 merge produced), so the next scheduler cycle would un-check it at once — patched to key the reuse on `stored.checked`.
  - `[low]` `[reject]` `saveItem` acts on soft-deleted rows without a guard — pre-existing and deliberate: `ItemLifecycleTest` 7.4 AC1 asserts an edit preserves a soft delete. A new guard would break it.
  - `[medium]` `[patch]` `checkItem` silently stopped stamping `now` unconditionally — same defect as the stale-clock row; patched with it and covered by the new `checkItem` case.
  - `[medium]` `[patch]` The "only writer" claim was false while `runSchedulerCycle` assigned directly — same defect as the scheduler row; patched with it, and the claim is now true.
  - `[medium]` `[patch]` The ONE_TIME branch of the new save path was exercised by no test that would see it (deleting the arm left the suite green) — patched with the new soft-delete-through-save case.
  - `[medium]` `[patch]` The scheduler restore was not asserted to clear `deleted`/`deletedAt` — patched with the seeded-row scheduler case.
  - `[medium]` `[patch]` `deletedAt` asymmetry against the `checkedAt` reasoning — same defect as the restart row; patched with it.
  - `[medium]` `[defer]` Recurring arms leave the soft-delete residue — same defect as the deferred cadence-change row.
  - `[medium]` `[patch]` The frontend header claimed `checkedAt`/`deleted`/`deletedAt` "survive untouched", true only of `addedBy` after this change — patched: those three are now described as derived by `applyCheckState`.
  - `[low]` `[reject]` Time is controlled by rewinding the persisted `checkedAt` rather than an injected clock — no bad outcome: the rewind is relative to what the write left behind, so the regression case is genuinely red under the bug, and it exercises the scheduler's real threshold arithmetic.
  - `[low]` `[patch]` "By any path" was asserted only through `saveItem` — patched: the new cases drive `checkItem` and the scheduler restore as well.
  - `[medium]` `[patch]` `checkItem`'s unconditional stamp changed with no covering test — same defect as the stale-clock row; patched and covered.
  - `[medium]` `[patch]` `deletedAt` restart contradicts the story's own anti-restart rationale — same defect as the restart row; patched with it.
  - `[low]` `[reject]` `epic-9-context.md` rewrite exceeds the intent's documentation clause — same reasoning as the rejection above: regenerable compiled cache.
  - `[low]` `[patch]` The frontend comments added claims beyond "describe the merge" — patched for the lifecycle-control sentence; the substituted `nothingChanged` rationale was verified true (`saveItem` emits unconditionally) and left.
  - `[false]` `[reject]` "Verification is self-reported; the diff carries no run evidence" — disproved in this pass: the full backend suite (149/149), `npm run lint` and `npm run build` were run here, and the frontend diff was machine-checked as comment-only.


## Design Notes

**What `applyCheckState` owns.** It returns `stored.copy(...)` setting exactly `checked`, `recurring`, `checkedAt`,
`deleted`, `deletedAt`. Taking `recurring` as a parameter *and* writing it is deliberate: `saveItem` may change the
cadence in the same call that changes check state, and the branch must be chosen by the **incoming** cadence, not the
stored one. `checkItem`/`uncheckItem` pass `stored.recurring`, so for them it is a no-op write.

```kotlin
private fun applyCheckState(stored: Item, checked: Boolean, recurring: Recurring?, now: Instant): Item =
    if (!checked) stored.copy(checked = false, recurring = recurring, checkedAt = null, deleted = false, deletedAt = null)
    else when (recurring) {
        Recurring.ONE_TIME -> stored.copy(checked = true, recurring = recurring, deleted = true, deletedAt = now)
        Recurring.WEEKLY, Recurring.BIWEEKLY, Recurring.MONTHLY ->
            stored.copy(checked = true, recurring = recurring, checkedAt = stored.checkedAt ?: now)
        null -> stored.copy(checked = true, recurring = recurring)
    }
```

**Why `checkedAt = stored.checkedAt ?: now` and not `= now`.** An edit must not restart the cadence clock, or renaming
a checked weekly item every day would postpone its restore indefinitely. `checkItem` gets the same treatment: checking
an already-checked item is a no-op on the clock, which is what AC5 already asserts.

**Why `now` is a parameter, not a `Clock`.** The single call site per caller is `Instant.now()`; the suite controls
time by rewinding the stored `checkedAt` after the write (`ItemLifecycleTest.kt:939-943`), which tests the scheduler's
real threshold arithmetic. Injecting a clock would change `ItemService`'s constructor and every test that builds it,
for no additional coverage.

## Verification

**Commands:**

- `./gradlew :bp_back:test --tests "com.bagplease.ItemLifecycleTest"` -- expected: red before the `ItemService` change
  (new case (a) fails on `checked=true, checkedAt=null`), fully green after.
- `./gradlew :bp_back:test` -- expected: all green, no pre-existing case edited.
- `cd bp_front && npm run lint && npm run build` -- expected: clean; comment-only frontend diff.
- `git diff --stat bp_front/src/components/EditItemDialog.tsx` -- expected: comment lines only.

## Auto Run Result

Status: done

**Implemented change.** `ItemService` gained one private `applyCheckState(stored, checked, recurring, now)`
(AR-E9-11) that writes exactly `checked`, `recurring`, `checkedAt`, `deleted` and `deletedAt`. `checkItem`,
`uncheckItem`, `saveItem`'s update branch and (after review) `runSchedulerCycle`'s restore all route through it, so no
path can produce a check state the others cannot. The defect it closes: an edit sending `checked: true` against a
recurring row with a null `checkedAt` used to write `checked = true, checkedAt = null`, which
`findCheckedRecurringItems` returns and `runSchedulerCycle` drops forever. Both clocks are kept for a row already in
the state being applied and stamped otherwise, keyed on `stored.checked` / `stored.deleted`. The four factually wrong
comments in `EditItemDialog.tsx` were rewritten (AR-E9-12) with no behavioural change.

**Files changed.**

- `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt` — `applyCheckState` plus the four call sites.
- `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` — seven new cases (four planned, three from review).
- `bp_front/src/components/EditItemDialog.tsx` — comment-only rewrite of the four wrong sites.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the Story 7.4 `checkedAt` entry and the 7-4 review
  comments entry closed in place; the orphan-dialog entry left open.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `9-5-…` moved off `backlog`.
- `_bmad-output/implementation-artifacts/epic-9-context.md` — regenerated by this run because a planning artifact was
  newer than the cache.

**Review findings.** 32 findings across four layers: 6 grouped entries patched (5 at `medium`, 1 at `low`), 2 entries
deferred (both `medium`, recorded in frontmatter `deferred`), 24 rows rejected or grouped into those entries. Rejected
with reason: the stale `checkedAt` on a soft-deleted one-timer (inert — filtered by cadence); the `epic-9-context.md`
rewrite, twice (regenerable compiled cache, planning artifacts remain the source of truth); spec metadata and Code Map
line numbers (the fix would edit this build's spec); unclosed `MongoClient`s and whole-body `shouldNotContain` (the
file's established idioms); a WEEKLY→ONE_TIME edit soft-deleting the row and a cadence-less checked row keeping residue
(both exactly what the intent prescribes); a guard against editing soft-deleted rows (7.4 AC1 asserts the opposite);
the rewound-clock test technique (no bad outcome — the rewind is relative to the write, so the regression case is
genuinely red under the bug); BIWEEKLY coverage (shares a `when` arm with WEEKLY); and "verification is self-reported",
disproved by the runs below.

**Follow-up review recommended: true.** Five `medium` entries were patched on a first pass. The specific unverified
risk: the two clock reuses now key on `stored.checked` / `stored.deleted`, and the deferred "cadence change off
ONE_TIME keeps `deleted = true`" state is the one row shape where those two flags disagree with the cadence — no test
constructs it, so the interaction between that residue and the new clock rules is unexercised. Patched counts: high 0,
medium 5, low 1.

**Verification.**

- `mise run back:test` — 149 tests, 149 passed, 0 failed, 0 skipped (146 before the story; every pre-existing case
  unmodified). The implementation agent recorded each new case red first.
- `cd bp_front && npm run lint && npm run build` — both clean.
- `git diff 1fa3f32f -- bp_front/src/components/EditItemDialog.tsx` filtered for non-comment changed lines — 0 lines,
  confirming the comment-only requirement.
- Matrix audit: every I/O row is covered by a case that ran and passed in the 149-test run.

**Residual risks.** The two deferred entries above (the create branch, and the soft-delete residue on a cadence
change). Neither is reachable from the UI today: both add dialogs send `checked: false` on a create, and a cadence
change on a checked one-timer requires an edit of a row that is already invisible on both screens.
