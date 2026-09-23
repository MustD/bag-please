# Deferred Work

> **Ledger rule (from the Epic 5 retro, 2026-07-28):** anything deferred "to a later story" must be recorded HERE, not
> only in a story file or dev-auto spec. This file is the ledger both workflows read.
>
> **Triaged 2026-09-07.** This file now holds OPEN items only. Everything resolved, superseded or closed by decision
> was moved to `deferred-work-archive.md`, which is a frozen byte-for-byte snapshot of the pre-triage ledger — go
> there for the history an entry references (struck-through closures, corrections recorded at review, quoted
> measurements). No BMad skill globs that filename. Line-number cross-references between entries (`831`, `812`, `836`
> …) were written against the pre-triage file and now resolve only against the archive.
>
> **Scoped for Epic 9 on 2026-09-15.** Twelve closed / decided / moot entries moved to the archive's dated section
> at its end. Entries pulled into Epic 9 are indexed in "Routed to Epic 9" below and **stay open in place** until the
> Epic 9 story that owns them closes them.
>
> **Second pass, 2026-09-15.** `md` ruled on every entry NOT routed to Epic 9: 153 were archived by decision
> (the archive's second 2026-09-15 addendum, grouped by source section) and three more were routed to Epic 9. What
> remains open outside the index is a short list — mostly items an Epic 9 story is expected to settle in passing, plus
> three kept deliberately. Cross-references from a surviving entry to a moved one resolve only against the archive.
>
> **Format for new entries** (`bmad-build` step-02/step-04/step-oneshot, `bmad-code-review` step-04): append, do not
> edit existing entries, do not look for duplicates.
> ```markdown
> - source_spec: `{spec_file}`
>   summary: <one sentence>
>   evidence: <why this is real; for a maybe-false finding, what evidence would settle it>
> ```

## Routed to Epic 9 — User Feedback Pass (scoped 2026-09-15 by md)

Scope source: `prd.md` → "Epic 9 — User Feedback Pass (Planned)". Each entry named here stays OPEN in its own section
below; this is an index, not a copy. Anything NOT named here stays deferred. Find entries by section and summary, not by
line number.

**Rides FR13 (admin user list pagination):** ✅ ALL THREE CLOSED by Story 9.2 (2026-09-16).

- ✅ CLOSED by Story 9.2 (2026-09-16): `users(limit, offset, around): UserPage` replaces the unpaginated field and
  `/admin` pages at 20; the gate half ships as `e2e/global-teardown.ts`. Was: Epic 7 close-out — `AdminUsers` is
  unpaginated; the product half is delivered by FR13 and the gate half (**D4**, per-run E2E data hygiene) ships with it.
- ✅ CLOSED by Story 9.2 (2026-09-16): the per-run sweep ends the growth that drove the flake, and pagination removes the
  full-table re-render the dialog close waited on. Was: Stories 7.8 + 7.9 — the size-driven `createUserViaUi` flake
  (mechanism behind D4).
- ✅ CLOSED by Story 9.2 (2026-09-16): the `/admin` username cell's cap is removed (the name wraps) and
  `narrow-viewport.spec.ts` now asserts the floor on `/admin`. Was: Story 8.2 + its review — the `/admin` username cell
  `noWrap` cap (`AdminPage.tsx`) and the missing floor assertion on `/admin`. The `/lists` half of those entries is NOT
  routed; `md` closed it by decision in the second 2026-09-15 pass.

**Rides FR44/FR69 (multiple stores per item — the story edits `EditItemDialog.tsx` and `saveItem`):**

- ✅ CLOSED by Story 9.5 (2026-09-18): all four comment sites in `EditItemDialog.tsx` rewritten to describe the merge
  and `applyCheckState`; no comment cites `BUG-E6-2` or calls `saveItem` a full-document upsert, and the
  `checked`/`recurring` carry-forward is kept with the new comment saying why it still matters. Was: Code review of
  7-4 — the four factually wrong comments in `EditItemDialog.tsx`.
- ✅ CLOSED by Story 9.6 (2026-09-20): `EditItemDialog.validate()` now rejects a category id that is not in
  `categories` (`isKnownCategoryId`, `src/lib/lists/categoryChoice.ts`), so an orphan's untouched save keeps the
  dialog open with `Choose a category` on the field instead of closing silently. Was: Story 8.6 (carried from 8.5) —
  an orphaned item's edit dialog closes silently when saved without touching the category.
- ✅ CLOSED by Story 9.5 (2026-09-18): one private `ItemService.applyCheckState(stored, checked, recurring, now)` is
  now the single writer of `checked`/`checkedAt`/`deleted`/`deletedAt`, and `checkItem`, `uncheckItem` and `saveItem`'s
  update branch all route through it, so no path can produce `checked = true` with a null `checkedAt`. Was: Story 7.4 —
  `saveItem` can write `checked = true` with a null `checkedAt`; stamp `checkedAt` on a false→true merge.

**Rides FR61 (confirm control on the category filter):** ✅ BOTH CLOSED by Story 9.8 (2026-09-22).

- ✅ CLOSED by Story 9.8 (2026-09-22): `groupItemsByCategory` takes an optional `selectedCategoryIds` and keeps a
  category rendered, even with zero matching items, when its id is in that list — `/lists/:id` passes
  `filter.categoryIds` on every call, so filtering explicitly to an empty category no longer drops its card or its
  add-item affordance. `/list/:id` never passes it: the shopping view still hides every empty group regardless of
  selection. Was: Epic 8 retro **F2** — filtering `/lists/:id` to an empty category drops its card and add-item
  affordance.
- ✅ CLOSED by Story 9.8 (2026-09-22): only the synthetic "Uncategorized" bucket's row testid changed, from
  `category-row-<name>`/`shopping-group-<name>` to the key-based `category-row-__uncategorized__`/
  `shopping-group-__uncategorized__` — so a real category a member types as "Uncategorized" can no longer collide with
  it. Every real category keeps its name-based testid unchanged; no reserved-name rule was added to `saveCategory`.
  Was: Epic 8 retro **F5** — `Uncategorized` is not a reserved name (relates to, but does not close, the Story 8.4
  name-keyed testid entry, which `md` archived by decision in the second 2026-09-15 pass).

**Rides FR57 (home entry in the account menu):** ✅ ALL CLOSED by Story 9.7 (2026-09-21).

- ✅ CLOSED by Story 9.7 (2026-09-21): Home is the account menu's first entry (`menu-home`), so an empty `/lists` no longer leaves the user without a Home or Lists entry in the installed PWA. On `/lists` itself both resolve to the page the user is already on — the exits that actually leave it are creating a list, Change password and Logout. Was: Story 7.5 — an empty `/lists` is one menu away from a dead end in the installed PWA.
- ✅ CLOSED by Story 9.7 (2026-09-21): the cache-first question is closed as leave-as-is (`md`, 2026-09-15): observe mode stays `cache-only`. The unreachable `error` branch is now gated on `mode === 'resolve'`. Was: Code review of 7-5 — the cache-first home-link design question for `md`, and the unreachable `error` branch in observe
  mode.
- ✅ CLOSED by Story 9.7 (2026-09-21): `useHomePath`'s error branch is gated on `mode === 'resolve'`; observe mode falls through to `!data` and answers `null`. Was: Code review of epic-7-context — `useHomePath`'s `if (error)` precedes `if (!data)`.

**Backend fixes riding the Epic 9 backend unfreeze (FR44/FR69, FR66/FR67):**

- ✅ CLOSED by Story 9.3 (2026-09-17): `CategoryService.deleteCategory` cascades server-side (soft-deleted rows
  included), emits only the category `DELETED` event, and the client loop is gone. Was: Story 8.5 — the orphan
  CAUSE: `deleteCategory` cascades to its items server-side and the client loop is deleted.
- ✅ CLOSED by Story 9.4 (2026-09-18): `UserAdminMutations.deleteUser` now runs `adminDeleteUser` →
  `ListService.purgeUser` → `invalidateUserSessions`, so a deleted user leaves no `list_members` row in any status, is
  stripped from lists they did not own, and the lists they owned are cascade-deleted. Was: Code review of 7-6 —
  `adminDeleteUser` strands the user's `list_members` rows (also the second leak path under the Story 7.6 standing
  assumption).

**Own story — E2E harness readiness:**

- ✅ CLOSED by Story 9.1 (2026-09-15): the webServer now waits on `:2080/api/health`. Was: Epic 8 retro **F20** +
  Epic 5 close-out "Playwright `webServer` gaps" + code review of 7-1 cold-start entry — wait for real readiness.
- ✅ CLOSED by Story 9.1 (2026-09-15): `GET /api/health` ships. Was: Story 7.12 — there is still no backend health
  endpoint.

**Own story — small cleanups:** ✅ ALL CLOSED by Story 9.12 (2026-09-23).

- ✅ CLOSED by Story 9.12 (2026-09-23): `.idea/dataSources.xml` is gitignored and untracked (`git rm --cached`); the
  file stays on disk. Was: Epic 8 retro **F19b** — untrack `.idea/dataSources.xml`.
- ✅ CLOSED by Story 9.12 (2026-09-23): `codegen.ts` is added to `tsconfig.node.json`'s `include`; `tsc -b` now
  type-checks it. Was: Story 7.1 + code review of 7-8/7-9 — `codegen.ts` is in no tsconfig project.
