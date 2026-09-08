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
> **Format for new entries** (`bmad-build` step-02/step-04/step-oneshot, `bmad-code-review` step-04): append, do not
> edit existing entries, do not look for duplicates.
> ```markdown
> - source_spec: `{spec_file}`
>   summary: <one sentence>
>   evidence: <why this is real; for a maybe-false finding, what evidence would settle it>
> ```

## Epic 7 close-out (2026-08-21)

Full context: `epic-7-retro-2026-08-21.md`. Only the rows that are still open are kept here; the closed rulings (the
7.14 device install, the `autoUpdate` tab reload, the `main`-behind-production gap) are in the archive.

- ⏸ **`AdminUsers` is unpaginated — the product half is BACKLOG, the gate half is Epic 7 action `D4` and is OPEN.**
  The defect is real for any admin with a large user table, not merely a test-harness annoyance. **The gate half is NOT
  covered by the backlog routing**: the users table grows ~120 rows per full suite run, the create-user dialog measured
  **5015 ms against a 5000 ms assertion at 5497 rows**, and clearing the database only restarted the clock. Per-run data
  hygiene is owed regardless of when pagination happens. Mechanism and measurements: see the Stories 7.8 + 7.9 entry
  below. `sprint-status.yaml` action item **D4**, owner Murat, status `open`.

- **Gates cover code. Nothing covers the authoritative prose the next agent reads as binding — Epic 7 action `D2`,
  OPEN.** All **15** Epic 7 specs closed `followup_review_recommended: true`, and the reasons recorded in their own
  frontmatter are consistent: Story 7.1 — *"8 patches, all landed in the documentation/bookkeeping ~80% of the diff that
  no gate checks — including two factually false ledger prescriptions"*; Story 7.3 — *"11 patches, 8 of them in newly
  written authoritative prose: a false mobile-gate claim, a recovery command that could not work, a ledger action item
  aimed at a CI pipeline that does not exist"*; Story 7.14 — both reviewers independently found the same top defect and
  it was a **documentation inversion**, not a code one. This ledger, `AGENTS.md` and the spec bodies are all in that
  unchecked category. **A flag that fires 15/15 carries no information — the same defect Story 7.15 proved against
  `oversized`** (which fired 6/6 and trimmed 0/6; Spearman rho 0.000 against total findings, the *smallest* spec
  producing the *most*). **Action:** run the 15 deferred follow-up reviews, or recalibrate the flag the way 7.15
  recalibrated its own. `sprint-status.yaml` **D2**, owner Amelia, status `open`.

## Epic 5 close-out — carried forward (2026-07-28)

Full context: `epic-5-retro-2026-07-28.md`. The other rows in this section were closed across Epics 6 and 7 and are in
the archive.

- **FR42 (one-timer) / FR43 (recurring) item UI deferred by epic design.** Backend support is complete and live,
  including the hourly scheduler; the UI affordances were intentionally postponed. `AddItemDialog` sends
  `recurring: null`. UI-only work against a frozen, tested contract whenever it is picked up.
  **Its recorded prerequisite is discharged 2026-08-10 by Story 7.4:** BUG-E6-2 (an edit wiping `checkedAt` and so
  permanently hiding the item from the scheduler) is fixed, so shipping the lifecycle control no longer ships a way to
  silently break the feature the control exposes. One caveat now applies instead, and it is filed in the Story 7.4
  section below: `saveItem` can still produce `checked=true` with a null `checkedAt`, because `checked` is in
  `ItemInput` while `checkedAt` is server-owned. No UI path does this today; a FR42/FR43 UI must not introduce one.
  `sprint-status.yaml` carries this as an `open` backlog row (owner `md`); its stated blocker C1 is now done, so what
  remains is `md` revisiting the requirements.

- **Playwright `webServer` gaps, carried since Epic 3** (still unaddressed after the Epic 5 harness rebuild, re-verified
  2026-09-07 at `playwright.config.ts:64-74`): no teardown command (containers accumulate across runs), the `url`
  health check only proves the entrypoint responds — not that Ktor is warm inside the container (first tests can see
  502) — and no `stdout`/`stderr` filtering, so a compose startup failure silently burns the 600 s timeout before
  surfacing. This entry is the rollup; the concrete run it cost is filed under Story 7.1's review below, and the
  duplicate Epic-3 filings are in the archive.

## Deferred from: Story 7.1 — E2E suite inside the frontend quality gates (2026-08-07)

- **Type-aware linting is not enabled, so `@typescript-eslint/no-floating-promises` does not run — an un-awaited
  Playwright assertion still ships undetected.** This is the single highest-value remaining addition to the frontend
  static gate and the one rule class that would catch the canonical "assertion that never ran" defect
  (`expect(locator).toBeVisible()` without `await`). Story 7.1 audited all 2,474 lines of `e2e/` and found **zero**
  instances today, but nothing in the current rule set would catch a future one. **Why deferred (Story 7.1 Decision 9):**
  `bp_front/eslint.config.mjs` extends `tseslint.configs.recommended`, not `recommendedTypeChecked`, and
  `parserOptions` carries no `project`/`projectService` (re-verified 2026-09-07 — unchanged through the ESLint 10 bump).
  Switching it on changes the rule set for `src/` too, and that blast radius is unmeasured. **Natural home was
  Story 7.11 (ESLint 9→10), which did not take it** — the next time the lint config is opened deliberately.
  **Implementation trap, verified on `typescript-eslint` 8.65.0 — do not lose a cycle to it:** with a solution-style
  root (`bp_front/tsconfig.json` is `{"files": [], "references": [...]}`), the documented
  `parserOptions: {project: ['./tsconfig.json']}` **fails** with
  `Parsing error: The file was not found in any of the provided project(s)`, because typescript-eslint does **not**
  follow project references. Use `parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}` instead.

- **`codegen.ts` is still inside no tsconfig project.** `tsconfig.app.json` covers `src`, `tsconfig.node.json` covers
  `vite.config.ts`, and `tsconfig.e2e.json` covers `e2e` + `playwright.config.ts` — `codegen.ts` is the one remaining
  root file that `tsc -b` never sees (re-verified 2026-09-07). It *is* linted (the widened `eslint .` picks it up) but
  it is not type-checked. Deliberately out of Story 7.1's scope (Decision 8). Low severity — the file is 44 lines of
  codegen config. Fix by adding `codegen.ts` to `tsconfig.node.json`'s `include`; **verified sufficient on its own** —
  no `types` change is needed alongside it (`tsc -b` exits 0), contrary to this entry's first draft.

### Surfaced by the Story 7.1 code review (2026-08-07)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: the production frontend **image build** now type-checks the E2E suite, so one spec type error blocks the
  image — and the E2E `webServer` builds that image, so the suite cannot run to reveal what broke it.
  evidence: `bp_front/Dockerfile:11-12` is `COPY bp_front/ ./` then `RUN npm run build`, and the root `.dockerignore`
  excludes only `node_modules`, `dist`, `test-results`, `playwright-report`, `blob-report`, `.vite` — so `e2e/`,
  `playwright.config.ts` and `tsconfig.e2e.json` all enter the build context and `tsc -b` checks them inside the image.
  This is a direct and arguably *correct* consequence of AC1 ("`tsc -b` type-checks the spec files as part of the normal
  build"), but the coupling is new and unrecorded: a broken spec now fails the shipping artifact, not just the gate.
  Note that dropping `e2e` from the Docker context is **not** a fix — `tsconfig.e2e.json` would then raise `TS18003`.
  The clean options are building the image with `tsc -b tsconfig.app.json tsconfig.node.json`, or accepting the coupling
  deliberately and saying so.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `tsc -b` has no working incremental cache — all three projects fully re-check on every `npm run build`, and
  this story made that cost 50% larger.
  evidence: two consecutive `npx tsc -b --verbose` runs both print `Project 'tsconfig.e2e.json' is out of date because
  output file 'e2e/account.spec.js' does not exist` and rebuild everything. With `noEmit` and no `composite`, the
  `.tsbuildinfo` is written (337 bytes — not a real program graph) but never satisfies the up-to-date check. Pre-existing
  for the two original projects; Story 7.1 added a third without observing it. Low consequence today (full build ~2s).
  The `composite: true` + `noEmit: true` combination is accepted on TypeScript 6.0.3 and is the obvious thing to test —
  Story 7.1 rejected it only on "buys nothing here" grounds, which this finding contradicts. Compounded by the
  `tsc -b` no-`--force` entry under the 7.8/7.9 review below.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `npm run test:e2e` cannot reliably cold-start — Story 7.1's green run was obtained via `reuseExistingServer`
  after the documented command aborted, so the headline evidence is not reproducible by that command on a clean machine.
  evidence: the first invocation failed with `Error: Process from config.webServer exited early.` because
  `docker compose up -d --build` returns once containers are *started*, before Caddy answers on `:2080`; the stack was
  then hand-verified healthy (`/` → 200, `/api/graphiql` → 401) and the suite re-run against the same freshly built
  production image, giving 104/104. This is the concrete, now-observed consequence of the long-standing "Playwright
  `webServer` gaps, carried since Epic 3" entry above — recorded separately because that entry describes the gap in the
  abstract and this is a run it actually cost. A `webServer.url` health check that waits for real readiness would fix it.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `react-refresh/only-export-components` is still `error` for `vite.config.ts` and `codegen.ts`, which the
  widened `eslint .` newly lints and which the `bp/e2e-playwright` override's glob does not cover.
  evidence: the override is `files: ['e2e/**/*.ts', 'playwright.config.ts']`, while the base block is
  `files: ['**/*.{ts,tsx}']` (re-verified 2026-09-07). Neither tooling file violates the rule today (both export only a
  default config object), so this is latent, not live. Left alone deliberately: widening the override glob beyond what
  AC3 asked for was out of Story 7.1's scope. Fold `vite.config.ts` and `codegen.ts` into the override glob whenever the
  lint config is next opened. **Note the interaction with the 7.11 finding below:** the override's *existing* `e2e/**`
  entry is itself dead configuration, so this fix and that deletion touch the same three lines.

## Deferred from: Story 7.2 — shared E2E support module (2026-08-08)

Story 7.2 extracted the **eight helpers the epic named** into `bp_front/e2e/support/`. Everything below is duplication
that was measured and left in place.

**Read this list as a statement about provenance, not severity.** The selection criterion for what Story 7.2 extracted
was "the epic named these eight" — it was *not* "these are the worst duplication in the suite". Some rows below are
objectively larger than things that shipped. **Nothing here has been assessed and found acceptable. It has been
assessed and found out of that story's charter.** A later story should rank them properly. Counts below were measured
at `e4c54dc`; a 2026-09-07 re-measure over the current tree is given where it moved.

- **`withSecondActor(browser, baseURL, fn)` — 15 `browser.newContext({baseURL, ignoreHTTPSErrors: true})` sites across
  5 files** (`admin` ×5, `sharing` ×5, `item-editing` ×2, `lists` ×2, `shopping` ×1). **Re-measured 2026-09-07: 20 sites
  across 7 files** — `admin` 5, `sharing` 5, `item-editing` 3, `lists` 2, `navigation` 2, `item-attribution` 2,
  `shopping` 1. Still the largest single duplication in the suite, and it grew. **Any extraction must preserve the AC4
  caveat**: `browser.newContext()` does **not** inherit the project's `use` block, so a hand-built context silently runs
  at a desktop viewport on the `mobile` project. The convention the specs already follow — put the actor whose
  *rendering* the mobile gate must cover on the `page` fixture, the other in the hand-built context — is load-bearing
  and easy to lose in a helper. **This is now more consequential than when filed:** since Story 8.1 the `mobile` project
  renders at the 320px floor, so a hand-built context is not merely "desktop-ish", it skips the epic's geometry gate
  entirely.

- **`seedMembership(listId, owner, member, pw)` — 3 copies**, each a 4-line `loginApi`×2 + `gql`×2 block. Missed by
  Epic 7 planning entirely. Still no helper (`grep -rn seedMembership bp_front/e2e/` → 0, 2026-09-07). The cheapest
  remaining extraction, because both of its ingredients already live in `support/api.ts`.

- **`loginViaUi` — a helper in `admin.spec.ts`, inlined 4× elsewhere.** **Must not bake in success assertions**:
  `admin.spec.ts:133` calls it expecting a *failed* login. That constraint is why it was not folded into
  `registerViaUi`'s neighbourhood.

- **`backToLists` — a helper in `sharing.spec.ts`, inlined 3×**, one of which asserts on the URL instead of the
  `lists-page` testid. Converging them changes what one test asserts; that needs a decision, not a move.

- **`logoutViaMenu` — 2 copies, one missing the trailing `auth-page` assertion.** Same shape of problem: the copies are
  not equivalent, so extraction is a behaviour decision.

- **`uniqueName(label)` — 79 inline `` `<Label> ${Date.now()}` `` sites, no helper anywhere.** **Re-measured
  2026-09-07: 97 sites** (`item-editing` 36, `navigation` 20, `shopping` 19, `lists` 8, `sharing` 7,
  `item-attribution` 4, `auth`/`narrow-viewport`/`pwa` 1 each). By site count the single most repeated idiom in `e2e/`.
  Trivially extractable and deliberately untouched: it is not one of the eight.

- **The `ADMIN` credential literal — 5 sites, 3 shapes.** `{username: 'admin', password: 'admin'}` is a named const in
  `admin.spec.ts` and `navigation.spec.ts`, and a bare inline literal in `account.spec.ts`, `lists.spec.ts` and
  `sharing.spec.ts`. Natural home is `support/ui.ts`.

- **`DEFAULT_PW` vs `PASSWORD` — and a third, uncounted copy in `auth.spec.ts`.** `admin.spec.ts:18` holds the same
  `'e2e-password-123'` literal under a different name; the other six copies were converged into `support/ui.ts`'s
  `PASSWORD` by Story 7.2. Renaming `DEFAULT_PW` is an `admin.spec.ts`-wide edit for zero behavioural gain — left alone
  on purpose. **It is not the only surviving alias:** `grep -rn "e2e-password-123" bp_front/e2e/` returns **three**
  sites — `admin.spec.ts:18`, `auth.spec.ts:13` and `support/ui.ts:20`.

- **`auth.spec.ts` inlines the whole registration flow and was invisible to every measurement in Story 7.2.**
  `auth.spec.ts:18-28` is `registerViaUi`'s body verbatim as a *test body* (goto `/auth` → `to-register-link` → fill →
  submit → `not.toHaveURL(/\/auth$/)` + `app-bar`), and `:13` holds its own password literal, `:12` its own
  `mia_e2e_${project.name}_${Date.now()}` username shape (no label segment). Story 7.2's ground truth was measured with
  `grep "function <helper>"`, which by construction cannot see an inlined copy — **the same class of undercount that
  story corrected in three prior documents.** Deliberately left inline: registration *is* the behaviour `auth.spec.ts`
  asserts (FR1), so routing it through the shared helper would have the test exercise the helper rather than the flow.
  **The `toPass`-guard half of this entry was RESOLVED 2026-08-08 by Story 7.3** (it wants no guard, and neither does
  anything else — see the archive). The rest — the inlined flow, the third password literal, the label-less username
  shape — stays OPEN on its own merits.

- ~~**Shopping-checkbox selector split.**~~ **CLOSED 2026-09-07 by Story 8.3 (`spec-8-3-check-off-an-item-by-tapping-its-row.md`).**
  The split was: 9 sites reaching the checkbox as `shopping-item-<name>` + `getByRole('checkbox')`, and one dedicated
  `shopping-item-checkbox-<name>` testid in `navigation.spec.ts`. **Decision: ONE selector — the row.** Story 8.3 made
  the row element itself the control (`role="checkbox"` + `aria-checked` + the `Toggle <name>` accessible name on the
  element carrying `data-testid="shopping-item-<name>"`), so the question dissolved rather than being settled by taste:
  the MUI `Checkbox` is gone, there is no `<input>` left inside the row to reach, and the
  `shopping-item-checkbox-<name>` testid was deleted. Counted off the diff, not estimated: **10 sites** —
  `shopping.spec.ts` x7 (`:31`, `:43`, `:46`, `:47`, `:83`, `:192`, `:198` in the pre-change file),
  `item-editing.spec.ts` x2 (`:216`, `:233`), `navigation.spec.ts` x1 (`:257` — that is where the dedicated
  `shopping-item-checkbox-<name>` testid lived; the `:316` in the original entry above was already stale when it was
  written). **Each site was visited, not sed'd** — a descendant `getByRole('checkbox')` now matches nothing, and in
  `toHaveCount(0)`-shaped phrasings that would have passed silently instead of failing.

- **`lists.spec.ts`'s four inline `addCategory`/`addItem` blocks are NOT a cleanup candidate — leave them.** Two are
  deliberately *weaker* than the shared helper (they omit the dialog assertions) and one is deliberately *stronger* (it
  asserts the item row scoped **under its category row**, which is the whole point of that test). Replacing them would
  silently add assertions to the FR46 cascade test and **lose** the nesting check. Likewise `createListViaUi` is a
  genuinely different function from `createListAndOpen` — it returns `void` and stays on `/lists`, where
  `createListAndOpen` returns the list id and navigates into the detail. Kept OPEN as a standing guard on the extraction
  items above, not because work is owed: a future "finish the job" story must not treat these as leftovers.

## Deferred from: Story 7.3 — delete the `registrationEnabled` race (2026-08-08)

