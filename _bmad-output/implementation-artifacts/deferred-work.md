# Deferred Work

> **Ledger rule (from the Epic 5 retro, 2026-07-28):** anything deferred "to a later story" must be recorded HERE, not
> only in a story file or dev-auto spec. The FR9 item below was tracked only in story prose and was silently orphaned
> when the epic switched from the story-file dev workflow to the dev-auto spec flow. This file is the ledger both
> workflows read.

## Epic 6 close-out (2026-07-29)

Full context: `epic-6-retro-2026-07-29.md`. **Epic 6 shipped to production** (version `0.16.0`) — the project's first
deployment. That resolved or retired five long-standing entries below; the remainder became named Epic 7 stories rather
than carried table rows, because Epic 5's action items came back **0/7** while its *agreements* largely held. The one
agreement that was encoded into an artifact (this ledger, as Story 6.1's **AC15**) executed perfectly.

**Closed by the Epic 6 retrospective — do not re-file these:**

- ✅ **Real-device HTTPS auth validation — DONE and working.** Epic 4's "mobile login broken on a real device" finding is
  now **refuted**, not merely unaddressed. Open since Epic 4, assigned in Stories 5.1/5.2.
- ✅ **FR47 migration — discharged by the real deployment.** It ran against production data and succeeded. Idempotent via
  the `app_migrations` `epic4-list-seed` record, so it cannot re-run. Validated-by-execution rather than by dry-run;
  carrying it a third epic was theatre.
- ❌ **FR9 automated E2E (401 → silent refresh → refresh-fail → `/auth?expired=1`) — CLOSED by decision.** The wiring
  exists and was hand-verified (`ApolloProvider.tsx` error link → `clearAuth(true)` → `RouteGuard` owns the
  `/auth?expired=1` redirect); automated coverage is deliberately not pursued. This is the "or close this entry with a
  stated reason" branch of the original action, exercised.
- ❌ **Auth rate limiter — CLOSED, not a defect.** Production runs a **separate compose/env held on the server only**, a
  deliberate security decision. `KTOR_RATE_LIMIT_ATTEMPTS: 6000` in this repo's `docker-compose.yaml` is dev/E2E-only
  and is overridden in production. Never infer production config from this repo.
- ❌ **Gradle MCP evaluation — CLOSED after 5 slips** (open since the Epic 2 retro). The wrapper has since moved to
  Gradle 9.6.1, so the original evaluation question is stale. Not carried forward.

**New from the Epic 6 deployment:**

- **The image publish path was never covered by the E2E gate.** `images-build-push.sh` built the frontend image with
  `./bp_front` as context while `bp_front/Dockerfile` requires the **repo root** (`COPY routing/Caddyfile`). Broken by
  Epic 5's Caddy rewrite, undetected through Epics 5 and 6, found only when md deployed by hand. Fixed in `fe31fbf`. The
  structural point outlives the fix: `docker compose` builds with `context: .` and the publish script builds separately,
  so **the artifact that ships is built by a path no gate exercises** — the one hole in Epic 5's "test the production
  artifact" principle. Accepted as closed by the fix; re-raise only if the paths diverge again.

## Epic 5 close-out — carried forward (2026-07-28)

Consolidated at retrospective. Full context: `epic-5-retro-2026-07-28.md`. These were tracked as retro action items in
`sprint-status.yaml → action_items` as well. **Statuses updated at the Epic 6 retro (2026-07-29) — see the Epic 6
close-out above before acting on anything here.**

- ~~**FR9 automated E2E is orphaned debt — 401 → silent refresh → refresh-fail → `/auth?expired=1`.**~~
  **CLOSED 2026-07-29 by decision** (see Epic 6 close-out). Retained for history:
  Deferred in Story 5.2 (AC#7, explicitly "tracked debt, not FR9 fully E2E-covered" — 5.2 issued no GraphQL query to
  trigger a 401), re-deferred in 5.3 (Decision #4 — the clean sign-out redirects too fast to fire it organically), and
  raised in 5.4 (Decision #8) as an **open question to `md` that was never answered** now that a query-bearing route
  made it organically reachable. Specs 5.5/5.6/5.7 do not mention it. The wiring exists and was hand-verified
  (`ApolloProvider.tsx` error link → `clearAuth(true)` → `RouteGuard` owns the `/auth?expired=1` redirect); only the
  automated coverage is missing. **Action:** either write the FR9-tagged E2E (any query-bearing route can host it now)
  or close this entry with a stated reason.

- ~~**Shared `registrationEnabled` flag races the E2E suite; masked by `retries: 2` rather than fixed.**~~
  **CLOSED 2026-08-08 by Story 7.3 — the race is deleted, not retried.** Mechanism: the FR20/FR21 admin test is tagged
  `@registration-toggle`; `playwright.config.ts` `grepInvert`s that tag out of `chromium`/`mobile` and grep-selects it
  into two new projects, `registration-toggle-chromium` (`dependencies: ['chromium', 'mobile']`) and
  `registration-toggle-mobile` (`dependencies: ['registration-toggle-chromium']`). `dependencies` is the only Playwright
  construct that orders work **across** projects, which is the scope this race actually had —
  `test.describe.configure({mode: 'serial'})` was rejected because it serializes within one project. The OFF window
  therefore opens only after every registering spec on both viewports has finished. The
  `expect(async () => …)`/`toPass` workaround in `support/ui.ts` was deleted in the same change rather than kept beside
  the fix. Total collected runs stayed **104** (51 / 51 / 1 / 1) — the test was rerouted, not duplicated.
  **Observed, not asserted:** with the mechanism disabled (two-project config, workaround already removed), three
  consecutive `retries: 0` runs failed **3**, **5** and **4** tests, every failure inside `registerViaUi` and carrying
  either `alert: "Registration is disabled"` or a 30 s timeout `waiting for getByTestId('to-register-link')`. With the
  mechanism in place, two consecutive `retries: 0` runs were `104 passed`, 0 flaky, 0 failed.
  **Caveat on that 3/5/4, added at review:** those runs had the mechanism absent *and* the `toPass` workaround already
  deleted, so they measure the fully-exposed race — **not** the historical one, which always ran with the workaround
  present. They are therefore not comparable with the "1 flaky, retry-healed" reports from Epics 5–6, and the
  first-draft inference that "the race is far larger than 1 flaky, the historical numbers were just measuring what
  survived retries" is **withdrawn**: no run was ever taken in the historical configuration. What the measurement does
  establish, which is all AC5 asked for, is that the race is real, reproducible on demand, and cross-project (runs 1–3
  each failed tests on `chromium` *and* `mobile` simultaneously — the empirical refutation of `mode: 'serial'`).
  Retained for history:
  Epic 6 accepted the flake a 6th and 7th time and added +34 UI registrations per run, widening the window.
  `registrationEnabled` is one Mongo document and the `chromium` + `mobile` projects run concurrently against a single
  backend, so the admin-toggle test's brief OFF window can break register-based specs in the other project. Accepted in
  5.4 ("keep the real flip + CI retries") and re-reported as "1 flaky, retry-healed" in 5.5, 5.6, and 5.7 — five
  acceptances, no fix. Full suite is NOT green at `retries: 0` locally. **Action:** serialize the toggle spec or give it
  a dedicated project/worker so the race is deleted rather than retried.

- ~~**Auth rate limiter is effectively disabled in the deployed stack.**~~ **CLOSED 2026-07-29 — the premise was
  wrong:**
  production uses a separate server-only compose/env, so the repo value never reached the deployed stack. Retained for
  history:
  `docker-compose.yaml` sets `KTOR_RATE_LIMIT_ATTEMPTS: 6000` (default 5/60s per IP) for E2E convenience. Previously
  flagged in the SSL/entrypoint review; restated here because the stack now sits behind a public-capable TLS edge.
  **Action:** a production compose profile with a sane per-IP value; keep 6000 dev/E2E-only.

- ~~**Real-device (physical phone) auth validation never performed.**~~ **DONE 2026-07-29 — validated and working on a
  real device; Epic 4's finding is refuted.** Retained for history:
  Assigned to `md` as a manual sign-off in Stories 5.1/5.2 and never recorded. The blocker at the time was the `Secure`
  `refresh_token` cookie, which Chrome rejects over a plain-HTTP LAN IP; that is now solved —
  `spec-ssl-termination-single-entrypoint`
  (commit `6b141e3`) provides the TLS edge and `playwright.config.ts` accepts
  `E2E_BASE_URL=https://bag-please.localhost`. Epic 4's "mobile login broken on a real device" finding is therefore
  **unrefuted, not fixed** — the emulated Pixel-7 gate is green but no physical device has been tested.

- ~~**FR47 migration path never validated against real data** (open since Epic 4).~~ **CLOSED 2026-07-29 — discharged by
  the production deployment:** the migration ran against real data, succeeded, and cannot re-run (`app_migrations`
  `epic4-list-seed` record). Validated by execution rather than by dry-run.

- **FR42 (one-timer) / FR43 (recurring) item UI deferred by epic design.** Backend support is complete and live,
  including the hourly scheduler; the UI affordances were intentionally postponed. `AddItemDialog` sends
  `recurring: null`. UI-only work against a frozen, tested contract whenever it is picked up.
  **Its recorded prerequisite is discharged 2026-08-10 by Story 7.4:** BUG-E6-2 (an edit wiping `checkedAt` and so
  permanently hiding the item from the scheduler) is fixed, so shipping the lifecycle control no longer ships a way to
  silently break the feature the control exposes. One caveat now applies instead, and it is filed in the 7.4 section
  below: `saveItem` can still produce `checked=false` with a non-null `checkedAt`, because `checked` is in `ItemInput`
  while `checkedAt` is server-owned. No UI path does this today; a FR42/FR43 UI must not introduce one.

- **Playwright `webServer` gaps, carried since Epic 3** (still unaddressed after the Epic 5 harness rebuild): no
  teardown command (containers accumulate across CI runs), the `url` health check only proves the entrypoint responds —
  not that Ktor is warm inside the container (first tests can see 502), and no `stdout`/`stderr` filtering, so a compose
  startup failure silently burns the full timeout before surfacing.

- **`warnings: [oversized]` on all three dev-auto specs (5.5, 5.6, 5.7)** was never investigated. Understand the
  threshold and whether it degraded anything before the next dev-auto run. **STILL OPEN — 3rd consecutive slip, and
  escalating.** Both Epic 6 specs carry `oversized` too, and Story 6.1 added a **new** warning type:
  `warnings: [multiple-goals, oversized]`. `bmad-dev-auto` had independently flagged the multiple-goals risk in its own
  blocked report before Epic 6 ran. Now an Epic 7 story (Epic 6 retro action B8).

- ~~**`bp_front/e2e/` is outside both frontend quality gates**~~ **CLOSED 2026-08-07 — Story 7.1 brought the suite
  inside both gates.** `bp_front/tsconfig.e2e.json` (a third project covering `e2e` + `playwright.config.ts`) is now
  referenced from the solution `tsconfig.json`, so `npm run build`'s `tsc -b` type-checks all 9 spec files plus
  `global-setup.ts`; `npm run
  lint` is now `eslint .`, which lints `e2e/`, `playwright.config.ts`, `vite.config.ts` and `codegen.ts` alongside
  `src/` (`dist` and `src/__generated__` stay ignored via the flat config's `ignores`). One pre-existing error was
  surfaced and fixed at the source (`e2e/lists.spec.ts:1`, an unused `type Browser` import); the gate was then observed
  **failing** on a deliberately injected type error and a deliberately injected lint error before being accepted.
  This entry is the rollup; the two per-review duplicates below (6.1 review, 6.2 review) close with it. **Residual gap
  filed separately:** type-aware linting is still not enabled, so an un-awaited assertion still ships undetected — see
  the new entry under "Deferred from: Story 7.1". Retained for history:
  neither linted (`eslint src/`) nor type-checked
  (`tsconfig.app.json` includes only `src`), while Playwright transpiles without type checking. Flagged as a defer in
  **both** Epic 6 stories; Epic 6 added ~1,015 lines of spec code into that blind spot, and AC-level claims that
  "`npm run lint` and `npm run build` pass" are vacuous for the layer the project treats as its hard gate. Now an Epic 7
  story (Epic 6 retro action B3).

- ~~**No shared E2E fixture module; the helper block is copy-pasted into four spec files**~~
  **CLOSED 2026-08-08 — resolved by Story 7.2.** The eight helpers (`uniqueUsername`, `registerViaUi`,
  `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`, `loginApi`, `gql`) now live exactly once, in
  `bp_front/e2e/support/api.ts` and `bp_front/e2e/support/ui.ts`;
  `grep -c "function <helper>" bp_front/e2e/*.spec.ts` returns **0** for all eight, and each spec passes its own
  `uniqueUsername` prefix so all seven namespaces survive byte-for-byte.
  **Two counts in the retained text are wrong; both were re-measured at `e4c54dc` by Story 7.2.** (a) The block was
  copy-pasted into **seven** spec files, not four — `account`, `admin`, `lists`, `navigation`, `sharing`, `shopping`,
  `item-editing` (per-helper: 7/6/5/4/4/4/2/2). (b) The `registrationEnabled` `toPass()` workaround had **five**
  copies, not four — `lists:32`, `navigation:41`, `sharing:32`, `shopping:33`, `item-editing:41`; `navigation.spec.ts:41`
  was missed by every prior document. The workaround itself is **unchanged and still present** (once, in
  `support/ui.ts`) — removing it is Story 7.3, which now lands in **one** place instead of five.
  Retained for history:
  **No shared E2E fixture module; the helper block is copy-pasted into four spec files** (`lists`, `shopping`,
  `sharing`,
  `item-editing`). `registerViaUi` carries the `registrationEnabled` `toPass()` workaround, so that logic will drift
  between copies — and the race fix has to land in four places instead of one. Now an Epic 7 story (Epic 6 retro action
  B4), sequenced **before** the race fix itself.

- ~~**`HomeRedirect` sorts `createdAt` lexicographically, so FR38 can send a user to the wrong list.**~~
  **CLOSED 2026-08-11 — resolved by Story 7.5.** The comparison is now numeric and lives in exactly one place:
  `byCreatedAtAsc` in `bp_front/src/lib/lists/homePath.ts` returns
  `Date.parse(a.createdAt) - Date.parse(b.createdAt)`, and both consumers call it — `useHomePath` (which `HomeRedirect`
  now delegates to entirely) and `ListShoppingPage`'s list-switcher `useMemo`.
  `grep -rn "createdAt.localeCompare" bp_front/src/` returns **zero** hits.
  **The retained text undercounts the defect: there were TWO copies of the expression, not one.**
  `ListShoppingPage.tsx:69` carried the identical sort and ordered the switcher chips, so `/` and the chip row could
  disagree about which list is first; it is outside the epic's `Files:` line for this story and is recorded as a
  deviation in the story record, `sprint-status.yaml` and the commit body rather than absorbed silently. The retained
  text's *other* branch — "or emit a fixed-precision timestamp" — was **rejected**, not merely unused (AR-E7-7): a wire
  format is not changed to paper over a frontend comparison bug, and `git diff bp_back/` is empty for this story.
  Verified by a Playwright `page.route` interception that patches only the two `createdAt` values in the real `Lists`
  response to the precision pair the UI cannot produce (`…:05.100Z` vs `…:05Z`), observed failing on both `chromium` and
  `mobile` with the comparator reverted.
  Retained for history:
  **`HomeRedirect` sorts `createdAt` lexicographically, so FR38 can send a user to the wrong list.**
  `[...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]` against a backend that emits
  `Instant.toString()`, which omits the fractional part entirely when nanos are zero — so `…:05Z` compares *greater*
  than
  `…:05.100Z` (`'Z'` 0x5A > `'.'` 0x2E) and the earlier list sorts last. ~1-in-1000 per list pair; also makes the FR38
  specs in `navigation.spec.ts` and `shopping.spec.ts` flaky at the same rate. Shipped in Story 5.6, untouched since.
  Fix: compare `Date.parse(createdAt)` numerically, or emit a fixed-precision timestamp. Now an Epic 7 story (Epic 6
  retro action B6).

- ~~**Activating the app-bar home link while already on the resolved home route is a visible no-op that still pushes a
  history entry**~~
  **CLOSED 2026-08-11 — resolved by Story 7.5.** The shared-hook route the retained text names is the one taken:
  `useHomePath('observe')` in `AppShell` reads the resolved path from the same resolver `HomeRedirect` uses (cache-only,
  so the app bar never issues the membership-gated `lists` request), compares it against `useLocation().pathname`, and
  when they are equal calls `event.preventDefault()` on the anchor's click. react-router 7's `Link` runs the caller's
  `onClick` first and skips its internal navigation when the event was `defaultPrevented`, and Enter on an anchor
  dispatches a click, so one line covers pointer and keyboard. **Nothing else about the element changes** — same
  element, `href="/"`, link role, focusability and focus ring, same type scale; `aria-current="page"` is the only added
  attribute. AR-E6-7 is satisfied because `AppShell` compares a path it is *given* and derives none.
  **Measured, both `chromium` and `mobile`: the history entry was real** — with the guard removed the click takes
  `history.length` from 5 to 6, and one `goBack()` then fails to leave the screen. The **spinner blink in the retained
  text could not be reproduced** and is not what the fix is verified against: by the time the user is standing on the
  resolved home route the `Lists` cache is warm, so `HomeRedirect` renders no spinner on the round trip and
  `home-redirect-loading` is absent in both the guarded and unguarded builds. The discriminating symptom is the wasted
  history entry, not the flash.
  Retained for history:
  **Activating the app-bar home link while already on the resolved home route is a visible no-op that still pushes a
  history entry** — spinner blink, then `replace` back to the same route, so Back appears to do nothing once. Not
  fixable in the app bar (AR-E6-7 forbids it re-deriving the home path); the clean fix belongs in `HomeRedirect` or a
  shared hook exposing the resolved path. Low consequence, unscheduled.

## Deferred from: Story 7.1 — E2E suite inside the frontend quality gates (2026-08-07)

Story 7.1 closed the "no static gate on `e2e/`" gap (three entries above). What follows is the residue it deliberately
did **not** take on, plus what its own adversarial review surfaced — recorded here rather than in `project-context.md`
(NFR-E7-1: that file is a rules file, this one is the ledger).

- **Type-aware linting is not enabled, so `@typescript-eslint/no-floating-promises` does not run — an un-awaited
  Playwright assertion still ships undetected.** This is the single highest-value remaining addition to the frontend
  static gate and the one rule class that would catch the canonical "assertion that never ran" defect
  (`expect(locator).toBeVisible()` without `await`). Story 7.1 audited all 2,474 lines of `e2e/` and found **zero**
  instances today, but nothing in the current rule set would catch a future one. **Why deferred (Story 7.1 Decision 9):**
  `bp_front/eslint.config.mjs` extends `tseslint.configs.recommended`, not `recommendedTypeChecked`, and
  `parserOptions` carries no `project`/`projectService`. Switching it on changes the rule set for `src/` too, and that
  blast radius is unmeasured; Story 7.1's whole value was a small, readable, tooling-only diff. **Natural home:
  Story 7.11 (ESLint 9→10)** — the next time the lint config is opened deliberately.
  **Implementation trap, verified on `typescript-eslint` 8.65.0 — do not lose a cycle to it:** with a solution-style
  root (`bp_front/tsconfig.json` is `{"files": [], "references": [...]}`), the documented
  `parserOptions: {project: ['./tsconfig.json']}` **fails** with
  `Parsing error: The file was not found in any of the provided project(s)`, because typescript-eslint does **not**
  follow project references. Use `parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}` instead —
  it is what typescript-eslint now recommends over `project`, and it needs no per-project maintenance as further
  tsconfigs are added (there are now three).

- **`codegen.ts` is still inside no tsconfig project.** After Story 7.1, `tsconfig.app.json` covers `src`,
  `tsconfig.node.json` covers `vite.config.ts`, and `tsconfig.e2e.json` covers `e2e` + `playwright.config.ts` —
  `codegen.ts` is the one remaining root file that `tsc -b` never sees. It *is* now linted (the widened `eslint .`
  picks it up) but it is not type-checked. Deliberately out of Story 7.1's scope (Decision 8): it is not E2E
  infrastructure, and widening the story to cover it would have meant either a fourth project or editing
  `tsconfig.node.json`, which Story 7.1 was forbidden to touch. Low severity — the file is 44 lines of codegen config.
  Fix by adding `codegen.ts` to `tsconfig.node.json`'s `include`; **verified sufficient on its own** — no `types` change
  is needed alongside it (`tsc -b` exits 0), contrary to this entry's first draft.

- **Informational, not debt — how Node ambient globals actually reach a project on TypeScript 6.** TypeScript 6.0
  changed the `types` default from "all of `@types/*`" to `[]`, so `@types/node` is no longer auto-discovered from an
  empty `types`. The operative rule is that **Node ambients are in scope only if something you import drags them in**:
  `vite.config.ts` imports from `vite`, whose own type surface pulls in `@types/node`, so `tsconfig.node.json` gets
  `process` transitively despite omitting `types`; `playwright.config.ts` imports only `@playwright/test`, which does
  not, which is why `tsconfig.e2e.json` must set `"types": ["node"]` explicitly (Story 7.1 hit four `TS2591`s on its
  `process.env` sites without it).
  **Correction (Story 7.1 review, 2026-08-07):** this entry was first filed claiming `tsconfig.node.json` was "one
  `process.env` reference away from a `TS2591`". **That is false and was disproved by probe** — appending
  `export const __probe: string = process.env.NODE_ENV ?? 'x'` to `vite.config.ts` and rebuilding from a cleared
  tsbuildinfo gives `tsc -b` exit **0**. There is no debt here; adding `"types": ["node"]` to `tsconfig.node.json`
  would be belt-and-braces, not a fix. Recorded because the *general* rule is the thing worth knowing, and because a
  ledger entry that sends the next agent at a non-problem is worse than no entry. If you do ever add `types` there, use
  the explicit `["node"]`, **not** `["*"]`, which the TS 6 release notes discourage.

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
  deliberately and saying so. Decide before Story 7.14 makes the image build more expensive.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `tsc -b` has no working incremental cache — all three projects fully re-check on every `npm run build`, and
  this story made that cost 50% larger.
  evidence: two consecutive `npx tsc -b --verbose` runs both print `Project 'tsconfig.e2e.json' is out of date because
  output file 'e2e/account.spec.js' does not exist` and rebuild everything. With `noEmit` and no `composite`, the
  `.tsbuildinfo` is written (337 bytes — not a real program graph) but never satisfies the up-to-date check. Pre-existing
  for the two original projects; Story 7.1 added a third without observing it. Low consequence today (full build ~2s).
  The `composite: true` + `noEmit: true` combination is accepted on TypeScript 6.0.3 and is the obvious thing to test —
  Story 7.1 rejected it only on "buys nothing here" grounds, which this finding contradicts.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-1-e2e-suite-inside-frontend-quality-gates.md`
  summary: `types: ["node"]` makes `setTimeout` return `Timeout` rather than `number` inside `e2e/`, while `src/` still
  gets `number` — the same line type-checks in one project and fails in the other.
  evidence: probe — `const t: number = setTimeout(() => {}, 1)` yields `TS2322: Type 'Timeout' is not assignable to type
  'number'` under `tsconfig.e2e.json` and compiles clean under `tsconfig.app.json`. Node's ambient timer declarations
  win over the DOM lib's when both are in scope. Not a defect, but a real gotcha for **Story 7.2**, whose shared support
  module is exactly the kind of code that reaches for a timer handle. Annotate as `ReturnType<typeof setTimeout>`.

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
  `files: ['**/*.{ts,tsx}']`. Neither tooling file violates the rule today (both export only a default config object),
  so this is latent, not live. Left alone deliberately: widening the override glob beyond what AC3 asked for was out of
  Story 7.1's scope. Fold `vite.config.ts` and `codegen.ts` into the override glob whenever the lint config is next
  opened (Story 7.11).

## Deferred from: Story 7.2 — shared E2E support module (2026-08-08)

Story 7.2 extracted the **eight helpers the epic named** into `bp_front/e2e/support/`. Everything below is duplication
that was measured and left in place.

**Read this list as a statement about provenance, not severity.** The selection criterion for what Story 7.2 extracted
was "the epic named these eight" — it was *not* "these are the worst duplication in the suite". Some rows below are
objectively larger than things that shipped: `loginApi` had 2 copies and was extracted, while `withSecondActor` has 15
sites across 6 files and was not. **Nothing here has been assessed and found acceptable. It has been assessed and found
out of that story's charter.** A later story should rank them properly.

- **`withSecondActor(browser, baseURL, fn)` — 15 `browser.newContext({baseURL, ignoreHTTPSErrors: true})` sites across
  5 files** (`admin` ×5, `sharing` ×5, `item-editing` ×2, `lists` ×2, `shopping` ×1 — the row said "6 files" while
  enumerating 5; corrected at Story 7.2's review). The largest single duplication in
  the suite. **Any extraction must preserve the AC4 caveat**: `browser.newContext()` does **not** inherit the project's
  `use` block, so a hand-built context silently runs at a desktop viewport on the `mobile` project. The convention the
  specs already follow — put the actor whose *rendering* the mobile gate must cover on the `page` fixture, the other in
  the hand-built context — is load-bearing and easy to lose in a helper.

- **`seedMembership(listId, owner, member, pw)` — 3 copies** (`shopping.spec.ts:278-281`, `item-editing.spec.ts:446-449`
  and `:594-597` at `e4c54dc`), each a 4-line `loginApi`×2 + `gql`×2 block. Missed by Epic 7 planning entirely. Now the
  cheapest remaining extraction, because both of its ingredients already live in `support/api.ts`.

- **`loginViaUi` — a helper in `admin.spec.ts:22-27`, inlined 4× elsewhere.** **Must not bake in success assertions**:
  `admin.spec.ts:133` calls it expecting a *failed* login. That constraint is why it was not folded into
  `registerViaUi`'s neighbourhood.

- **`backToLists` — a helper in `sharing.spec.ts`, inlined 3×**, one of which asserts on the URL instead of the
  `lists-page` testid. Converging them changes what one test asserts; that needs a decision, not a move.

- **`logoutViaMenu` — 2 copies, one missing the trailing `auth-page` assertion.** Same shape of problem: the copies are
  not equivalent, so extraction is a behaviour decision.

- **`uniqueName(label)` — 79 inline `` `<Label> ${Date.now()}` `` sites, no helper anywhere.** By site count the
  single most repeated idiom in `e2e/`. Trivially extractable and deliberately untouched: it is not one of the eight.

- **The `ADMIN` credential literal — 5 sites, 3 shapes.** `{username: 'admin', password: 'admin'}` is a named const in
  `admin.spec.ts:15` and `navigation.spec.ts:25`, and a bare inline literal in `account.spec.ts`, `lists.spec.ts` and
  `sharing.spec.ts`. Natural home is `support/ui.ts`.

- **`DEFAULT_PW` vs `PASSWORD` — and a third, uncounted copy in `auth.spec.ts`.** `admin.spec.ts:18` holds the same
  `'e2e-password-123'` literal under a different name; the other six copies were converged into `support/ui.ts`'s
  `PASSWORD` by Story 7.2. Renaming `DEFAULT_PW` is an `admin.spec.ts`-wide edit for zero behavioural gain — left alone
  on purpose. **Corrected during Story 7.2's review:** it is **not** the only surviving alias.
  `grep -rn "e2e-password-123" bp_front/e2e/` returns **three** sites — `admin.spec.ts:18`, `auth.spec.ts:13` and
  `support/ui.ts:20`. See the `auth.spec.ts` entry below.

- **`auth.spec.ts` inlines the whole registration flow and was invisible to every measurement in Story 7.2.**
  `auth.spec.ts:18-28` is `registerViaUi`'s body verbatim as a *test body* (goto `/auth` → `to-register-link` → fill →
  submit → `not.toHaveURL(/\/auth$/)` + `app-bar`), and `:13` holds its own password literal, `:12` its own
  `mia_e2e_${project.name}_${Date.now()}` username shape (no label segment). Story 7.2's ground truth was measured with
  `grep "function <helper>"`, which by construction cannot see an inlined copy — **the same class of undercount that
  story corrected in three prior documents.** Deliberately left inline: registration *is* the behaviour `auth.spec.ts`
  asserts (FR1), so routing it through the shared helper would have the test exercise the helper rather than the flow.
  **The consequence to record:** it is the one register-based spec with **no `toPass` hardening at all**, so it remains
  bare against the `registrationEnabled` race that Story 7.3 deletes. Decide there whether it wants the guard.
  **RESOLVED 2026-08-08 by Story 7.3 — it wants no guard, and neither does anything else.** The race it was bare against
  no longer exists (the toggle test now runs in projects chained behind both viewport projects), and the guard it would
  have copied was itself deleted from `support/ui.ts` in the same change. Adding one here would have re-created, in the
  one spec that never had it, the workaround AC3 exists to remove — and would hide the next genuine registration
  regression in the one spec whose whole subject (FR1) is registration. `auth.spec.ts` stays exactly as it is; its
  bareness is now the correct shape, not an exposure. The rest of this entry (the inlined flow, the third password
  literal, the label-less username shape) stays OPEN on its own merits.

- ~~**`global-setup.ts` overlaps `support/api.ts` in all but name.**~~ **CLOSED 2026-08-08 by Story 7.3.**
  `global-setup.ts` now does `import {BACKEND, gql, loginApi} from './support/api'`; its local `BASE_URL` const, its
  inline `fetch` login and its inline GraphQL `fetch` are deleted (the file went 53 → 55 lines, of which the body
  shrank from ~22 statements to 4 — the delta is comment, not code). `waitForBackend` stayed local and now polls
  `${BACKEND}/api/auth/config`. The constraint held in practice: `api.ts` still imports nothing from
  `@playwright/test`, and the run's globalSetup phase completed normally in five full-suite runs. Retained for history:
  Its `BASE_URL` is the same literal as `BACKEND`, and
  its inline admin login and `setRegistrationEnabled` call are `loginApi`/`gql` re-implemented. **Deliberately deferred
  to Story 7.3**, which owns that file. Note the constraint Story 7.2 built for it: `support/api.ts` imports nothing
  from `@playwright/test` precisely so `global-setup.ts` can import it without dragging the runner into the globalSetup
  phase. That is the whole reason the support module is two files rather than one.

- **Shopping-checkbox selector split.** 9 sites reach the checkbox as `shopping-item-<name>` +
  `getByRole('checkbox')`; `navigation.spec.ts:316` alone uses a dedicated `shopping-item-checkbox-<name>` testid. Not
  duplication so much as an inconsistency that a future helper would have to pick a side on.

- **`lists.spec.ts`'s four inline `addCategory`/`addItem` blocks are NOT a cleanup candidate — leave them.** Two are
  deliberately *weaker* than the shared helper (`:155-158` and `:160-165` at `e4c54dc` omit the dialog assertions) and
  one is deliberately *stronger* (`:106-116` asserts the item row scoped **under its category row**, which is the whole
  point of that test). Replacing them would silently add assertions to the FR46 cascade test and **lose** the nesting
  check. Likewise `createListViaUi` is a genuinely different function from `createListAndOpen` — it returns `void` and
  stays on `/lists`, where `createListAndOpen` returns the list id and navigates into the detail. Recorded here so a
  future "finish the job" story does not treat them as leftovers.

## Deferred from: Story 7.3 — delete the `registrationEnabled` race (2026-08-08)

- **A red `chromium` or `mobile` now costs the FR20/FR21 toggle coverage entirely — measured, not assumed.** With one
  chromium test deliberately failing, the run reported `1 failed / 2 did not run / 101 passed` and exited `1`: both
  `registration-toggle-*` tests were **not executed**. Playwright's wording is "did not run", not "skipped", and a
  single failing dependency project is enough (the `mobile` dependency passed in that experiment). This is the accepted
  price of `dependencies` and the run is already red either way, but it has a real consequence: **any failing run gives
  you zero information about FR20/FR21**, so a regression in the registration toggle can hide behind an unrelated
  failure across several red runs. Mitigations if it ever bites: run
  `npx playwright test --project=registration-toggle-chromium --no-deps` — **`--no-deps` is load-bearing and was missing
  from the first version of this entry:** without it the command re-runs the still-broken dependency and fails
  identically, so the recovery it prescribed could not work in the situation it was prescribed for (`globalSetup` still
  runs under `--no-deps`, so registration is still enabled).
  **The real fix candidate is `testProject.teardown`, and it was never evaluated.** The config comment written by this
  story claimed `dependencies` is "the only Playwright construct that orders work across projects" — that is false.
  `teardown` also orders across projects, and unlike `dependencies` it still runs when the run is red, which would
  dissolve this entire cost rather than mitigate it. The alternatives that *were* weighed were `mode: 'serial'`
  (rejected: wrong scope) and a worker-scoped file lock (rejected: re-introduces waiting at every register site). Both
  the claim and the omission are corrected in `playwright.config.ts`. **Action:** evaluate a teardown-project ordering
  before accepting this cost as permanent.

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
  retries" narrative repeated across three epics therefore names the wrong mechanism.** Verified 2026-08-08: there is no
  `.github/`, no `.gitlab-ci.yml`, no CI workflow of any kind; the only E2E entry point is `mise run front:e2e` →
  `npm run test:e2e` with `CI` unset, i.e. **`retries: 0`**. So the `retries: 2` branch has, as far as this repo shows,
  never executed. Whatever actually absorbed the seven acceptances — a developer passing `--retries` by hand, re-running
  after a red run, or simply reporting "1 flaky" from a `--retries=2` invocation — is undocumented, and the story
  records that repeat the "CI retries healed it" line (including this story's own) are propagating an unverified
  premise. **Action:** either stand up the CI pipeline the config already assumes, or delete the `process.env.CI`
  branch so the config stops describing infrastructure that does not exist. Out of charter here (the spec forbids
  touching `retries`). Original framing, retained because the underlying judgement still holds: the retries were added
  to absorb this race, the race is gone, and a surviving `retries: 2` would now mask a genuinely *new* flake rather
  than a known one.

## Deferred from: Story 7.4 — an item edit merges the stored item (2026-08-10)

Story 7.4 turned `ItemService.saveItem` into a **merge**: it loads the stored row with
`storage.getByIdCached(item.id, item.listId)` and, when the row exists, `copy()`s onto it only the five fields
`ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`). The direction is deliberate — copying the
input **onto** the stored row is an allowlist, so a field added to `Item` later is preserved by default; the inverse
(`item.copy(addedBy = stored.addedBy, …)`) is a denylist and the next server-owned field would regress silently.
BUG-E6-1 and BUG-E6-2 are closed above and BUG-E6-3 is partial. What follows is what the story knowingly did **not**
take, plus one thing the merge newly makes possible.

**Read the first three entries as scope decisions, not discoveries.** Each was put to `md` on 2026-08-10 and answered
as a ruling *before* any code was written; they are filed so that the next agent inherits the reasoning instead of
re-deriving it — and so that a later "tightening" is recognised as re-opening a decision rather than fixing an
oversight.

- **`saveItem`'s create branch still accepts a `category` that belongs to no list** (`md`'s ruling A: the check is
  **update-only**). No dialog *offers* a foreign category — both pick from the list's own `categories`
  (`ListDetailPage.tsx` passes them into `AddItemDialog` and `EditItemDialog`), and `SaveCategoryMutation`'s only
  consumer is `AddCategoryDialog.tsx:32` — so a direct GraphQL caller was the only producer this story's planning
  identified. **CORRECTED 2026-08-10 by the code review of this story: there IS a UI-reachable producer, and it is a
  two-member race, not an exotic client.** Removing a category from `/lists/:id` hard-deletes that category's items
  **first** and the category second (`ListDetailPage.tsx:288-296`, and its comment says why). So if member B removes a
  category while member A's edit dialog is open on one of its items, A's save finds the id gone from storage **and**
  gone from Mongo, takes the **create** branch — the branch this ruling deliberately leaves unguarded — and resurrects
  the item carrying the now-deleted category. That composes the two holes this story knowingly left open (the
  unguarded create branch here, and BUG-E6-3a's resurrection below) into BUG-E6-3b's state through a path a normal
  user can walk. **Price this entry accordingly: it is not "direct API callers only".**
  **Also corrected: the resulting item is not invisible on both screens.** `/list/:id` renders it under the synthetic
  `Uncategorized` bucket (`ListShoppingPage.tsx:40`, `:194-221`); only `/lists/:id` hides it, because that screen
  groups strictly by known category. The accurate description of the end state is **visible on the shopping view but
  unreachable for editing or removal on the management view** — bad, but recoverable-looking to a user who cannot
  actually recover it, which is arguably worse than being invisible.
  **The cost of closing it, measured at `73db447` rather than estimated:** `grep -c "saveItem(" *.kt` over
  `bp_back/src/test/kotlin/com/bagplease/` returns **32 hits across seven files** (`ItemLifecycleTest` 17, `ItemApiTest`
  5, `ItemCategoryStorageTest` 3, `ListAuthorizationTest` 2, `ListSharingTest` 2, `SubscriptionScopingTest` 2,
  `ListServiceTest` 1). Two of those hits are `ItemLifecycleTest`'s own helper declaration and its mutation string, so
  there are **30 invocations, of which 29 across six files invent a `catId` and never create the category** — only
  `ListServiceTest:183` seeds its own, at `:178`. Re-measured directly in this story's tree by hoisting the guard out
  of the update branch: **10 of the 25 `ItemLifecycleTest` tests went red**, the ruling-A tripwire among them
  (`Exception while fetching data (/saveItem) : Category <uuid> does not belong to list <uuid>` … `should not include
  substring "errors"`). **The cheap partial, if this is ever picked up under time pressure:** reject a category that
  exists on *another* list even on create. That is the half with a real victim, and **no existing test does it**, so it
  costs nothing. The expensive half — rejecting a category that exists nowhere — is what the 29 sites pay for.
  A tripwire test guards the current behaviour: `7.4 AC4 a CREATE with an unknown category is still accepted (ruling A
  tripwire)` in `ItemLifecycleTest`. Tightening the scoping must delete or rewrite that test deliberately; it is there
  so the change cannot happen by accident inside an unrelated red run.

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
  "locations":[…],"path":["saveItem"]}]}`. The frontend can therefore only branch on the message string, exactly as
  the list/sharing flows already have to. Why declined rather than fixed: the four `GraphQL*Exception` classes live in
  `bp_back/src/main/java/com/bagplease/plugins/` and are imported **only** by `*/gql` files (verified by grep), so
  throwing one from a service would be a service→plugins layering violation; getting a typed code any other way means
  editing `ItemApi.kt`, which is outside the scoped unfreeze. This is the same debt already on file as the **"AC7 error
  shape"** bullet under `## Deferred from: code review of 4-1-list-entity-backend-crud-authorization-migration
  (2026-05-22)` — that entry is about `ListService`'s over-long-name rejection and this is its second instance. Whoever
  picks up either should pick up both, and should decide the *shape* once (a `GraphQLBadRequestException` thrown from
  the `gql/` layer after the service returns a typed Left is the obvious candidate, but it changes `saveItem`'s
  `Either<ListAuthError, Item>` Left type, which Story 7.4 was explicitly forbidden to touch).

- **BUG-E6-3a — a save against a hard-deleted id resurrects the item. Severity-downgraded by this story, NOT fixed
  (AR-E7-2a).** This record is created here because the ID never existed in this ledger: `BUG-E6-3a` and `BUG-E6-3b`
  live only in `epics.md`, and `grep -n "E6-3a"` over this file returned nothing before Story 7.4. BUG-E6-3's parent
  entry above covers both halves; **(b) the dangling-category half is fixed by AC4, (a) this half is not.**
  What the merge changes: `ItemStorage.delete` is a **hard** delete, so the row is genuinely gone and a subsequent save
  against that id misses `getByIdCached`, takes the **create** branch, and is written as a new item — `addedBy` = the
  editor (who did, factually, create this row), `checkedAt` null (correct for a new item), and the result is visible
  and removable through the UI. Before the merge the same write reconstructed a row from `ItemInput`'s defaults and the
  outcome was indistinguishable from silent corruption. So the remaining defect is a **stale-dialog UX race** — B
  deletes an item while A's edit dialog is open, A saves, the item comes back — not a data-integrity failure.
  **The real fix is soft-delete tombstones that the scheduler owns:** make `deleteItem` set `deleted`/`deletedAt`
  instead of removing the row (`getByIdCached` already does not filter `deleted`, which is precisely why AC1's
  soft-delete test passes), let `saveItem` see the tombstone and reject the write, and give the existing
  `findSoftDeletedToHardDelete` reaper the job of collecting them. **That is outside the scoped unfreeze**: it changes
  the delete contract, the reaper's retention window and the subscription's `DELETED` semantics all at once, and Epic 7
  opened the backend for exactly one merge. Do not close this entry as "fixed by 7.4" — it was downgraded, not
  resolved. Client-side mitigations (refetch-before-save, clearing `editItemTarget` when the item leaves `items`) only
  shrink the window and are already described in BUG-E6-3 above.

- **New, and created by this story's own shape: `saveItem` can now write `checked = false` alongside a non-null
  `checkedAt`, and the scheduler then ignores the item forever.** `checked` **is** in `ItemInput` while `checkedAt` is
  server-owned, so an update that carries `checked: false` un-checks the row while the merge preserves the stored
  clock. `findCheckedRecurringItems` filters `checked == true`, so a recurring item in that state is skipped by the
  scheduler. **CORRECTED 2026-08-10 by the code review of this story: this half is inert, and the dangerous half is
  its mirror, which this entry originally missed.** `checked = false` **is** the restored, visible state — the
  scheduler has nothing to restore, and the next `checkItem` overwrites `checkedAt` (`ItemService.kt:86`), so the
  stale clock is residue, not a defect. It is emphatically **not** "the same end state as BUG-E6-2".
  **The state that reproduces BUG-E6-2's end state is `checked = true` with a null `checkedAt`.**
  `findCheckedRecurringItems` *returns* that row (it filters on `checked == true` and the cadence only), and
  `runSchedulerCycle` then drops it at `if (item.checkedAt == null || …) continue` (`ItemService.kt:120`) — checked
  off, never restored, on every cycle forever. The merge produces it whenever an update carries `checked: true`
  against a recurring row whose stored `checkedAt` is null, i.e. one created recurring and never checked through
  `checkItem`. Note this is **not a regression** — the pre-merge reconstruct nulled `checkedAt` on every save, so it
  was the norm — but it is the state a fix must actually target, and the remedy sketched below ("clear `checkedAt` on
  a true→false transition") does **not** close it. A third coherent answer belongs on the list: stamp `checkedAt =
  now()` when the merge transitions `checked` false→true on a recurring item, which is what `checkItem` already does.
  **No UI path produces either state today:** `EditItemDialog.tsx:125-144` carries `checked` and `recurring` forward from the **live** `item` prop
  specifically so an edit cannot reset them, and it says so in a comment. It is filed rather than fixed because
  closing it means deciding whether `saveItem` may un-check an item **at all** — which is `uncheckItem`'s job, and
  `uncheckItem` deliberately clears `checkedAt` as part of the scheduler contract. Two coherent answers exist (drop
  `checked` from the merge's allowlist, or clear `checkedAt` whenever the merge transitions `checked` true→false) and
  picking one is a product decision, not a bug fix. **Direct consequence for FR42/FR43:** the one-timer / recurring UI
  is now unblocked (see the FR42/FR43 entry near the top of this file), but it must not introduce the first UI path
  that sends `checked: false` for a recurring item without going through `uncheckItem`.

## Deferred from: Story 7.5 — home resolution and the inert home link (2026-08-11)

Story 7.5 closed four entries above (the FR38 lexicographic sort and the home-link no-op, each filed twice — once as a
rollup and once from the Story-6.2 review). What follows is what it uncovered or deliberately left standing.

- **`/lists` for a user with no lists is a route whose only exits are the user menu and creating a list.** For that
  user home resolves *to* `/lists`, so the title link is correctly inert there, and `/lists` has no back affordance of
  its own — leaving `user-menu-button` as the single in-app navigation control on the screen. Harmless today (the URL
  bar and the browser Back button are both present), but Story 7.14 removes both, and the new `exits` test asserts the
  user menu as the affordance of record precisely because it is load-bearing there. Worth a deliberate look when
  standalone display lands: an empty `/lists` in an installed app is one menu away from being a dead end.

- **Nothing mechanically prevents a third `createdAt` sort site from reappearing with `localeCompare`.** Both existing
  copies now call `byCreatedAtAsc`, and `grep -rn "createdAt.localeCompare" bp_front/src/` is zero — but that is a
  measurement, not a guard. `grep -rn "localeCompare" bp_front/src/` still returns three legitimate *name* sorts
  (`components/StoreField.tsx:37`, `routes/ListShoppingPage.tsx:209`, `routes/ListShoppingPage.tsx:327`), so a blanket
  ban is not the answer. The real guard is a lint rule scoped to the `createdAt` property, or a convention that any
  timestamp ordering imports the shared comparator. Unscheduled; the cost of rediscovery is one more ~1-in-1000
  wrong-list bug.

- **`/admin/*` is a splat route, so an admin on a hypothetical `/admin/<sub>` would see a LIVE title link** that
  navigates to `/admin`. That is correct behaviour, not a bug — but the inert test is exact pathname equality
  (`homePath === pathname`), so it is worth knowing before `AdminPage` ever gains nested routes: the guard would then
  fire on the index and not on the children, which is right, while any future assumption that "admin's title link is
  always inert" would be wrong.

- **The observe mode is cache-only, so on a cold `Lists` cache the link is briefly LIVE on the very route it resolves
  to** — one wasted click in a window measured in milliseconds, after which the answer is known and the link goes
  inert. Chosen deliberately over letting the app bar issue its own membership-gated `lists` request (UX-DR-E7-4's
  fail-toward-navigating direction; the same rationale as `ListDetailPage.tsx:52`). **This is observable in the suite
  and explains a real measurement:** with the guard deliberately made to over-fire, three of the four existing
  link-activating tests went red on both projects, but `FR38 — activating the title link with no lists lands on the
  lists index` stayed green — it reaches `/account/password` by a full page load, which resets the Apollo cache, and
  nothing on that route queries `Lists`, so the observed path is `null` and the link is live regardless of the guard.
  Consequence for future authors: a test that means to exercise the inert state must arrive at the route through
  IN-APP navigation, or warm the cache first. A `goto` is not equivalent.

- **One full-suite run went red immediately after `docker compose up -d --build --force-recreate` and could not be
  reproduced.** Three `mobile` tests failed — `admin.spec.ts:110` (FR16/FR17 password reset), `:145` (FR15/FR17 delete
  user) and `:219` (FR30/FR31 non-admin redirect) — on the first traffic against the freshly recreated stack, with the
  two toggle projects then reporting "did not run". The next three consecutive full runs at `retries: 0` were
  `118 passed`, 0 flaky, and three isolated `--project=mobile --no-deps` runs of `admin.spec.ts` passed 4/4 each time.
  **The failure text was not captured** (the console output was `tail`-ed and the following green run overwrote
  `test-results/`), so this entry cannot name a cause — the honest statement is that the first run against a
  cold-started backend failed three admin tests and no run since has. It is filed rather than dismissed because it is
  exactly the shape of a cold-start flake that the epic's "green at zero retries, measured twice" requirement exists to
  catch, and the next occurrence should be captured with `--reporter=list 2>&1 | tee` before the report is overwritten.
  Suspected but unverified: JVM/Mongo cold start under 118 concurrent tests. Not attributable to this story's change —
  `AppShell` fires no new request in observe mode, and `admin.spec.ts` does not touch the title link.

## Deferred from: code review of 7-5-home-resolution-and-inert-home-link (2026-08-11)

Nine findings from this review were **patched in place** (the cold-start test race, the modified-click guard, the
NaN/tie-break comparator, trailing-slash normalisation, a seventh test for the zero-list home outcome, three
interception hardenings in the FR38 test, and three overclaiming comments). Six were rejected as not real — two of
them worth naming so they are not re-raised: the claim that `HomeRedirect`'s `path === '/lists'` welcome-forwarding is
untested is **false** (`account.spec.ts:103`, FR5, covers it and passes), and the claim that ignoring `search`/`hash`
in the pathname compare is a live defect is **unreachable** (`useSearchParams` appears only in `AuthPage`, which is
outside `RouteGuard`; no guarded route ever carries a query string). What follows is what was deferred.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: **FOR `md` — a design decision, not a bug: should the app bar be allowed to join the in-flight lists query
  so the inert guard covers the cold-start window?** Today it does not, and for roughly the first 100ms after a full
  page load of the resolved home route the title link is live, so a click landing in that window still costs the FR57
  history entry the story exists to remove.
  evidence: `AppShell.tsx` observes via `useHomePath('observe')`, which is `fetchPolicy: 'cache-only'` — a constraint
  written into the spec's `<intent-contract>` ("the observing consumer must never issue the membership-gated `lists`
  request", "unknown path ⇒ not inert"). The window is real and measured: `ListShoppingPage.tsx:228` computes
  `loading` from `itemsResult`/`categoriesResult` only, so `list-shopping-page` (and the app bar with it) renders
  before the lists query resolves; a probe reads `aria-current` as absent immediately after the page appears and
  `page` a moment later. Two of the story's own new tests raced it and failed 2 of 6 isolated runs before they were
  changed to synchronise on `aria-current`. The implementation is contract-conformant — the contract's I/O matrix
  explicitly specifies a live link while resolving — so this was NOT overridden unilaterally. The cheap fix is
  `fetchPolicy: 'cache-first'` in observe mode: on `/list/:id` and `/lists` the page already issues the identical
  `Lists` query so Apollo would dedupe it to zero extra requests, and the only routes where it would add one
  (`/lists/:id`, `/account/password`) are never home. That contradicts the contract's letter, which is why it is a
  question for `md` rather than a patch. Weigh it against the fact that Story 7.14 makes this link the app's only
  exit and makes launch-then-tap the normal interaction.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: `useHomePath`'s `if (error) return '/lists'` branch is unreachable in `observe` mode, so while the lists
  query is failing the two consumers of the "single source of truth" disagree about where home is.
  evidence: `cache-only` never issues a request and therefore never surfaces an `error`; observe mode falls to
  `!data → null` instead. Verified by forcing the `Lists` operation to HTTP 500: a zero-list user standing on
  `/lists` (which is where `HomeRedirect` would send them) gets no `aria-current`, and clicking the title moves
  `history.length` 2 → 3. Low consequence — one wasted Back press in an already-degraded state — but the hook's own
  header comment claims both consumers read the same answer, and that is only true once the query has succeeded. Same
  root cause as the entry above; fixing that fixes this.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: **UX question for `md`** — for a sighted user the inert link is a silent no-op with no feedback at all, and
  one of the new tests actively enforces that it looks identical to a live one.
  evidence: UX-DR-E7-2 and AR-E7-8 require the inert state to keep its type scale, weight, colour, hover underline
  and focus ring, and `inertlook` asserts exactly that. So the control advertises itself as clickable, underlines on
  hover, takes focus, activates on Enter — and does nothing. `aria-current="page"` reaches screen readers only.
  Rejecting `disabled`/`aria-disabled` is right (the element is the only exit on `/admin` and `/account/password`),
  but the middle ground was never considered: `cursor: 'default'` on the inert state would give sighted users the
  same signal without touching type, colour, or the accessibility tree. Not applied unilaterally because "identical
  look" is an explicit UX ruling.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: `AppShell` now mounts a `ListsQuery` watcher on every guarded screen — including `/account/password` and
  `/admin` — purely to decide one attribute, and re-renders the whole shell on any write to the lists cache.
  evidence: `useHomePath('observe')` inside `AppShell`. It costs no network request (`cache-only`, and admin is
  skipped entirely), so the consequence is a wrong dependency direction rather than a measurable cost: a chrome
  component now depends on the list domain. The alternative shape is a small context published by whoever already
  fetches lists, which would give the app bar the answer without giving it the query. Deliberately not done here —
  the shared hook is what the intent contract prescribes, and inverting the data flow is a bigger change than this
  story's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-5-home-resolution-and-inert-home-link.md`
  summary: A semantic change slipped in with the refactor: `/` used to redirect when the lists query settled with no
  data, and now shows the spinner indefinitely instead.
  evidence: the old `HomeRedirect` spun only while `loading` and otherwise fell through to `lists = []` → `/lists`;
  the new one returns `null` for `!data`, which renders `home-redirect-loading` with no timeout. Practically
  unreachable in `resolve` mode — Apollo sets `data` on success and `error` on failure, and the `skip` path is
  admin-only, which returns `/admin` before the check — so this is filed as a latent semantic difference, not a live
  bug. It is not a dead end for the user either: `AppShell` wraps `/`, so the user menu remains available. Worth
  knowing before anyone adds a fetch policy or an `errorPolicy` that can produce settled-and-dataless.

## Deferred from: code review of 7-4-item-edit-merges-stored-item (2026-08-10)

Two findings from this review were **not** deferred — they were corrected in place, because they were false statements
this story had just written into the two entries above: the create-branch category hole is UI-reachable through the
remove-category cascade (not "direct API callers only"), and the filed `checked`/`checkedAt` desync had the harmful
and harmless halves the wrong way round. Both corrections are marked `CORRECTED 2026-08-10` in the Story 7.4 section.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: Nothing tests the "throw before `emit`" contract that this story promoted to a stated invariant.
  evidence: The spec and `project-context.md` both assert that AC3/AC4 must throw before `itemUpdateChannel.emit(...)`
  so a rejected save broadcasts no `SAVED` event. All four rejection tests assert only on the HTTP response body, so
  moving the `emit` above the throws would regress the invariant with the suite fully green. It is cheap to cover —
  `ItemService.itemUpdates` is a public `SharedFlow` and `SubscriptionScopingTest` already shows the collect pattern —
  but doing it inside a `MutableSharedFlow` with `extraBufferCapacity = 1` and no replay needs a collector attached
  before the call, which is a timing shape this suite has no precedent for; it was left out of the review pass rather
  than land a possibly-flaky test on a story whose sibling (7.3) existed to delete a flake.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: AC3's cross-list rejection is a TOCTOU pre-read where an atomic storage-layer fix was available.
  evidence: Between `repository.findById(item.id) != null` (`ItemService.kt:63`) and `storage.save(toSave)` (`:69`) a
  concurrent request can create the same `_id` on another list, and `ItemRepository.save`'s filter is `_id` only under
  `upsert(true)`, so the relocation AC3 forbids still happens. Adding the `listId` to that filter — or a compound
  unique index — rejects it atomically, needs no extra read per write, and would not have required the new repository
  method that forced one of this story's two `Files:`-line deviations. The window is narrow and the guard is a strict
  improvement on the baseline, so this is a follow-up, not a defect in the merge.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-4-item-edit-merges-stored-item.md`
  summary: The create/update branch is chosen from the in-memory cache while the cross-list rejection reads Mongo, and
  nothing pins the two to agree.
  evidence: `saveItem` discriminates on `storage.getByIdCached` (`ItemStorage`'s `ConcurrentMap`) but rejects on
  `repository.findById` (a Mongo point read). They agree today only because every write path goes through
  `save`/`delete`/`deleteAllInList` + `evictList` on a single backend instance. A second instance, a migration writing
  straight to Mongo, or a future partial eviction makes a legitimate update miss the cache, take the create branch,
  hit `findById`, and be rejected with the actively misleading `"Item <id> belongs to a different list"`. The coupling
  is load-bearing and is recorded nowhere in the code, the tests, or `project-context.md`.

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
  summary: Four comments in `EditItemDialog.tsx` are now factually wrong and shipped that way, because `bp_front/src/`
  was out of scope by rule.
  evidence: `:38-43` still describes `saveItem` as "a full-document upsert (`GqlItemMapper.mapItemFromInput` builds a
  fresh `Item` from the input alone)" and names "the server-side `checkedAt` reset — see deferred-work.md BUG-E6-2" as
  a live blocker on the lifecycle control; `:117` and `:127` repeat the premise. BUG-E6-2 is closed. The next
  developer is pointed at a fixed bug — and, worse, the `checked`/`recurring` carry-forward those comments justify is
  now the only thing keeping the desync in the Story 7.4 section from being reachable, so a reader who deletes the
  carry-forward as obsolete opens a real hole. This should be picked up by the first story that is allowed to touch
  `bp_front/src/` (FR42/FR43 is the natural one).

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
  evidence: the toggle test asserts `contact-admin` / `to-register-link` on `offPage` (`admin.spec.ts`, from
  `browser.newContext({baseURL, ignoreHTTPSErrors})`) and inside `withFreshAuthPage`, both hand-built. The project's
  own documented rule — "`browser.newContext()` does NOT inherit the project's `use` block" — means those run at a
  desktop viewport on `registration-toggle-mobile` too. Only the admin-panel half (menu → `/admin` → the Switch) is
  genuinely Pixel-7-emulated there. Pre-existing since Story 5.4; Story 7.3 only made it visible by giving the test its
  own projects, and corrected the config comment that claimed the opposite. Fix would be to drive the public-effect
  assertions on the `page` fixture, or to accept and document the split coverage deliberately.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-3-delete-registrationenabled-race.md`
  summary: `testProject.teardown` was never evaluated as the ordering mechanism, and it is the one candidate that would
  remove the "a red run yields zero FR20/FR21 information" cost instead of merely mitigating it.
  evidence: `teardown?: string` exists on `TestProject` in the installed Playwright 1.61 types and orders work across
  projects like `dependencies`, but runs after its project finishes regardless of outcome. The alternatives actually
  weighed were `mode: 'serial'` and a worker-scoped file lock. See the corrected entry under "Deferred from: Story 7.3".

- source_spec: `_bmad-output/implementation-artifacts/spec-7-3-delete-registrationenabled-race.md`
  summary: converging `global-setup.ts` onto the shared `gql` traded a status-aware failure message for the helper's
  parse-before-`res.ok` behaviour, in the one code path whose failure blocks the entire suite.
  evidence: the deleted inline code did `if (!gqlRes.ok) throw new Error("Enable-registration request failed: " +
  status)` before parsing; `support/api.ts:29-38` calls `await res.json()` first, so a Caddy 502 HTML body or an empty
  401 now surfaces as an opaque `SyntaxError` instead of naming the status. `loginApi`'s message likewise drops the "in
  global setup" context the old string carried. The underlying `gql` defect is already filed (7.2 review); this records
  that Story 7.3 removed the one call site that did not have it, so fixing `gql` is now the only way to get it back.

## Deferred from: code review of 4-8-frontend-lists-tab-list-management-bpavatar (2026-05-25)

- `ListStorage.rename` not atomic — in-memory updated before MongoDB write; if MongoDB throws, in-memory reflects rename
  but DB does not until process restart; same pre-existing pattern as `save()` and `delete()` across all Storage classes
- Concurrent delete+rename race causes `IllegalStateException` bypassing GQL error model — service confirms existence
  via `listStorage.getById`, then storage re-confirms; a concurrent `deleteList` between the two calls evicts the list
  from the map, causing `storage[id] ?: throw IllegalStateException(...)` to throw an uncaught 500 instead of a
  structured GQL error; pre-existing pattern across all Storage classes

## Deferred from: code review of 4-7-frontend-today-tab-shopping-loop-core-components (2026-05-25)

- `usePrefersReducedMotion` hook duplicated in `ItemCard.tsx` and `ProgressStrip.tsx` — registers separate matchMedia
  listeners per instance; extract to a shared `src/hooks/usePrefersReducedMotion.ts`
- `announceToSR` fires immediately on check before mutation resolves — on checkItem failure, SR has already announced
  item as removed; no correction is announced; AC10 satisfied for happy path only; error path SR UX not spec'd
- `uncheckItem` (Undo) failure is silent — no onError handler; UI shows unchecked while backend may remain checked; not
  spec'd for this story
- Concurrent check+undo race — if Undo is tapped while checkItem is still in-flight, both mutations run concurrently;
  last writer wins; rare edge case not spec'd
- `ListChipRow` shows skeleton chips when user genuinely has zero lists — `lists.length === 0` shows skeletons
  regardless of loading state; requires a separate `loading` prop to distinguish; enhancement deferred
- Subscription `updateQuery` merge safety — `{...items[idx], ...update.item}` overwrites known-good fields with
  undefined if the subscription document is trimmed in future; low-risk forward-looking concern

## Deferred from: code review of 4-6-frontend-bpsheet-spike-component (2026-05-25)

- No keyboard alternative for drag handle expand/collapse — drag handle is `aria-hidden` and `useSwipeable` is
  touch/mouse only; keyboard users cannot move the sheet between PEEKED and OPEN states; not in spec scope for this
  story; forward-looking accessibility gap to address when BPSheet API is locked
- `triggerRef.current` null at focus restore leaves focus on `<body>` — if the trigger element is conditionally
  unmounted while the sheet is open, focus after close lands on `<body>`; component handles it safely via optional
  chaining (no crash); caller responsibility to keep trigger mounted until close

## Deferred from: code review of 4-5-frontend-foundation-theme-navigation-layout (2026-05-24)

- Today tab `onChange` navigates to `/lists` instead of a list route — intentional scaffold; dev notes confirm Story 4.7 wires the Today tab properly with a real `listId`
- `no-sx-color` ESLint rule only inspects flat `ObjectExpression` — spread/nested/conditional `sx` patterns bypass enforcement; acceptable for current scope, enhance rule when a bypass is observed in practice
- `router` in `useEffect` dependency array on `page.tsx` — theoretically triggers re-fire if router identity changes; stable in Next.js practice; `page.tsx` will be substantially rewritten in Story 4.7
- `AuthContext` `clearAuth` + `isLoading` timing edge case — if `clearAuth` fires before initial `refresh` resolves, `isLoading` stays `true` until `refresh` completes, holding `RouteGuard` in null-render state while Apollo redirect fires; pre-existing in `AuthContext`, not introduced by this story

## Deferred from: code review of 4-3-list-sharing-backend-pending-invites-member-management (2026-05-22)

- Untyped status strings `"PENDING"/"ACCEPTED"/"DECLINED"` — no sealed enum or constants; typos silently produce broken state; pre-existing design choice not introduced by this story
- `acceptInvite` TOCTOU double-accept race — two concurrent accepts can both pass the `PENDING` check and insert the user's UUID into `List.members` twice; spec-acknowledged acceptable at this scale
- `deleteList` doesn't clean up `list_members` rows — orphaned `list_members` rows accumulate for deleted lists; `getLists` silently drops them via null-map; `deleteList` predates this story
- Re-invite after DECLINE overwrites original `createdAt` — `shareList` constructs a new `ListMember(..., Instant.now())` on re-invite, upsert overwrites original invite timestamp; acceptable for current audit requirements
- Username recycling UUID/username desync — `removeMember`/`leaveList` filter `List.members` by resolved UUID but `memberUsernames` by string; if a username is re-registered to a different UUID the two arrays diverge; pre-existing design gap not introduced by this story
- Non-auth validation errors wrapped in `GraphQLForbiddenException` — `UserNotFound`, `AlreadyMember`, `AlreadyPending`, `SelfShare` are semantic validation errors but use the same exception type as auth failures; pre-existing GQL error taxonomy (noted in 2-1 deferred items)
- `acceptInvite` UUID oracle via error differentiation — valid `listId` returns `NotPendingInvite` (confirming existence) vs error for unknown UUIDs; auth-gated endpoint, UUID space makes enumeration infeasible; acceptable design tradeoff
- `runBlocking` in `ListMemberRepository.init` — follows same pattern as all other repository `init` blocks; already deferred in 4-1 review

## Deferred from: code review of 4-2-websocket-auth-per-list-subscription-scoping (2026-05-22)

- Stale `isMember` cache — `ListStorage.getByIdCached` bypasses `sync()`; a user revoked from a list mid-subscription may continue receiving events until the process restarts or the cache is refreshed; full test requires Story 4.3 member-removal mutation
- Race window between Point 1 `verifyMembership` and `emitAll` start — theoretical TOCTOU gap; mitigated in practice by Point 2 `takeWhile` re-check on every event; acceptable design tradeoff given two-point enforcement
- Lost SharedFlow events during subscribe setup — events emitted between `verifyMembership` and `emitAll` may be silently dropped if the SharedFlow buffer is full (DROP_OLDEST); pre-existing SharedFlow backpressure behavior not introduced by this change
- AC4 Point 2 (`takeWhile` membership revocation) test absent — implementation exists and is correct; test blocked on Story 4.3 member-removal mutation (noted with TODO in `SubscriptionScopingTest.kt`)

## Deferred from: code review of 4-1-list-entity-backend-crud-authorization-migration (2026-05-22)

- TOCTOU `synced` flag — `private var synced = false` is non-volatile; two coroutines can double-sync on startup; pre-existing pattern in `UserStorage` from story 1.2; affects `ItemStorage`, `CategoryStorage`, and new `ListStorage`
- `runBlocking` in repository init + duplicate instantiation — repository constructors call `runBlocking { createIndexes }` (pre-existing pattern); `Application.kt` and `GQL.kt` now create separate repository instances, doubling startup index-creation calls; idempotent but wasteful
- `isMember` cold-cache false-denial — `ListStorage.getByIdCached` bypasses `sync()`; if called before any sync, returns `false` for legitimate members; `isMember` is currently unused in production paths but is a latent trap
- `deleteList` partial-failure stale in-memory data — if `listRepository.delete()` throws after `itemRepository.deleteAllInList` + `categoryRepository.deleteAllInList` succeed, the `evictList` calls are never reached; in-memory data stays stale for the process lifetime; process restart recovers from MongoDB; design-acknowledged via spec cascade ordering
- `verifyMembership` error message leaks list existence — "List not found" vs "Access denied" reveals whether a list UUID exists; UUID space makes enumeration infeasible in practice
- `GqlItem @GraphQLName("Item")` input/output collision — same class used as both input and output type in graphql-kotlin; pre-existing pattern before this story; all 65 tests pass; investigate if schema generation creates `ItemInput` vs `Item` conflict
- AC7 error shape — `IllegalArgumentException` for list name > 100 chars produces a GQL execution error, not a formal GQL validation error; behavior is correct (no DB write, error returned to client) but error format differs from spec intent
- `ListStorage.delete()` dead code — the method exists but `ListService.deleteList` bypasses it (calls `listRepository.delete` + `evictFromCache` directly); latent inconsistency; could cause a double-delete if future code routes through `listStorage.delete()`

## Deferred from: code review of 3-2-e2e-test-coverage-admin-panel (2026-05-18)

- `webServer` has no teardown command — containers started by `docker compose up -d` during the test suite are never
  stopped; on CI this accumulates running containers across runs
- `webServer` `url` health check only verifies nginx responds on port 2080, not that Ktor or Next.js are fully ready
  inside containers; first tests may encounter 502 until backend warms up
- `webServer` has no `stdout`/`stderr` filtering — on compose startup failure Playwright silently waits the full 120 s
  timeout before surfacing the error
- AC1 page-reload assertion absent — the spec calls out "without a page reload" but asserting absence of navigation in
  Playwright requires a `framenavigated` listener; deferred as impractical at current test scope
- Orphaned test users from guard tests (`guardtest_*`, `guardnav_*`) accumulate in DB per run — accepted same-pattern as
  `auth.spec.ts`; clean dev DB periodically

## Deferred from: code review of 3-1-deferred-work-triage-high-priority-fixes (2026-05-15)

- Concurrent test in `UserRegistrationTest.kt` may only verify sequential duplicate-rejection; Ktor `testApplication`
  may serialize requests on a single-threaded engine, making the TOCTOU proof vacuous; MongoDB unique index is the real
  protection and the test still has regression value
- Permanent blank page if auth config fetch permanently fails: `AuthContext` swallows `getConfig` errors silently,
  leaving `registrationEnabled === null` forever; `/auth/register` shows a blank page indefinitely with no error message
- Authenticated users can navigate to `/auth/register` and overwrite their session: `RegisterLayout` checks only
  `registrationEnabled`, not auth state; an authenticated admin reaching `/auth/register` and submitting can overwrite
  their own JWT with a newly registered user token

## Deferred from: code review of 2-4-registration-toggle-ui-adaptive-login-screen (2026-05-15)

- `/auth/config` shares auth rate-limit bucket with `/auth/login` — page-load requests consume login quota per IP;
  intentional per spec placement; revisit rate-limit config if exhaustion observed in production
- `registrationEnabled` stays `null` permanently on `GET /api/auth/config` network failure — spec-accepted silent
  failure; both Register link and "Contact admin" are suppressed while null; may confuse users on transient backend
  outage
- `/auth/register` page directly accessible when registration is disabled — backend correctly rejects POST but user sees
  full form and gets no useful error message; frontend route guard is a follow-up UX enhancement
- `ApplicationConfigService` in-memory cache can diverge from MongoDB if DB write fails after `cache.set` succeeds —
  backend pre-existing issue; process restart recovers; fix with transactional write or cache invalidation on error

## Deferred from: code review of 2-3-admin-user-management-ui (2026-05-15)

- Client-side-only admin guard — `getUsersQuery` fires before `layout.tsx` redirect executes in `useEffect`; a logged-in
  non-admin user with a valid JWT receives the user list response before the React redirect runs; pre-existing Next.js
  App Router client-auth limitation; proper fix is middleware-level auth or server component guard

## Deferred from: code review of 2-2-admin-user-management-backend (2026-05-15)

- AC4 test does not verify `refresh_tokens` collection is cleared after `resetUserPassword` — direct DB inspection
  discouraged by project rules; `invalidateUserSessions` is tested as part of prior stories
- `deleteUser` session invalidation has a TOCTOU window — concurrent login between `adminDeleteUser` success and
  `invalidateUserSessions` call produces a live refresh token; requires transactional semantics not currently in
  codebase
- Password plaintext in GQL mutation arguments (`createUser`, `resetUserPassword`) — logged in debug mode; same pattern
  as `register()` and `changePassword()`; broader API design concern
- No pagination on `getAllRegularUsers` / `users` query — loads entire collection; out of scope for this story

## Deferred from: code review of 2-1-applicationconfig-entity-registration-toggle-backend (2026-05-14)

- Non-atomic AtomicReference cache init in `ApplicationConfigService.get()` — benign in practice (idempotent upsert
  means double-load has no observable effect); use `compareAndSet` or a `Mutex` if stricter guarantees needed
- Admin password compared with `==` (timing-vulnerable, no bcrypt) — pre-existing in UserService; accepted design
  trade-off (also noted in story 1.2 deferred items)
- `changePassword` uses upsert `save` rather than targeted atomic update — pre-existing pattern in UserService
- Duplicate-username detection relies on MongoDB unique index not established in this diff — index should exist from
  story 1.1; tests pass; verify index creation in UserRepository on startup
- `DataFetchingException` used as error type for auth failure in `GraphQLForbiddenException` — clients should use
  `extensions.code`; minor semantic; revisit when standardizing GQL error taxonomy
- Magic number `11000` for MongoDB duplicate-key error in `UserService` — replace with `ErrorCategory.DUPLICATE_KEY`
  check when tightening error handling
- `CONFIG_ID` is an instance `val` in `ApplicationConfigRepository` rather than a companion-object constant — trivial;
  move to companion object if additional instances are ever created

## Deferred from: code review of 1-6-e2e-test-infrastructure-auth-flow-coverage (2026-05-14)

- Hardcoded admin/admin credentials in test files — documented default dev credentials; swap to env var pattern if
  credentials become environment-specific
- Registration test accumulates test users with no teardown — explicitly accepted in dev notes; clean dev DB
  periodically or add a purge script before prod migration
- `button[aria-haspopup="true"]` selector not scoped to AppBar — stable for current UI; refactor to scoped selector if
  additional `aria-haspopup` buttons are added to the header
- `[aria-label="logout"]` selector fragile to future label/i18n changes — use `data-testid` for logout trigger when
  accessibility labels evolve
- No `webServer` config in playwright.config.ts — out of scope per story; add `webServer` block with `docker compose`
  invocation when CI pipeline is configured
- No `playwright install` step in `test:e2e` script — one-time manual setup; document in CI pipeline onboarding
- No explicit timeout overrides on URL/element assertions — Playwright default (5s) is adequate for local dev; increase
  if flakiness observed in CI

## Deferred from: code review of 1-5-user-identity-account-management-ui (2026-05-11)

- Silent return when `accessToken` is null gives user no feedback — spec-designed loading-window guard; UX improvement
  is post-scope
- UserChip causes layout shift during hydration — AppHeader renders chip once auth context resolves; needs
  skeleton/loading state design
- No client-side check that new password differs from current — server enforced
- No minimum password length client validation — server enforced; depends on backend password policy rules
- Non-wrong-password server errors (401, 500) surfaced under "Current password" field — only AC4 wrong-password case is
  spec'd; general error placement is post-scope design
- No spacing `sx` between UserChip and Navigation icon in Toolbar — no spec requirement; adjust if design calls for it

## Deferred from: code review of 1-4-login-registration-ui (2026-05-11)

- `LoginForm` / `RegisterPage` near-identical components — same layout, state structure, and submit pattern with zero
  shared abstraction; will diverge silently; architectural refactor deferred beyond story scope
- Unsafe `role as 'admin' | 'user'` cast in both `auth/page.tsx` and `register/page.tsx` — unexpected backend role value
  silently accepted; cross-cutting TypeScript concern; deferred as it matches the existing pattern
- `authApi.register` success response JSON parse unguarded — if `res.ok` is true but body is not valid JSON the
  rejection is unhandled; matches existing `authApi.login` behaviour; deferred as cross-cutting API hardening
- `WelcomeBanner` reappears if `username` repopulates after auth expiry while `showBanner` is still `true` — edge case;
  acceptable for v1

## Deferred from: code review of 1-3-frontend-theme-auth-infrastructure (2026-05-09)

- `auth/page.tsx` still calls bare `fetch('/api/login')` + writes `localStorage` — full replacement is story 1.4 scope;
  currently broken but unreachable because RouteGuard redirects to `/auth` (which then fails to populate AuthContext)
- `AuthProvider` refresh failure silently swallowed — `.catch(() => {})` per spec intent; no user-visible error on
  session expiry; consider a toast or redirect with message in a future UX pass
- No inverse guard for authenticated users visiting `/auth` — authenticated users land on the login page; they must
  manually navigate away; add redirect-if-authenticated logic before or during story 1.4 login UI
- `isLoading` stays `true` on `AuthProvider` unmount before refresh resolves — React StrictMode double-invoke in dev
  causes two parallel refresh calls; add `AbortController` cleanup to the `useEffect` as a hardening step

## Deferred from: code review of 1-2-login-token-system-session-security-backend (2026-05-08)

- Admin timing attack — plain-text `==` on admin password is faster than bcrypt+DB; spec intentionally chose this;
  timing side-channel exists but is an accepted design trade-off
- Admin password in JVM heap — config-sourced String not zeroed; general JVM concern; not actionable without moving to
  char[]
- Refresh tokens stored as plaintext in MongoDB — should hash with SHA-256 before storing; DB exfiltration exposes all
  active sessions; security hardening deferred
- Access token not revoked on password change — 15-min JWTs stay valid after change-password; requires a token blocklist
  to fix; known JWT architecture limitation
- Admin timing leak vs regular user — admin check bypasses bcrypt+DB; ~100ms timing difference reveals admin account;
  inherent in plain-text design choice
- No `iat` (issued-at) claim in JWT — prevents "invalidate tokens issued before T" without a blocklist; security
  hardening
- `UserStorage.sync()` check-then-act race — `synced` flag is not atomically guarded; double-sync possible under
  coroutine concurrency; pre-existing in storage layer
- CORS plugin does not allow credentials or expose Authorization header — frontend is same-origin via nginx;
  cross-origin clients (API playground, mobile) will fail; pre-existing config
- MongoDB error handling absent in repositories — `insertOne`/`deleteOne` throw MongoWriteException as 500; pre-existing
  pattern across all repositories; needs global error handler
- AC2 log sanitization — Ktor monitoring may log request bodies including credentials; audit `configureMonitoring()`
  before production; flagged in Story 1.1 deferred items

## Deferred from: code review of 1-1-user-entity-registration-backend (2026-05-08)

- No input validation on username/password (length, blank, character set) — out of scope for Story 1.1; consider a
  validation layer before Story 1.4 login UI
- BCrypt 72-byte password truncation — passwords longer than 72 bytes are silently truncated by BCrypt; no max length
  enforced at API boundary; security hardening out of scope
- `password.toCharArray()` not zeroed after hashing — not actionable in JVM given the upstream `String` is also
  unzeroable
- `role` field is raw String, not typed enum — design concern; consider converting to `enum class Role` when more roles
  are added
- `UserRepository.findByUsername` is dead code — storage intentionally serves from memory only; the repository method
  exists for potential future direct-DB lookup but is currently never called
- No test for malformed / empty JSON request body — `call.receive<RegisterRequest>()` throws on bad input; behavior
  untested; out of scope for this story
- No test verifies bcrypt hash stored in MongoDB — test only checks HTTP response doesn't contain plaintext; would
  require direct DB access against project testing policy
- UUID deserialization byte-swap risk — `UUIDMongoSerializer.asUuid()` may use JAVA_LEGACY byte order vs STANDARD used
  by `MongoClientSettings`; needs cross-cutting investigation against existing ItemRepository to confirm consistency
- Rate limiter coverage of `/auth/login` — `RateLimitName("auth")` is already reusable; Story 1.2 just wraps
  `/auth/login` in `rateLimit(RateLimitName("auth"))`; no structural refactor needed
- Monitoring plugin may log request bodies including passwords — pre-existing concern not introduced by Story 1.1; audit
  `configureMonitoring()` before production deployment

## Deferred from: code review of spec-fix-new-list-sheet-crash (2026-06-15)

- BPSheet focus-on-open does not fire under reduced motion — `bp_front/src/app/BPSheet.tsx`: with
  `prefers-reduced-motion: reduce`, the Paper has `transition: 'none'` and uses a `Fade` slot, so no `height`
  `transitionend` ever fires and `handleTransitionEnd` never runs; the open sheet's first focusable (e.g. the New list
  name field) is never auto-focused. A11y gap, pre-existing — needs a fallback (e.g. focus on `Fade` `onEntered` or an
  effect keyed on `state === 'open'`). Out of scope for the crash/blink fix.
- BPSheet re-fires focus-on-open on every height transition — `bp_front/src/app/BPSheet.tsx:handleTransitionEnd`: any
  completed `height` transition while `state !== 'closed'` (incl. peeked↔open collapse and the picker-toggle expand)
  re-runs `first?.focus()`, which can yank focus to the first focusable mid-interaction. Pre-existing; the
  `target === currentTarget` guard only filters child-vs-self transitions, not open-vs-peeked re-entry. Consider firing
  focus only on the initial open transition.

## Deferred from: code review of spec-fix-list-golden-path (2026-06-15)

- BPSheet history sentinels carry no per-instance identity — `bp_front/src/app/BPSheet.tsx`: every instance (and the
  consumer-pushed sentinel in `SheetNewList`) uses the identical `{bpSheetSentinel: true}` marker. If two BPSheet
  consumers were ever open/closing concurrently, one instance's cleanup `history.back()` could pop another's sentinel.
  No current trigger (only one sheet is open at a time on `/lists` and `/list/[listId]`). Fix: tag each sentinel with a
  unique per-instance id and only pop your own.
- Orphan sentinel history entry after create-navigate — `SheetNewList` create path intentionally skips the sentinel
  pop and `router.push`es over it, leaving one extra `/lists` history entry beneath the new list. Cosmetic: pressing
  Back from the new list still lands on the lists view; there is just a redundant duplicate entry. Consider
  `router.replace`-style cleanup if history hygiene matters.
- `crypto.randomUUID()` requires a secure context — `bp_front/src/app/list/[listId]/page.tsx` generates item/category
  UUIDs client-side; `crypto.randomUUID` is undefined over plain `http://<LAN-IP>` (non-localhost), so add-item throws
  on a phone hitting the LAN IP. Ties into Epic 5 mobile-login work. Fix: a UUID fallback, or have the backend generate
  the id like `createList` does. (`SheetNewList` is unaffected — the server generates the list id there.)
- Orphan empty "Uncategorized" category on partial add failure — `handleAddItem`: if `saveCategory` succeeds but the
  subsequent `saveItem` throws, the list keeps a created-but-empty category. Minor data hygiene; low priority.

## Deferred from: code review of 5-1-foundation-vite-mui-caddy-apollo-shell (2026-07-14)

- `getConfig()` failure leaves `registrationEnabled` stuck at `null` with no retry [bp_front/src/lib/auth/AuthContext.tsx:55-58] — the bootstrap `.catch(() => {})` swallows the error and never retries; `registrationEnabled` is consumed by the auth screen (Story 5.2), which must handle the null/retry case.
- WS `connectionParams` sends `Bearer ` (empty) when unauthenticated, and a live WebSocket won't pick up a refreshed token until it reconnects [bp_front/src/lib/apollo/ApolloProvider.tsx:37-39] — unreachable in 5.1 (no subscription operations open the socket; backend WS is unauthenticated). Revisit when subscriptions are introduced.
- Bare `/api` (no subpath) falls through to the SPA `index.html` instead of the backend [routing/Caddyfile:10] — `handle /api/*` does not match the exact path `/api`; latent because the app only calls `/api/<subpath>`. Tighten the matcher if a bare `/api` request is ever added.

## Deferred from: code review of 5-2-authentication (2026-07-15)

- `authApi.logout` has no timeout/AbortController (unlike `refresh`, which caps at
  8s) [bp_front/src/lib/auth/authApi.ts:24] — its `.catch()` only handles a rejected fetch, not a socket that stays open
  with no response. If `/api/auth/logout` accepts the connection but never replies, `HomePage.handleLogout`'s `await`
  never settles, `clearAuth()` never runs, and the user is trapped signed in (no button-disabled/pending state either).
  Fix belongs in `authApi.ts` (add an abort like `refresh`), which was out of scope for Story 5.2. Revisit when a story
  is allowed to touch `authApi.ts`.
- Authenticated user is not redirected away from `/auth` [bp_front/src/App.tsx:12] — `/auth` is a public route outside
  the `RouteGuard` subtree and `AuthPage` does not check `username`, so a logged-in user who navigates to `/auth` (
  bookmark, back button, manual URL) sees the sign-in form despite a live session. Pre-existing Story 5.1 routing
  design; not a Story 5.2 acceptance criterion. Add a "if authenticated, redirect to /" guard if/when this becomes a
  product requirement.

## Deferred from: code review of ssl-termination-single-entrypoint (2026-07-16)

- source_spec: `_bmad-output/implementation-artifacts/spec-ssl-termination-single-entrypoint.md`
  summary: Auth rate limiter is effectively disabled in the deployed stack (`KTOR_RATE_LIMIT_ATTEMPTS: 6000`).
  evidence: docker-compose.yaml sets 6000 attempts/60s per IP (default is 5), so the per-client auth limiter this SSL/entrypoint work carefully preserves is off in practice. Pre-existing (dev/E2E convenience), but directly relevant now that the stack is being prepared for a public domain — lower it to a sane per-IP value for the production profile before going live.
- source_spec: `_bmad-output/implementation-artifacts/spec-ssl-termination-single-entrypoint.md`
  summary: Defense-in-depth — Ktor `XForwardedHeaders` trusts the leftmost X-Forwarded-For unconditionally.
  evidence: ForwardedHeaders.kt installs XForwardedHeaders with defaults, so app-layer client-IP resolution relies entirely on the edge proxy overwriting X-Forwarded-For (now documented in routing/edge-proxy.md). A misconfigured edge (appends instead of overwrites) re-enables IP spoofing / rate-limit bypass. Hardening (e.g. app-level trusted-proxy validation / skipLastProxies) was out of scope — the frozen intent forbade auth-code behavior changes. Revisit when a story may touch the auth path.

## Deferred from: code review of story-5.3 (2026-07-17)

- source_spec: `_bmad-output/implementation-artifacts/5-3-user-account.md`
  summary: Consumed one-shot auth flags (`passwordChanged`/`expired`) are never reset after the guard redirect.
  evidence: bp_front/src/lib/auth/AuthContext.tsx:87-92 + RouteGuard.tsx:21-25 — `clearAuth` sets the flag and only a
  later `setAuth`/`clearAuth` clears it, so it stays sticky until the next sign-in. Re-entering a guarded route while
  still unauthenticated (e.g. manually navigating to `/` after a password change) re-fires the redirect and re-shows the
  banner. `expired` has had this latent behaviour since Story 5.2; `passwordChanged` inherits the accepted pattern. Low
  consequence, narrow trigger — consider a shared "reset flag on consumption" when this area is next touched.
- source_spec: `_bmad-output/implementation-artifacts/5-3-user-account.md`
  summary: Change-password error alert can shift the vertically-centered form on a failed submit (mobile, AC9 no-shift).
  evidence: bp_front/src/routes/ChangePasswordPage.tsx:93-105,187-197 — field `helperText ?? ' '` reserves space (no
  shift on inline errors), but the conditional `change-password-error` Typography grows a `justifyContent: 'center'`
  column, re-centering the stack on failure. Mirrors the accepted Story 5.2 `auth-error` convention, so consistent
  rather than a regression; revisit holistically if the no-shift bar tightens.

## Deferred from: planning of 5-5-lists-management (2026-07-21)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-lists-management.md`
  summary: List optional description (FR34) is not implemented — the frozen backend has no `List.description` field.
  evidence: `type List` (GqlList.kt) exposes only id/name/emoji/ownerId/ownerUsername/members/createdAt/uncheckedItemCount, and `createList(name, emoji)` (ListApi.kt) takes no description arg. Epic-5 freezes the backend, so shipping description would require a backend schema + mutation change (needs `md` sign-off). Create-list UI ships name + emoji only. Revisit if/when the backend gains a description field.

## Deferred from: code review of 5-5-lists-management (2026-07-21)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-lists-management.md`
  summary: `ItemsQuery` (getItems) neither selects nor filters the backend `Item.deleted` flag, and ListDetailPage groups items without a deleted guard.
  evidence: bp_front/src/lib/lists/listsQueries.ts (ItemsQuery selects id/name/checked/category/listId only) + ListDetailPage.tsx (`items.filter(i => i.category === category.id)`). Harmless in Story 5.5 (no soft-delete path is exercised — `deleteItem` is a hard delete and there is no check/uncheck), but Story 5.6 introduces `checkItem` (ONE_TIME → deleted=true) and the shopping view; if `getItems` returns soft-deleted rows, 5.6 must select `deleted` and filter/handle it or removed one-timers will reappear. Flag for Story 5.6.

## Deferred from: code review of 5-7-sharing-and-membership (2026-07-23)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-7-sharing-and-membership.md`
  summary: Membership mutation failures (leave/accept/decline/remove) do not trigger a `Lists` refetch, so a stale list row or pending-invite row can persist until a manual reload.
  evidence: bp_front/src/routes/ListsPage.tsx (leave/delete ConfirmDialog `onConfirm` calls `refresh()` only after the awaited mutation resolves) + PendingInvites.tsx (`run` returns without `onChanged()` on error). Concrete race: owner removes member A at the same moment A clicks Leave; A's `leaveList` returns FORBIDDEN ("not a member"), A sees the inline error, but A's now-stale list row stays in the index until a manual `/lists` reload. Low consequence (recoverable by reload) and an unlikely concurrent-action window; a clean fix would refetch on the error path too.

## Deferred from: planning of 6-1-edit-item-name-category-store (2026-07-28)

Both are **unfixable from the frontend** and both ship with Epic 6 by decision (AR-E6-0 freezes `bp_back/`). Filing them
is an acceptance criterion of Story 6.1, not a note. Both were **observed live** during the story's manual browser pass
against `:2080`, not merely reasoned about.

- ~~**BUG-E6-1 — `saveItem` re-attributes `addedBy` to whoever edited the item, stealing authorship.**~~
  **RESOLVED 2026-08-10 by Story 7.4 — `saveItem` now merges the stored row instead of reconstructing it.**
  `ItemService.saveItem` loads the stored item with `storage.getByIdCached(item.id, item.listId)` and, when it exists,
  `copy()`s only the five fields `ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`) onto it, so
  `addedBy` comes from storage. Evidence, all measured: the Kotest test
  `7.4 AC1 an edit by another member keeps addedBy and the check-off clock` was observed red with the merge reverted —
  `"addedBy":"mem74_e64fd24f"` where the author was `own74_50c571a0` — and green with it in place; the new Playwright
  spec `bp_front/e2e/item-attribution.spec.ts` was observed red on **both** `chromium` and `mobile` against the unfixed
  production image (`Received string: "Aattrib_e2e_editor_mobile_1786370690586"`) and green after the fix; and the
  symptom was reproduced and then re-checked by hand in a real browser at `:2080`. The **fix taken differs from the
  proposed fix below**: rather than special-casing `addedBy`, the merge copies the input onto the stored row, so every
  present and future server-owned field is preserved by default (allowlist, not denylist). Retained for history:
  source_spec: `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md`
  cause: `addedBy` is server-set from the caller's principal and is deliberately not part of `ItemInput`
  (`ItemApi.kt:52` → `GqlItemMapper.mapItemFromInput(item, caller.value)`), so every `saveItem` overwrites it with the
  *current* caller. Because `saveItem` is a full-document upsert, an edit is indistinguishable from a create.
  user-visible impact: on a shared list, when a co-member fixes a typo in an item someone else added, the shopping view's
  `addedBy` avatar/name (`ListShoppingPage.tsx:440-454`, `shopping-item-addedby-<name>`) silently flips to the editor.
  Attribution is quietly wrong with no user action that could cause or undo it. This is also *why* Story 6.1's editor
  sends no mutation at all for a no-op save — the request would re-attribute the item for zero benefit.
  proposed fix (server-side): preserve the stored `addedBy` on update — look up the existing item in
  `ItemService.saveItem` and keep its `addedBy`, only setting the caller's name when the item does not yet exist.

- ~~**BUG-E6-2 — `saveItem` resets `checkedAt` to `null`, clearing the check-off clock the recurring scheduler reads.**~~
  **RESOLVED 2026-08-10 by Story 7.4 — the same merge; `checkedAt` is server-owned and now comes from storage.**
  **The FR42/FR43 prerequisite this entry named is therefore discharged** (see the FR42/FR43 entry near the top of this
  file). Evidence: the Kotest test `7.4 AC5 an edit keeps the check-off clock, so the scheduler still restores the item`
  *drives* `runSchedulerCycle()` after an HTTP rename, and backdates `checkedAt` **relative to whatever the edit left
  behind** precisely so that a wiped clock cannot be papered over by the backdate. With the merge reverted it failed at
  the scheduler assertion — `expected:<false> but was:<true>`, i.e. the scheduler skipped the item exactly as this entry
  predicted — and passes with the merge in place. Retained for history:
  **Prerequisite for undeferring the one-timer / recurring item UI (FR42/FR43).**
  source_spec: `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md`
  cause: `GqlItemMapper.mapItemFromInput` (`GqlItemMapper.kt:26-41`) constructs a **fresh** `Item` from the input alone,
  and `Item` (`Item.kt:6-18`) defaults `checkedAt`, `deletedAt` and `deleted`. `ItemRepository.save` then `Updates.set`s
  every field, so any field absent from `ItemInput` — and `checkedAt` is not in `ItemInput` at all — is written back as
  its default. Confirmed in the manual pass: an item checked through the UI (`checkedAt` set by `ItemService.checkItem`)
  came back with `checked: true, checkedAt: null` after a UI rename.
  user-visible impact: `ItemService.runSchedulerCycle` restores a checked recurring item only once
  `item.checkedAt` is older than the cadence threshold, and `continue`s when `checkedAt == null`. So a recurring item
  that is edited after being checked off **never comes back** — the hourly scheduler skips it forever. Today the blast
  radius is limited because no UI can set `recurring` (FR42/FR43 are deferred), which is exactly why this is a
  **prerequisite**: shipping the lifecycle control on top of this defect would make editing silently break the feature
  the control exists to expose.
  proposed fix (server-side): merge the input onto the stored item instead of constructing a fresh one — load the
  existing `Item` in `ItemService.saveItem` and `copy()` only the fields `ItemInput` actually carries, leaving
  `checkedAt` / `deletedAt` / `deleted` (and `addedBy`, per BUG-E6-1) untouched. One change fixes both bugs.

## Deferred from: code review of 6-1-edit-item-name-category-store (2026-07-28)

- **BUG-E6-3 — a stale open edit dialog can resurrect a deleted item or orphan it under a deleted category.**
  Third member of the same family as BUG-E6-1/E6-2 above, and the one Story 6.1 newly exposes: before it, no UI path ever
  issued `saveItem` for an *already existing* id.
  source_spec: `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md`
  cause: `ItemStorage.delete` is a **hard** delete (`ItemStorage.kt:41-46`) while `ItemRepository.save` runs
  `UpdateOptions().upsert(true)` (`ItemRepository.kt:41-56`), and `/lists/:id` is refetch-driven by design (no
  `subscribeToMore`, per AR-E6-5), so a dialog left open holds a snapshot the page never refreshes. Two outcomes:
  (a) another member removes the item → Save re-creates it from the snapshot and broadcasts a `SAVED` event that puts the
  row back on every shopping view, now attributed to the editor with `checkedAt` cleared; (b) another member removes the
  *category* → Save writes a dangling `category` id, and the item renders under no group on either screen — invisible and
  therefore unremovable through the UI.
  user-visible impact: a deleted item reappears for everyone, or an item vanishes while still occupying the list. Both
  need concurrent action by two members inside one dialog's open window, so the window is narrow — but recovery from (b)
  requires direct database access.
  mitigation already in place: the edit payload reads its carry-forward fields from the live `item` prop rather than the
  open-time snapshot, so anything a refetch *has* observed is not clobbered. That narrows the window; it does not close
  it, because nothing refetches while the dialog is open.
  proposed fix: server-side, the same `ItemService.saveItem` change that fixes BUG-E6-1/E6-2 should also
  ~~reject an upsert whose id does not exist (make `saveItem` create-or-update explicitly rather than blind-upsert)~~
  **[CORRECTED 2026-08-10 — that clause was wrong and must not be implemented as written.** `GqlItemInput.id` is
  non-nullable and the frontend calls `crypto.randomUUID()` for **new** items too, so rejecting a non-existent id
  rejects every add. Measured: implementing exactly that wording turned **16 of the 25 `ItemLifecycleTest` tests red**,
  every one of them on
  `Exception while fetching data (/saveItem) : Item <uuid> does not exist`. The correct discriminator is **existence in
  storage** — `getByIdCached` hit → update, miss → create — which is what Story 7.4 implemented. Epic 6 retro action
  item **C1** carried the same wrong wording and is closed with this correction recorded.**]** and validate that
  `category` still belongs to the list. Client-side alternatives (refetch-before-save, or clearing `editItemTarget` when
  the item leaves `items`) only shrink the race.
  **PARTIALLY RESOLVED 2026-08-10 by Story 7.4.**
  **(b) the dangling-category outcome is fixed**: on the update branch `saveItem` now throws
  `IllegalArgumentException("Category <id> does not belong to list <id>")` before `storage.save` and before
  `itemUpdateChannel.emit`, so nothing is written and no `SAVED` event is broadcast for a rejected write. Two Kotest
  tests cover it (category on another list; category on no list); both were observed red with the guard removed
  (`should include substring "errors"` against a successful `saveItem` payload) and green with it. **The guard is
  update-only by decision (`md`, ruling A) — the create branch still accepts any category, see
  `## Deferred from: Story 7.4` above.**
  **(a) the resurrection outcome is NOT fixed, only severity-downgraded** — tracked as **BUG-E6-3a** in
  `## Deferred from: Story 7.4` above.

- ~~source_spec: `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md`~~
  **CLOSED 2026-08-07 — resolved by Story 7.1** (duplicate of the rollup entry at the top of this file; see it for the
  full closure note). `tsconfig.e2e.json` is referenced from the solution `tsconfig.json` and `"lint"` is now
  `eslint .`. Retained for history:
  summary: `bp_front/e2e/` is covered by neither ESLint nor `tsc`, so the Playwright suite — the project's primary quality
  gate — has no static verification at all.
  evidence: `package.json` runs `lint` as `eslint src/`; `tsconfig.app.json` includes only `["src"]` and
  `tsconfig.node.json` only `vite.config.ts`. Playwright transpiles without type checking, so a type error in a spec
  surfaces as a runtime failure or not at all. `item-editing.spec.ts` alone is ~620 lines and is the entire evidence base
  for AC1/AC3/AC4/AC7, yet "lint and build pass" (AC5) says nothing about it. Fix: add an `e2e` tsconfig project to the
  build references and widen the lint glob.

- ~~source_spec: `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md`~~
  **CLOSED 2026-08-08 — resolved by Story 7.2** (duplicate of the Epic 6 close-out entry near the top of this file; see
  it for the full closure note). The eight helpers now live once under `bp_front/e2e/support/`. **Count correction:**
  the block was in **seven** spec files at `e4c54dc`, not four, and the `toPass()` workaround in **five**, not four —
  `item-editing.spec.ts` was the *sixth* `registerViaUi` copy and the *fifth* `toPass` copy, not the fourth of either.
  Retained for history:
  summary: the E2E helper block (`uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory`,
  `addItem`, `loginApi`, `gql`) is now copy-pasted into a fourth spec file; no shared fixture module exists.
  evidence: `lists.spec.ts`, `shopping.spec.ts`, `sharing.spec.ts` and now `item-editing.spec.ts` each re-declare them,
  differing only in the `uniqueUsername` prefix. `registerViaUi` carries the `expect(...).toPass()` workaround for the
  shared `registrationEnabled` race — logic that will drift silently between copies, and that has to be fixed in four
  places when that race is finally fixed at the source (itself an open Epic 5 retro action). Pre-existing convention, not
  caused by this story, but each new spec raises the cost of undoing it.

## Deferred from: code review of 6-2-back-to-home-and-lists-navigation (2026-07-28)

- ~~source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`~~
  **CLOSED 2026-08-11 — resolved by Story 7.5** (duplicate of the FR38-sort rollup entry near the top of this file; see
  it for the full closure note, including the second copy of the expression in `ListShoppingPage.tsx` and why the
  backend-timestamp alternative was rejected rather than skipped). Retained for history:
  summary: `HomeRedirect` picks the oldest list with a lexicographic string compare on `createdAt`, which is wrong for
  the variable-precision ISO instants the backend emits — FR38 can send a user to the wrong list.
  evidence: bp_front/src/routes/HomeRedirect.tsx (`[...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]`)
  against bp_back/.../entity/list/gql/GqlListMapper.kt:19 (`createdAt = list.createdAt.toString()` on a
  `java.time.Instant`). `Instant.toString()` omits the fractional part entirely when nanos are zero, so a list created at
  exactly `…:05Z` compares as *greater* than one created at `…:05.100Z` (`'Z'` 0x5A > `'.'` 0x2E) — the earlier list
  sorts last. Roughly a 1-in-1000 window per list pair, and it also makes the new
  `FR57/FR38 — …lands on the oldest list` spec flaky at the same rate. Pre-existing (shipped in Story 5.6, exercised by
  `shopping.spec.ts` FR38 since); untouched by this story. Fix by comparing `Date.parse(createdAt)` / `new Date(...)`
  numerically, or by having the backend emit a fixed-precision timestamp.
- ~~source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`~~
  **CLOSED 2026-08-07 — resolved by Story 7.1** (duplicate of the rollup entry at the top of this file; see it for the
  full closure note). `tsconfig.e2e.json` is referenced from the solution `tsconfig.json` and `"lint"` is now
  `eslint .`. Retained for history:
  summary: `bp_front/e2e/` is outside both frontend quality gates — E2E specs are neither linted nor type-checked.
  evidence: bp_front/package.json:12 (`"lint": "eslint src/"`) and bp_front/tsconfig.app.json:30-32 (`"include": ["src"]`)
  / tsconfig.node.json:20-22 (`"include": ["vite.config.ts"]`). Playwright transpiles specs without type checking, so a
  type error, unused import, or bad locator type in any of the nine spec files ships undetected and AC-level claims of
  "`npm run lint` and `npm run build` pass" are vacuous for the E2E suite — the very layer the project treats as its hard
  gate. Project-wide and pre-existing (affects all specs, not just the one added here). Fix by adding `e2e` to a
  tsconfig project and widening the lint glob.
- ~~source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`~~
  **CLOSED 2026-08-11 — resolved by Story 7.5** (duplicate of the home-no-op rollup entry near the top of this file; see
  it for the full closure note, including the measured history-depth evidence and the fact that the spinner blink could
  not be reproduced). Retained for history:
  summary: Activating the new app-bar title link while already on the route home resolves to is a visible no-op that
  still leaves a redundant history entry.
  evidence: bp_front/src/components/AppShell.tsx (title link `to="/"`) + HomeRedirect.tsx — a user standing on their
  oldest list, or on `/lists` with no lists, pushes `/`, sees `home-redirect-loading` flash while `ListsQuery` resolves,
  then gets `replace`d back to the same route. Net effect: a spinner blink and a duplicate history entry, so Back appears
  to do nothing once. Not fixable inside this story: suppressing it requires knowing the resolved home path in the app
  bar, which AR-E6-7 explicitly forbids ("the app bar does not re-implement or duplicate that logic"). Low consequence;
  the clean fix belongs in `HomeRedirect` (or a shared hook exposing the resolved path) if it is ever worth doing.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`
  summary: The new `navigation.spec.ts` adds 14 more UI registrations per full run, measurably increasing pressure on the
  already-tracked shared `registrationEnabled` race.
  evidence: The race is probabilistic, and two full-suite runs at `--retries=2` after this story bracket it: one returned
  **4 flaky** (every one in the untouched `lists.spec.ts`, every one carrying `alert: "Registration is disabled"` in its
  error context, all healed on retry1) and a later one returned **84 passed, 0 flaky**. An earlier run at the default
  local `retries: 0` had **1 outright failure**, same file, same cause. So the race is unchanged in kind but each new
  registering spec widens the window it can hit, and this story adds 14 registrations per full run. This is the ~~fourth~~
  **fifth** spec to copy the `toPass()` workaround instead of the race being fixed at the source — the standing Epic 5
  retro action item.
  **Count corrected 2026-08-08 by Story 7.2** (this entry stays OPEN — the race is Story 7.3's): re-measured at
  `e4c54dc`, the workaround existed in **five** files — `lists:32`, `shopping:33`, `sharing:32`, `item-editing:41` and
  `navigation:41`, the copy this entry itself added and then undercounted. Story 7.3's AC3 ("no spec retains a local
  copy") depends on that count. Since Story 7.2 the workaround exists in exactly **one** place,
  `bp_front/e2e/support/ui.ts:35-38`, unchanged in behaviour and with its 1500/20000 ms timeouts untouched.
  (`navigation.spec.ts` also carries a sixth, *unrelated* `toPass` — CSS hover settling, 2000 ms — which is not this.)
  **CLOSED 2026-08-08 by Story 7.3, together with the Epic 5 close-out entry this duplicates** (see "Epic 5 close-out —
  carried forward" above; that entry is the rollup and carries the mechanism and the measurements). The workaround is
  gone from `support/ui.ts`, and `grep -rn "toPass" bp_front/e2e/` now returns exactly one line —
  `navigation.spec.ts:100`, the unrelated CSS-hover one. This entry's own premise ("each new registering spec widens the
  window") no longer holds: there is no window while anything is registering. No new entry is filed alongside these two
  restating the same debt.

## Deferred from: code review of 7-2-shared-e2e-support-module (2026-08-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `PASSWORD` lives in `support/ui.ts`, so any pure-API consumer must import the runner-importing module to get a
  credential — the exact coupling the two-file split exists to prevent.
  evidence: all seven `loginApi(x, PASSWORD)` call sites pair `./support/api`'s function with `./support/ui`'s constant,
  and `ui.ts` imports `@playwright/test` at the top level. ~~Story 7.3 converges `global-setup.ts` onto `api.ts` and will
  hit this immediately.~~ **Correction 2026-08-08 (Story 7.3, measured): it did not hit this at all.**
  `global-setup.ts` authenticates as `admin`/`admin` — the first-boot admin credentials, not the suite's registered-user
  `PASSWORD` — so its convergence onto `api.ts` needed `BACKEND`, `loginApi` and `gql` and no constant from `ui.ts`. It
  imports the runner-free module only, exactly as designed. **This entry stays OPEN on its own merits** (the seven spec
  call sites still pair the two modules), but the "a pure-API consumer is forced to import the runner-importing module"
  claim now has **zero** actual instances — it remains a latent coupling, not an observed one, which lowers its
  priority. `PASSWORD` is a bare string literal with no Playwright dependency; moving it to `api.ts`
  alongside `BACKEND` costs seven import-line edits and no behaviour change. Not done here: Story 7.2's spec assigned it
  to `ui.ts` explicitly, and the suite is green as shipped.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: none of the five new E2E invariants has a machine gate — all five are prose in `project-context.md`, which is
  the precise failure mode Epic 6's retro action B4 and Story 7.1 exist to correct.
  evidence: "never re-declare a helper", "`api.ts` stays runner-free", "`BACKEND` must not become `baseURL`", "support
  files must not match `*.spec.ts`" and "imports must be relative" are enforced by nothing; a one-line
  `import {expect} from '@playwright/test'` added to `api.ts` passes both gates today. Two cheap enforcements exist and
  were **blocked by Story 7.2's own no-config-change boundary**, not judged unnecessary: an ESLint `no-restricted-imports`
  entry scoped to `files: ['e2e/support/api.ts']`, and an explicit `testMatch`/`testIgnore` in `playwright.config.ts`
  (which would also convert the documented `support/helpers.spec.ts` trap from a warning into an impossibility).

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
  pre-existing — Story 7.2 was a byte-identical extraction and correctly changed none of it.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `createListAndOpen` returns `page.url().split('/lists/')[1]` with no validation, and that unchecked id is now
  fanned out to four specs and interpolated into GraphQL mutations.
  evidence: the guarding assertion is `toHaveURL(/\/lists\/[^/]+$/)`, which still matches a URL carrying a query string
  or fragment; the resulting id would be interpolated into `shareList(listId: "…")` and fail far from its cause.
  `tsconfig.e2e.json` does not set `noUncheckedIndexedAccess`, so the declared `Promise<string>` is not compiler-guaranteed.
  `new URL(page.url()).pathname.split('/lists/')[1]` is the one-line hardening. Pre-existing; extracted verbatim.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: the "no re-declaration" check greps for the literal string `function <helper>`, which tests a spelling rather
  than the property it stands for.
  evidence: it returns 0 today, but is equally satisfied by `const registerViaUi = async () => …` and was blind to
  `auth.spec.ts`'s fully inlined copy — a real omission this very story made and only the review caught. Any future
  restatement of this check should assert on imports (every spec using a helper imports it from `support/`) rather than
  on the absence of a keyword.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `uniqueUsername(prefix, label, projectName)` takes three interchangeable positional `string`s to guard an
  invariant the rules file calls "load-bearing".
  evidence: transposing any two arguments compiles, lints and type-checks clean while silently placing a spec in a
  foreign namespace — exactly the collision the prefix exists to prevent — and the change spread a repeated string
  literal across ~40 call sites. A per-spec factory (`const userFor = namespace('shopping')`) or a
  `type SpecPrefix` union removes both the repetition and the transposition hazard.