- ✅ CLOSED by Story 9.12 (2026-09-23): every stale `./db/data` mention in `docs/` and `bp_front/e2e/` now describes
  the `db_data` named volume. Was: Code review of 7-8/7-9 — `./db/data` survives as a stale path in docs and E2E
  comments.
- ✅ CLOSED by Story 9.12 (2026-09-23): the redundant trailing `Unit` in `UserService.changePassword` is deleted; the
  block's last expression is `repository.save(...)`. Was: Story 7.12 — the redundant trailing `Unit` in
  `UserService.changePassword` (Kotlin 2.4 warning).
- ✅ CLOSED by Story 9.12 (2026-09-23): `dev-dist` is added to `bp_front/.gitignore` and the ESLint `ignores` array.
  Was: Code review of 7-14 — `dev-dist/` is not gitignored (routed in the second 2026-09-15 pass).
- ✅ CLOSED by Story 9.12 (2026-09-23): `ListStorage.delete()` is deleted (zero callers; `ListService.cascadeDeleteList`
  always bypassed it). Was: Code review of 4-1 — `ListStorage.delete()` is dead code (routed in the second
  2026-09-15 pass).
- ✅ CLOSED by Story 9.12 (2026-09-23): the four unconsumed `custom.bp.*` tokens (`bg2`, `card2`, `sheetBg`, `stripe`)
  are deleted from `theme.ts` and its module-augmentation type; `DESIGN.md` §3 and §11.2 updated. Was: Story 8.7 —
  four `custom.bp.*` theme tokens are declared and unconsumed; adopt or delete them (routed in the second
  2026-09-15 pass).

## Epic 7 close-out (2026-08-21)

Full context: `epic-7-retro-2026-08-21.md`. Only the rows that are still open are kept here; the closed rulings (the
7.14 device install, the `autoUpdate` tab reload, the `main`-behind-production gap) are in the archive.

- ✅ CLOSED by Story 9.2 (2026-09-16): both halves shipped together — `users(limit, offset, around): UserPage` with a
  20-per-page `/admin` pager, and `e2e/global-teardown.ts`, which deletes every `_e2e_` user a run created (so the next
  run starts at the same table size, and the rows already banked are drained). `sprint-status.yaml` action **D4** is
  `done`.
  Was: ⏸ **`AdminUsers` is unpaginated — the product half is BACKLOG, the gate half is Epic 7 action `D4` and is OPEN.**
  The defect is real for any admin with a large user table, not merely a test-harness annoyance. **The gate half is NOT
  covered by the backlog routing**: the users table grows ~120 rows per full suite run, the create-user dialog measured
  **5015 ms against a 5000 ms assertion at 5497 rows**, and clearing the database only restarted the clock. Per-run data
  hygiene is owed regardless of when pagination happens. Mechanism and measurements: see the Stories 7.8 + 7.9 entry
  below. `sprint-status.yaml` action item **D4**, owner Murat, status `open`.

## Epic 5 close-out — carried forward (2026-07-28)

Full context: `epic-5-retro-2026-07-28.md`. The other rows in this section were closed across Epics 6 and 7 and are in
the archive.

- ✅ CLOSED by Story 9.1 (2026-09-15): compose runs in the foreground (`--abort-on-container-failure`, stderr piped,
  SIGTERM stop at teardown with the volume kept) and `webServer.url` is `:2080/api/health`, which only a warm Ktor with
  a pingable Mongo answers 200. Not closed: a failed start (e.g. a port-bind error on bp_front) still leaves `mongo`
  and `bp_back` running, deferred in the Story 9.1 spec's story record.
  Was: **Playwright `webServer` gaps, carried since Epic 3** (still unaddressed after the Epic 5 harness rebuild, re-verified
  2026-09-07 at `playwright.config.ts:64-74`): no teardown command (containers accumulate across runs), the `url`
  health check only proves the entrypoint responds — not that Ktor is warm inside the container (first tests can see
  502) — and no `stdout`/`stderr` filtering, so a compose startup failure silently burns the 600 s timeout before
  surfacing. This entry is the rollup; the concrete run it cost is filed under Story 7.1's review below, and the
  duplicate Epic-3 filings are in the archive.

## Deferred from: Story 7.1 — E2E suite inside the frontend quality gates (2026-08-07)

- ✅ CLOSED by Story 9.12 (2026-09-23): `codegen.ts` is added to `tsconfig.node.json`'s `include`; `tsc -b` now
  type-checks it, exit 0. Was: **`codegen.ts` is still inside no tsconfig project.** `tsconfig.app.json` covers
  `src`, `tsconfig.node.json` covers `vite.config.ts`, and `tsconfig.e2e.json` covers `e2e` + `playwright.config.ts`
  — `codegen.ts` is the one remaining root file that `tsc -b` never sees (re-verified 2026-09-07). It *is* linted
  (the widened `eslint .` picks it up) but it is not type-checked. Deliberately out of Story 7.1's scope
  (Decision 8). Low severity — the file is 44 lines of codegen config. Fix by adding `codegen.ts` to
  `tsconfig.node.json`'s `include`; **verified sufficient on its own** — no `types` change is needed alongside it
  (`tsc -b` exits 0), contrary to this entry's first draft.

### Surfaced by the Story 7.1 code review (2026-08-07)

- ✅ CLOSED by Story 9.1 (2026-09-15): `docker compose up` now runs in the foreground, so a healthy start never "exits
  early", and Playwright waits on `/api/health` (see `spec-9-1-the-test-run-waits-until-the-backend-is-ready.md`).
  Was: source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `npm run test:e2e` cannot reliably cold-start — Story 7.1's green run was obtained via `reuseExistingServer`
  after the documented command aborted, so the headline evidence is not reproducible by that command on a clean machine.
  evidence: the first invocation failed with `Error: Process from config.webServer exited early.` because
  `docker compose up -d --build` returns once containers are *started*, before Caddy answers on `:2080`; the stack was
  then hand-verified healthy (`/` → 200, `/api/graphiql` → 401) and the suite re-run against the same freshly built
  production image, giving 104/104. This is the concrete, now-observed consequence of the long-standing "Playwright
  `webServer` gaps, carried since Epic 3" entry above — recorded separately because that entry describes the gap in the
  abstract and this is a run it actually cost. A `webServer.url` health check that waits for real readiness would fix it.

## Deferred from: Story 7.4 — an item edit merges the stored item (2026-08-10)

Story 7.4 turned `ItemService.saveItem` into a **merge**: it loads the stored row with
`storage.getByIdCached(item.id, item.listId)` and, when the row exists, `copy()`s onto it only the five fields
`ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`). The direction is deliberate — copying the
input **onto** the stored row is an allowlist, so a field added to `Item` later is preserved by default. BUG-E6-1 and
BUG-E6-2 are closed (archive); BUG-E6-3 is partial. What follows is what the story knowingly did **not** take, plus one
thing the merge newly makes possible. All re-verified against `ItemService.kt` on 2026-09-07.

- ✅ **CLOSED by Story 9.5 (2026-09-18):** one private `ItemService.applyCheckState(stored, checked, recurring, now)`
  is the single check-state transition, and `checkItem`, `uncheckItem` and `saveItem`'s update branch all route through
  it — so the merge can no longer manufacture a state the other two cannot. The answer taken is the third one this
  entry names, refined: on a checked recurring row the merge writes `checkedAt = stored.checkedAt ?: now`, which stamps
  the clock on a false→true edit **without restarting** it on a rename, so editing a checked weekly item daily no
  longer postpones its restore. Unchecking through any path clears `checkedAt`, `deleted` and `deletedAt` together.
  `recurring` is passed in and written, so a cadence change in the same call picks the branch by the **incoming**
  cadence. The merge stays an allowlist of `name`, `category`, `store`, so `addedBy` and every other server-owned field
  still survive. Regression coverage: `ItemLifecycleTest` "9.5 an item checked through an edit still feeds the
  scheduler" (observed red before the change) plus three sibling cases. The `EditItemDialog.tsx` carry-forward is
  unchanged and still required — `checked`/`recurring` remain input-owned. Was:

- **`saveItem` can write `checked` inconsistently with the server-owned `checkedAt`, and the scheduler then ignores the
  item forever.** `checked` **is** in `ItemInput` while `checkedAt` is server-owned, so the merge can manufacture states
  neither `checkItem` nor `uncheckItem` produces. **The harmful state is `checked = true` with a null `checkedAt`.**
  `findCheckedRecurringItems` *returns* that row (it filters on `checked == true` and the cadence only), and
  `runSchedulerCycle` then drops it at `if (item.checkedAt == null || …) continue` (`ItemService.kt:120`) — checked
  off, never restored, on every cycle forever. The merge produces it whenever an update carries `checked: true` against
  a recurring row whose stored `checkedAt` is null, i.e. one created recurring and never checked through `checkItem`.
  **The mirror state (`checked = false` with a stale non-null `checkedAt`) is inert** — that is the restored, visible
  state, the scheduler has nothing to restore, and the next `checkItem` overwrites `checkedAt`. Note the harmful state
  is **not a regression** — the pre-merge reconstruct nulled `checkedAt` on every save, so it was the norm — but it is
  the state a fix must actually target, and the obvious remedy ("clear `checkedAt` on a true→false transition") does
  **not** close it. A third coherent answer belongs on the list: stamp `checkedAt = now()` when the merge transitions
  `checked` false→true on a recurring item, which is what `checkItem` already does.
  **No UI path produces either state today:** `EditItemDialog.tsx` carries `checked` and `recurring` forward from the
  **live** `item` prop specifically so an edit cannot reset them, and it says so in a comment. Filed rather than fixed
  because closing it means deciding whether `saveItem` may un-check an item **at all** — which is `uncheckItem`'s job,
  and `uncheckItem` deliberately clears `checkedAt` as part of the scheduler contract. **Direct consequence for
  FR42/FR43:** the one-timer / recurring UI is unblocked (see the Epic 5 close-out entry above), but it must not
  introduce the first UI path that sends `checked: true` for a recurring item without going through `checkItem`.