- **A red `chromium` or `mobile` now costs the FR20/FR21 toggle coverage entirely — measured, not assumed.** With one
  chromium test deliberately failing, the run reported `1 failed / 2 did not run / 101 passed` and exited `1`: both
  `registration-toggle-*` tests were **not executed**. Playwright's wording is "did not run", not "skipped", and a
  single failing dependency project is enough. This is the accepted price of `dependencies` and the run is already red
  either way, but it has a real consequence: **any failing run gives you zero information about FR20/FR21**, so a
  regression in the registration toggle can hide behind an unrelated failure across several red runs. Mitigation if it
  bites: `npx playwright test --project=registration-toggle-chromium --no-deps` — **`--no-deps` is load-bearing:**
  without it the command re-runs the still-broken dependency and fails identically (`globalSetup` still runs under
  `--no-deps`, so registration is still enabled).
  **The real fix candidate is `testProject.teardown`, and it was never evaluated.** The config comment written by this
  story claimed `dependencies` is "the only Playwright construct that orders work across projects" — that is false.
  `teardown` also orders across projects, and unlike `dependencies` it still runs when the run is red, which would
  dissolve this entire cost rather than mitigate it. The alternatives that *were* weighed were `mode: 'serial'`
  (rejected: wrong scope) and a worker-scoped file lock (rejected: re-introduces waiting at every register site).
  **Action:** evaluate a teardown-project ordering before accepting this cost as permanent.

- **The whole mechanism is prose-and-config with no machine gate — the same failure mode as the Story 7.2 review's
  "five invariants, zero gates" entry.** Nothing stops a future test from calling `setRegistrationEnabled` without the
  `@registration-toggle` tag, and nothing stops the `grepInvert` being dropped from one project; either silently
  restores the exact race this story deleted, and the deleted `toPass` guard means the next occurrence fails loudly
  rather than being retried away (which is the intent, but only if someone reads the failure correctly). The cheap
  enforcement is an ESLint `no-restricted-syntax`/`no-restricted-properties` rule banning `setRegistrationEnabled`
  outside `admin.spec.ts` + `global-setup.ts`; blocked here by the story's own "config/lint files untouched" boundary.
  Group it with the 7.2 review's `testMatch`/`no-restricted-imports` item — one small "gate the E2E invariants" story
  would discharge all three.

- **`retries: process.env.CI ? 2 : 0` points at a pipeline that does not exist in this repo — and the "masked by CI
  retries" narrative repeated across three epics therefore names the wrong mechanism.** Re-verified 2026-09-07: there is
  still no `.github/`, no `.gitlab-ci.yml`, no CI workflow of any kind; the only E2E entry point is
  `mise run front:e2e` → `npm run test:e2e` with `CI` unset, i.e. **`retries: 0`**. So the `retries: 2` branch has, as
  far as this repo shows, never executed. Whatever actually absorbed the seven acceptances is undocumented, and the
  story records that repeat the "CI retries healed it" line are propagating an unverified premise. **Action:** either
  stand up the CI pipeline the config already assumes, or delete the `process.env.CI` branch so the config stops
  describing infrastructure that does not exist. **Note the Story 8.2 entry below still reasons from "CI runs at
  `retries: 2`"** — that premise is this entry's subject.

## Deferred from: Story 7.4 — an item edit merges the stored item (2026-08-10)

Story 7.4 turned `ItemService.saveItem` into a **merge**: it loads the stored row with
`storage.getByIdCached(item.id, item.listId)` and, when the row exists, `copy()`s onto it only the five fields
`ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`). The direction is deliberate — copying the
input **onto** the stored row is an allowlist, so a field added to `Item` later is preserved by default. BUG-E6-1 and
BUG-E6-2 are closed (archive); BUG-E6-3 is partial. What follows is what the story knowingly did **not** take, plus one
thing the merge newly makes possible. All re-verified against `ItemService.kt` on 2026-09-07.

**Read the first three entries as scope decisions, not discoveries.** Each was put to `md` on 2026-08-10 and answered
as a ruling *before* any code was written; they are filed so that a later "tightening" is recognised as re-opening a
decision rather than fixing an oversight.