## Deferred from: Story 7.5 — home resolution and the inert home link (2026-08-11)

- ✅ CLOSED by Story 9.7 (2026-09-21): Home is now the account menu's first entry (`menu-home`, closes the menu on the home route), so the menu carries both a Home and a Lists entry on an empty `/lists` (both are no-ops there; the exits that leave the page are creating a list, Change password and Logout). Was: **`/lists` for a user with no lists is a route whose only exits are the user menu and creating a list.** For that
  user home resolves *to* `/lists`, so the title link is correctly inert there, and `/lists` has no back affordance of
  its own — leaving `user-menu-button` as the single in-app navigation control on the screen. Harmless in a browser
  tab, but **Story 7.14 shipped the PWA, whose standalone display removes both the URL bar and the browser Back
  button**, and the `exits` test asserts the user menu as the affordance of record precisely because it is load-bearing
  there. An empty `/lists` in an installed app is one menu away from being a dead end.

- **The observe mode is cache-only, so on a cold `Lists` cache the link is briefly LIVE on the very route it resolves
  to** — one wasted click in a window measured in milliseconds, after which the answer is known and the link goes
  inert. Chosen deliberately over letting the app bar issue its own membership-gated `lists` request (UX-DR-E7-4's
  fail-toward-navigating direction). **This is observable in the suite and explains a real measurement:** with the guard
  deliberately made to over-fire, three of the four existing link-activating tests went red on both projects, but
  `FR38 — activating the title link with no lists lands on the lists index` stayed green — it reaches
  `/account/password` by a full page load, which resets the Apollo cache, and nothing on that route queries `Lists`, so
  the observed path is `null` and the link is live regardless of the guard. Consequence for future authors: a test that
  means to exercise the inert state must arrive at the route through IN-APP navigation, or warm the cache first. A
  `goto` is not equivalent. See also the design question filed under the 7.5 review below.

## Deferred from: Story 7.6 — backend safety fixes riding the same unfreeze (2026-08-12)

Story 7.6 closed four Epic-4 review entries under the epic's scoped backend unfreeze (all struck through in the
archive). What follows is the residue it deliberately did **not** take on. All re-verified against `bp_back/` on
2026-09-07.

- **STANDING ASSUMPTION (`md`'s ruling, 2026-07-29), not debt: production is assumed to hold no already-orphaned
  `list_members` rows, and Story 7.6 shipped no migration, backfill or cleanup script.** The cascade fix prevents *new*
  orphans from list deletion only. **If an orphaned `list_members` row is ever observed in production it is a NEW
  finding and must not be triaged as a regression of this story.** Orphans are invisible through the API
  (`ListService.getLists` `mapNotNull`s them away), so detection needs a direct query: compare
  `db.list_members.distinct("listId")` against `_id` on `lists`.
  **Narrowed by Story 9.4 (2026-09-18) to ALREADY-STRANDED ROWS ONLY.** The second leak path this paragraph used to
  describe — `adminDeleteUser` stranding every membership row a deleted user held — is closed: `deleteUser` now runs
  `ListService.purgeUser` between the user delete and session invalidation, and no code path leaks a `list_members` row
  any more. What survives of the assumption is only the no-backfill part: rows stranded by either path BEFORE their fix
  shipped are still in the database, and Story 9.4 shipped no migration, backfill or cleanup script for them either. A
  row stranded by a user deletion is keyed by a live `listId`, so the `db.list_members.distinct("listId")` vs
  `lists._id` query above cannot see it; that one needs `db.list_members.distinct("userId")` compared against `_id` on
  `users`. **A NEWLY created orphan from either path is a regression and must be triaged as one.**

## Deferred from: Stories 7.8 + 7.9 — @types/node 26 and Vite 8 (2026-08-13)

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  ✅ CLOSED by Story 9.2 (2026-09-16): the mechanism is gone on both sides — `/admin` renders at most 20 rows (the
  dialog's close no longer waits on a full-table re-render), and `e2e/global-teardown.ts` deletes every `_e2e_` user a
  run created, so the table stops growing instead of merely being cleared. Of the three candidates recorded below, the
  first (a table-independent assertion) was NOT taken and the other two were, in their non-destructive form: a teardown
  SWEEP rather than a database reset, because it keeps the `db_data` volume, needs no privileged docker step in
  `webServer`, and drains the rows earlier runs banked. No retry loop was added.
  Was: summary: **The `createUserViaUi` flake is SIZE-DRIVEN, not random, and its mechanism is measured.** The admin panel
  renders **every** user row in the persistent database (`AdminUsers` at `bp_front/src/lib/admin/adminQueries.ts:21` is
  unpaginated), and the create-user dialog's close is gated behind that re-render. At **~5.5k** user rows a
  no-other-load probe measured **5015 ms** to close against `admin.spec.ts:49`'s **5000 ms** `toHaveCount` timeout. As
  the table grows, the suite fails more and more often under 12-worker parallel load. This is a hard blocker on the
  E2E gate and is Epic 7 action **D4** (owner Murat, `open`).
  **Do not restore the words "deterministic" or "monotonic".** 5015 ms against a 5000 ms budget is a **0.3 % margin
  measured once**, so the failure is probabilistic and load-sensitive; the cited `3 → 2 → 2 → 4 → 8` progression is not
  monotonic and two full **green** runs occurred *after* a red one at **larger** row counts. What is established is the
  direction and the mechanism, not a cliff.
  evidence: verbatim, on every failing run in that pass — `Error: expect(locator).toHaveCount(expected) failed /
  Locator: getByTestId('create-user-dialog') / Expected: 0 / Received: 1 / Timeout: 5000ms` at `admin.spec.ts:49:56`.
  A no-other-load Playwright probe against the running `:2080` stack measured: `admin page visible in 66 ms`,
  `first user row rendered in 2199 ms`, `row count 5497`, `create-user dialog closed in 5015 ms`. `2 did not run` on
  every red run: the `registration-toggle-*` pair is `dependencies`-chained behind `chromium`/`mobile`.
  **Attribution is settled and it is not the Vite 8 upgrade** — after `md` cleared the database, the **unchanged**
  Vite 8 tree passed `120 passed` **twice consecutively** at `retries: 0`, with the served bundle confirmed as the
  Vite 8 output. Deleting user rows does not cure a bundler regression.
  **RESOLVED FOR NOW, BUT NOT FIXED — `md` cleared the database on 2026-08-13 and the gate went green immediately.**
  The bind mount was replaced with the named Docker volume `db_data`, so the stack came up on an empty database.
  **The defect itself is untouched and will recur.** Nothing was done to the admin panel or to `createUserViaUi`; only
  the data under them was removed. **No arrival estimate is given** — the first draft's "~45 more runs" does not close
  against the four row counts recorded that pass (5380 at start, a 5497 probe, 5498, 5734 at close, over ≥7 full-suite
  invocations), so the rate or one of the counts is wrong. The direction is certain; the timing is not. It will return
  **silently**, as a "flake" that re-runs seem to heal, exactly as it did for two epics.
  Proposed fix, three candidates: make the helper's assertion independent of a table it did not create; paginate the
  admin users query (routed to backlog as a product feature request at the Epic 7 retro); or a per-run database reset or
  namespace in `webServer`/`globalSetup`, which would end the growth mechanically and is probably the cheapest. A retry
  loop is forbidden — that is the shape Story 7.3 deleted. **Do not treat "the gate is green" as closure — clearing
  data is not a mechanism.** This supersedes the "test-side race in the helper" reading in the Story 7.7 record, which
  was correct for the symptom at ~5.2k rows and is now incomplete.
  **Numbers caveat:** they were measured against a bind-mounted `./db/data`, which no longer exists. See the stale-path
  sweep entry under the 7.8/7.9 review below.

## Deferred from: Story 7.12 — `graphql-kotlin` 9 → 10, with Kotlin (2026-08-16)

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **the split Kotlin runtime survived this story and is now one patch wider** — `kotlin-stdlib` **2.4.10**
  against `kotlin-reflect` **2.3.21**. The Story 7.7 ledger entry's proposal ("let Story 7.12 dissolve it — any Kotlin
  at or above 2.4.0 removes the skew") is **measured false**.
  evidence: `./gradlew :bp_back:dependencies --configuration runtimeClasspath` on the bumped tree resolves
  `kotlin-stdlib:2.4.10` alongside `kotlin-reflect:2.3.21`, with the compiler at 2.4.10. Every `kotlin-reflect` request
  in the graph, counted: `2 × 1.8.10 -> 2.3.21`, `2 × 2.1.21 -> 2.3.21`, `7 × 2.3.0 -> 2.3.21`, `1 × 2.3.21` (unmoved).
  The single un-upgraded request is `io.ktor:ktor-server-core-jvm:3.5.2 → kotlin-reflect:2.3.21`. **So `kotlin-reflect`
  tracks Ktor, not the `kotlin` catalog entry**: the Kotlin Gradle Plugin injects `kotlin-stdlib` at the compiler
  version but never injects `kotlin-reflect`. Consequence: **no `kotlin` bump can close this**, so the re-check trigger
  is **the next Ktor bump** (whose `ktor-server-core` POM is the thing to read). Not fixed here: the skew is in the
  supported direction (newer stdlib, older reflect) and green across all four instruments.
  Proposed fix, three candidates: `implementation(kotlin("reflect"))` in `bp_back/build.gradle.kts` — a plain dependency
  declaration that KGP version-aligns to the compiler automatically and would close the skew today, and the remedy the
  original entry omitted; or `dependencies { constraints { implementation("org.jetbrains.kotlin:kotlin-reflect:${libs.versions.kotlin.get()}") } }`
  (note it is `kotlin-reflect` that needs the pin, not `kotlin-stdlib` as the 7.7 entry proposed); or simply wait for a
  Ktor version compiled against 2.4.x. The story's replacement absolute ("no `kotlin` bump can ever close it") rests on
  a single observation of current KGP behaviour — treat it as measured-here, not as a law.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **Jackson 2 and Jackson 3 now coexist on the backend runtime classpath**, with two live `ContentNegotiation`
  converter implementations available and no measurement of which one actually serialises `data`/`errors`.
  evidence: the `runtimeClasspath` adds `tools.jackson.core:jackson-core:3.1.3`, `jackson-databind:3.1.3`,
  `jackson-module-kotlin:3.1.3` and `jackson-bom:3.1.3` while `com.fasterxml.jackson.*` stays at 2.22.1;
  `ktor-serialization-jackson3(-jvm):3.5.2` joins `ktor-serialization-jackson(-jvm):3.5.2`. graphql-kotlin 10's release
  notes name the mechanism — "skip internal ContentNegotiation install when already configured" (PR #2174) — and this
  project installs `ContentNegotiation { jackson() }` (Jackson **2**) on the *root* route at `Routing.kt:14-16`, one
  level above the GraphQL routes. **The observable contract is intact and that is measured**: the failing-mutation and
  `FORBIDDEN` response bodies are byte-identical before and after (md5 `0f14f39530c686ecc53218f28f1b79f4` and
  `e8f4a49ba280f66c1510a6bfbb0f21ea`). What is *not* established is which mapper produced them — **and the story's
  claim that "no distinguishing signal was available without a code change" was asserted rather than demonstrated.** At
  least four black-box discriminators exist and none was tried: non-ASCII / astral-plane escaping via the schema's
  `emoji` field; `Accept`-header negotiation and 406 behaviour; the `charset` suffix on `Content-Type`; and
  field-ordering / pretty-print defaults. Related: `install(WebSockets) { contentConverter = JacksonWebsocketContentConverter() }`
  at `GQL.kt:130` is Jackson **2**, while graphql-kotlin's subscription server now carries its own Jackson 3 mapper, so
  that converter may be vestigial for GraphQL frames — noted, deliberately not deleted. Consequence: relocating or
  removing the `ContentNegotiation` install would silently flip GraphQL body serialization with no gate detecting it.
  Proposed fix: run one of the four probes (or a temporary `pluginOrNull(ContentNegotiation)` read in a throwaway
  build), record the answer as a rule, then either drop the dead Jackson 2 websocket converter or record it as
  intentionally load-bearing. Do this before the next Ktor or graphql-kotlin major, not after.

- ✅ CLOSED by Story 9.12 (2026-09-23): the redundant trailing `Unit` in `changePassword`'s `either { }` block is
  deleted; `gradle :bp_back:compileKotlin --rerun` now emits zero `w: ` lines. (The line number below, `:65`,
  reflects where later stories had pushed the statement by the time this entry was filed — it was at `:73` by the
  time this closure landed, after further intervening code; same statement throughout.)
  Was: source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: Kotlin 2.4.10 emits a compiler warning on unchanged source that 2.3.21 did not —
  `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt:65:9 Expression is unused.`
  evidence: established with a control rather than assumed. The catalog was stashed back to `9.3.0`/`2.3.21` and
  `./gradlew :bp_back:compileKotlin --rerun-tasks` run over identical source: exit 0, **0** lines matching `^w: `. On
  2.4.10 the same forced compile emits exactly that one warning, and it also appears in the image build. The line is
  the trailing `Unit` of `changePassword`'s `either { }` block — re-verified present at `UserService.kt:65` on
  2026-09-07. Warning only; **nothing was suppressed**. Proposed fix: drop the redundant trailing `Unit` (the block's
  type is already inferred), in a change that is not a dependency bump. **Caveat on the attribution:** the control
  moved two variables (`graphql-kotlin` *and* `kotlin`) and the finding is attributed to one. The inference is almost
  certainly right — `Expression is unused.` is a language diagnostic a library cannot emit — but the isolating run was
  one command away and not taken.

- ✅ CLOSED by Story 9.1 (2026-09-15): unauthenticated, non-rate-limited `GET /api/health` (Mongo ping in a 2 s
  timeout → `200 OK` / `503 UNAVAILABLE`); `AGENTS.md` now documents it as the readiness check.
  Was: source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **there is still no backend health endpoint**, which is the actual gap the "backend readiness" documentation
  bullet has been deferring since Epic 1.
  evidence: `GQL.kt:135-140` puts `graphiQLRoute()` inside `authenticate(authMethod)` alongside `graphQLPostRoute()`
  and `graphQLSDLRoute()`. Measured on the running stack: `curl` with no token → **401**; with an admin Bearer token →
  **200**, 2511 bytes. **The documentation half is now fixed** — `AGENTS.md:41-42` gives the token-bearing `curl` form
  and states that a plain browser navigation returns 401 on a healthy backend. What remains is the endpoint itself:
  Playwright's `webServer.url` probe still proves only that Caddy answers, not that Ktor is warm (see the `webServer`
  gaps entry above). One trap worth keeping, because it costs a full debugging cycle: driving `/api/graphiql` with
  Playwright's `context.setExtraHTTPHeaders({Authorization: …})` attaches the header to the jsdelivr CDN requests too,
  and Chromium rejects the preflight (`Request header field authorization is not allowed by
  Access-Control-Allow-Headers`), leaving the page stuck on `Loading...` with `ReferenceError: GraphiQL is not defined`
  — a false negative indistinguishable from a broken playground. Scope the header to same-origin API requests with
  `context.route("http://localhost:2080/api/**", …)`.

## Deferred from: code review of 7-14-installable-pwa (2026-08-20)

- ✅ CLOSED by Story 9.12 (2026-09-23): `dev-dist` is added to `bp_front/.gitignore` and the ESLint `ignores` array.
  Was: source_spec: `spec-7-14-installable-pwa.md`
  summary: `dev-dist/` is not gitignored, which is a trap the first time anyone sets `devOptions.enabled`.
  evidence: `npm run dev` was run in that pass and produced no `dev-dist/`, so the spec's condition was correctly read
  as not met and neither `.gitignore` nor `eslint.config.mjs` was touched. Re-verified 2026-09-07: `dev-dist` still
  appears in neither `.gitignore` nor the ESLint `ignores` array. Enabling dev-mode PWA debugging will drop an
  untracked, unlinted build directory into the tree.

## Deferred from: code review of 7-8-7-9-types-node-26-and-vite-8 (2026-08-13)

Findings the review surfaced that are **not** fixable inside that story's boundary (version numbers and what an
upgrade strictly requires). Several are pre-existing and were merely exposed by the bundler swap.

- ✅ CLOSED by Story 9.12 (2026-09-23): `codegen.ts` is now in `tsconfig.node.json`'s `include` — the tsconfig half
  closed alongside the Story 7.1 entry above; combined with Story 7.13's earlier `npm run generate` run, the
  `npm run generate` path is both type-checked and exercised.
  Was: source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`codegen.ts` is in no tsconfig project and codegen was never run against the Vite 8 tree**, so the
  `npm run generate` path is unverified after `esbuild` left the dependency graph.
  evidence: `tsconfig.app.json` includes `src`, `tsconfig.node.json` only `vite.config.ts`, `tsconfig.e2e.json` `e2e` +
  `playwright.config.ts`; `codegen.ts` matches none. That spec forbade running `npm run generate` (no schema change in
  the epic), so this was correct to skip. **Partially discharged since:** Story 7.13 ran `npm run generate` against the
  live schema under graphql 17 and got byte-identical output, which exercised the path on the Vite 8 tree. What remains
  is the tsconfig half — see the 7.1 entry above.

- ✅ CLOSED by Story 9.12 (2026-09-23): every stale `./db/data` mention in `docs/` and `bp_front/e2e/` now describes
  the `db_data` named volume.
  Was: source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`./db/data` survives as a stale path across the docs and E2E comments** after `md` switched the mongo
  mount to the named volume `bag-please_db_data`.
  evidence: re-verified 2026-09-07 — `docs/deployment-guide.md:10,101,117` still teaches it as the persistent volume
  and instructs backing it up, and six `bp_front/e2e/` comments (`global-setup.ts:4`, `admin.spec.ts:11,183,198`,
  `account.spec.ts:12`, `support/ui.ts:14`, `item-attribution.spec.ts:14`) still name it as the volume that persists
  across runs. The persistence *claim* is still true of the named volume; the path is not, and `docs/` now tells an
  operator to back up a directory that no longer holds the data. Deliberately not swept at the time because the compose
  change was uncommitted; it has since been committed, so the blocker is gone. Proposed fix: sweep the path.
  (The `project-context.md` occurrences named in the original entry are moot — that file was retired 2026-09-07.)

## Deferred from: code review of 7-6-backend-safety-fixes (2026-08-12)

- source_spec: `spec-7-6-backend-safety-fixes.md`
  ✅ CLOSED by Story 9.4 (2026-09-18): `UserAdminMutations.deleteUser` orchestrates `adminDeleteUser` →
  `ListService.purgeUser(userId, username)` → `authService.invalidateUserSessions`, in that order. `purgeUser` deletes
  every `list_members` row the user held in ANY status (`ListMemberRepository.deleteAllForUser`), strips them from the
  `members`/`memberUsernames` of lists they did not own (through `ListStorage.save`, so the in-memory cache cannot
  diverge), and destroys the lists they owned through the one private `cascadeDeleteList` that `deleteList` also uses.
  The phantom Share-dialog row is therefore gone, and the admin's confirmation states how many owned lists the delete
  destroys (`User.ownedListCount`). Pinned by `ListSharingTest` `AC-9.4-purge` / `-idempotent` / `-order` and by the
  `@serial-users` E2E case in `admin.spec.ts`. No backfill for already-stranded rows — see the narrowed standing
  assumption under Story 7.6 above. Was:
  summary: `UserService.adminDeleteUser` deletes a user without removing their `list_members` rows, so user deletion is a
  still-open second orphan-leak path that Story 7.6's list-side cascade does not touch.
  evidence: `entity/user/UserService.kt:84-88` contains no reference to `ListMemberRepository` — the class is not
  injected at all (re-verified 2026-09-07). The rows it strands carry a **live** `listId`, so the detection query
  recorded with Story 7.6's no-backfill assumption (`list_members.distinct("listId")` vs `lists._id`) cannot see them;
  they need `distinct("userId")` vs `users._id`. Consequence: a phantom member row that still renders in the Share
  dialog and cannot be cleared through `removeMember`, because that path resolves the username to a user that is gone.

## Deferred from: code review of 7-5-home-resolution-and-inert-home-link (2026-08-11)

- ✅ CLOSED by Story 9.7 (2026-09-21): closed as leave-as-is by `md` (2026-09-15): observe mode stays `cache-only`. No code change. Was: source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: **FOR `md` — a design decision, not a bug: should the app bar be allowed to join the in-flight lists query
  so the inert guard covers the cold-start window?** Today it does not, and for roughly the first 100 ms after a full
  page load of the resolved home route the title link is live, so a click landing in that window still costs the FR57
  history entry the story exists to remove.
  evidence: `AppShell.tsx` observes via `useHomePath('observe')`, which is `fetchPolicy: 'cache-only'` — a constraint
  written into the spec's `<intent-contract>` ("the observing consumer must never issue the membership-gated `lists`
  request", "unknown path ⇒ not inert"). The window is real and measured: `ListShoppingPage.tsx` computes `loading`
  from `itemsResult`/`categoriesResult` only, so `list-shopping-page` (and the app bar with it) renders before the
  lists query resolves; a probe reads `aria-current` as absent immediately after the page appears and `page` a moment
  later. Two of the story's own new tests raced it and failed 2 of 6 isolated runs before they were changed to
  synchronise on `aria-current`. The implementation is contract-conformant, so this was NOT overridden unilaterally.
  The cheap fix is `fetchPolicy: 'cache-first'` in observe mode: on `/list/:id` and `/lists` the page already issues the
  identical `Lists` query so Apollo would dedupe it to zero extra requests, and the only routes where it would add one
  (`/lists/:id`, `/account/password`) are never home. That contradicts the contract's letter, which is why it is a
  question for `md` rather than a patch. Weigh it against the fact that the PWA makes this link the app's only exit and
  makes launch-then-tap the normal interaction.

- ✅ CLOSED by Story 9.7 (2026-09-21): `useHomePath` gates the error branch on `mode === 'resolve'` (Story 9.7), so observe mode can never resolve to `/lists` from an error; resolve mode still does. `e2e/navigation.spec.ts` pins the resolve half and the live title link with `Lists` forced to HTTP 500; the observe gate itself is hardening no test can distinguish today (Apollo `cache-only` never surfaces an error), so it is unpinned. Was: source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: `useHomePath`'s `if (error) return '/lists'` branch is unreachable in `observe` mode, so while the lists
  query is failing the two consumers of the "single source of truth" disagree about where home is.
  evidence: `cache-only` never issues a request and therefore never surfaces an `error`; observe mode falls to
  `!data → null` instead. Verified by forcing the `Lists` operation to HTTP 500: a zero-list user standing on `/lists`
  gets no `aria-current`, and clicking the title moves `history.length` 2 → 3. Low consequence — one wasted Back press
  in an already-degraded state — but the hook's own header comment claims both consumers read the same answer, and that
  is only true once the query has succeeded. Same root cause as the entry above; fixing that fixes this. **See also the
  Epic 7 post-factum review entry below, which flags the branch *ordering* (`if (error)` precedes `if (!data)`) as a
  latent hazard riding future Apollo majors — one change addresses both.**

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: **UX question for `md`** — for a sighted user the inert link is a silent no-op with no feedback at all, and
  one of the new tests actively enforces that it looks identical to a live one.
  evidence: UX-DR-E7-2 and AR-E7-8 require the inert state to keep its type scale, weight, colour, hover underline
  and focus ring, and the `inertlook` test asserts exactly that. So the control advertises itself as clickable,
  underlines on hover, takes focus, activates on Enter — and does nothing. `aria-current="page"` reaches screen readers
  only. Rejecting `disabled`/`aria-disabled` is right (the element is the only exit on `/admin` and
  `/account/password`), but the middle ground was never considered: `cursor: 'default'` on the inert state would give
  sighted users the same signal without touching type, colour, or the accessibility tree. Not applied unilaterally
  because "identical look" is an explicit UX ruling. **Natural home is Story 8.7** (write down the design this app
  actually has), which is where an inert-control convention belongs.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: `AppShell` mounts a `ListsQuery` watcher on every guarded screen — including `/account/password` and
  `/admin` — purely to decide one attribute, and re-renders the whole shell on any write to the lists cache.
  evidence: `useHomePath('observe')` inside `AppShell`. It costs no network request (`cache-only`, and admin is
  skipped entirely), so the consequence is a wrong dependency direction rather than a measurable cost: a chrome
  component now depends on the list domain. The alternative shape is a small context published by whoever already
  fetches lists, which would give the app bar the answer without giving it the query. Deliberately not done — the
  shared hook is what the intent contract prescribes, and inverting the data flow is a bigger change than that story's
  scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: A semantic change slipped in with the refactor: `/` used to redirect when the lists query settled with no
  data, and now shows the spinner indefinitely instead.
  evidence: the old `HomeRedirect` spun only while `loading` and otherwise fell through to `lists = []` → `/lists`;
  the new one returns `null` for `!data`, which renders `home-redirect-loading` with no timeout. Practically
  unreachable in `resolve` mode — Apollo sets `data` on success and `error` on failure, and the `skip` path is
  admin-only, which returns `/admin` before the check — so this is filed as a latent semantic difference, not a live
  bug. It is not a dead end for the user either: `AppShell` wraps `/`, so the user menu remains available. Worth
  knowing before anyone adds a fetch policy or an `errorPolicy` that can produce settled-and-dataless — which is
  exactly what the cache-first question above proposes.

## Deferred from: code review of 7-4-item-edit-merges-stored-item (2026-08-10)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: Nothing tests the "throw before `emit`" contract that Story 7.4 promoted to a stated invariant.
  evidence: the spec asserts that AC3/AC4 must throw before `itemUpdateChannel.emit(...)` so a rejected save
  broadcasts no `SAVED` event (the code still has that shape — `ItemService.kt`, guards precede
  `storage.save`/`emit`). All four rejection tests assert only on the HTTP response body, so moving the `emit` above
  the throws would regress the invariant with the suite fully green. It is cheap to cover — `ItemService.itemUpdates`
  is a public `SharedFlow` and `SubscriptionScopingTest` already shows the collect pattern — but doing it inside a
  `MutableSharedFlow` with `extraBufferCapacity = 1` and no replay needs a collector attached before the call, which is
  a timing shape this suite has no precedent for; it was left out rather than land a possibly-flaky test on a story
  whose sibling (7.3) existed to delete a flake.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: AC4's guard creates a new terminal state — an item already carrying a dangling category can never be
  renamed, and the raw guard message reaches the user verbatim.
  evidence: The guard validates the *incoming* `category`, and `EditItemDialog` sends back the item's stored category
  when the user does not change it. An item in the state described in the ruling-A entry above therefore rejects every
  future edit. The MUI `Select` renders **blank** for a category id absent from `categories` while `validate()` still
  passes (the id is a non-empty string), so the user sees `Category <uuid> does not belong to list <uuid>` in
  `edit-item-error` with no indication that re-picking the category is the fix. Cross-reference the declined
  `BAD_USER_INPUT` shape in the Story 7.4 section: a typed code is what a "pick a category" hint would branch on.

- ✅ **CLOSED by Story 9.5 (2026-09-18):** all four sites rewritten in place, with a comment-only diff on
  `EditItemDialog.tsx` (same JSX, same handlers, same carry-forward). The header block now describes `saveItem` as a
  merge that copies `name`/`category`/`store` and routes check state through `applyCheckState`, and records that the
  lifecycle control's absence is a product decision rather than a blocked one; the `nothingChanged`, carry-forward and
  payload comments now say that `checked`/`recurring` are **input-owned** — which is exactly why the carry-forward from
  the live `item` prop still matters and must not be deleted as obsolete. No comment cites `BUG-E6-2` or the
  "full-document upsert" premise. The routing question this entry kept re-opening is moot: Story 9.5 is the first story
  that actually edits the file. Was:

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: Four comments in `EditItemDialog.tsx` are factually wrong and shipped that way, because `bp_front/src/`
  was out of scope by rule.
  evidence: `:38-43` still describes `saveItem` as "a full-document upsert (`GqlItemMapper.mapItemFromInput` builds a
  fresh `Item` from the input alone)" and names "the server-side `checkedAt` reset — see deferred-work.md BUG-E6-2" as
  a live blocker on the lifecycle control; `:117` and `:127` repeat the premise. BUG-E6-2 is closed. The next
  developer is pointed at a fixed bug — and, worse, the `checked`/`recurring` carry-forward those comments justify is
  now the only thing keeping the desync in the Story 7.4 section from being reachable, so a reader who deletes the
  carry-forward as obsolete opens a real hole. Should be picked up by the first story allowed to touch
  `bp_front/src/` — **Epic 8 stories qualify.**
  **UNROUTED 2026-09-08 by Story 8.4 — still OPEN, now with NO named story.** The routing above named Story 8.4 as
  "the first that goes near this component". That was wrong on the facts: 8.4 adds `ListFilters.tsx` and
  `itemFilter.ts` and edits the two route components, and does not open `EditItemDialog.tsx` at all (`git diff
  --stat` for the story lists neither that file nor any of its call paths). Re-pointing it at Story 8.6 was
  considered and rejected on the same evidence: 8.6's `Files:` line (`epics.md:2058`) lists only a new rename dialog
  and `ListDetailPage.tsx`, and its `Reuses:` line says it MIRRORS `EditItemDialog`'s form conventions rather than
  editing it — so 8.6 would decline on exactly the grounds 8.4 did, and naming it would just move the wrong routing
  one story down the sprint. **Correct routing: the first story that actually edits `EditItemDialog.tsx`, whichever
  that turns out to be.** Guessing which story that is, ahead of a story that has a real reason to be in the file, is
  what produced two bad routings already.