- **`saveItem`'s create branch still accepts a `category` that belongs to no list** (`md`'s ruling A: the check is
  **update-only**). **There IS a UI-reachable producer, and it is a two-member race, not an exotic client.** Removing a
  category from `/lists/:id` hard-deletes that category's items **first** and the category second. So if member B
  removes a category while member A's edit dialog is open on one of its items, A's save finds the id gone from storage
  **and** gone from Mongo, takes the **create** branch — the branch this ruling deliberately leaves unguarded — and
  resurrects the item carrying the now-deleted category. That composes the two holes this story knowingly left open
  (the unguarded create branch here, and BUG-E6-3a's resurrection below) into BUG-E6-3b's state through a path a normal
  user can walk. **Price this entry accordingly: it is not "direct API callers only".**
  **The resulting item is not invisible on both screens.** `/list/:id` renders it under the synthetic `Uncategorized`
  bucket; only `/lists/:id` hides it, because that screen groups strictly by known category. The accurate description
  of the end state is **visible on the shopping view but unreachable for editing or removal on the management view**.
  **The cost of closing it, measured at `73db447` rather than estimated:** `grep -c "saveItem(" *.kt` over
  `bp_back/src/test/kotlin/com/bagplease/` returns **32 hits across seven files**; two are `ItemLifecycleTest`'s own
  helper declaration and its mutation string, so there are **30 invocations, of which 29 across six files invent a
  `catId` and never create the category**. Re-measured by hoisting the guard out of the update branch: **10 of the 25
  `ItemLifecycleTest` tests went red**, the ruling-A tripwire among them. **The cheap partial, if this is ever picked up
  under time pressure:** reject a category that exists on *another* list even on create. That is the half with a real
  victim, and **no existing test does it**, so it costs nothing. The expensive half — rejecting a category that exists
  nowhere — is what the 29 sites pay for.
  A tripwire test guards the current behaviour: `7.4 AC4 a CREATE with an unknown category is still accepted (ruling A
  tripwire)` in `ItemLifecycleTest`. Tightening the scoping must delete or rewrite that test deliberately.

- **`Item.category` has no schema-level referential integrity, and after this story the only guard is service-layer
  and update-only.** Mongo stores the category as a bare string UUID on the item document; nothing at the storage or
  schema layer relates it to the `categories` collection, and `deleteCategory` does not re-home or reject items that
  point at it. The service check added by AC4 is therefore the *entire* integrity mechanism, it runs on one of two
  branches, and it is enforced per-write rather than as an invariant. Recorded so that "categories are validated now"
  is not read as more than it is.

- **The `BAD_USER_INPUT` error shape was declined** (`md`'s ruling B). AC3 and AC4 `throw IllegalArgumentException`
  from `ItemService`, and `ItemApi.kt` has no try/catch, so both surface as graphql-java's default
  `ExceptionWhileDataFetching` with **no `extensions.code`** — measured verbatim:
  `{"errors":[{"message":"Exception while fetching data (/saveItem) : Category <uuid> does not belong to list <uuid>",
  "locations":[…],"path":["saveItem"]}]}`. The frontend can therefore only branch on the message string. Why declined
  rather than fixed: the four `GraphQL*Exception` classes live in `bp_back/src/main/java/com/bagplease/plugins/` and are
  imported **only** by `*/gql` files, so throwing one from a service would be a service→plugins layering violation;
  getting a typed code any other way means editing `ItemApi.kt`, which was outside the scoped unfreeze. This is the same
  debt already on file as the **"AC7 error shape"** bullet under the `4-1` section below — that entry is about
  `ListService`'s over-long-name rejection and this is its second instance. Whoever picks up either should pick up both,
  and should decide the *shape* once (a `GraphQLBadRequestException` thrown from the `gql/` layer after the service
  returns a typed Left is the obvious candidate, but it changes `saveItem`'s `Either<ListAuthError, Item>` Left type).

- **BUG-E6-3a — a save against a hard-deleted id resurrects the item. Severity-downgraded by Story 7.4, NOT fixed
  (AR-E7-2a).** BUG-E6-3's parent entry covered both halves; **(b) the dangling-category half is fixed by AC4, (a) this
  half is not.** What the merge changes: `ItemStorage.delete` is a **hard** delete, so a subsequent save against that id
  misses `getByIdCached`, takes the **create** branch, and is written as a new item — `addedBy` = the editor,
  `checkedAt` null, and the result is visible and removable through the UI. Before the merge the same write reconstructed
  a row from `ItemInput`'s defaults and the outcome was indistinguishable from silent corruption. So the remaining
  defect is a **stale-dialog UX race** — B deletes an item while A's edit dialog is open, A saves, the item comes back —
  not a data-integrity failure.
  **The real fix is soft-delete tombstones that the scheduler owns:** make `deleteItem` set `deleted`/`deletedAt`
  instead of removing the row (`getByIdCached` already does not filter `deleted`), let `saveItem` see the tombstone and
  reject the write, and give the existing `findSoftDeletedToHardDelete` reaper the job of collecting them. That changes
  the delete contract, the reaper's retention window and the subscription's `DELETED` semantics all at once. **Do not
  close this entry as "fixed by 7.4"** — it was downgraded, not resolved. Client-side mitigations (refetch-before-save,
  clearing `editItemTarget` when the item leaves `items`) only shrink the window.

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

- **`/lists` for a user with no lists is a route whose only exits are the user menu and creating a list.** For that
  user home resolves *to* `/lists`, so the title link is correctly inert there, and `/lists` has no back affordance of
  its own — leaving `user-menu-button` as the single in-app navigation control on the screen. Harmless in a browser
  tab, but **Story 7.14 shipped the PWA, whose standalone display removes both the URL bar and the browser Back
  button**, and the `exits` test asserts the user menu as the affordance of record precisely because it is load-bearing
  there. An empty `/lists` in an installed app is one menu away from being a dead end.

- **Nothing mechanically prevents a third `createdAt` sort site from reappearing with `localeCompare`.** Both existing
  copies call `byCreatedAtAsc`, and `grep -rn "createdAt.localeCompare" bp_front/src/` is zero — but that is a
  measurement, not a guard. `grep -rn "localeCompare" bp_front/src/` still returns legitimate *name* sorts, so a blanket
  ban is not the answer. The real guard is a lint rule scoped to the `createdAt` property, or a convention that any
  timestamp ordering imports the shared comparator. **Story 8.5 ("the same list reads the same way on both screens")
  adds a shared ordering comparator and is the natural place to land the guard alongside it.** The cost of rediscovery
  is one more ~1-in-1000 wrong-list bug.

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

- **One full-suite run went red immediately after `docker compose up -d --build --force-recreate` and could not be
  reproduced.** Three `mobile` tests failed — `admin.spec.ts:110` (FR16/FR17 password reset), `:145` (FR15/FR17 delete
  user) and `:219` (FR30/FR31 non-admin redirect) — on the first traffic against the freshly recreated stack, with the
  two toggle projects then reporting "did not run". The next three consecutive full runs at `retries: 0` were
  `118 passed`, 0 flaky, and three isolated `--project=mobile --no-deps` runs of `admin.spec.ts` passed 4/4 each time.
  **The failure text was not captured** (the console output was `tail`-ed and the following green run overwrote
  `test-results/`), so this entry cannot name a cause — the honest statement is that the first run against a
  cold-started backend failed three admin tests and no run since has. Filed rather than dismissed because it is exactly
  the shape of cold-start flake the epic's "green at zero retries, measured twice" requirement exists to catch, and the
  next occurrence should be captured with `--reporter=list 2>&1 | tee` before the report is overwritten. Suspected but
  unverified: JVM/Mongo cold start under 118 concurrent tests. **Note the three failing tests are all in
  `admin.spec.ts`, which is also where the size-driven `createUserViaUi` defect lives** — do not conflate them without
  the captured text.

## Deferred from: Story 7.6 — backend safety fixes riding the same unfreeze (2026-08-12)

Story 7.6 closed four Epic-4 review entries under the epic's scoped backend unfreeze (all struck through in the
archive). What follows is the residue it deliberately did **not** take on. All re-verified against `bp_back/` on
2026-09-07.

- **`@Volatile` fixes the visibility half of the lazy-sync race and leaves the check-then-act window open.** All three
  `sync()` guards are still `if (synced.not()) { <suspending repository.getAll()> ; synced = true }`, so two coroutines
  arriving before either finishes can both read `false` and both run the startup load. What the fix buys is that once
  one of them writes `true`, every other thread reliably *sees* `true`.
  **The double load is NOT merely wasted I/O.** The two passes are only idempotent if no write interleaves, and one
  can: `sync()` takes its snapshot at the suspending `repository.getAll()` and writes it into the map *afterwards*, so
  if coroutine A finishes its own sync and then `save()`s a row while coroutine B is still suspended inside `getAll()`,
  B's resume replays the stale snapshot over A's row. Nothing ever resets `synced`, so the in-memory value stays stale
  for the process lifetime while Mongo holds the new one. The `delete`/`evictList` variant is worse: an in-flight stale
  sync can re-insert a row already hard-deleted from Mongo. This is reachable on every cold boot, not only in theory —
  `configureScheduler` (`plugins/GQL.kt:89`) runs `runSchedulerCycle()` immediately and it calls
  `storage.save`/`storage.delete`, so the scheduler races the first HTTP request on `synced`.
  **Proposed fix:** a `kotlinx.coroutines.sync.Mutex` held across the load (`synchronized` is not an option — the body
  suspends), or an `AtomicBoolean.compareAndSet` gate with a `CompletableDeferred` the losers await. **Why deferred:**
  Story 7.6's AC1 required the guard body otherwise unchanged, and the spec explicitly forbade substituting a
  `Mutex`/double-checked lock/`AtomicBoolean` as "a different, larger fix". That larger fix wants its own story and its
  own red observation.

- **`findByListIdAndUserId` will throw on a `list_members` row carrying an unknown `status`.** The mapper does
  `MemberStatus.valueOf(mongo.status)` (`MongoListMemberMapper.kt:13`). **The precedent is weaker than it looks:**
  `MongoItemMapper.kt:33` is `item.recurring?.let { Recurring.valueOf(it) }` over a **nullable** field, so absence is
  tolerated; `status` is non-nullable and has no equivalent tolerance. And this is a behaviour *change*, not just an
  unfixed gap — before Story 7.6 an unrecognised status simply failed the `!= "DECLINED"` / `== "PENDING"` string
  comparisons and the request completed, whereas now the mapper throws before the service sees anything. The two hot
  paths are safe by construction — `findActiveByListId` and `findPendingByUserId` filter status **at the database** —
  but `findByListIdAndUserId` filters on `_id` alone and is called from `shareList`, `acceptInvite` and `rejectInvite`,
  which would surface an `IllegalArgumentException` as an untyped `ExceptionWhileDataFetching`. **Why not fixed:** every
  candidate fallback invents a semantic that needs a ruling — unknown → `DECLINED` silently hides a member, unknown →
  `PENDING` invents an invite, and skipping the row makes a re-share overwrite it. **Proposed fix (needs `md`'s
  ruling):** decide the semantic, then either add a nullable `MemberStatus.parse()` and treat `null` as "no membership
  row", or filter `findByListIdAndUserId` on the same status whitelist the other two already use. Unreachable today:
  nothing writes a status outside the three enum names.

- **STANDING ASSUMPTION (`md`'s ruling, 2026-07-29), not debt: production is assumed to hold no already-orphaned
  `list_members` rows, and Story 7.6 shipped no migration, backfill or cleanup script.** The cascade fix prevents *new*
  orphans from list deletion only. **If an orphaned `list_members` row is ever observed in production it is a NEW
  finding and must not be triaged as a regression of this story.** Orphans are invisible through the API
  (`ListService.getLists` `mapNotNull`s them away), so detection needs a direct query: compare
  `db.list_members.distinct("listId")` against `_id` on `lists`.
  **A second leak path is still open and known, and that query cannot see it.** `UserService.adminDeleteUser`
  (`entity/user/UserService.kt:84-88`, re-verified 2026-09-07) deletes the user row and never touches `list_members` —
  it holds no `ListMemberRepository` at all — so deleting a user still strands every membership row they held. Those
  orphans are keyed by a live `listId`; catching them needs `db.list_members.distinct("userId")` compared against `_id`
  on `users`. The honest form of the assumption is therefore: *list deletion* no longer leaks; *user deletion* still
  does. (The user-deletion leak is also filed on its own under the 7.6 review below, with its user-visible consequence.)

- **`ListMemberRepository.findActiveByListId` and `GqlListMapper` express "active member" with two non-equivalent
  predicates.** The repository uses a positive whitelist (`Filters.in("status", PENDING, ACCEPTED)`); the mapper uses a
  negative one (`!= MemberStatus.DECLINED`). They agree on today's three-value enum and would disagree the moment a
  fourth status exists — the repository would exclude it, the mapper would include it. Story 7.6 typed both sites and
  deliberately did **not** reconcile them, because picking one decides where a future status is visible, which is a
  product call. **Proposed fix:** when a fourth status is introduced, define the active set once on `MemberStatus`
  (e.g. `val ACTIVE: Set<MemberStatus>`) and have both sites read it. Zero consequence today.

**Still open, restated here because Story 7.6 worked in their neighbourhood without closing them** (each stays live in
its own section below — this is a pointer, not a second copy; the numeric labels are pre-triage line references and now
resolve only against `deferred-work-archive.md`):

- `831` / `822` — **`ListStorage.getByIdCached` bypasses `sync()`**, so `isMember` can deny a legitimate member on a
  cold cache and can keep admitting a revoked one. This is the **read** side of the same lazy-sync bug whose write side
  Story 7.6 made visibility-safe, and `@Volatile` does nothing for it: the method never consults `synced` at all.
- `771-776` — `ListStorage.rename` is still not atomic (in-memory updated before the Mongo write, `ListStorage.kt:41-47`),
  and the concurrent delete+rename race still throws `IllegalStateException` past the GQL error model.
- `836` — `ListStorage.delete()` is still dead code; `ListService.deleteList` still calls `listRepository.delete` +
  `evictFromCache` directly (`ListService.kt:117-123`).
- `812` — the `acceptInvite` TOCTOU double-accept race is **still live; only its wording is now stale.** The check is
  `member.status != MemberStatus.PENDING`; typing it changed nothing about the race — the check and the
  `listStorage.save` of `members + callerUser.id` are still two steps with a suspending write between them.
- `814` — a re-invite after a DECLINE still overwrites the original `createdAt`; `shareList` still constructs
  `ListMember(..., Instant.now())` and upserts over the existing `_id`.
- `832` — **`deleteList`'s partial-failure window is one Mongo call LONGER because of Story 7.6.** The block is
  `deleteAllInList(items)` → `deleteAllInList(categories)` → `deleteAllInList(members)` → `listRepository.delete(id)` →
  three `evict*` calls. **The ordering is NOT a mitigation.** If `listRepository.delete(id)` throws, the list survives
  and its membership rows are already gone, and the "a restart re-syncs from Mongo" consolation does not apply to
  `list_members` at all — there is no in-memory membership cache, so those rows are gone permanently. Concrete
  user-visible result: previously-ACCEPTED members keep access (authorization reads `List.members`/`memberUsernames`,
  not the collection) while vanishing from the Share dialog, and re-inviting them raises `AlreadyMember`. **Neither
  order is failure-safe** — only a single Mongo session/transaction across the four deletes would be. Filed as its own
  entry under the 7.6 review below.

## Deferred from: Story 7.7 — minor and patch dependency sweep (2026-08-12)

**No version was reverted under S-AC3.** The entries below are the deliberate holds and the pre-existing drift the
sweep surfaced. The `typescript-eslint`/TS-7 deadlock prediction and the `allowScripts` drift are both discharged and
are in the archive.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the Gradle wrapper is held at 9.6.1 while 9.7.0 is released. **Named blocking symptom:** `bp_back/Dockerfile:1`
  is `FROM gradle:9.6.1-jdk25`, so the shipped image builds with the **image's** Gradle; a wrapper-only bump puts local
  builds and the shipped artifact on different Gradle versions, which is a build-path divergence, not a preference.
  evidence: `./gradlew dependencyUpdates` reports `Gradle release-candidate updates: - Gradle: [9.6.1 -> 9.7.0]`.
  AC1's claim that the wrapper is "already current" is false and is recorded as such. Re-verified 2026-09-07: both
  `gradle/wrapper/gradle-wrapper.properties` and `bp_back/Dockerfile:1` still read 9.6.1, so the pair is coherent and the
  hold stands. Proposed fix: its own story, as a two-file change (wrapper properties + Dockerfile base tag) with its own
  `docker compose up --build` + E2E verification.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `kotest-property` is declared in `bp_back/build.gradle.kts` and used nowhere; the sweep bumped it rather
  than dropping it.
  evidence: `grep -rn 'Arb\.\|checkAll\|forAll' bp_back/src/test/` returns nothing. Still declared at
  `gradle/libs.versions.toml:41` on 2026-09-07. Removing a dependency was scope bleed under S-AC4, so it moved with the
  rest of the `kotest` ref. Proposed fix: delete the line in a dedicated cleanup, or write the property tests it was
  added for.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the lists index renders in a non-deterministic order, because `ListStorage.getAll()` returns
  `storage.values.toList()` off a `ConcurrentHashMap`.
  evidence: found while comparing S-AC2 screenshots. Two users who each created `Groceries` then `Hardware` render as
  `Groceries, Hardware` and `Hardware, Groceries` respectively, on the **same** build — so the order is hash-order of
  the UUID keys, not creation order. Confirmed unchanged at `ListStorage.kt:32-35` on 2026-09-07. It does not affect
  FR38 home resolution, which sorts numerically via `byCreatedAtAsc`. Proposed fix: sort in `ListService.getLists` (or
  the page) by `createdAt` using the same numeric comparison, so the index agrees with the resolved home. **Note the
  scope boundary against Epic 8:** Story 8.5 unifies ordering *within* a list (categories and items across the two list
  screens); the order of the lists index itself is a different surface and is not in its `Delivers:` line.

## Deferred from: Stories 7.8 + 7.9 — @types/node 26 and Vite 8 (2026-08-13)

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The `createUserViaUi` flake is SIZE-DRIVEN, not random, and its mechanism is measured.** The admin panel
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

## Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15)

One held-back major, with its blocking symptom reproduced in this repository. The story closed `done` (S-AC3): a
held-back dependency closes its story rather than failing it. Re-verified 2026-09-07: `bp_front/package.json` still
pins `"typescript": "6.0.3"`.

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: **`typescript` is held at `6.0.3` while `7.x` is `latest`.** The blocking symptom is `typescript-eslint`:
  **no published version admits TypeScript 7**, and the whole static lint gate dies at module load under it. Version
  attempted: `7.0.2`. `6.0.3` is the newest stable 6.x, so this is a clean hold at the top of 6, not a lag.
  evidence, measurement 1 — the registry (2026-08-15): `npm view typescript-eslint@latest peerDependencies` →
  `{"eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0"}`; `canary` (8.67.1-alpha.4) also declares
  `<6.1.0`. The defensible claim: **no stable release, and neither published prerelease channel (`canary`, `rc-v8`),
  admits TS 7.** Do not restore "every published release" — 22 of the 105 stable 8.x releases declare no `typescript`
  peer at all, and no prerelease was swept. The *conclusion* does not rest on the sweep — see measurement 3.
  evidence, measurement 2 — the install, in the real tree: `npm install typescript@7.0.2` **succeeded, exit 0**, with
  `npm warn ERESOLVE overriding peer dependency` — npm treats an explicitly-versioned install target as authoritative.
  **`--legacy-peer-deps` was never needed and never used.** Do not plan a future attempt around a hard install failure:
  **the peer conflict does not stop you, the runtime does.** The blocking peer is declared by exactly 8 packages
  (`typescript-eslint` plus seven `@typescript-eslint/*`); the other `typescript` peers in the lockfile
  (`ts-api-utils`, two `cosmiconfig` copies) are open-ended and do not block TS 7.
  evidence, measurement 3 — the lint gate, verbatim from `npm run lint` with TS 7.0.2 installed, **exit code 2**:
  ```
  typescript-eslint does not support TS 7.0.
  ...
  Error: typescript-eslint does not support TS 7.0.
      at Object.<anonymous> (.../node_modules/typescript-eslint/dist/index.js:52:11)
  ```
  It throws at **module load**, in the config's own import — so `eslint .` lints **zero files** and reports no rule
  results at all. The upstream issue tracks support for TS **>=7.1**, not 7.0.
  root cause, measured in-tree: TS 7 is the native (Go) port and **ships no JavaScript compiler API**. With 7.0.2
  installed, `node -e "console.log(Object.keys(require('typescript')))"` → `[ 'version', 'versionMajorMinor' ]` and
  `typeof ts.createProgram` → `undefined`. `@typescript-eslint/typescript-estree` `require`s that API. So this cannot
  be waved through with a range override.
  **The finding worth keeping — this codebase is already TS-7-clean.** With TS 7.0.2 installed:
  `npx tsc -b tsconfig.json --force` → **exit 0, zero diagnostics**, and each project individually → exit 0. No
  `@ts-ignore`, `@ts-expect-error` or weakened compiler option was added. That separates **"our linter is not ready"**
  from "our code is not ready" — only the former is true. **Scope this expectation honestly:** the exit-0 was measured
  under **7.0.2**, against the tree at `853b599`, on **glibc linux-x64 only**. The compiler that eventually lands will
  by construction not be 7.0.2 (support starts at ≥7.1), and the tree has since absorbed Stories 7.11–7.15 and Epic 8.
  Re-run `tsc -b --force` under the actual 7.x before scoping the retry as one line. The **Alpine/musl image was never
  built under TS 7** — `docker compose build bp_front` is an unexercised path.
  **Rejected escape hatch: the sanctioned side-by-side / dual-TypeScript install** (alias TS 6 in so `typescript` still
  resolves to a compiler API). Refused on S-AC3 — "a failed bump is reverted and recorded, never worked around" — which
  is by itself sufficient. Two supporting arguments were recorded and are weaker than they read: that it would
  *downgrade* the linting compiler rests on `@typescript/typescript6`'s published `latest` being `6.0.2`, a version
  that can move; and that it would split the codebase across two type systems is a *prediction* this story's own
  evidence points against (TS 7.0.2 and TS 6.0.3 were both measured clean here). Do not re-present the refusal as three
  co-equal measured grounds.
  **And the hold imposes an inverse constraint on any `typescript-eslint` move:** whatever version lands must still
  declare a `typescript` peer admitting the held **6.0.3** — i.e. the `<6.1.0` line. 31 of the swept releases declare
  `>=4.8.4 <6.0.0`, which does *not* admit 6.0.3, so an ESLint-driven move of `typescript-eslint` could re-open the
  same conflict from the other side.
  **Re-check trigger, concrete.** Watch <https://github.com/typescript-eslint/typescript-eslint/issues/10940>. (Read
  2026-08-15: open, labelled *blocked by external API*, maintainers describing tsgo as "many months away from being
  stable". That reading was **not** captured to an evidence file — treat the issue's state as needing a fresh look.)
  **The test must be a disjunction, not a single `@latest` peer-range check.** **Any** of these qualifies: the
  `typescript` peer's upper bound admits 7.1+; the peer is dropped or made optional; a new peer on the native compiler
  appears; or a `canary`/`rc` release or the release notes announce TS 7 support. Check `npm view typescript-eslint
  dist-tags` and the release notes, not `@latest` alone. **Whatever the signal, the decisive confirmation is
  behavioural:** install the candidate pair and confirm `npm run lint` lints a non-zero number of files, since the
  refusal is a runtime check.
  When it lands, re-run this story: bump the pinned `"typescript"`, bump `typescript-eslint` to the enabling version,
  then `npm run lint` + `npm run build` + the full four-project Playwright suite + `docker compose build bp_front` (the
  musl path, never exercised under TS 7). Expect the tsconfigs to need nothing.
  Proposed fix: **OPEN — this is a live obligation, not a closed item.** No code change is owed today, but the re-check
  must actually be performed before any future TypeScript attempt, and nothing in the story workflow will resurface it
  now that 7.10 is `done`. Tracked as an open `action_items` entry in `sprint-status.yaml` (owner Amelia).

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: **TypeScript 7 drops `tsserver` from the npm package**, which no gate in this project can see and which will
  matter to editor tooling on the day the bump finally lands.
  evidence: measured in-tree with 7.0.2 installed — `node_modules/typescript/bin/` contains only `tsc`, where 6.0.3
  ships `tsc` **and** `tsserver`. Every editor/LSP integration in this repo's workflow resolves the workspace
  `typescript` for its language server, and the project's global directive is to use an LSP server where one is
  available. Nothing in `npm run lint`, `npm run build`, `docker compose up --build` or the Playwright suite touches
  `tsserver`, so **all four gates would stay green while in-editor type intelligence silently stopped working**.
  Proposed fix: when the TS 7 bump is re-attempted, verify the editor path explicitly as a named acceptance step,
  rather than inferring editor health from four green gates that cannot observe it.

## Deferred from: Story 7.11 — ESLint 9 → 10 (2026-08-16)

The `rule_count` entry from this section is superseded: `_bmad-output/project-context.md` was retired on 2026-09-07
(commit `f3a6098`, replaced by the repo's `AGENTS.md` block), so the metric it argued about no longer exists.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `bp_front/eslint.config.mjs`'s `'react-refresh/only-export-components': 'off'` override for `e2e/**`
  is **unreachable configuration**, and has been since Story 7.1 introduced it.
  evidence: `eslint-plugin-react-refresh/index.js:36-40` returns `{}` for any filename containing `.spec.`, then
  gates on `shouldScan = filename.endsWith(".jsx") || filename.endsWith(".tsx") || checkJS && filename.endsWith(".js")`.
  All files matched by the `bp/e2e-playwright` block are `.ts`, so the rule never runs there regardless of the override.
  Measured with a control on the bumped tree: a component plus a non-component function appended to the `.ts` file
  `src/lib/lists/homePath.ts`, where the rule resolves to `[2]`, reports nothing (exit 0), while the same shape in the
  `.tsx` file `src/components/StoreField.tsx` reports 1 error. Consequence beyond the dead line itself: the epic's AC3
  premise ("Story 7.1 excluded the rule from `e2e/` so the shared support module is legal") is **mistaken** — the module
  was always legal — and Story 7.11's first draft recorded the e2e silence as a falsification, which is the
  assertion-that-cannot-fail defect class the Epic 6 retro named.
  Proposed fix: either delete the override and assert `npm run lint` still exits 0 (cheapest, and honest), or keep it
  and make it load-bearing with a component-shaped `.tsx` fixture under `e2e/`. Do **not** leave it carried forward as a
  verified invariant across the next ESLint major. **Touches the same three lines as the 7.1-review entry that wants
  `vite.config.ts` and `codegen.ts` folded into that override's glob** — do both at once.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `bp_front/package.json` declares **no `engines` field**, while ESLint 10 narrowed the Node floor further than
  anything else in the toolchain — so a Node that builds, type-checks and E2E-tests this project can silently fail to
  lint it.
  evidence: `eslint@9.39.5` engines were `^18.18.0 || ^20.9.0 || >=21.1.0`; `eslint@10.8.1` is
  `^20.19.0 || ^22.13.0 || >=24` (both read from the lockfiles). `vite@8` admits `^20.19.0 || >=22.12.0`. So Node
  22.12.x and 23.x pass every other gate and cannot run `npm run lint`, and `npm` only emits an `EBADENGINE` **warning**.
  The two paths actually in use are fine (`mise.toml:6` = the floating major `26`; `bp_front/Dockerfile:7` =
  `node:26-alpine`), so nothing is broken today — this is an unpinned floor, not a live defect. Re-verified 2026-09-07:
  still no `engines` block. **This is one of three entries asking for the same field** (see the 7.13 graphql-17 Node
  floor and the 7.8/7.9 review's `@types/node` pairing); one `engines` edit discharges all three, but they disagree on
  the range — settle the range once. Deliberately not done in Story 7.11: S-AC4 scoped it to version numbers.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: The `ignores`-integrity proof exercises only 2 of the array's 7 entries, and `npm run lint` cannot go red on
  a warning-only ignores regression anyway.
  evidence: `eslint.config.mjs:11-19` lists `dist`, `src/__generated__`, `test-results`, `playwright-report`,
  `blob-report`, `playwright/.cache`, `e2e/.auth`. Three of those do not exist on disk and two contain no lintable
  file, so the before/after linted-file-set comparison genuinely tests only `dist` and `src/__generated__`. Compounding:
  `package.json` runs `eslint .` with no `--max-warnings 0`, and `src/__generated__` under `--no-ignore` yields exit 0
  with a *warning*, so a regression there would not redden the gate — the manual sorted-list diff is the only detector
  and no gate re-runs it.
  Proposed fix: `--max-warnings 0` on the lint script, and if the ignores array is to be treated as verified, a
  throwaway `.ts` under each output directory before capturing the set.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `eslint.config.mjs` lints itself with an empty rule set — it is one of the 52 files in the linted set but
  matches neither `files` block.
  evidence: the config's two rule-bearing objects are `files: ['**/*.{ts,tsx}']` and
  `files: ['e2e/**/*.ts', 'playwright.config.ts']` (unchanged 2026-09-07). The measured set is 26 `.tsx`, 25 `.ts` and
  1 `.mjs`; the `.mjs` is the config itself, walked and reported as linted while carrying no rules. Pre-existing, not
  caused by the bump.
  Proposed fix: add `'**/*.mjs'` to the first block's `files`, or accept it knowingly — but stop counting it as a
  linted file in evidence about gate coverage.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `eslint` and `@eslint/js` are now independently versioned behind caret ranges with an **optional** peer, so
  nothing mechanical keeps them coherent.
  evidence: `eslint@10.8.1` no longer depends on `@eslint/js` at all (9.39.5 pinned it exactly), and `@eslint/js@10.0.1`
  declares `eslint: ^10.0.0` with `peerDependenciesMeta.optional: true`. `package.json` carries `^10.8.1` and `^10.0.1`
  (unchanged 2026-09-07). npm will therefore accept any `^10` combination silently, and `js.configs.recommended` is
  where new rules arrive — so a future `@eslint/js` minor can redden lint with no `eslint` bump and no signal that
  anything moved.
  Proposed fix: pin both exactly, which is already the convention for 13 other entries in this `package.json`.

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

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
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

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
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

## Deferred from: Story 7.13 — `graphql` 16 → 17 (2026-08-19)

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: **`graphql` 17.0.2 LANDED, but the tree carries one permanently-unmet peer declaration — 25 flagged tree
  positions — and `npm ls graphql` exits 1.** `graphql-config@5.1.6` declares
  `peer graphql: "^0.11.0 || … || ^16.0.0"` — no `^17` — and it is a **hard dependency** of `@graphql-codegen/cli@7.2.0`,
  with `5.1.6` being `latest` on the registry. There is no version to take that fixes it.
  evidence: full sweep of `bp_front/package-lock.json` — **42 lockfile entries declare a `graphql` peer (41 distinct
  package names); 41 admit `^17.0.0`, exactly one does not**, and it is `graphql-config`. (One of the 41 is
  `@ardatan/relay-compiler@13.0.2` with peer `*`, which is no evidence of v17 support.) Against the baseline lockfile
  the same sweep returns **42 peers, 0 unsatisfied by 16.14.2**, so the invalid-peer state is new with this bump — by
  inference from the ranges, not by an observed exit code: the baseline `npm ls` was never actually run. Say it that
  way. `npm install graphql@17.0.2` with **no flags** exits **0** with `npm warn ERESOLVE overriding peer dependency`,
  and npm nests `graphql-config` under `node_modules/@graphql-codegen/cli/` — which changes nothing, since there is
  still exactly one `graphql` in the tree and it is 17.0.2. **No `--legacy-peer-deps`, no `--force`, no `overrides`, no
  `resolutions`, no `.npmrc` was used — not even transiently.** The peer refusal is measured **stale rather than
  functional**: `npm run generate` against the live `:2080` schema exits **0** under v17 and leaves all four files in
  `bp_front/src/__generated__/` byte-identical, and `graphql-config` is on that exact path. What is **not** established:
  that every `graphql-config` code path this project does not walk is v17-safe. Only the config-load path was exercised.
  Proposed fix: **no fix exists that keeps graphql 17.** Holding `graphql` at 16.14.2 was a real option — the same
  sweep shows 42/42 satisfied there — and it was **declined** in favour of landing the major. This is an accepted
  trade-off, not a forced state. Re-check trigger: the first `graphql-config` release whose `graphql` peer includes
  `^17`, or a `@graphql-codegen/cli` release that drops the `graphql-config` dependency. Until then, an agent seeing
  `npm ls` exit 1 or the ERESOLVE warn on a routine `npm install` must read it as **this filed, known,
  deliberately-accepted state** and not as a broken tree, and must **not** "fix" it with an override.

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: The Docker image build's green `npm ci` is conditional on npm's `strict-peer-deps` default, which nothing in
  this repo pins.
  evidence: `npm ci --dry-run --strict-peer-deps` and `npm install --dry-run --strict-peer-deps` both fail
  `ERESOLVE ... Fix the upstream dependency conflict`, on the `graphql-config` peer above. `bp_front/Dockerfile` runs a
  bare `npm ci` and there is no `.npmrc` anywhere in the repo, so the build passes only because the current npm default
  is permissive. A future npm default flip, a CI runner exporting `npm_config_strict_peer_deps`, or an organisation
  `.npmrc` would break the image build with no source change. Proposed fix: an explicit `bp_front/.npmrc` with
  `strict-peer-deps=false`, pinning the assumption rather than inheriting it — deliberately NOT done in Story 7.13,
  because adding an `.npmrc` is exactly the shape of workaround AC2 forbids. Re-check trigger: any npm major, or the
  first CI pipeline added to this repo.

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: Codegen's failure branch is unexercised under graphql 17, and its config makes a silent partial success
  possible.
  evidence: `bp_front/codegen.ts:26-29` sets `ignoreNoDocuments: true` and `allowPartialOutputs: true`. Every codegen
  run in that pass took the success path, so a v17 parse regression that dropped some documents could exit 0 with
  partial output and a byte-identical-looking `git status` on the files it did not touch. Proposed fix: run
  `npm run generate` once against a deliberately invalid document and confirm it fails loudly rather than partially.
  Cheap, and it would make the byte-identity check mean what it is quoted as meaning.

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: Nothing fences graphql 17's narrowed Node floor — no `engines` field, no `.nvmrc`, no `.node-version`.
  evidence: graphql 17.0.2 declares `engines.node: "^22.0.0 || ^24.0.0 || ^25.0.0 || >=26.0.0"`, where 16.14.2 accepted
  anything `>=`. The current paths are fine (`mise.toml` pins the major `26`; `bp_front/Dockerfile` is `node:26-alpine`),
  but `bp_front/package.json` has no `engines` block, so anyone outside mise gets an `EBADENGINE` **warning** and a
  build that proceeds. Compounds the eslint-10 and `@types/node` entries — **three entries, one field, three different
  proposed ranges. Settle the range once.** Proposed fix: one `engines` field plus a `.nvmrc`.

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: The known-invalid-peer state is recorded only under `_bmad-output/`, nowhere inside `bp_front/` where
  someone hitting it would look.
  evidence: an agent or contributor working in `bp_front/` who runs `npm ls`, or sees the `ERESOLVE` warn on a routine
  `npm install`, finds no marker in `package.json`, `README` or an `.npmrc` comment explaining that this is deliberate.
  The instruction not to "repair" it with an override lives two directories away in files they may never open — which
  is precisely how an override gets added. Proposed fix: a short comment-bearing marker inside `bp_front/`.

- source_spec: `spec-7-13-graphql-16-to-17.md`
  summary: `@apollo/client` patch drift, deliberately **not** swept into this story.
  evidence: `npm view @apollo/client dist-tags` gave `latest` **4.2.12** (2026-08-19) against the locked **4.2.11**
  (still 4.2.11 on 2026-09-07). S-AC4 confined the story to `graphql` version numbers only, and the epic's "each major
  is independently attributable" rule forbade bundling. Not a defect; recorded so the next sweep does not treat it as
  newly discovered. Proposed fix: pick it up in a later patch sweep.

## Deferred from: Story 7.14 — installable PWA (2026-08-20)

The device-verification, Caddy-header-pin, package-footprint, `registerSW.js`, `beforeinstallprompt` and manifest-`lang`
entries from this section are all closed ("Proposed fix: none", or discharged by `md`'s hand-verification at the Epic 7
retro) and are in the archive.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: One of the six new E2E assertions could only be falsified at the **instrument** level, not by breaking the
  guarded behaviour through the worker.
  evidence: the other five were reddened on both projects by real config breaks (white `background_color`; a 191 px
  icon; `manifest: false`; registration removed; precache emptied so the offline reload died with
  `ERR_INTERNET_DISCONNECTED`; and the load-bearing one — deleting `navigateFallbackDenylist` made `/api/graphiql`
  return the SPA shell, `toHaveTitle` receiving `"Bag Please"` instead of `"GraphiQL"`). The "no `/api` entry in
  Cache Storage" test resisted: Workbox refuses to cache `POST`, which is every GraphQL and auth call the app makes,
  and forcing `/api/graphiql` into the precache instead made the worker's **install** fail (401 without a Bearer
  token), so the test reddened on the controller wait rather than on the cache assertion. It was falsified instead by
  planting a real `/api/graphql` entry in Cache Storage from the page and confirming the identical enumeration and
  filter reported it — proving the instrument sees what it claims to see.
  Proposed fix: if runtime caching is ever added, revisit with a real GET route under `/api` so the behaviour itself
  can be broken. Kept OPEN as a live obligation attached to that future change, not as work owed today.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: iOS/Safari installability is untouched and out of scope, and it is now the only mobile platform without a
  home-screen story.
  evidence: FR59 scoped this to Android/WebAPK; no `apple-touch-icon` and no `apple-mobile-web-app-*` meta were
  added, so an iOS "Add to Home Screen" gets Safari's screenshot-derived icon. Vite 8's resolved `build.target`
  already dropped Safari/iOS 16.0–16.3 (Story 7.9), so the iOS floor is narrowed independently of this.
  Proposed fix: a separate story if iOS is ever in scope — one 180×180 `apple-touch-icon` plus the status-bar meta.

## Deferred from: code review of 7-14-installable-pwa (2026-08-20)

- source_spec: `spec-7-14-installable-pwa.md`
  summary: The `E2E_BASE_URL=https://bag-please.localhost` mode was never run against the service worker, and it is
  the mode most likely to break.
  evidence: the root `CLAUDE.md` advertises that mode as the way to exercise the real HTTPS + Secure-cookie path,
  and `playwright.config.ts` sets `ignoreHTTPSErrors: true` with a comment conceding the local edge cert may be
  self-signed. Chromium refuses `serviceWorker.register()` on an origin with certificate errors even when told to
  ignore them for navigation — `ignoreHTTPSErrors` does not extend to worker registration. If that holds here,
  `waitForController()` times out and four of the seven tests in `e2e/pwa.spec.ts` fail in a documented supported
  configuration. Untested in either direction: the edge was not running during that pass. Re-check trigger: the
  next time anyone runs the suite through the edge domain. Named at the Epic 7 retro as part of harness integrity
  (**D5**). **Related and still owed from the 7.7 review:** `graphql-ws` 6.0.8 → 6.2.1 was verified only over `ws://`
  on plain `http://localhost:2080`, and the subscription transport is exactly what moved — the TLS run is also the only
  path that exercises the `Secure` + `SameSite=Strict` refresh cookie. One TLS-edge run discharges both.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: `/index.html` and `/manifest.webmanifest` are served with no `Cache-Control` at all, unlike `/sw.js`.
  evidence: `curl -sI http://localhost:2080/index.html` returns an `Etag` and no `Cache-Control`, so a browser may
  heuristically cache the shell. Pre-existing and largely masked by the precache's revision hashes for CONTROLLED
  clients — but a first-time or uncontrolled visitor can still be pinned to an old shell. **Compounds the Caddy
  SPA-fallback entry under the 7.8/7.9 review below**, which wants `Cache-Control: no-cache` on `index.html` for the
  same reason; fix them together.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: Nothing fences workbox's default 2 MiB precache size limit, and the app is a single 803 kB chunk with a
  build-time warning already firing at 500 kB.
  evidence: `npm run build` reports `precache 8 entries (790.94 KiB)` and separately warns "Some chunks are larger
  than 500 kB". If the main chunk ever crosses `maximumFileSizeToCacheInBytes` (default 2 MiB), workbox DROPS it
  from the precache with a build-time warning and no failure — and because `runtimeCaching` is empty, nothing
  backfills it, so the worker keeps its fetch handler but stops serving the app shell. Consider failing the build
  on a precache warning rather than setting a larger limit.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: The Caddy content-type pin covers `/manifest.webmanifest` only; `/sw.js` and `/icons/*.png` rely on the
  base image's MIME table.
  evidence: the same AR-E7-15 argument that justified pinning the manifest type applies to the worker script (a
  worker served as `text/plain` is refused) and to the icons (a wrong type is ignored for WebAPK purposes). Both
  were measured correct on `caddy:2-alpine` v2.11.4 and the story deliberately pinned only what AC5 named. The
  `sw.js` test asserts the served content type, so a drift there is caught by the suite; the icons are not covered.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: AC9 as drafted can be satisfied by an instrument that cannot fail, and was.
  evidence: the AC required that "the substitute instrument and its limits are stated explicitly" and that the
  `beforeinstallprompt` result is "recorded whichever way it goes". The record states up front that Playwright's
  Chromium is not Chrome-branded and that install promotion is a branded-Chrome heuristic — i.e. the probe carried
  no information in either direction, established BEFORE it was run. Honest, but it is not verification. Kept as a
  standing convention: a future story writing a device-dependent AC should either gate on the device or state plainly
  that the criterion is unverifiable in CI, rather than specifying a null instrument.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: The manifest has no `description`, `screenshots`, `orientation` or `display_override`, so Chrome shows
  the minimal install mini-infobar rather than the rich install dialog.
  evidence: read from `dist/manifest.webmanifest` — ten keys, none of them these. Not a WebAPK blocker and not
  required by any AC, but the story's stated intent is "Install Bag Please as a Real App" and this is the least
  persuasive install surface Chrome offers. `screenshots` needs real captures, which is design work, not a patch.
  **Natural home is Story 8.7** ("write down the design this app actually has"), which is the first story since that
  owns visual assets.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: `immediate: true` fires a ~790 KiB precache during first paint, and the mobile-data cost is recorded
  nowhere.
  evidence: `precache 8 entries (790.94 KiB)` from the build. `immediate: true` is deliberate and justified — the
  worker must be registered for the WebAPK precondition and must not be gated behind app startup — but this project
  treats the mobile viewport as the mandatory gate, and a first visit on cellular now pays that download before the
  app is interactive. Measure the first-paint impact on a throttled connection before assuming it is free.

- source_spec: `spec-7-14-installable-pwa.md`
  summary: `dev-dist/` is not gitignored, which is a trap the first time anyone sets `devOptions.enabled`.
  evidence: `npm run dev` was run in that pass and produced no `dev-dist/`, so the spec's condition was correctly read
  as not met and neither `.gitignore` nor `eslint.config.mjs` was touched. Re-verified 2026-09-07: `dev-dist` still
  appears in neither `.gitignore` nor the ESLint `ignores` array. Enabling dev-mode PWA debugging will drop an
  untracked, unlinted build directory into the tree.

## Deferred from: code review of 7-12-graphql-kotlin-9-to-10-with-kotlin (2026-08-16)

The Jackson-mapper finding from this review is folded into the Story 7.12 entry above (it corrects that entry rather
than standing beside it). The two process findings that only describe a completed pass — the missing perturbed
artifacts and the two-variable compiler-warning control — are recorded against the entries they qualify and are
otherwise in the archive.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **The `Exception while fetching data (/field) : ` wrapper and `extensions.code` are a load-bearing frontend
  contract that NO gate in this project can assert** — every E2E check of a backend error message is a `toContainText`
  substring match, which passes just as happily with the wrapper left un-stripped, and no backend test asserts
  `errors[0].message` or `extensions.code` at all.
  evidence: `bp_front/src/lib/admin/adminErrors.ts:7`'s `RESOLVER_WRAPPER` regex is what strips graphql-java's prefix
  before a user sees "User 'x' not found". `sharing.spec.ts:109` asserts ``toContainText(`User '${ghost}' not found`)``
  — and `Exception while fetching data (/shareList) : User 'x' not found` **contains** that string, so the assertion
  cannot fail for the reason it exists. Same shape at `sharing.spec.ts:61,68,114,124,161,265`. A `grep` over
  `bp_back/src/test` finds no assertion on a GraphQL error message body. Consequence: Story 7.12 had to discharge AC3
  by hand — mint a token, POST a deliberately-failing mutation, byte-diff the raw JSON — and **every future
  graphql-java or graphql-kotlin bump repeats that ritual or ships blind**. Proposed fix, cheap: change
  `sharing.spec.ts:109` to `toHaveText` (exact), and/or add one Kotest assertion that a failing mutation's
  `errors[0].message` starts with `Exception while fetching data (` and that a forbidden read carries
  `extensions.code == "FORBIDDEN"`. **Cross-reference the declined `BAD_USER_INPUT` shape in the Story 7.4 section:**
  whoever changes the error shape must move this gate at the same time, or the change ships unobserved.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **Probe scripts write to the shared dev stack and clean up after nothing** — the story's `probe.py` enabled
  `registrationEnabled` and never restored it, and deposited a permanent user, list, category and item into the
  persistent Mongo volume.
  evidence: the probe's setup phase issues `mutation { setRegistrationEnabled(enabled: true) }` against the running
  `:2080` stack and has no teardown; it ran at 18:05:47 and the baseline E2E started ~18:07. Story 7.3 deleted a real
  cross-project race over that one `ApplicationConfig` document, and `global-setup.ts` re-enables the flag idempotently
  precisely because a stranded value is recoverable-but-invisible. Separately, `gk12probe` plus its list, category and
  item now live in `bag-please_db_data`, feeding the size-driven `createUserViaUi` defect filed twice above — `md`
  cleared the database once already to recover from it, and green-first-try does not make the deposit free.
  Proposed fix, standing convention: any probe script restores global state in a `finally` (or reuses
  `global-setup.ts`'s idempotent path), and deletes what it creates or runs against a throwaway database rather than
  the dev volume.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **No advisory sweep is run over the backend classpath**, in contrast to the frontend, where `npm audit`
  deltas are recorded as findings.
  evidence: Story 7.11 recorded a measured 2-high → 1-high `npm audit --package-lock-only` delta on both sides of its
  bump. Story 7.12 added `tools.jackson.core:jackson-core`, `jackson-databind`, `jackson-bom` and
  `jackson-module-kotlin` at 3.1.3, and moved `graphql-java` 23.1 → 25.0, `java-dataloader` 4.0.0 → 6.0.0,
  `federation-graphql-java-support` 5.5.0 → 6.0.0 and `com.alibaba:fastjson2` 2.0.56 → 2.0.61 — the last a library with
  a notable CVE history, and a **third** JSON implementation resident on a classpath the record discusses as carrying
  "two". Proposed fix: add a dependency-check step (e.g. OWASP dependency-check / `gradle dependencyCheckAnalyze`) to
  the Gradle build, or at minimum record a before/after advisory count for backend bumps the way the frontend ones do.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **The build has no `languageVersion`/`apiVersion` pin and no `allWarningsAsErrors`, so a compiler minor can
  introduce new diagnostics that clear every gate unnoticed** — which is exactly what happened here.
  evidence: `bp_back/build.gradle.kts:16-18` is `kotlin { jvmToolchain(25) }` and nothing else. Kotlin 2.3 → 2.4
  introduced `UserService.kt:65:9 Expression is unused.`, which the story caught only because it ran a deliberate
  stash-back control — the baseline `compileKotlin` was `UP-TO-DATE` and emitted nothing, so a normal pass would have
  seen neither the warning nor its novelty. Consequence: future deprecations and language-level changes arrive silently
  on every Kotlin bump. Proposed fix: `compilerOptions { allWarningsAsErrors }` (with the existing warning fixed first
  — see the 7.12 entry above), and/or an explicit `languageVersion` pin so a compiler bump and a language-level bump
  are separate decisions.

- source_spec: `spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md`
  summary: **Transitive MAJOR bumps are cleared on a `grep`, not on behaviour** — `java-dataloader` 4.0.0 → 6.0.0 (two
  majors) and `federation-graphql-java-support` 5.5.0 → 6.0.0 were dismissed as "neither is named anywhere in this
  codebase".
  evidence: true — but the codebase names `graphql-java` nowhere either, and that one received a POM citation, a
  decompiled format-string comparison and a byte-level after-check. `graphql-kotlin-dataloader-instrumentation` sits on
  the runtime classpath and is active regardless of whether project source mentions it. The SDL and response captures do
  cover the observable surface, so the conclusion is probably safe; the *reasoning* is not the standard the rest of that
  record holds itself to. Proposed fix, standing convention: for a transitive major, cite the upstream changelog for
  breaking changes the way `graphql-java` was handled, or state explicitly that the observable-surface captures are being
  relied on instead. The same applies to the serialization compiler plugin moving 2.3.21 → 2.4.10 against an unmoved
  `kotlinx-serialization-core` 1.11.0 — closed by a green build rather than a cited compatibility source, when real
  evidence existed and went unstated (the Testcontainers suite and the E2E run both read documents written by the 2.3
  toolchain out of a pre-existing database, which exercises the serializers end to end).

## Deferred from: code review of 7-10-typescript-6-to-7 (2026-08-15)

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: `sprint-status.yaml` records a **held-back** dependency story with the same `done` value as a story that
  actually landed its bump, so the epic-close dependency-currency audit cannot tell the two apart without parsing a
  multi-thousand-character prose comment.
  evidence: `7-10-typescript-6-to-7: done` is byte-identical in form to `7-8-…: done` and `7-9-…: done`, which landed
  real version moves; the only distinguishing signal is the trailing comment. This is *sanctioned* — S-AC3 says a
  held-back dependency closes its story — but the epic's "every direct dependency is at latest stable **or**
  **deliberately held back**" close criterion is a machine-checkable question being answered by narrative, and there
  are now **three** holds (TypeScript 7, the Gradle wrapper, and `graphql` 17's accepted invalid peer), so it compounds.
  The mitigation that existed outside this file is gone: `project-context.md`, which carried "the major is held" in its
  Technology Stack section, was retired on 2026-09-07.
  Proposed fix: add a structured marker — a `held_dependencies:` block, or a `status: done-held` value — so the
  epic-close audit reads YAML rather than narrative. Deliberately **not** done inside Story 7.10: changing the sprint
  board's schema was outside a held story's scope and would affect every consumer of the file.

## Deferred from: code review of 7-8-7-9-types-node-26-and-vite-8 (2026-08-13)

Findings the review surfaced that are **not** fixable inside that story's boundary (version numbers and what an
upgrade strictly requires). Several are pre-existing and were merely exposed by the bundler swap.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The shipped bundle now carries zero third-party licence banners.** Vite 8 defaults `build.minify` to
  `"oxc"`, which does not preserve legal comments; `bp_front/dist/assets/index-*.js` contains **0** occurrences of
  `@license` or `Copyright (c)` while `@mui/material` and `react-dom` both ship MIT/React banners in source. MIT asks
  that the notice travel with substantial portions.
  evidence: `vite.resolveConfig(..., 'build').build.minify` returns `"oxc"` on 8.2.1; `grep -c "@license\|Copyright
  (c)" bp_front/dist/assets/*.js` returns 0. Whether Vite 7's esbuild path preserved them was NOT measured, so the
  regression is probable rather than proven — measure before acting. Proposed fix: either a `build.minify` option that
  keeps legal comments, or an emitted third-party licence file. Both need a `build` block in `vite.config.ts`, so it is
  a decision for `md` and not a patch. Low practical risk for a private app; non-zero if it is ever distributed.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Deleting `allowScripts` removed the project's install-script policy anchor, and the image's npm floats.**
  `bp_front/Dockerfile:7` is `node:26-alpine`, an unpinned tag whose npm moves independently of `mise.toml`. npm 11
  *warns* on an unreviewed install script and still runs it, whereas npm 12 requires an explicit allow and blocks. If
  the image's npm rolls to 12 and any future dependency needs a postinstall, `npm ci` in the build stage skips it and
  the image breaks in a way that reads as unrelated.
  evidence: `allowScripts` is absent from `bp_front/package.json` after commit `9efa85c`; there is no `.npmrc`, no
  `engines` field and no `packageManager` field anywhere in the repo (re-verified 2026-09-07). Proposed fix: keep an
  explicit `"allowScripts": {}` as the policy anchor, and/or pin `packageManager` so the image's npm is a decision
  rather than a roll.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **A bundler swap was accepted on Chromium-only evidence.** `playwright.config.ts` declares four projects,
  all Chromium (Desktop Chrome + Pixel 7). Rolldown's and oxc's output on WebKit and Gecko is unverified, and this
  matters more now that Vite 8's baseline includes `safari16.4`/`ios16.4`.
  evidence: `playwright.config.ts:96-140`; no `webkit` or `firefox` project exists. Proposed fix: add a WebKit project
  (at least a smoke subset), or state explicitly in the E2E rules that non-Chromium output is unverified. **Compounds
  the iOS entry under Story 7.14** — both are "the platform we ship to and never render on".

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The lockfile's 25 optional native platform packages can be pruned by an `npm install` on a different
  platform, breaking the musl image build for everyone.** Rolldown and Lightning CSS bindings are resolved as optional
  platform deps; npm records only what it saw. A contributor on macOS or arm64 running `npm install` can drop the
  `linux-x64-musl` entries the Docker build needs.
  evidence: `package-lock.json` carries 14 `@rolldown/binding-*` and 11 `lightningcss-*` entries after an `npm install`
  on linux/x64/glibc; `bp_front/Dockerfile:10` runs `npm ci` under `node:26-alpine` (musl). Proposed fix: a check that
  all platform entries survive an install, or `npm install --os=... --cpu=...` guidance in the frontend `CLAUDE.md`.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Caddy's SPA fallback answers a request for a stale hashed asset with `index.html` and HTTP 200.** After
  any deploy that changes the chunk hash, a browser holding a cached `index.html` requests the old
  `/assets/index-<oldhash>.js`, receives HTML with a 200, and fails with a module-script MIME error — a blank page,
  not a retry. Pre-existing (hashing is not new), but a bundler swap guarantees a hash change.
  evidence: `routing/Caddyfile:29-33` is `root * /srv` / `try_files {path} /index.html` / `file_server` with no
  `/assets/*` carve-out and no cache-control directives. Proposed fix: a `handle /assets/*` block ahead of the SPA
  fallback so a missing asset 404s honestly, plus `Cache-Control: no-cache` on `index.html` — which is also what the
  7.14-review shell-caching entry asks for. **Now sharper than when filed:** since Story 7.14 a service worker
  intercepts every navigation, so an uncontrolled visitor pinned to an old shell is a state the worker's precache
  revisions do not repair.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`tsconfig.app.json` declares no `types` field, so `@types/node`'s globals are visible to browser code.**
  Node-only APIs type-check clean inside `src/` and fail at runtime. Pre-existing; this story made the Node typings a
  major newer.
  evidence: `bp_front/tsconfig.app.json` has no `types` key, so every package under `node_modules/@types` is included
  by default. Proposed fix: `"types": ["vite/client"]` there, keeping `tsconfig.e2e.json`'s explicit `["node"]`.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`npm run build`'s `tsc -b` has no `--force`, so a future types bump can report green having checked
  nothing.**
  evidence: `bp_front/package.json` is `"build": "tsc -b && vite build"` (unchanged 2026-09-07); build mode caches per
  project under `node_modules/.tmp/*.tsbuildinfo`. That story's gate worked around it by deleting `node_modules/.tmp`
  by hand. Proposed fix: `tsc -b --force` in the script, or a separate `typecheck` script the dependency stories use.
  **Interacts with the 7.1-review incremental-cache entry, which reports the opposite symptom** (the cache never
  satisfies the up-to-date check, so everything rebuilds every time) — reconcile the two before changing either: one of
  them is describing behaviour the other says is impossible, and neither was re-measured after the Vite 8 swap.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Nothing outside `mise.toml` pins Node for a contributor who does not use mise**, so a build on Node 22
  would type-check against `@types/node` 26 APIs its runtime lacks.
  evidence: no `engines` field, no `.nvmrc`, no `.node-version`, no `packageManager`; only `mise.toml:6` (the floating
  major `26` since 2026-08-21, so it no longer pins a minor at all) and `bp_front/Dockerfile:7`. Proposed fix:
  `"engines": {"node": ">=26 <27"}` plus `engine-strict=true`. **Third of the three `engines` entries, and the one with
  the narrowest proposed range — settle the range against the eslint-10 and graphql-17 floors before writing it.**

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`codegen.ts` is in no tsconfig project and codegen was never run against the Vite 8 tree**, so the
  `npm run generate` path is unverified after `esbuild` left the dependency graph.
  evidence: `tsconfig.app.json` includes `src`, `tsconfig.node.json` only `vite.config.ts`, `tsconfig.e2e.json` `e2e` +
  `playwright.config.ts`; `codegen.ts` matches none. That spec forbade running `npm run generate` (no schema change in
  the epic), so this was correct to skip. **Partially discharged since:** Story 7.13 ran `npm run generate` against the
  live schema under graphql 17 and got byte-identical output, which exercised the path on the Vite 8 tree. What remains
  is the tsconfig half — see the 7.1 entry above.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`./db/data` survives as a stale path across the docs and E2E comments** after `md` switched the mongo
  mount to the named volume `bag-please_db_data`.
  evidence: re-verified 2026-09-07 — `docs/deployment-guide.md:10,101,117` still teaches it as the persistent volume
  and instructs backing it up, and six `bp_front/e2e/` comments (`global-setup.ts:4`, `admin.spec.ts:11,183,198`,
  `account.spec.ts:12`, `support/ui.ts:14`, `item-attribution.spec.ts:14`) still name it as the volume that persists
  across runs. The persistence *claim* is still true of the named volume; the path is not, and `docs/` now tells an
  operator to back up a directory that no longer holds the data. Deliberately not swept at the time because the compose
  change was uncommitted; it has since been committed, so the blocker is gone. Proposed fix: sweep the path.
  (The `project-context.md` occurrences named in the original entry are moot — that file was retired 2026-09-07.)

## Deferred from: code review of 7-7-minor-and-patch-dependency-sweep (2026-08-12)

The Kotlin-runtime-split entry from this review is superseded by the Story 7.12 entry above, which measured its
proposed remedy false and moved the re-check trigger to the next Ktor bump. The `createUserViaUi` "test-side race"
entry is superseded by the Stories 7.8+7.9 size-driven entry. Both are in the archive.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: two runtime libraries moved silently under the Ktor bump and were not named anywhere in the original
  record — `kotlinx-serialization-core` 1.9.0 → **1.11.0** and `kotlinx-coroutines-core` 1.10.2 → **1.11.0**.
  evidence: `:bp_back:dependencies` resolution; `ktor-server-core-jvm-3.5.2.pom` declares
  `kotlinx-coroutines-core-jvm:1.11.0`. This matters because the spec's Design Notes explicitly watched for a silent
  serialization change under the **driver** bump, and the hand-written `BsonEncoder`/`BsonDecoder` codecs in
  `mongo/model/serialization/` sit on `kotlinx-serialization` — which moved under **Ktor** instead. Both are covered in
  practice by `ListSharingTest`'s raw-BSON assertion and the full suite, which are green. Proposed fix: declare
  `kotlinx-serialization` and `kotlinx-coroutines` as explicit `[versions]` refs so they stop moving invisibly, or add
  a resolved-version assertion to the backend gate.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the shipped lockfile carries npm advisories and no closing document mentions them.
  evidence: `npm audit` in `bp_front/` reported `brace-expansion` (high, two DoS advisories), `js-yaml 4.0.0 - 4.3.0`
  (high), `nanoid <3.3.17` (high) and `postcss <=8.5.22` (moderate), with `fix available via npm audit fix`. All four
  were transitive build-time dependencies, none in the browser bundle's runtime path. The sweep **reduced** the count
  (6 → 4), but a dependency-currency story should say so rather than truncate the audit lines out of its quoted output.
  **Partially discharged since:** Story 7.14 recorded `npm audit --package-lock-only` at **1 high** (the `js-yaml`
  CVE-2026-59870 advisory) before and after, so the Vite 8 swap cleared the `postcss`/`nanoid` chain as predicted.
  What remains is the surviving advisory and the absence of a convention. Proposed fix: run `npm audit fix` as its own
  change with the full gate behind it, and record a before/after count on every dependency story — the same convention
  the backend entry above asks for.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the `mobile` project's viewport comes from `devices['Pixel 7']`, which ships **inside** `playwright-core`
  and therefore moves with every runner bump; nothing pins it.
  evidence: `playwright.config.ts` spreads `devices['Pixel 7']` with no explicit `viewport` override. A descriptor
  change would silently alter what "the mandatory mobile gate" actually tests, and the whole suite would stay green
  either way. **Sharper since Story 8.1:** the project now renders at the 320px floor
  (`PIXEL_7_AT_FLOOR`), so the descriptor is a *base* the epic's geometry gate is measured against — a silent shift in
  it moves the floor the whole of Epic 8 is written to. Proposed fix: spread the descriptor and then pin `viewport`
  explicitly, or assert the resolved viewport once in a spec.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: nothing installs Playwright browser binaries automatically, so a future lockfile refresh can re-create the
  runner-versus-binary skew this story had to fix by hand.
  evidence: `@playwright/test` is caret-ranged (`^1.60.0`, unchanged 2026-09-07), there is no `postinstall` script, no
  CI step and no `mise` task that runs `playwright install`; that pass needed a manual `npx playwright install chromium`
  after the runner moved, and the failure mode is `Executable doesn't exist`, which reads as an environment fault rather
  than a dependency change. Proposed fix: add a `postinstall` running `playwright install chromium`, or pin
  `@playwright/test` exactly so the move is always a deliberate manifest edit.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: nothing mechanically ties `gradle/wrapper/gradle-wrapper.properties` to the `gradle:<version>-jdk25` base
  image in `bp_back/Dockerfile:1`, which is the coupling the wrapper hold depends on.
  evidence: the coupling is held in prose only; the two files agree today (both 9.6.1) by convention, and the whole
  justification for holding the wrapper is that they must. Proposed fix: a one-line grep check in the build asserting
  the pair matches. (The `@types/node` half of this entry is folded into the `engines` entries above.)

## Deferred from: code review of 7-6-backend-safety-fixes (2026-08-12)

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `UserService.adminDeleteUser` deletes a user without removing their `list_members` rows, so user deletion is a
  still-open second orphan-leak path that Story 7.6's list-side cascade does not touch.
  evidence: `entity/user/UserService.kt:84-88` contains no reference to `ListMemberRepository` — the class is not
  injected at all (re-verified 2026-09-07). The rows it strands carry a **live** `listId`, so the detection query
  recorded with Story 7.6's no-backfill assumption (`list_members.distinct("listId")` vs `lists._id`) cannot see them;
  they need `distinct("userId")` vs `users._id`. Consequence: a phantom member row that still renders in the Share
  dialog and cannot be cleared through `removeMember`, because that path resolves the username to a user that is gone.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `ListService.deleteList`'s four-step cascade is not transactional, so any throw mid-block leaves a live list
  whose children are already deleted — and no ordering of the four statements can fix it.
  evidence: `ListService.kt:117-120` runs four independent Mongo deletes with no session (re-verified 2026-09-07; the
  code comment now states this correctly). If `listRepository.delete(id)` throws, the list row survives while items,
  categories and membership rows are gone; moving the membership delete after it just swaps which pair is inconsistent.
  Membership is the worst case because there is no in-memory cache to re-sync it from, unlike items/categories.
  Proposed fix: wrap the block in a single `ClientSession` with a transaction (Mongo 8 standalone in dev would need a
  replica set, which is why this is not a drive-by change).

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: a `shareList`/`acceptInvite` landing concurrently with `deleteList` can write a membership row after the
  cascade has run, re-creating exactly the orphan Story 7.6 set out to prevent.
  evidence: `ListService.deleteList` evicts the list from `listStorage` only *after* all four deletes, so a concurrent
  `shareList` still resolves `listStorage.getById(listId)` successfully and upserts into `list_members` in the window
  between `deleteAllInList(members)` and `evictFromCache`. Narrow but real, and it falsifies the unqualified form of
  "the cascade prevents new orphans". Proposed fix: evict from cache *before* the child deletes so concurrent callers
  raise `NotMember` mid-cascade, or take the transaction above.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: AC4's ordering clause ("after the category delete, before the list delete") is pinned by inspection only —
  moving the membership delete after `listRepository.delete` leaves the whole suite green.
  evidence: neither new test observes ordering; `AC-7.6-cascade` asserts only the post-delete row counts, which are
  identical under either order in the success path. Ordering is only observable under a partial failure, which is not
  reproducible without the transaction/fault-injection work above. Recorded so the clause is not mistaken for covered.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `ListSharingTest.connectToDb()` opens a `MongoClient` per call and never closes it, and is the third copy
  of the hard-coded `test_user`/`test_pass`/`test` credentials.
  evidence: `ListSharingTest.kt:111-121` mirrors `ItemLifecycleTest.kt:158-168`; neither closes the client, so the two
  tests leak one connection pool each. The repo already contains the correct shape — `utils/TestContainers.kt`
  `setUpRegistration` wraps its client in `try { … } finally { client.close() }`. Proposed fix: promote a single closing
  helper into `utils/TestContainers.kt` and delete both copies. Test-infrastructure only; no production impact.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: the invariant "`MemberStatus` constant names are byte-identical to the persisted/wire strings" is
  cross-repo, but the frontend half compares bare literals with no compile-time check and no test.
  evidence: `bp_front/src/components/ShareMembersDialog.tsx:174` compares `member.status === 'PENDING'`; the backend
  enum is what produces that string. The backend side is pinned (`ListSharingTest.kt:617,624` on stored bytes plus
  `:147,152,266` on the wire all turn red if one constant is renamed); `bp_front/` was untouchable in that story by epic
  rule. Recorded so the invariant's other half is not assumed covered.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `sprint-status.yaml`'s per-story record is a single ~10,000-character YAML comment line, and the same
  narrative lives in multiple documents that have already drifted from each other.
  evidence: the 7.6 entry restated content also held in this ledger's Story 7.6 section and summarised again in
  `project-context.md`; the review found the copies disagreeing on cited line numbers within hours of being written. A
  single unwrapped line is also not reviewable by diff — any edit rewrites the whole line. This is the established
  house convention across Epics 5–8, so changing it is a process decision, not a story fix. **Partially eased
  2026-09-07:** `project-context.md` was retired, removing one of the drifting copies; the ledger/sprint-status pair
  remains, and Story 8.2's entry is itself a ~6,000-character single line. **Further eased 2026-09-07:** every Epic 1–7
  `done` entry was reduced to a `# <date> (<commit>)` stub (98,171 → 30,887 bytes), so the duplicated narrative for
  closed epics now lives only in the specs and epic retros. Epic 8's entries are untouched while the epic is in flight,
  so the underlying convention is unchanged and this entry stays open.

## Deferred from: code review of 7-5-home-resolution-and-inert-home-link (2026-08-11)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
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

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
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
  summary: AC3's cross-list rejection is a TOCTOU pre-read where an atomic storage-layer fix was available.
  evidence: Between `repository.findById(item.id) != null` and `storage.save(toSave)` a concurrent request can create
  the same `_id` on another list, and `ItemRepository.save`'s filter is `_id` only under `upsert(true)`, so the
  relocation AC3 forbids still happens. Adding the `listId` to that filter — or a compound unique index — rejects it
  atomically, needs no extra read per write, and would not have required the new repository method that forced one of
  that story's two `Files:`-line deviations. The window is narrow and the guard is a strict improvement on the baseline,
  so this is a follow-up, not a defect in the merge. **Same fix shape as the concurrent-create entry under the Epic 7
  post-factum review below** — one conditional upsert filter closes both.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: The create/update branch is chosen from the in-memory cache while the cross-list rejection reads Mongo, and
  nothing pins the two to agree.
  evidence: `saveItem` discriminates on `storage.getByIdCached` (`ItemStorage`'s `ConcurrentMap`) but rejects on
  `repository.findById` (a Mongo point read). They agree today only because every write path goes through
  `save`/`delete`/`deleteAllInList` + `evictList` on a single backend instance. A second instance, a migration writing
  straight to Mongo, or a future partial eviction makes a legitimate update miss the cache, take the create branch,
  hit `findById`, and be rejected with the actively misleading `"Item <id> belongs to a different list"`. The coupling
  is load-bearing and is recorded nowhere in the code or the tests. **Note it is the same coupling the lazy-sync
  entries above are about** — `getByIdCached` never consults `synced`.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: AC4's guard creates a new terminal state — an item already carrying a dangling category can never be
  renamed, and the raw guard message reaches the user verbatim.
  evidence: The guard validates the *incoming* `category`, and `EditItemDialog` sends back the item's stored category
  when the user does not change it. An item in the state described in the ruling-A entry above therefore rejects every
  future edit. The MUI `Select` renders **blank** for a category id absent from `categories` while `validate()` still
  passes (the id is a non-empty string), so the user sees `Category <uuid> does not belong to list <uuid>` in
  `edit-item-error` with no indication that re-picking the category is the fix. Cross-reference the declined
  `BAD_USER_INPUT` shape in the Story 7.4 section: a typed code is what a "pick a category" hint would branch on.

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

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: `ItemRepository.findById` is an existence check built on a mapper that can return null, so AC3's guard
  cannot see documents it fails to map.
  evidence: `.mapNotNull(MongoItemMapper::mapItemFromMongo)` drops any `items` document the mapper rejects (e.g. a
  missing `listId`). Such a row exists in Mongo under that `_id`, so `save`'s `_id`-only upsert would overwrite it,
  but `findById` reports `null` and the create branch proceeds. `countDocuments` on the same filter would be a true
  existence check and is cheaper. No such document is known to exist today — the Epic 4 migration is the only writer
  that ever bypassed the mapper — which is why this is filed rather than fixed.

## Deferred from: code review of 7-3-delete-registrationenabled-race (2026-08-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-3-delete-registrationenabled-race.md`
  summary: FR20/FR21's mobile coverage is largely nominal — the assertions that observe the public effect of the
  registration flag run in hand-built contexts that do not inherit the Pixel 7 emulation.
  evidence: the toggle test asserts `contact-admin` / `to-register-link` on `offPage` (from
  `browser.newContext({baseURL, ignoreHTTPSErrors})`) and inside `withFreshAuthPage`, both hand-built. The project's
  own documented rule — "`browser.newContext()` does NOT inherit the project's `use` block" — means those run at a
  desktop viewport on `registration-toggle-mobile` too. Only the admin-panel half (menu → `/admin` → the Switch) is
  genuinely emulated there. Pre-existing since Story 5.4; Story 7.3 only made it visible by giving the test its own
  projects. **Worse since Story 8.1**, which moved the `mobile` project to the 320px floor: the hand-built contexts now
  miss the geometry gate as well as the viewport. Fix would be to drive the public-effect assertions on the `page`
  fixture, or to accept and document the split coverage deliberately. **Same root cause as the `withSecondActor` entry
  under Story 7.2** — one helper that inherits the project's `use` block would discharge both.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-3-delete-registrationenabled-race.md`
  summary: converging `global-setup.ts` onto the shared `gql` traded a status-aware failure message for the helper's
  parse-before-`res.ok` behaviour, in the one code path whose failure blocks the entire suite.
  evidence: the deleted inline code did `if (!gqlRes.ok) throw new Error("Enable-registration request failed: " +
  status)` before parsing; `support/api.ts:29-38` calls `await res.json()` first, so a Caddy 502 HTML body or an empty
  401 now surfaces as an opaque `SyntaxError` instead of naming the status. `loginApi`'s message likewise drops the
  "in global setup" context the old string carried. The underlying `gql` defect is filed under the 7.2 review below;
  this records that Story 7.3 removed the one call site that did not have it, so fixing `gql` is now the only way to
  get it back.

## Deferred from: code review of 7-2-shared-e2e-support-module (2026-08-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `PASSWORD` lives in `support/ui.ts`, so any pure-API consumer must import the runner-importing module to get a
  credential — the exact coupling the two-file split exists to prevent.
  evidence: all seven `loginApi(x, PASSWORD)` call sites pair `./support/api`'s function with `./support/ui`'s constant,
  and `ui.ts` imports `@playwright/test` at the top level (re-verified 2026-09-07: `support/ui.ts:20`). The predicted
  first instance did not materialise — `global-setup.ts` authenticates as `admin`/`admin`, the first-boot credentials,
  so its convergence onto `api.ts` needed `BACKEND`, `loginApi` and `gql` and no constant from `ui.ts`. **This entry
  stays OPEN on its own merits** (the seven spec call sites still pair the two modules), but the "a pure-API consumer is
  forced to import the runner-importing module" claim has **zero** actual instances — it is a latent coupling, not an
  observed one, which lowers its priority. `PASSWORD` is a bare string literal with no Playwright dependency; moving it
  to `api.ts` alongside `BACKEND` costs seven import-line edits and no behaviour change.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: none of the five E2E invariants has a machine gate — all five are prose, which is the precise failure mode
  Epic 6's retro action B4 and Story 7.1 exist to correct.
  evidence: "never re-declare a helper", "`api.ts` stays runner-free", "`BACKEND` must not become `baseURL`", "support
  files must not match `*.spec.ts`" and "imports must be relative" are enforced by nothing; a one-line
  `import {expect} from '@playwright/test'` added to `api.ts` passes both gates today. Two cheap enforcements exist and
  were **blocked by Story 7.2's own no-config-change boundary**, not judged unnecessary: an ESLint `no-restricted-imports`
  entry scoped to `files: ['e2e/support/api.ts']`, and an explicit `testMatch`/`testIgnore` in `playwright.config.ts`
  (which would also convert the documented `support/helpers.spec.ts` trap from a warning into an impossibility).
  **This is one of the three items the "gate the E2E invariants" story named under Story 7.3 would discharge together.**
  The prose these invariants lived in was `project-context.md`, retired 2026-09-07 — so they are now enforced by
  nothing *and* written down nowhere authoritative. Check whether `AGENTS.md` carried them across.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: the shared `gql(query, token)` has no `variables` parameter, institutionalising string interpolation of test
  data into GraphQL documents across all eight call sites.
  evidence: every caller interpolates `listId` and usernames directly into the query string. Safe only incidentally —
  `uniqueUsername` emits `[a-z0-9_]` and the interpolated ids are UUIDs. A list *name* (already a template literal,
  e.g. `` `Shared ${Date.now()}` ``) or any string containing `"` would break the document. Extraction was the cheap
  moment to add `variables`; it now costs eight call-site edits instead of two.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `loginApi` and `gql` have no timeout, no retry, and no readiness assumption, so a stalled backend surfaces as
  an opaque Playwright test timeout that does not distinguish setup from assertion.
  evidence: both call bare `fetch` with no `AbortSignal`. `global-setup.ts` deliberately polls the backend for 120 s
  before touching it; the shared helpers inherited none of that. `gql` also calls `res.json()` before checking `res.ok`,
  so a Caddy 502 HTML body or an empty 401 yields a `SyntaxError` instead of the intended status diagnostic. All
  pre-existing — Story 7.2 was a byte-identical extraction and correctly changed none of it. **This is the `gql` defect
  the 7.3 review entry above depends on.**

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `createListAndOpen` returns `page.url().split('/lists/')[1]` with no validation, and that unchecked id is
  fanned out to four specs and interpolated into GraphQL mutations.
  evidence: the guarding assertion is `toHaveURL(/\/lists\/[^/]+$/)`, which still matches a URL carrying a query string
  or fragment; the resulting id would be interpolated into `shareList(listId: "…")` and fail far from its cause.
  `tsconfig.e2e.json` does not set `noUncheckedIndexedAccess`, so the declared `Promise<string>` is not
  compiler-guaranteed. `new URL(page.url()).pathname.split('/lists/')[1]` is the one-line hardening. Pre-existing;
  extracted verbatim.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: the "no re-declaration" check greps for the literal string `function <helper>`, which tests a spelling rather
  than the property it stands for.
  evidence: it returns 0 today, but is equally satisfied by `const registerViaUi = async () => …` and was blind to
  `auth.spec.ts`'s fully inlined copy — a real omission that story made and only the review caught. Any future
  restatement of this check should assert on imports (every spec using a helper imports it from `support/`) rather than
  on the absence of a keyword.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `uniqueUsername(prefix, label, projectName)` takes three interchangeable positional `string`s to guard an
  invariant the rules file calls "load-bearing".
  evidence: transposing any two arguments compiles, lints and type-checks clean while silently placing a spec in a
  foreign namespace — exactly the collision the prefix exists to prevent — and the change spread a repeated string
  literal across ~40 call sites. A per-spec factory (`const userFor = namespace('shopping')`) or a `type SpecPrefix`
  union removes both the repetition and the transposition hazard.

## Deferred from: code review of 7-15-dev-auto-warnings-verdict (2026-08-21)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md`
  summary: Nothing mechanically enforces the recalibrated 6000-token threshold — `step-02-plan.md` instruction 6 still
  hardcodes "exceeds 1600 tokens", and the verdict lives only as advisory prose in activation context.
  evidence: the encoding was proved *resolvable and consumed* (resolver exit 0, five `persistent_facts` entries,
  `SKILL.md` activation Step 3 named as consumer) but never proved *effective*. Precedence between a hardcoded step
  instruction and a persistent fact is undefined, so a future run may honour either. The story's own Block If forbade
  editing anything under `.claude/skills/` (`customize.toml` is marked `DO NOT EDIT -- overwritten on every update`),
  so the only real fixes — forking the skill, or upstreaming a `spec_token_budget` config key the workflow actually
  reads — are `md`'s call. Re-raise if the next dev-auto spec is stamped against 1600. `sprint-status.yaml` action
  **D3**, owner `md`, status `open`.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md`
  summary: The verdict names the next dev-auto run as its "first falsification opportunity", then closed every ledger
  row that would have caused anyone to look.
  evidence: this is the failure mode the story exists to correct, one level up — a signal carried unread across three
  epics is replaced by an untracked expectation. The concrete observable is cheap: the next spec this workflow writes
  either carries an `oversized` stamp measured against 6000 on its planning body, or it does not. Nothing currently
  records that check as owed. **This entry is that record.**

- source_spec: `_bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md`
  summary: ~1000 tokens of literal prose now load as foundational context on *every* future `bmad-dev-auto` run,
  permanently, with no expiry and no summarised form; the context cost was never weighed against the benefit.
  evidence: `persistent_facts` entries are loaded verbatim at activation Step 3 before step-01, so the full four-fact
  block is paid on every invocation regardless of whether the story is about spec sizing. Arrays append with no removal
  mechanism, so the cost is monotonic as further verdicts are encoded the same way. **Exactly the shape of problem this
  ledger's own 2026-09-07 triage addressed** — an append-only store loaded in full on every run.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md`
  summary: 6000 is a population calibration on n=6 set 0.7 % above a figure the record itself calls an upper bound, and
  it replaces a flag with a 6/6 fire rate with one projected to fire 0/6.
  evidence: 6.1's 5959 is explicitly reported as inflated (review-loop Design Note extensions could not be separated
  out), so the ceiling sits above a knowingly-high value. Nothing in the record supports 6000 over 5000 or 8000 — no
  outlier-detection reasoning was performed. Identical information content to the old threshold, opposite sign. The
  amended fact states the margin and a re-measure trigger, but the underlying calibration question is open.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md`
  summary: The override is only visible to `bmad-dev-auto` activation; a human, or any other skill authoring a spec,
  still reads the stock 900–1600 budget in `spec-template.md:12`.
  evidence: the verdict was deliberately encoded outside `.claude/skills/`, which is correct, but that leaves two live
  and conflicting statements of the budget with nothing cross-referencing them. `project-context.md` — which every
  agent loaded — received no directive by design, and has since been retired; `AGENTS.md` inherits the same gap.

## Deferred from: code review of epic-7-context (2026-08-21)

Post-factum adversarial review of Epic 7 (`main...epic7-maintenance`, 44 commits), chunk A+B only — backend (`bp_back/`)
plus frontend app source and build config. **The E2E suite (`bp_front/e2e/`, `playwright.config.ts`, 2119 diff lines)
and the docs/`_bmad` chunk were NOT reviewed and are outstanding.** Items already filed elsewhere and merely
re-confirmed by this pass (the `checked`/`checkedAt` desync, `@Volatile`, `MemberStatus.valueOf`, the cold-cache home
link, the non-transactional cascade, the widened `eslint .` glob) are cross-references only and are in the archive.

- **`useHomePath`'s `if (error)` precedes `if (!data)` in `observe` mode too.** `homePath.ts:68-69`. Not a live defect:
  Apollo 4 `cache-only` reports a miss as `data: undefined, error: undefined`, so the branch does not fire today. Both
  the adversarial and edge-case layers independently flagged it as a latent hazard riding the Apollo 4.1→4.2 bump. If a
  future Apollo ever surfaces a cache miss as `error`, the app bar resolves home to `/lists` and the link goes inert ON
  `/lists` — a dead control on the one screen the code says must never have one. Cheap hardening: gate the error branch
  on `mode === 'resolve'`. Filed rather than patched because it is speculative about upstream behaviour. Pairs with the
  unreachable-`error`-branch entry under the 7.5 review above.

- **`byCreatedAtAsc` and `useHomePath` share a module, so a pure sort helper drags in `useQuery` + `useAuth`.**
  `homePath.ts` is imported by `ListShoppingPage.tsx:36` for the comparator alone. Design nit; the single-source
  requirement (AR-E7-8) is about the *home path*, not the comparator, so a `lib/lists/order.ts` split would not violate
  it. No runtime cost today. **Story 8.5 introduces the shared ordering comparator for both list screens and is the
  natural moment to do the split** — otherwise a third consumer imports the auth hook to sort.

- **The new backend tests are calibrated against the rate limiter's exact 5-per-60 s budget.** `ItemLifecycleTest.kt`
  and `ListSharingTest.kt` carry comments naming their auth-call ceilings ("A third here would return 429";
  "Three users is the ceiling here"). Correct today, but the coupling is documented rather than removed: tighten the
  limiter for a security story and several tests fail with a 429 that reads as an auth defect. A test-profile override
  or per-test limiter reset would state the real precondition.

- **`generate-icons.sh` claims byte-reproducibility but enforces only tool presence.** `scripts/generate-icons.sh:13-17,
  25-27` — the header names librsvg 2.62.3 + ImageMagick 7 as the versions the claim holds for; the script checks
  `command -v` and nothing more. A contributor on a different librsvg commits three PNGs differing in every byte.
  Mitigated by `e2e/pwa.spec.ts` re-deriving the maskable safe-zone from the served bytes, so correctness is gated even
  when reproducibility is not. A version check or a checked-in checksum would make the stated claim real.

- **Concurrent `saveItem` for the same new id: both calls take the create branch.** `ItemService.kt:44-66` is
  check-then-act across `getByIdCached` and `repository.findById`; neither is atomic with `storage.save`. Two devices
  queueing the same add both create, second write wins, `addedBy` overwritten. Low reachability on a two-member shopping
  list. A conditional upsert filter (`Filters.and(eq(_id), eq(listId))`) is the shape of the fix — **the same fix the
  AC3 TOCTOU entry under the 7.4 review proposes.**

- **The epic constraint on the category guard is unqualified; the implementation is update-branch-only, and the
  planning record was never amended.** `epic-7-context.md` says "A category not belonging to the target list is
  rejected rather than written as a dangling reference" with no branch qualifier; `spec-7-4` legitimises the narrowing
  via `md`'s ruling A, and `ItemService.kt:48` implements it with a tripwire test pinning the open create hole. The
  hole itself is filed under Story 7.4. What is NOT recorded anywhere is that the *epic context document* was never
  amended to carry ruling A, so the two planning artefacts disagree in the permanent record. **This is a live instance
  of Epic 7 action D2** (nothing gates authoritative prose), and it recurs in Epic 8 — see the `epic-8-context.md`
  entries below.

## Deferred from: code review of 4-8-frontend-lists-tab-list-management-bpavatar (2026-05-25)

Both surviving items are backend, and both were re-verified against `ListStorage.kt` on 2026-09-07. The frontend items
from this epic's other reviews were superseded by the Epic 5 Vite rebuild and are in the archive.

- `ListStorage.rename` not atomic — in-memory updated before the MongoDB write (`ListStorage.kt:41-47`); if MongoDB
  throws, in-memory reflects the rename but the DB does not until process restart; same pre-existing pattern as
  `save()` and `delete()` across all Storage classes.
- Concurrent delete+rename race causes `IllegalStateException` bypassing the GQL error model — the service confirms
  existence via `listStorage.getById`, then storage re-confirms; a concurrent `deleteList` between the two calls evicts
  the list from the map, so `storage[id] ?: throw IllegalStateException(...)` throws an uncaught 500 instead of a
  structured GQL error; pre-existing pattern across all Storage classes.

## Deferred from: code review of 4-3-list-sharing-backend-pending-invites-member-management (2026-05-22)

The untyped-status-strings and `deleteList`-cascade items from this section were resolved by Story 7.6 and are in the
archive, along with the `acceptInvite` UUID-oracle item, which was accepted as a design trade-off.

- `acceptInvite` TOCTOU double-accept race — two concurrent accepts can both pass the `PENDING` check and insert the
  user's UUID into `List.members` twice; spec-acknowledged acceptable at this scale. Re-verified 2026-09-07: the check
  is now `member.status != MemberStatus.PENDING` and the `listStorage.save` still follows it across a suspending write.
- Re-invite after DECLINE overwrites the original `createdAt` — `shareList` constructs a new
  `ListMember(..., Instant.now())` on re-invite and the upsert overwrites the original invite timestamp; acceptable for
  current audit requirements. Re-verified 2026-09-07 at `ListService.kt`.
- Username recycling UUID/username desync — `removeMember`/`leaveList` filter `List.members` by resolved UUID but
  `memberUsernames` by string; if a username is re-registered to a different UUID the two arrays diverge; pre-existing
  design gap not introduced by that story.
- Non-auth validation errors wrapped in `GraphQLForbiddenException` — `UserNotFound`, `AlreadyMember`, `AlreadyPending`,
  `SelfShare` are semantic validation errors but use the same exception type as auth failures; pre-existing GQL error
  taxonomy. **Third instance of the same debt** — see the `BAD_USER_INPUT` shape under Story 7.4 and the `AC7 error
  shape` item under `4-1`; decide the taxonomy once.
- `runBlocking` in `ListMemberRepository.init` — follows the same pattern as all other repository `init` blocks; see the
  `4-1` entry below.

## Deferred from: code review of 4-2-websocket-auth-per-list-subscription-scoping (2026-05-22)

- Stale `isMember` cache — `ListStorage.getByIdCached` bypasses `sync()`; a user revoked from a list mid-subscription
  may continue receiving events until the process restarts or the cache is refreshed. Re-verified 2026-09-07:
  `getByIdCached` is still a bare map read and `ListService.isMember` still calls it. This is the read side of the
  lazy-sync bug whose write side Story 7.6 addressed — see the Story 7.6 section.
- Lost SharedFlow events during subscribe setup — events emitted between `verifyMembership` and `emitAll` may be
  silently dropped if the SharedFlow buffer is full (DROP_OLDEST); pre-existing backpressure behaviour not introduced by
  that change.
- **AC4 Point 2 (`takeWhile` membership revocation) test absent, and no longer blocked.** The implementation exists and
  is correct; the test was blocked on Story 4.3's member-removal mutation, which shipped in 2026-05. Re-verified
  2026-09-07: `SubscriptionScopingTest.kt` covers the subscribe-time gate only, and the `TODO` marker that recorded the
  block is gone from the file — so the obligation now lives nowhere but here.

## Deferred from: code review of 4-1-list-entity-backend-crud-authorization-migration (2026-05-22)

The `synced` TOCTOU item is superseded — its visibility half was fixed by Story 7.6 and its check-then-act half re-filed
in that section. `verifyMembership`'s existence leak was accepted, and the `GqlItem` input/output name collision is
resolved (`GqlItem` is `@GraphQLName("Item")` and `GqlItemInput` is `@GraphQLName("ItemInput")` — separate classes).
All three are in the archive.

- `runBlocking` in repository init + duplicate instantiation — repository constructors call
  `runBlocking { createIndexes }` (pre-existing pattern); `Application.kt` and `GQL.kt` create separate repository
  instances, doubling startup index-creation calls; idempotent but wasteful.
- `isMember` cold-cache false-denial — `ListStorage.getByIdCached` bypasses `sync()`; if called before any sync it
  returns `false` for legitimate members. **No longer merely latent:** `ListService.isMember` is the WebSocket
  subscription gate (see the `4-2` entry above), so this is reachable on a cold boot.
- AC7 error shape — `IllegalArgumentException` for a list name > 100 chars produces a GQL execution error, not a formal
  GQL validation error; the behaviour is correct (no DB write, error returned to client) but the format differs from
  spec intent. Re-verified 2026-09-07 at `ListService.renameList`. **Same debt as the declined `BAD_USER_INPUT` shape
  under Story 7.4 and the taxonomy item under `4-3` — decide the shape once.**
- `ListStorage.delete()` dead code — the method exists but `ListService.deleteList` bypasses it (calls
  `listRepository.delete` + `evictFromCache` directly, `ListService.kt:117-123`); latent inconsistency that could cause
  a double-delete if future code routes through `listStorage.delete()`. Re-verified 2026-09-07.
- `deleteList` partial-failure stale in-memory data — superseded in detail by the non-transactional-cascade entry under
  the 7.6 review, which corrects the "cascade ordering is a mitigation" reasoning this entry carried. Retained as a
  pointer only.

## Deferred from: code review of 3-1-deferred-work-triage-high-priority-fixes (2026-05-15)

The two frontend items in this section (`AuthContext` swallowing `getConfig` errors, and authenticated users
overwriting their session at `/auth/register`) targeted the Next.js App Router frontend. That frontend was replaced in
Epic 5; there is no `/auth/register` route today (`App.tsx` declares `/auth` only). Their live successors are filed
under the `5-1` and `5-2` reviews below. Archived.

- Concurrent test in `UserRegistrationTest.kt` may only verify sequential duplicate-rejection; Ktor `testApplication`
  may serialize requests on a single-threaded engine, making the TOCTOU proof vacuous; the MongoDB unique index is the
  real protection and the test still has regression value. **This is the "assertion that cannot fail" defect class the
  Epic 6 retro named, filed three epics before that retro named it.**

## Deferred from: code review of 2-4-registration-toggle-ui-adaptive-login-screen (2026-05-15)

The two `/auth/register`-page items are superseded by the Epic 5 rebuild (no such route exists), and the
`registrationEnabled`-stays-null item is superseded by the fuller `5-1` review entry below. Archived.

- `/auth/config` shares the auth rate-limit bucket with `/auth/login` — page-load requests consume login quota per IP;
  intentional per spec placement; revisit rate-limit config if exhaustion is observed in production. **Note the
  interaction with the rate-limiter-calibrated backend tests filed under the Epic 7 post-factum review.**
- `ApplicationConfigService` in-memory cache can diverge from MongoDB if the DB write fails after `cache.set` succeeds —
  process restart recovers; fix with a transactional write or cache invalidation on error.

## Deferred from: code review of 2-2-admin-user-management-backend (2026-05-15)

The "no pagination on `getAllRegularUsers` / `users`" item is superseded: it was routed to backlog as a product feature
request by `md` at the Epic 7 retrospective, and its E2E consequence is tracked as action **D4** under the Stories
7.8+7.9 entry above. Archived.

- AC4 test does not verify the `refresh_tokens` collection is cleared after `resetUserPassword` — direct DB inspection
  was discouraged by project rules at the time; `invalidateUserSessions` is tested as part of prior stories. (Note the
  rule has since relaxed in practice — Story 7.6's `AC-7.6-cascade` asserts on the raw collection.)
- `deleteUser` session invalidation has a TOCTOU window — a concurrent login between `adminDeleteUser` success and the
  `invalidateUserSessions` call produces a live refresh token; requires transactional semantics not currently in the
  codebase.
- Password plaintext in GQL mutation arguments (`createUser`, `resetUserPassword`) — logged in debug mode; same pattern
  as `register()` and `changePassword()`; broader API design concern. **Same family as the two log-sanitisation items
  under `1-2`/`1-1` — one `configureMonitoring()` audit covers all three.**

## Deferred from: code review of 2-1-applicationconfig-entity-registration-toggle-backend (2026-05-14)

- Non-atomic `AtomicReference` cache init in `ApplicationConfigService.get()` — benign in practice (the idempotent
  upsert means a double-load has no observable effect); use `compareAndSet` or a `Mutex` if stricter guarantees are
  needed. Re-verified 2026-09-07: `ApplicationConfigService.kt:7` is still a bare `AtomicReference` with no CAS. **Same
  shape as the three `sync()` guards under Story 7.6 — a fourth instance of the same check-then-act pattern.**
- Admin password compared with `==` (timing-vulnerable, no bcrypt) — pre-existing in `UserService`; accepted design
  trade-off. Re-verified 2026-09-07 at `UserService.kt:47-48`. Also filed under `1-2`.
- `changePassword` uses upsert `save` rather than a targeted atomic update — pre-existing pattern in `UserService`.
- Duplicate-username detection relies on a MongoDB unique index not established in this diff — the index should exist
  from story 1.1; tests pass; verify index creation in `UserRepository` on startup.
- `DataFetchingException` used as the error type for auth failure in `GraphQLForbiddenException` — clients should use
  `extensions.code`; minor semantic. **Fourth instance of the GQL error-taxonomy debt** (see `4-1`, `4-3`, Story 7.4).
- Magic number `11000` for the MongoDB duplicate-key error in `UserService` — replace with an
  `ErrorCategory.DUPLICATE_KEY` check when tightening error handling.
- `CONFIG_ID` is an instance `val` in `ApplicationConfigRepository` rather than a companion-object constant — trivial.

## Deferred from: code review of 1-2-login-token-system-session-security-backend (2026-05-08)

The `UserStorage.sync()` race is closed — the class was deleted by Story 2.0 and the surviving instances of the pattern
are filed under Story 7.6. Archived. Everything below was re-verified against `bp_back/` on 2026-09-07.

- **Refresh tokens stored as plaintext in MongoDB** — should be hashed with SHA-256 before storing; DB exfiltration
  exposes all active sessions. Re-verified: `RefreshTokenRepository` stores the token value as the document `_id` and
  looks it up with `Filters.eq("_id", tokenValue)`; no hashing anywhere. **The highest-severity item in this file.**
- **Access token not revoked on password change** — 15-minute JWTs stay valid after change-password; requires a token
  blocklist to fix; known JWT architecture limitation.
- **No `iat` (issued-at) claim in JWT** — prevents "invalidate tokens issued before T" without a blocklist. Re-verified:
  `AuthService.kt:74-76` sets `username`, `role` and `withExpiresAt` only. Pairs with the item above — `iat` is the
  cheap half of that fix.
- Admin timing attack — plain-text `==` on the admin password is faster than bcrypt+DB; the spec intentionally chose
  this; a timing side-channel exists but is an accepted design trade-off. The same `==` also reveals which account is
  the admin, via the ~100 ms difference from the bcrypt path.
- Admin password in JVM heap — a config-sourced `String` is not zeroed; a general JVM concern, not actionable without
  moving to `char[]`.
- **CORS plugin does not allow credentials or expose the Authorization header** — re-verified at `plugins/CORS.kt`:
  `anyHost()`, four methods, `allowNonSimpleContentTypes`, and nothing else. The frontend is same-origin through Caddy
  so nothing is broken; cross-origin clients (an API playground, a native mobile app) will fail. Note `anyHost()` is
  itself worth a look before this stack is ever exposed beyond the local edge.
- MongoDB error handling absent in repositories — `insertOne`/`deleteOne` throw `MongoWriteException` as a 500;
  pre-existing pattern across all repositories; needs a global error handler.
- AC2 log sanitization — Ktor monitoring may log request bodies including credentials; audit `configureMonitoring()`
  before production. **Still owed, and production now exists** (0.17.0 has been deployed since 2026-07).

## Deferred from: code review of 1-1-user-entity-registration-backend (2026-05-08)

`UserRepository.findByUsername` is no longer dead code (Story 2.0 made it the primary lookup path — five call sites on
2026-09-07), and the rate-limiter coverage item was delivered by Story 1.2. Both are in the archive.

- No input validation on username/password (length, blank, character set) — out of scope for Story 1.1; consider a
  validation layer.
- BCrypt 72-byte password truncation — passwords longer than 72 bytes are silently truncated by BCrypt; no maximum
  length is enforced at the API boundary.
- `password.toCharArray()` not zeroed after hashing — not actionable in the JVM given the upstream `String` is also
  unzeroable. Same family as the admin-password-in-heap item under `1-2`.
- `role` field is a raw `String`, not a typed enum — consider `enum class Role` when more roles are added. (Note the
  precedent now exists: Story 7.6 introduced `MemberStatus` with the enum stopping at the mapper boundary.)
- No test for a malformed / empty JSON request body — `call.receive<RegisterRequest>()` throws on bad input; the
  behaviour is untested.
- No test verifies the bcrypt hash is stored in MongoDB — the test only checks that the HTTP response does not contain
  the plaintext. (The "direct DB access is against project policy" reason has since lapsed — Story 7.6 asserts on raw
  collections.)
- UUID deserialization byte-swap risk — `UUIDMongoSerializer.asUuid()` may use JAVA_LEGACY byte order vs the STANDARD
  used by `MongoClientSettings`; needs a cross-cutting investigation against `ItemRepository` to confirm consistency.
- Monitoring plugin may log request bodies including passwords — audit `configureMonitoring()` before production
  deployment. Duplicate of the `1-2` AC2 item; one audit closes both.

## Deferred from: code review of 5-1-foundation-vite-mui-caddy-apollo-shell (2026-07-14)

All three re-verified against the current tree on 2026-09-07.

- `getConfig()` failure leaves `registrationEnabled` stuck at `null` with no retry
  [`bp_front/src/lib/auth/AuthContext.tsx:61-64`] — the bootstrap `.catch(() => {})` swallows the error and never
  retries. Both the Register link and the "Contact admin" text are suppressed while null, so a transient backend outage
  leaves the auth screen with no route to registration and no explanation. Supersedes the `2-4` filing of the same
  behaviour against the Next.js frontend.
- WS `connectionParams` sends `Bearer ` (empty) when unauthenticated, and a live WebSocket won't pick up a refreshed
  token until it reconnects [`bp_front/src/lib/apollo/ApolloProvider.tsx:37-39`]. **No longer unreachable:** Story 5.6
  shipped the subscriptions that open the socket, and Story 4.2's backend gate authenticates it — so the
  refresh-token-not-propagated half is now live on any session that outlives an access token.
- Bare `/api` (no subpath) falls through to the SPA `index.html` instead of the backend — `handle /api/*` does not match
  the exact path `/api` (`routing/Caddyfile:25`, re-verified). Latent because the app only calls `/api/<subpath>`.
  Tighten the matcher if a bare `/api` request is ever added.

## Deferred from: code review of 5-2-authentication (2026-07-15)

- `authApi.logout` has no timeout/AbortController, unlike `refresh`, which caps at 8 s
  [`bp_front/src/lib/auth/authApi.ts`, re-verified 2026-09-07: `logout` is a bare `fetch(...).catch(() => {})` while
  `REFRESH_TIMEOUT_MS = 8000` guards only `refresh`]. The `.catch()` handles a rejected fetch, not a socket that stays
  open with no response. If `/api/auth/logout` accepts the connection but never replies, the caller's `await` never
  settles, `clearAuth()` never runs, and the user is trapped signed in (there is no button-disabled/pending state
  either). Fix belongs in `authApi.ts`; revisit when a story is allowed to touch it.
- Authenticated user is not redirected away from `/auth` [`bp_front/src/App.tsx:16`, re-verified: `/auth` is declared
  outside the `RouteGuard` subtree] — `AuthPage` does not check `username`, so a logged-in user who navigates to
  `/auth` (bookmark, back button, manual URL) sees the sign-in form despite a live session. Pre-existing Story 5.1
  routing design. **Sharper under the PWA:** in standalone display the user has no URL bar to escape with, and the app
  bar does not render on `/auth`. Add a "if authenticated, redirect to /" guard if this becomes a product requirement.

## Deferred from: code review of ssl-termination-single-entrypoint (2026-07-16)

The rate-limiter item from this review was closed at the Epic 6 retro (production runs a separate server-only
compose/env; the repo's `KTOR_RATE_LIMIT_ATTEMPTS: 6000` is dev/E2E-only and never reached the deployed stack).
Archived — and **never infer production config from this repo**.

- source_spec: `_bmad-output/implementation-artifacts/spec-ssl-termination-single-entrypoint.md`
  summary: Defense-in-depth — Ktor `XForwardedHeaders` trusts the leftmost `X-Forwarded-For` unconditionally.
  evidence: `ForwardedHeaders.kt` installs `XForwardedHeaders` with defaults, so app-layer client-IP resolution relies
  entirely on the edge proxy overwriting `X-Forwarded-For` (documented in `routing/edge-proxy.md`). A misconfigured edge
  (appends instead of overwrites) re-enables IP spoofing and rate-limit bypass. Hardening (app-level trusted-proxy
  validation / `skipLastProxies`) was out of scope — the frozen intent forbade auth-code behaviour changes. Revisit when
  a story may touch the auth path. **Note this is load-bearing for the production rate limiter**, whose real per-IP
  value lives in the server-only compose.

## Deferred from: code review of story-5.3 (2026-07-17)

- source_spec: `_bmad-output/implementation-artifacts/5-3-user-account.md`
  summary: Consumed one-shot auth flags (`passwordChanged`/`expired`) are never reset after the guard redirect.
  evidence: `bp_front/src/lib/auth/AuthContext.tsx` + `RouteGuard.tsx` — `clearAuth` sets the flag and only a later
  `setAuth`/`clearAuth` clears it, so it stays sticky until the next sign-in. Re-verified 2026-09-07: `setAuth` resets
  both, `clearAuth` sets both, and nothing clears them on consumption. Re-entering a guarded route while still
  unauthenticated (e.g. manually navigating to `/` after a password change) re-fires the redirect and re-shows the
  banner. `expired` has had this latent behaviour since Story 5.2; `passwordChanged` inherits the accepted pattern. Low
  consequence, narrow trigger — consider a shared "reset flag on consumption" when this area is next touched.

- source_spec: `_bmad-output/implementation-artifacts/5-3-user-account.md`
  summary: Change-password error alert can shift the vertically-centred form on a failed submit (mobile, AC9 no-shift).
  evidence: `bp_front/src/routes/ChangePasswordPage.tsx` — field `helperText ?? ' '` reserves space (no shift on inline
  errors), but the conditional `change-password-error` Typography grows a `justifyContent: 'center'` column,
  re-centring the stack on failure. Mirrors the accepted Story 5.2 `auth-error` convention, so consistent rather than a
  regression; revisit holistically if the no-shift bar tightens. **Epic 8 tightens exactly that bar** — NFR-E8-1 makes
  narrow-viewport layout a gated property, and `/account/password` is in the route sweep, so this is now measurable
  where it was not.

## Deferred from: planning of 5-5-lists-management (2026-07-21)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-lists-management.md`
  summary: List optional description (FR34) is not implemented — the frozen backend has no `List.description` field.
  evidence: `type List` (`GqlList.kt`) exposes only id/name/emoji/ownerId/ownerUsername/members/createdAt/
  uncheckedItemCount, and `createList(name, emoji)` (`ListApi.kt`) takes no description arg. Epic 5 froze the backend,
  so shipping description would require a backend schema + mutation change (needs `md`'s sign-off). Create-list UI ships
  name + emoji only. **Still frozen:** Epic 8 authorises a scoped backend unfreeze but records it as unspent, and no
  Epic 8 story needs it. Revisit if/when the backend gains a description field.

## Deferred from: code review of 5-7-sharing-and-membership (2026-07-23)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-7-sharing-and-membership.md`
  summary: Membership mutation failures (leave/accept/decline/remove) do not trigger a `Lists` refetch, so a stale list
  row or pending-invite row can persist until a manual reload.
  evidence: `bp_front/src/routes/ListsPage.tsx` (leave/delete `ConfirmDialog` `onConfirm` calls `refresh()` only after
  the awaited mutation resolves) + `PendingInvites.tsx` (`run` returns without `onChanged()` on error). Concrete race:
  the owner removes member A at the same moment A clicks Leave; A's `leaveList` returns FORBIDDEN ("not a member"), A
  sees the inline error, but A's now-stale list row stays in the index until a manual `/lists` reload. Low consequence
  (recoverable by reload) and an unlikely concurrent-action window; a clean fix would refetch on the error path too.

## Deferred from: Story 8.2 — a long name and a full header fit on a narrow phone (2026-09-05)

- source_spec: `_bmad-output/implementation-artifacts/spec-8-2-a-long-name-and-a-full-header-fit-on-a-narrow-phone.md`
  summary: The app bar's username chip (`bp_front/src/components/AppShell.tsx:192`, `noWrap` + `maxWidth: {xs: 140, sm:
  220}`) is one of THREE instances of the construct still standing after Story 8.2 removed three from `/lists/:id` —
  the other two are `ListsPage.tsx:195` and `AdminPage.tsx:200`, in the entry below — and it still truncates a long
  username at the 320px floor. AC4 required it be measured rather than pass silently; it is **left as shipped**, with
  the measurement here.
  (Corrected twice. The Story 8.2 review called this "the FOURTH instance", which read as an exhaustive audit; the
  correction then said "at least FOUR … see the entry below for the other three" while that entry names TWO. Verified
  by grep at review Pass 2 and again 2026-09-07: `noWrap` with a fixed pixel cap survives at exactly three sites —
  `AppShell.tsx:192`, `ListsPage.tsx:195`, `AdminPage.tsx:200`. `ListShoppingPage.tsx:215` is a fourth `noWrap` +
  numeric cap and is discussed, unresolved, in the entry below. **Re-measured 2026-09-07 after Story 8.3:** that
  construct — the `addedBy` attribution `Typography`, `noWrap` + `maxWidth: 100` — moved from `:451` to `:215` when
  the row was extracted into the `ShoppingItemRow` component, and `:451` is now the back link. Every
  `ListShoppingPage.tsx` line number below this point in the file was written pre-8.3; the constructs, not the
  numbers, are what the entries are about.)
  evidence: Measured 2026-09-05 at 320px (Pixel 7 descriptor at the floor, production image on :2080) with the 42-char
  username `averyveryverylongusernameindeed_1788637389`. The chip BOX is fine — x 120.6, width 180, right edge 300.6 ≤
  clientWidth 320, and `document.documentElement.scrollWidth === clientWidth === 320` — so NFR-E8-1's "inside the
  viewport" and "no horizontal scroll" clauses both hold, and `narrow-viewport.spec.ts` already asserts the first with
  `expectInsideViewport`. What is NOT fine is the TEXT: `scrollWidth 369 > clientWidth 140`, i.e. the username is an
  ellipsis. Not fixed here for a structural reason, not an oversight: on `/lists/:id` the fix was to give the title its
  own row, and the app bar has no second row to give — of the 320px bar, the home link takes ~120px and the avatar +
  gap 40, leaving the 140px cap as very nearly the room that exists. Removing the cap the way the three list-detail
  caps were removed would widen the menu button past the bar. Any real fix is a different treatment (elide in the
  middle, drop to the avatar alone below `sm`, or move identity out of the bar) and wants its own story with a UX
  ruling. AR-E8-3 kept it out of automatic scope for this reason.

- source_spec: `_bmad-output/implementation-artifacts/spec-8-2-a-long-name-and-a-full-header-fit-on-a-narrow-phone.md`
  summary: `bp_front/e2e/item-attribution.spec.ts` (FR45/FR58, chromium) flaked once during Story 8.2's verification —
  `getByTestId('shopping-item-addedby-<renamed item>')` was not found within the 5 s expect timeout after an edit by a
  co-member.
  evidence: Observed 2026-09-05 in one full `--retries=0` run; the same spec passed on an immediate isolated re-run and
  in the following full run (151 passed, 15 skipped, 0 failed — an INTERMEDIATE state, recorded mid-review: neither the
  162 of the pre-review suite nor the 168 = 83/83/1/1 the story finished at, because only two of the three
  review-added tests existed when it ran). The testid is on the SHOPPING view (`/list/:id`), which Story 8.2 does not
  touch — the story's diff is confined to `/lists/:id`, the narrow-viewport spec and the FR40 case — so this is not
  caused or exposed by the change. Recorded rather than retried away because the config would absorb it silently at
  `retries: 2`. **Note that premise is itself disputed** — see the `process.env.CI` entry under Story 7.3: the
  `retries: 2` branch has, as far as this repo shows, never executed. What would settle the flake: a `--repeat-each`
  pass over that spec showing whether the miss is a live-update propagation race (the testid is keyed by the item NAME,
  so it changes with the rename) or ordinary timeout noise.

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
  measured at 320px.

## Deferred from: code review of 8-1-move-the-mobile-gate-to-the-width-people-actually-use (2026-09-05)

The FR40 `nowrap`/`ellipsis` assertions that encoded the defect as a requirement were replaced by Story 8.2, which owed
that change and made it. Archived.

- source_spec: `_bmad-output/implementation-artifacts/spec-8-1-move-the-mobile-gate-to-the-width-people-actually-use.md`
  summary: `expectNotClipped` compares integer-rounded `scrollWidth`/`clientWidth` with no subpixel tolerance, so
  fractional text widths could in principle produce 1px false reds in the gate every Epic 8 story reuses.
  evidence: Plausible because the Pixel 7 descriptor carries `deviceScaleFactor: 2.625` and both properties round up,
  but no false red was observed in any Story 8.1 run, including a `--repeat-each=2` pass over the whole `mobile`
  project (160/160 green, 2026-09-05). What would settle it: a 320px run showing `expectNotClipped` red at exactly 1px
  on text that is visibly not truncated. Adding a tolerance before that would guard undemonstrated state and blunt the
  epic's only geometry gate.

- source_spec: `_bmad-output/implementation-artifacts/spec-8-1-move-the-mobile-gate-to-the-width-people-actually-use.md`
  status: **DECIDED 2026-09-08 — closed by decision, superseded by the OPEN entry below.**
  summary: ~~Whether ``data-testid={`item-row-${item.name}`}`` should be re-keyed by `item.id`.~~
  **Decided by Story 8.4 (`spec-8-4-one-filter-and-search-on-both-list-screens.md`). Decision: KEEP the
  name-keyed testids; do NOT re-key by `item.id` in this story.** The original question — whether
  ``data-testid={`item-row-${item.name}`}`` in `ListDetailPage.tsx` should become id-keyed — was routed here because
  8.4 selects item rows by name. It does: the two new FR61 management-side specs in `lists.spec.ts` address rows as
  `item-row-<name>` throughout, and so does every FR61 assertion on the shopping side (`shopping-item-<name>`).
  **Why keep:** Epic 8's own contract keys BOTH surfaces by name (that is what makes a shopping-side and a
  management-side assertion about the same item comparable at all), and the FR61 filter is a filter over the item
  NAME — a spec that filters by name and then asserts by id reads as two unrelated facts. **The defect is real and
  stays real:** one list holding two same-named items in different categories still makes `getByTestId('item-row-X')`
  match twice and trip Playwright strict mode. Re-keying touches selectors several shipped specs depend on and every
  site must be visited rather than sed'd (the Story 8.3 selector-split closure above is the worked example of what
  that costs), so it remains its own story — **re-filed as OPEN below, no longer blocked on a decision.**

- source_spec: `_bmad-output/implementation-artifacts/spec-8-4-one-filter-and-search-on-both-list-screens.md`
  status: **OPEN — wants its own story.**
  summary: `item-row-<name>`, `shopping-item-<name>` and `filter-category-option-<name>` are not unique; two
  same-named items in different categories — or two same-named categories on one list — trip Playwright strict mode
  on both list screens.
  evidence: Carried forward from the entry immediately above with its decision applied: the testids stay name-keyed for now, and the non-uniqueness is
  the thing to fix. Two same-named items in different categories on one list break `getByTestId` strict mode on both
  screens. Not reachable through the UI's own flows today (nothing stops it; nothing in the suite creates it), and
  every scenario in the suite uses `Date.now()`-suffixed names, which is why this has never fired.
  Story 8.4 added a THIRD name-keyed family with the shared filter — `filter-category-option-<name>` in
  `bp_front/src/components/ListFilters.tsx`, addressed by name from `lists.spec.ts`, `shopping.spec.ts` and
  `narrow-viewport.spec.ts` — and it belongs in THIS entry rather than a separate one: a re-key that fixed the item
  rows and left the filter options name-keyed would leave the two screens' selectors inconsistent again, which is the
  thing this entry exists to prevent. (`add-item-category-option-<name>` predates Story 8.4 and has the same shape;
  the sweep should take it too.) A fix must re-key
  ALL of these surfaces together and visit each of the ~35 call sites; a partial re-key would leave the two screens keyed
  differently, which is the drift class Epic 8 exists to remove.

- source_spec: `_bmad-output/implementation-artifacts/spec-8-1-move-the-mobile-gate-to-the-width-people-actually-use.md`
  summary: `bp_front/e2e/navigation.spec.ts` (NFR-E6-2) and `bp_front/e2e/item-editing.spec.ts` (FR40) each call
  `page.setViewportSize({width: 360})`, which in the retargeted `mobile` project now WIDENS the viewport rather than
  narrowing it — so neither assertion runs at NFR-E8-1's floor.
  evidence: Verified at both call sites. Story 8.1 closed the coverage gap by ADDING floor-level assertions in
  `narrow-viewport.spec.ts` (the app-bar chip and home link, and the item row's edit/remove controls, all via
  `expectInsideViewport`) rather than by changing the two existing tests, because dropping them to 320 would change
  what they measure without anyone having measured the result first — which is exactly what AR-E8-2a forbids. Whether
  the 360px cases should survive at all is a question Story 8.2 was expected to answer and did not. Their comments now
  say 360 is a width those tests own, not "the floor".

## Deferred from: code review of spec-8-2-a-long-name-and-a-full-header-fit-on-a-narrow-phone (2026-09-06)

Review Pass 2, four layers. Five entries routed `defer`; the full triage lives in the spec's `### Review Findings`.

- **`epic-8-context.md`'s recompile dropped Story 8.4/8.5 contract detail that Pass 1 did not restore.** Verified by
  grep: "case-insensitive name search, combined by AND" (the 8.4 filter/search conjunction) and "The group is absent
  when there are no orphans" (the 8.5 `Uncategorized` group) are present at `456500b` and return zero hits now. Pass 1
  restored the `## Reports` index and the 8.2/8.3 UX bullets only. Stories 8.4 and 8.5 now have less contract to build
  from than before the story that shipped none of it. Fix edits a planning document, so it was out of Story 8.2's
  scope. **Blocking for Story 8.4** — restore before that story is planned, not after.
- **NFR-E8-1 was loosened in `epic-8-context.md:55` by the story that needed the carve-out.** Prior wording was "no
  control is clipped"; it now reads "no text is clipped **except where a story has measured the clipping and recorded
  the decision to keep it**", with Story 8.2 named as the standing example. Three caps remain: `AppShell.tsx:192`
  (audited), `ListsPage.tsx:195` (measured at `380 > 200`, but the recorded decision is "not in scope", not a
  keep-decision), `AdminPage.tsx:200` (unmeasured). Either the constraint carries a "known exceptions, pending audit"
  list naming all three, or the two screens go through the audit. **A live instance of Epic 7 action D2** — a
  constraint edited by the story it constrains, with no gate over the prose.
- **`/lists` and `/admin` clip at the floor with no assertion holding the debt visible.** `/lists` is reached at the
  floor only by the route sweep, which asserts `expectNoHorizontalOverflow(page)` and nothing element-level — green at
  `320 === 320` while the list name is an ellipsis at `scrollWidth 380 > clientWidth 200`. `/admin` is rendered at the
  floor on every run by `admin.spec.ts` (no project guard) but carries no layout assertion at all. Neither Typography
  has a `data-testid`, so no spec can target them today. Belongs with the scoping story this file already asks for.
- **`ListShoppingPage.tsx:421/:451` are dismissed as "a different case" without a measurement.** `:451` — **`:215`
  since Story 8.3 moved the row into `ShoppingItemRow`; `:451` is now the back link** — is `noWrap` with a hard
  `maxWidth: 100`, the same construct with a numeric cap, on the screen users spend the most time on;
  `:421` is `noWrap` + `maxWidth: '100%'` inside a `minWidth: 0` flex box, which clips by exactly report #2's
  mechanism without a numeric cap. Both are ruled out of scope on a one-line claim rather than the measurement this
  file demands of everything else. Measure both at 320px and file the numbers, or drop the framing.
- **`LONG_ITEM_NAME` may sit on the two-line boundary with no recorded margin — medium, UNVERIFIED.** The floor item
  test's only load-bearing assertion is now `expectNotClipped`'s height branch, and a 41-character name in the ~190px
  the row leaves at 320px is plausibly close to exactly two lines; a small font-metric or padding change would flip it
  red for a reason unrelated to the defect it guards. It fits today (the suite is green), but nothing records by how
  much — `item-editing.spec.ts` records `66 vs 44` at 360px and there is no equivalent at the floor. **What would
  settle it:** measure `scrollHeight`/`clientHeight` for `LONG_ITEM_NAME` at 320px and record the margin, or pick a
  name with slack.