## Deferred from: code review of epic-7-context (2026-08-21)

Post-factum adversarial review of Epic 7 (`main...epic7-maintenance`, 44 commits), chunk A+B only — backend (`bp_back/`)
plus frontend app source and build config. **The E2E suite (`bp_front/e2e/`, `playwright.config.ts`, 2119 diff lines)
and the docs/`_bmad` chunk were NOT reviewed and are outstanding.** Items already filed elsewhere and merely
re-confirmed by this pass (the `checked`/`checkedAt` desync, `@Volatile`, `MemberStatus.valueOf`, the cold-cache home
link, the non-transactional cascade, the widened `eslint .` glob) are cross-references only and are in the archive.

- ✅ CLOSED by Story 9.7 (2026-09-21): the branch is gated on `mode === 'resolve'` (Story 9.7); the ordering hazard cannot fire in observe mode, and resolve mode keeps `error` before `!data` so a dataless failure cannot spin forever. Was: **`useHomePath`'s `if (error)` precedes `if (!data)` in `observe` mode too.** `homePath.ts:68-69`. Not a live defect:
  Apollo 4 `cache-only` reports a miss as `data: undefined, error: undefined`, so the branch does not fire today. Both
  the adversarial and edge-case layers independently flagged it as a latent hazard riding the Apollo 4.1→4.2 bump. If a
  future Apollo ever surfaces a cache miss as `error`, the app bar resolves home to `/lists` and the link goes inert ON
  `/lists` — a dead control on the one screen the code says must never have one. Cheap hardening: gate the error branch
  on `mode === 'resolve'`. Filed rather than patched because it is speculative about upstream behaviour. Pairs with the
  unreachable-`error`-branch entry under the 7.5 review above.

## Deferred from: code review of 4-3-list-sharing-backend-pending-invites-member-management (2026-05-22)

The untyped-status-strings and `deleteList`-cascade items from this section were resolved by Story 7.6 and are in the
archive, along with the `acceptInvite` UUID-oracle item, which was accepted as a design trade-off.

- Username recycling UUID/username desync — `removeMember`/`leaveList` filter `List.members` by resolved UUID but
  `memberUsernames` by string; if a username is re-registered to a different UUID the two arrays diverge; pre-existing
  design gap not introduced by that story.
## Deferred from: code review of 4-1-list-entity-backend-crud-authorization-migration (2026-05-22)

The `synced` TOCTOU item is superseded — its visibility half was fixed by Story 7.6 and its check-then-act half re-filed
in that section. `verifyMembership`'s existence leak was accepted, and the `GqlItem` input/output name collision is
resolved (`GqlItem` is `@GraphQLName("Item")` and `GqlItemInput` is `@GraphQLName("ItemInput")` — separate classes).
All three are in the archive.

- ✅ CLOSED by Story 9.12 (2026-09-23): `ListStorage.delete()` is deleted; no callers existed, and no test covered it
  either (`bp_back/src/test/kotlin` has no `ListStorage` test file), so nothing else needed removing. Was: `ListStorage.delete()`
  dead code — the method exists but `ListService.deleteList` bypasses it (calls
  `listRepository.delete` + `evictFromCache` directly, `ListService.kt:117-123`); latent inconsistency that could cause
  a double-delete if future code routes through `listStorage.delete()`. Re-verified 2026-09-07.
## Deferred from: code review of 1-2-login-token-system-session-security-backend (2026-05-08)

The `UserStorage.sync()` race is closed — the class was deleted by Story 2.0 and the surviving instances of the pattern
are filed under Story 7.6. Archived. Everything below was re-verified against `bp_back/` on 2026-09-07.

- **CORS plugin does not allow credentials or expose the Authorization header** — re-verified at `plugins/CORS.kt`:
  `anyHost()`, four methods, `allowNonSimpleContentTypes`, and nothing else. The frontend is same-origin through Caddy
  so nothing is broken; cross-origin clients (an API playground, a native mobile app) will fail. Note `anyHost()` is
  itself worth a look before this stack is ever exposed beyond the local edge.
## Deferred from: Story 8.2 — a long name and a full header fit on a narrow phone (2026-09-05)

- source_spec: `_bmad-output/implementation-artifacts/spec-8-2-a-long-name-and-a-full-header-fit-on-a-narrow-phone.md`
  summary: The `noWrap` + fixed-`xs`-cap census is not complete, and the epic's floor audit should not be read as
  finished. `bp_front/src/routes/ListsPage.tsx:195` (the list name on `/lists`, `maxWidth: {xs: 200, sm: 420}`) and
  `bp_front/src/routes/AdminPage.tsx:200` (the username cell, `{xs: 140, sm: 260}`) are the same construct Story 8.2
  removed from `/lists/:id`, and neither is named in `epics.md`, `epic-8-context.md` or any story spec.
  evidence: Measured at the Story 8.2 review, at 320px against the production image: the `/lists` row name is
  `scrollWidth 380 > clientWidth 200` with `white-space: nowrap` — a clipped list name on the first screen an
  authenticated user sees. The suite does not catch it: the only test that visits `/lists` at the floor is
  `[P1] no route scrolls horizontally at the floor`, which asserts `expectNoHorizontalOverflow` alone, and a clipped
  element does not widen its ancestors (AR-E8-3a). `/admin` IS visited at the floor — `e2e/admin.spec.ts` carries no
  project guard and the `mobile` project renders at 320px (`playwright.config.ts`, `PIXEL_7_AT_FLOOR`) — but it makes
  no layout assertion there, so the cap is unmeasured rather than unreached. (Corrected at review Pass 2: this line
  read "`/admin` is not visited at the floor at all", which would send a future story looking for a missing route
  instead of a missing assertion.) Not fixed in Story 8.2 because both screens are outside its frozen scope, and, like
  the app-bar chip, each wants its own scoping decision rather than a fix smuggled into a story that was not asked for
  it. The cheap version is one `expectNotClipped` per screen at the floor; the fix is then the same cap removal Story
  8.2 did. `ListShoppingPage.tsx:275/400/421` use `maxWidth: '100%'` and `:451` a 100px attribution chip
  (post-8.3: the attribution is `:215`, and the two surviving `maxWidth: '100%'` sites are `:464` and `:588`). Called "a
  different case, and deliberately not lumped in here" — a claim review Pass 2 flagged as asserted rather than
  measured, and carried into the Pass 2 deferral below: `:451` (post-8.3 `:215`) is `noWrap` with a hard
  `maxWidth: 100`, the same
  construct with a numeric cap, on the screen users spend the most time on, and `:421` is `noWrap` + `maxWidth: '100%'`
  inside a `minWidth: 0` flex box, which clips by exactly report #2's mechanism without a numeric cap. Neither has been
  measured at 320px. **2026-09-15, second triage pass (`md`):** the `/lists` half of this entry (`ListsPage.tsx:195`) is
  CLOSED by
  decision and will not be worked. Was: The `/admin` half stays OPEN and rides FR13 in Epic 9 (see the index at the top).
  **✅ The `/admin` half is CLOSED by Story 9.2 (2026-09-16):** the username cell's `noWrap` +
  `maxWidth: {xs: 140, sm: 260}` is gone — the name wraps (`overflowWrap: 'anywhere'`) and carries a
  `data-testid="admin-user-name"` so a spec can target the text element — and the missing assertion now exists as
  `narrow-viewport.spec.ts`'s `[P1] a long username and the pager stay inside the floor on /admin`. `ListsPage.tsx:195`
  is untouched, per md's decision.

## Deferred from: code review of spec-8-2-a-long-name-and-a-full-header-fit-on-a-narrow-phone (2026-09-06)

Review Pass 2, four layers. Five entries routed `defer`; the full triage lives in the spec's `### Review Findings`.

- **`/lists` and `/admin` clip at the floor with no assertion holding the debt visible.** `/lists` is reached at the
  floor only by the route sweep, which asserts `expectNoHorizontalOverflow(page)` and nothing element-level — green at
  `320 === 320` while the list name is an ellipsis at `scrollWidth 380 > clientWidth 200`. `/admin` is rendered at the
  floor on every run by `admin.spec.ts` (no project guard) but carries no layout assertion at all. Neither Typography
  has a `data-testid`, so no spec can target them today. Belongs with the scoping story this file already asks for.
  **2026-09-15, second triage pass (`md`):** the `/lists` half is CLOSED by decision. Was: the missing `/admin` floor
  assertion stays OPEN and rides FR13 in Epic 9.
  **✅ CLOSED by Story 9.2 (2026-09-16):** the `/admin` username `Typography` now has a `data-testid`
  (`admin-user-name`), which is what "no spec can target them today" was blocking, and
  `narrow-viewport.spec.ts` asserts a 42-character username with `expectNotClipped`, the page with
  `expectNoHorizontalOverflow`, and both pager controls with `expectInsideViewport`, at the 320px floor.
## Deferred from: Story 8.5 — the same list reads the same way on both screens (2026-09-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-8-5-the-same-list-reads-the-same-way-on-both-screens.md`
  status: **✅ CLOSED by Story 9.3 (2026-09-17).** Was: **OPEN — the orphan CAUSE. Story 8.5 filed it rather than
  fixing it (its AC6 forbade the fix).**
  summary: `ListDetailPage`'s remove-category confirm is a CLIENT-SIDE delete loop over the items that client happens
  to hold, so any item added by another client since the last refetch survives its category and is left pointing at a
  dangling category id.
  evidence: `bp_front/src/routes/ListDetailPage.tsx` — the confirm handler runs
  `for (const item of items.filter(i => i.category === target.id)) await deleteItem(...)` and then `deleteCategory`.
  `items` is this render's Apollo data, and `/lists/:id` is refetch-driven with no subscription (AR-E8-6), so the set
  is stale by construction whenever anyone else has written. **Reachable through the UI with ONE user and no API
  shortcut**, which is how Story 8.5's `FR62 — an item orphaned by a category removal…` spec in
  `bp_front/e2e/lists.spec.ts` produces its fixture: tab A opens the list, tab B adds two items to a category tab A
  has already loaded, tab A removes that category and deletes only the item it knew about. The loop is also not atomic
  — a failure partway leaves items deleted and the category intact.
  **Why 8.5 did not fix it:** making the delete a single server-side cascade is a backend change, and the AR-E8-0
  backend freeze holds for the rest of Epic 8 — nothing else in the epic needs it unfrozen. It would also do nothing
  for orphans already in the data, which is the half users feel. **What 8.5 DID deliver is the mitigation, not the
  fix:** orphans are now visible and recoverable on `/lists/:id` in the synthetic `Uncategorized` group, with each
  orphaned item's own edit and remove controls. Before that they were visible on `/list/:id` and unreachable
  everywhere, i.e. recoverable only with database access.
  **Shape of the real fix:** `deleteCategory` cascades to the category's items server-side, in `ItemService`/
  `CategoryService`, and the client loop is deleted. Pairs with the standing "`Item.category` has no schema-level
  referential integrity" entry under the Story 7.4 section — same missing invariant, other end.
  **How Story 9.3 closed it:** `CategoryService.deleteCategory` now verifies membership, deletes the category, then
  removes every item of it — `ItemStorage.deleteAllInCategory` walks the RAW per-list cache map (not `getByListId`,
  whose `!deleted` filter would skip soft-deleted rows) and `ItemRepository.deleteAllInCategory` is the Mongo
  `deleteMany`. Exactly ONE event is emitted, the category `DELETED`; both SharedFlows are `extraBufferCapacity = 1` /
  `DROP_OLDEST`, so a per-item fan-out would be dropped. Clients treat that event as authoritative for the children:
  `ListShoppingPage` prunes `ItemsQuery{listId}` through `client.cache.updateQuery`, and `ListDetailPage`'s per-item
  loop is deleted. The two remaining ways to MAKE a fresh orphan are closed too — `saveItem` rejects an out-of-list
  category on the CREATE branch as well as the UPDATE branch, and `uncheckItem` refuses to resurrect an item whose
  category is gone.
  **A coverage gap this leaves, recorded rather than patched:** with no API-reachable way to create an orphan, the
  Story 8.5 E2E spec `FR62 — an item orphaned by a category removal…` could no longer build its fixture and was
  RETIRED (see the comment left in its place in `bp_front/e2e/lists.spec.ts`). The synthetic `Uncategorized` bucket
  stays in the product for items that predate the cascade, and its ordering/placement rules stay covered by
  `e2e/order.spec.ts` (which calls `groupItemsByCategory` directly), but the RENDERING of a legacy orphan on
  `/lists/:id` — the bucket's controls, its last-position placement, the filter tripwire — now has no end-to-end
  test, because no test can produce the data. Re-covering it needs a seam that writes an orphan directly (a Mongo
  fixture in the E2E harness, or a test-only seeding route); neither exists today.
  **That gap is tracked as its OWN open entry** under "Deferred from: Story 9.3" at the end of this file — it was
  first recorded here, inside this CLOSED block, where a scan for OPEN entries would have missed it (review finding,
  2026-09-17). This paragraph stays as the history of how the gap arose; the open entry is the one to work from.
  **One rough edge on the mitigation, recorded here rather than patched:** `EditItemDialog` seeds `categoryId` from
  `item.category`, so an orphan's dialog opens with a BLANK `Select` (the stored id is out of range; MUI's warning is
  dev-only and the E2E runs the production build). Picking a category is the recovery and it works — that is AC4 and
  it is asserted. But saving WITHOUT touching the Select hits the dialog's `nothingChanged` guard and closes silently,
  leaving the orphan orphaned with no feedback. Out of Story 8.5's scope: no AC covers it, and `EditItemDialog.tsx`
  edits are routed by the standing entry above to "the first story that actually edits that file".

## Deferred from: Story 8.6 — rename a category instead of destroying it (2026-09-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-8-6-rename-a-category-instead-of-destroying-it.md`
  status: **✅ CLOSED by Story 9.6 (2026-09-20).**
  closed_by: `_bmad-output/implementation-artifacts/spec-9-6-an-item-can-be-in-several-stores.md`
  summary of the fix: the guard went into `validate()`, not into the `nothingChanged` short-circuit. `validate()` now
  requires `isKnownCategoryId(categoryId, categories)` — a pure, import-free function in
  `bp_front/src/lib/lists/categoryChoice.ts` — so an out-of-list category id fails validation on every path and the
  short-circuit below is never reached: the dialog stays open, the `Select` shows `Choose a category`, and nothing is
  saved. The `nothingChanged` guard itself was never the bug; accepting a stale category id was.
  where it is proven: `bp_front/e2e/item-fields.spec.ts`, a browserless spec. Since Story 9.3 no API path can create
  an item whose category is not on its list, so no browser test can build the fixture — the same coverage gap already
  recorded as its own OPEN entry under "Deferred from: Story 9.3". The guard is asserted where it lives, exactly as
  `e2e/order.spec.ts` does for the duplicate-name ordering.
  Was: **OPEN — carried forward from Story 8.5, still uncovered.** The Story 8.5 note that an ORPHANED item's
  `EditItemDialog` closes silently when submitted without touching the category `Select` (the `nothingChanged` guard
  fires, the orphan stays orphaned, no feedback) stayed OPEN. Story 8.4 routed `EditItemDialog.tsx` edits to "the
  first story that actually edits that file"; Story 8.6 was not that story — it added `EditCategoryDialog.tsx` and
  changed `EditItemDialog.tsx` by zero lines, and no AC of its own covered the item dialog. Story 9.6 is that story.

## Deferred from: Story 8.7 — write down the design this app actually has (2026-09-09)

The entries below are **measurement corrections and recorded inconsistencies, not fixes**. The current design contract
is `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` + `EXPERIENCE.md` (both older UX specs carry a
SUPERSEDED banner); expect their line anchors to drift. Story 8.7 ships no
code (`git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` is empty at
`3af2d575e852ca186467c67a051e5ddc77a6fe6d`); it re-measured every figure it needed rather than copying one, and these
are the places where the measurement disagreed with what was already written down.

- source_spec: `_bmad-output/implementation-artifacts/spec-8-7-write-down-the-design-this-app-actually-has.md`
  status: **✅ CLOSED by Story 9.12 (2026-09-23).**
  closed_by: `_bmad-output/implementation-artifacts/spec-9-12-small-cleanups.md`
  summary of the fix: the four unconsumed tokens (`bg2`, `card2`, `sheetBg`, `stripe`) are deleted from `theme.ts`'s
  value object and module-augmentation type; `DESIGN.md` §3 and §11.2 updated to the resulting two-token state.
  Was: summary: `bp_front/src/theme.ts` declares SIX `custom.bp.*` tokens and only **two** have a consumer. `bg2`
  (`#0E0E10`, `theme.ts:74`), `card2` (`#2C2C2E`, `:75`), `sheetBg` (`#1C1C1E`, `:77`) and `stripe`
  (`rgba(255,255,255,0.03)`, `:79`) are read by nothing in `src/`.
  evidence: Measured 2026-09-09 — `grep -rn 'custom\.bp' bp_front/src | grep -v 'src/theme.ts'` returns exactly two
  hits: `AppShell.tsx:102` (`navBg`) and `WelcomeBanner.tsx:37` (`accentSoft`). The namespace is also typed into MUI's
  `Theme` by the module augmentation at `theme.ts:5-24`, so all six carry type weight regardless of use, and
  `sheetBg` is byte-identical to `palette.background.paper` (`theme.ts:34`) so it would add no surface value even if
  adopted. This corrects an implicit reading rather than a stated figure: `epics.md:1247-1251` (UX-DR-E8-11) says the
  closing story documents the deployed design "including the `custom.bp.*` tokens in `theme.ts`", which reads as a
  namespace in use; two-thirds of it is not. The four tokens name a two-tier surface system and a zebra-stripe
  treatment the app does not have. **Not fixed** because UX-DR-E8-11 freezes the visual language for Epic 8 and
  because the decision is a product one — adopt them or delete them — not a cleanup. Recorded in `DESIGN.md` §3 and
  §11.2.

## Deferred from: Story 9.3 — deleting a category deletes its items for everyone (2026-09-17)

Filed at the Story 9.3 review (three layers; the full triage is in the spec's `## Review Triage Log`).

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-deleting-a-category-deletes-its-items-for-everyone.md`
  status: **OPEN**
  summary: `saveCategory` has no `listId`-stability guard, so re-saving an existing category id under a different list
  RELOCATES it and strands the original list's items as orphans — the one API path that still produces the data shape
  Story 9.3 exists to eliminate.
  evidence: `CategoryService.saveCategory` verifies membership only against the INCOMING `category.listId`, and
  `CategoryRepository.save` upserts by `_id` alone while `Updates.set`-ting `listId`. `ItemService.saveItem` has exactly
  this guard for items ("Item … belongs to a different list"); categories have none. In-process the effect is masked
  because `CategoryStorage.save` adds the category under the new list without removing the stale entry under the old
  one, so `getCategories(oldList)` still returns it; the orphan surfaces after a restart, when the caches sync from
  Mongo. No Kotest case covers a `saveCategory` carrying a changed `listId`.
  **Shape of the fix:** mirror the item guard — `storage.getById(category.id)?.let { require(it.listId == category.listId) }`
  in `saveCategory`, plus a case pinning it. Pairs with the standing "`Item.category` has no schema-level referential
  integrity" entry: same missing invariant, third end.
  **Rides along:** `CategoryStorage.delete(id, listId)` removes from that list's map while `CategoryRepository.delete(id)`
  deletes by `_id` globally, so a relocated category can be deleted through its STALE old-list entry — which now also
  fires `deleteAllInCategory(oldListId, id)`. Pre-existing and only reachable through the relocation above, but the
  cascade widens what that path destroys.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-deleting-a-category-deletes-its-items-for-everyone.md`
  status: **OPEN — needs a test seam that does not exist yet.**
  summary: the `Uncategorized` rendering path on `/lists/:id` — the story's own AC3 — has no end-to-end test, because
  retiring the Story 8.5 FR62 spec removed the only one and no API-reachable way to seed an orphan remains.
  evidence: this is the gap Story 9.3 first recorded INSIDE the now-closed Story 8.5 entry above, where an OPEN scan
  would miss it (review finding, 2026-09-17); it is restated here as its own open entry. What is uncovered: the bucket
  appearing at all on `/lists/:id`, its LAST position among real categories, the `category &&` gate in
  `ListDetailPage.tsx` that hides `add-item-in-category-button` / `edit-category-button` / `remove-category-button` on
  the synthetic bucket, the per-item edit and remove controls that are the recovery path, search reaching an orphan,
  the "no `Uncategorized` filter option" decision tripwire, and `list-detail-empty` staying absent on a list of pure
  orphans. Inverting that gate, or sorting the bucket among real categories instead of appending it, leaves every
  remaining test green: `e2e/order.spec.ts` calls `groupItemsByCategory` as a pure function and renders no page, and
  the only other `Uncategorized` hit in `bp_front/e2e` is a comment in `shopping.spec.ts` in a test that deletes the
  item first so no orphan appears.
  **Shape of the fix:** a seam that writes an orphan directly — a Mongo fixture in the E2E harness, or a test-only
  seeding route. Neither exists. **Cheap interim, worth doing even without the seam:** `order.spec.ts` already calls
  `groupItemsByCategory` directly, so the PLACEMENT half ("the bucket is appended last, not sorted among real
  categories") can be pinned there today at no infrastructure cost.
  **Also open on the same data:** nothing decides what happens to the orphan rows already on disk. Story 9.3 gives them
  a rendering (AC3) but not a disposition. Epic 9 is already reworking the migration runner (Story 9.6), so a one-time
  `epic9-*` migration that deletes or re-homes category-less items would be cheap to ride along — or the decision NOT
  to run one should be recorded here.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-deleting-a-category-deletes-its-items-for-everyone.md`
  status: **OPEN — narrow; no atomicity is claimed anywhere, this records the exact windows.**
  summary: the cascade is non-transactional, so a concurrent `saveItem` can still write an orphan, and a save landing
  between the cascade's two halves survives in Mongo while being evicted from the cache.
  evidence: `ItemService.requireCategoryOnList` reads the in-memory `CategoryStorage` and `ItemStorage.save` runs
  outside any lock, so a create that passes the guard before a cascade can land after it. Separately,
  `ItemStorage.deleteAllInCategory` does `repository.deleteAllInCategory` then the cache `removeIf` as two independent
  writes; a save interleaving between them leaves a row on disk that is absent from the cache — invisible until the
  next process restart. Both need the operations to interleave within a small window. Deferred rather than patched
  because every fix (a per-list mutex, re-checking inside the write's critical section) adds locking machinery for
  state Story 9.3 did not demonstrate reachable.
  **Rides along:** `runSchedulerCycle` reads `toDelete` from Mongo and then calls `storage.delete`, which throws
  `IllegalStateException("Item not found")` when a cascade removed the cache entry in between; `Scheduler.kt` catches
  and logs, so the remaining items simply wait an hour. Pre-existing — `deleteItem` takes the same path, so the
  client-side loop Story 9.3 REPLACED produced the identical race — but the cascade widens the window. A `try`/`catch`
  around the per-item delete inside the loop would close it.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-deleting-a-category-deletes-its-items-for-everyone.md`
  status: **OPEN — test hygiene, cheap.**
  summary: the "seed a category before saving an item" fixture is copy-pasted across eight sites in six Kotest files
  and belongs in the shared test utilities.
  evidence: Story 9.3 made a real category a precondition for EVERY `saveItem`, so six raw `client.post` blocks plus
  two private `saveCategory` helpers (`ItemLifecycleTest`, `SubscriptionScopingTest`) now express one repo-wide rule,
  each with its own copy of the comment. The review found the duplication had already propagated the defect it
  enables: six of the eight new sites shipped fire-and-forget, without the `shouldNotContain "errors"` assertion that
  `ItemApiTest` documents as mandatory (patched in that review, but the next copy-paste reintroduces it).
  **Shape of the fix:** one `saveCategory` helper beside `utils/TestContainers.kt`, asserting its own response, with
  the rationale stated once.

## Deferred from: code review of 9-4-deleting-a-user-leaves-no-phantom-memberships (2026-09-18)

- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-deleting-a-user-leaves-no-phantom-memberships.md`
  summary: Items in lists a deleted user merely belonged to keep `addedBy = <their username>`, so a deleted account's
  name goes on rendering on items in lists that survive the purge.
  evidence: `ListService.purgeUser` scopes the purge to `list_members` rows, the two member arrays and owned lists —
  `addedBy` is a denormalized username on `items` that user deletion never touched before this story either, so this
  is residue the story did not create and its intent does not cover. Settling it needs a product answer first (blank
  the field, keep it as a historical record, or show "deleted user"), then an `ItemRepository` sweep in the same purge.
