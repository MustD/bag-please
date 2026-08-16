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

## Deferred from: Story 7.6 — backend safety fixes riding the same unfreeze (2026-08-12)

Story 7.6 closed four Epic-4 review entries under the epic's scoped backend unfreeze (`829` + its `971-972` ancestor,
`811`, `813` — all struck through in their own sections below). What follows is the residue it deliberately did **not**
take on, plus one epic premise that was measured wrong. Recorded here rather than in `project-context.md` (NFR-E7-1:
that file is a rules file, this one is the ledger).

- **`@Volatile` fixes the visibility half of the lazy-sync race and leaves the check-then-act window open.** All three
  `sync()` guards are still `if (synced.not()) { <suspending repository.getAll()> ; synced = true }`, so two coroutines
  arriving before either finishes can both read `false` and both run the startup load. What the fix buys is that once
  one of them writes `true`, every other thread reliably *sees* `true` — previously it might not, indefinitely.
  **The double load is NOT merely wasted I/O — corrected at the Story 7.6 review, 2026-08-12.** An earlier draft of this
  entry claimed the two passes are idempotent "so the consequence is wasted startup I/O, not corruption". They are only
  idempotent if no write interleaves, and one can: `sync()` takes its snapshot at the suspending `repository.getAll()`
  and writes it into the map *afterwards*, so if coroutine A finishes its own sync and then `save()`s a row while
  coroutine B is still suspended inside `getAll()`, B's resume replays the stale snapshot over A's row. Nothing ever
  resets `synced`, so the in-memory value stays stale for the process lifetime while Mongo holds the new one. The
  `delete`/`evictList` variant is worse: an in-flight stale sync can re-insert a row already hard-deleted from Mongo.
  This is reachable on every cold boot, not only in theory — `configureScheduler` (`plugins/GQL.kt:89`) runs
  `runSchedulerCycle()` immediately and it calls `storage.save`/`storage.delete`, so the scheduler races the first HTTP
  request on `synced`. The severity of the deferral is therefore higher than first recorded; what does **not** change is
  that the fix is out of AC1's scope. **Proposed fix:** a `kotlinx.coroutines.sync.Mutex` held across the load
  (`synchronized` is not an option — the body suspends), or an `AtomicBoolean.compareAndSet` gate with a
  `CompletableDeferred` the losers await. **Why deferred:** Story 7.6's AC1 requires the guard body otherwise unchanged,
  and the spec explicitly forbade substituting a `Mutex`/double-checked lock/`AtomicBoolean` as "a different, larger
  fix". That larger fix wants its own story and its own red observation.

- **`findByListIdAndUserId` will throw on a `list_members` row carrying an unknown `status`.** After Story 7.6 the
  mapper does `MemberStatus.valueOf(mongo.status)` (`MongoListMemberMapper.kt:13`). **Note the precedent is weaker than
  it looks** (corrected at review): `MongoItemMapper.kt:33` is `item.recurring?.let { Recurring.valueOf(it) }` over a
  **nullable** field, so absence is tolerated; `status` is non-nullable and has no equivalent tolerance. And this is a
  behaviour *change*, not just an unfixed gap — before Story 7.6 an unrecognised status simply failed the
  `!= "DECLINED"` / `== "PENDING"` string comparisons and the request completed, whereas now the mapper throws before
  the service sees anything. The two hot paths are safe by construction — `findActiveByListId` and `findPendingByUserId`
  filter status **at the database**, so neither can hand the mapper a value outside the enum — but
  `findByListIdAndUserId` filters on `_id` alone and is called from `shareList`, `acceptInvite` and `rejectInvite`,
  which would surface an `IllegalArgumentException` as an untyped `ExceptionWhileDataFetching`. **Why not fixed:** every
  candidate fallback invents a semantic that needs a ruling — unknown → `DECLINED` silently hides a member, unknown →
  `PENDING` invents an invite, and skipping the row makes a re-share overwrite it. **Proposed fix (needs `md`'s
  ruling):** decide the semantic, then either add a nullable `MemberStatus.parse()` and treat `null` as "no membership
  row", or filter `findByListIdAndUserId` on the same status whitelist the other two already use. Unreachable today:
  nothing writes a status outside the three enum names and there is no surface that hand-edits the collection.

- **STANDING ASSUMPTION (`md`'s ruling, 2026-07-29), not debt: production is assumed to hold no already-orphaned
  `list_members` rows, and Story 7.6 shipped no migration, backfill or cleanup script.** The cascade fix
  (`ListService.deleteList` → `listMemberRepository.deleteAllInList(id)`) prevents *new* orphans only. The consequence
  to hold onto: **if an orphaned `list_members` row is ever observed in production it is a NEW finding and must not be
  triaged as a regression of this story.** Orphans are invisible through the API (`ListService.getLists:86-87`
  `mapNotNull`s them away), so detection needs a direct query — the cheap version is to compare
  `db.list_members.distinct("listId")` against `_id` on `lists`. Not scheduled; recorded so the assumption is
  falsifiable rather than forgotten.
  **Corrected at the Story 7.6 review, 2026-08-12: "a fresh leak path" was the wrong framing, because a second leak
  path is still open and known.** `UserService.adminDeleteUser` (`entity/user/UserService.kt:84`) deletes the user row
  and never touches `list_members` — it holds no `ListMemberRepository` at all — so deleting a user still strands every
  membership row they held. Those orphans are keyed by a live `listId`, so the detection query above **cannot see
  them**; catching them needs `db.list_members.distinct("userId")` compared against `_id` on `users` instead. Out of
  Story 7.6's scope (`UserService.kt` is not on the epic's `Files:` line for this story) and filed as its own entry
  below. The honest form of the assumption is therefore: *list deletion* no longer leaks; *user deletion* still does.

- **MEASURED WRONG, recorded so it is not re-raised: writing a Kotlin enum through `Updates.set` was never going to
  corrupt the stored bytes.** Story 7.6's spec called `ListMemberRepository.kt:40` "the single highest-risk site in the
  story", on the premise that without `.name` "the driver receives a Kotlin enum". It does receive one — and encodes it
  to the identical BSON string, because `org.bson.codecs.EnumCodecProvider` is in the driver's **default** codec
  registry (verified present in `bson-5.5.1.jar`; `MongoConnection.kt:29-33` installs no custom registry). Measured:
  with `:40` reverted to `member.status`, the story's own persistence test — which reads the raw document and asserts
  the stored value is the String `"ACCEPTED"` — stayed **green at 18/18**. The `.name` form was kept anyway: it matches
  `ItemRepository.kt:60` (`item.recurring?.name`) and it makes the wire format independent of a driver default instead
  of dependent on one. But it is an explicitness change, not a data-corruption fix, and **no test distinguished the two
  forms in this configuration** — driver `mongodb 5.5.1`, one enum with no `@SerialName` overrides. That scope matters:
  the measurement isolated the *outcome*, not which codec produced it (the collection is `getCollection<MongoListMember>`
  with a kotlinx-serialization codec also in the registry), so treat it as "measured true here, on this driver", not as
  a law. Story 7.7 is a dependency sweep; re-measure rather than re-quote. Consequence for a future author: the invariant
  actually worth protecting is that `MemberStatus`'s constant names stay byte-identical to the persisted strings, and
  *that* is pinned — `ListSharingTest.kt:617,624` (stored bytes) plus `:147,152,266` (wire) all turn red if one constant
  is renamed, which is how the persistence test was proven non-vacuous. The test was renamed at review to say what it
  pins (`AC-7.6-persist MemberStatus constant names round-trip as the stored list_members.status strings`); its original
  name asserted the very premise this entry records as false.

- **`ListMemberRepository.findActiveByListId` and `GqlListMapper` express "active member" with two non-equivalent
  predicates.** The repository uses a positive whitelist (`Filters.in("status", PENDING, ACCEPTED)`); the mapper uses a
  negative one (`!= MemberStatus.DECLINED`). They agree on today's three-value enum and would disagree the moment a
  fourth status exists — the repository would exclude it, the mapper would include it. Story 7.6 typed both sites and
  deliberately did **not** reconcile them (its spec says so in as many words), because picking one decides where a
  future status is visible, which is a product call. **Proposed fix:** when a fourth status is introduced, define the
  active set once on `MemberStatus` (e.g. `val ACTIVE: Set<MemberStatus>`) and have both sites read it. Zero
  consequence today.

**Still open, restated here because Story 7.6 worked in their neighbourhood without closing them** (each stays live in
its own section below — this is a pointer, not a second copy):

- `831` / `822` — **`ListStorage.getByIdCached` bypasses `sync()`**, so `isMember` can deny a legitimate member on a
  cold cache and can keep admitting a revoked one. This is the **read** side of the same lazy-sync bug whose write side
  Story 7.6 just made visibility-safe, and `@Volatile` does nothing for it: the method never consults `synced` at all.
- `771-776` — `ListStorage.rename` is still not atomic (in-memory updated before the Mongo write), and the concurrent
  delete+rename race still throws `IllegalStateException` past the GQL error model. Untouched.
- `836` — `ListStorage.delete()` is still dead code; `ListService.deleteList` still calls `listRepository.delete` +
  `evictFromCache` directly. Story 7.6 added a fourth Mongo call to that same block and still did not route through it.
- `812` — the `acceptInvite` TOCTOU double-accept race is **still live; only its wording is now stale.** The entry
  describes "the `PENDING` check" against a bare string; that comparison now reads
  `member.status != MemberStatus.PENDING`. Typing it changed nothing about the race — the check and the
  `listStorage.save` of `members + callerUser.id` are still two steps with a suspending write between them.
- `814` — a re-invite after a DECLINE still overwrites the original `createdAt`; `shareList` still constructs
  `ListMember(..., Instant.now())` and upserts over the existing `_id`.
- `832` — **`deleteList`'s partial-failure window is now one Mongo call LONGER because of this story, and that must be
  said out loud.** The block is now `deleteAllInList(items)` → `deleteAllInList(categories)` →
  `deleteAllInList(members)` → `listRepository.delete(id)` → three `evict*` calls. A throw anywhere before the evictions
  still leaves in-memory data stale for the process lifetime, and there is now one more statement that can throw.
  **The ordering is NOT a mitigation, and an earlier draft of this entry had the argument backwards — corrected at the
  Story 7.6 review, 2026-08-12.** It claimed memberships are deleted before the list "so a failure cannot leave a live
  list with its memberships gone". That ordering is precisely what *makes* that outcome possible: if
  `listRepository.delete(id)` throws, the list survives and its membership rows are already gone. Worse, the "a restart
  re-syncs from Mongo" consolation does not apply to `list_members` at all — there is no in-memory membership cache, so
  those rows are gone permanently, not merely stale. The concrete user-visible result: previously-ACCEPTED members keep
  access (authorization reads `List.members`/`memberUsernames`, not the collection) while vanishing from the Share
  dialog, and re-inviting them raises `AlreadyMember`. The ordering is what AC4 mandates and it is kept; what is now
  recorded is that **neither order is failure-safe** — only a single Mongo session/transaction across the four deletes
  would be. Filed as its own entry below. Unchanged in kind, worse by one call in degree.

**On coverage, stated explicitly because AC6 requires it: the `@Volatile` fix ships with no test, and that is a
decision, not an omission.** `@Volatile` is a Java-Memory-Model *visibility* guarantee. A test that "covered" it would
have to observe a stale read — something the JMM permits but never requires, and that no JVM reproduces deterministically
on demand. Such a test would be precisely the Epic-6 anti-pattern the retro named (6 of that epic's 17 review patches
were assertions that could not fail for the reason they were written). The three-line diff is verifiable by inspection
instead: `grep -rn '@Volatile' bp_back/src/main/` returns exactly 3 hits, one per Storage class, with the guard bodies,
their callers and `evictList`/`evictFromCache` byte-unchanged. The residual it does not fix is the first entry in this
section rather than a silent absorption.

## Deferred from: Story 7.7 — minor and patch dependency sweep (2026-08-12)

**No version was reverted under S-AC3.** Every target in the story's §1/§3 tables landed green, including
`graphql-kotlin 9.3.0`, which the spec pre-declared as the most likely revert. The entries below are the deliberate
holds, the pre-existing drift the sweep surfaced, and one flake the baseline run exposed — none of them is a bump that
failed.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the Gradle wrapper is held at 9.6.1 while 9.7.0 is released. **Named blocking symptom (NFR-E7-1 requires
  one, and "outside the story's `Files:` line" is not it — the same story bumped `settings.gradle.kts`, which is also
  outside that line):** `bp_back/Dockerfile:1` is `FROM gradle:9.6.1-jdk25`, so the shipped image builds with the
  **image's** Gradle; a wrapper-only bump puts local builds and the shipped artifact on different Gradle versions,
  which is a build-path divergence, not a preference.
  evidence: `./gradlew dependencyUpdates` reports `Gradle release-candidate updates: - Gradle: [9.6.1 -> 9.7.0]`.
  AC1's claim that the wrapper is "already current" is now false and is recorded as such. Moving
  `gradle/wrapper/gradle-wrapper.properties` alone would put local builds and the shipped image on different Gradle
  versions — the same build-path divergence that let a broken `images-build-push.sh` survive two epics undetected.
  Proposed fix: its own story, as a two-file change (wrapper properties + Dockerfile base tag) with its own
  `docker compose up --build` + E2E verification.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  **RESOLVED (2026-08-15) by Story 7.10 — no action remains; the `Proposed fix:` below is discharged, not pending.**
  ~~summary: `typescript-eslint` 8.67.0 declares `typescript >=4.8.4 <6.1.0`, so the TypeScript 7 major (Story 7.10)
  and the TS-lint bridge can deadlock across two stories if a TS-7-capable `typescript-eslint` does not exist when
  7.10 starts.~~
  ~~evidence: measured from the installed package at 8.67.0 (`peerDependencies.typescript`), satisfied today by the
  pinned `typescript 6.0.3`. Proposed fix: **before** 7.10 begins, confirm a published `typescript-eslint` whose
  `typescript` peer range admits 7.x; if none exists, 7.10 and 7.11 must be planned as one combined story or 7.10 held
  with that as its blocking symptom.~~
  **RESOLVED (2026-08-15) by Story 7.10.** The prediction was correct and the second of its two sanctioned outcomes was
  taken: no published `typescript-eslint` admits TypeScript 7, so 7.10 held `typescript` at 6.0.3 with that as its
  measured blocking symptom and closed `done`. The combined-story branch was **not** needed — `typescript-eslint@8.67.0`
  peers `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`, so the TypeScript hold does not block Story 7.11 (ESLint 9 → 10) on
  that axis; 7.11 still owes its own peer pre-check for the other plugins. See
  "Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15)" below for the reproduced symptoms and the re-check
  trigger; this entry is superseded by it and needs no further action.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `bp_front/package.json`'s `allowScripts` key names `esbuild@0.27.7` while the lockfile carries
  `esbuild@0.28.1`; the drift is pre-existing, was not fixed here, and now produces a warning on every `npm install`.
  evidence: verbatim from this story's `npm install` — `npm warn allow-scripts 1 package has install scripts not yet
  covered by allowScripts: esbuild@0.28.1 (postinstall: node install.js)`. Exit code was still **0**, so it never
  blocked the sweep. `esbuild` is a transitive dependency of `vite`, so the pinned key goes stale on every vite bump.
  **It is a build-path issue as well as a local one:** `bp_front/Dockerfile:10` runs `npm ci` against the same
  manifest, so esbuild's postinstall is skipped in the shipped image build too. The image builds and the E2E gate is
  green, so there is no present impact — but the entry should not read as "a warning on your laptop".
  Proposed fix: either track the key to the locked version as part of each vite bump, or drop the version qualifier.
  Out of scope here — S-AC4 restricts the diff to version numbers and what an upgrade strictly requires.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `kotest-property` is declared in `bp_back/build.gradle.kts` and used nowhere; the sweep bumped it to 6.2.4
  rather than dropping it.
  evidence: `grep -rn 'Arb\.\|checkAll\|forAll' bp_back/src/test/` returns nothing. Removing a dependency is scope
  bleed under S-AC4, so it moves with the rest of the `kotest` ref. Proposed fix: delete the line in a dedicated
  cleanup, or write the property tests it was added for.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `admin.spec.ts`'s `createUserViaUi` helper is flaky under full-suite parallel load — it failed on the
  **baseline** run before any dependency moved, and again on the first post-sweep run, always at the same assertion.
  evidence: baseline full run (clean tree, `e58065b`): `2 failed / 2 did not run / 116 passed`, both
  `[mobile] › e2e/admin.spec.ts:87` and `:110`, both `Error: expect(locator).toHaveCount(expected) failed / Locator:
  getByTestId('create-user-dialog') / Expected: 0 / Received: 1 / Timeout: 5000ms` at `admin.spec.ts:49`. First
  post-sweep run: `1 failed / 2 did not run / 117 passed`, `[chromium] › e2e/admin.spec.ts:219`, identical error text
  and identical line. Re-running `npx playwright test e2e/admin.spec.ts --project=mobile --no-deps` in isolation
  passed `4 passed (12.3s)`. Immediate re-runs of the full suite were green in both cases (`120 passed`, exit 0). The
  failure snapshot shows the dialog still open with **empty** username/password fields, no error alert, and the users
  table still rendering a `progressbar` — i.e. the dialog's fields were cleared/remounted by a parent re-render between
  the `fill` calls and the `submit` click, not a rejected mutation. So it is a test-side race in the helper, not a
  product regression and not an upgrade regression. It is also why the E2E gate needed two invocations at both the
  baseline and the close. Proposed fix: make `createUserViaUi` wait for the users query to settle before opening the
  dialog (or assert the field values immediately before submitting), and observe it failing first per the standing
  convention. **Do not paper over it with a retry loop** — that is the shape Story 7.3 deleted.
  **This falsifies an epic-level invariant and needs an owner before epic close.** Epic 7 requires *"The E2E suite is
  green at zero retries and stays green — two consecutive full runs at `retries: 0` pass on both desktop and mobile,
  measured twice: when the race-fix story claims it, and again at epic close."* Measured here, that is currently
  **false**: this story's gate went red-then-green at *both* ends, which is the opposite of two consecutive passes.
  Story 7.3's completion claim (`104 passed`, 0 flaky, two consecutive `retries: 0` runs, 2026-08-08) is not
  contradicted — it was true of the suite as it then stood, and this flake is in `admin.spec.ts`'s helper, not in the
  `registrationEnabled` mechanism 7.3 fixed — but it is no longer sufficient evidence for the epic-close criterion.
  Consequence for sequencing: Stories 7.8-7.13 all inherit S-AC1 ("the full Playwright suite passes") against a gate
  that is known to be non-deterministic, so each of them may need a second invocation, and none of them can read a
  single red run as an upgrade regression without checking this helper first. Fix it before epic close, or the close
  criterion cannot be honestly claimed.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the lists index renders in a non-deterministic order, because `ListStorage.getAll()` returns
  `storage.values.toList()` off a `ConcurrentHashMap`.
  evidence: found while comparing S-AC2 screenshots. Two users who each created `Groceries` then `Hardware` render as
  `Groceries, Hardware` and `Hardware, Groceries` respectively, on the **same** build — so the order is hash-order of
  the UUID keys, not creation order. Pre-existing and unrelated to this sweep (the same-user before/after pair is
  byte-identical). It does not affect FR38 home resolution, which sorts numerically via `byCreatedAtAsc`. Proposed
  fix: sort in `ListService.getLists` (or the page) by `createdAt` using the same numeric comparison, so the index
  agrees with the resolved home. Not done here — it is a product change, forbidden by S-AC4.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `dependencyUpdates` will keep reporting Kotlin `2.4.20-RC` and Arrow `2.3.0-alpha.4` as "later release"
  after this story; that is the plugin's `revision = "release"` filter failing to exclude prereleases, not a missed
  bump.
  evidence: the post-sweep report lists 10 `org.jetbrains.kotlin:*` artifacts at `[2.3.21 -> 2.4.20-RC]` and both
  Arrow artifacts at `[2.2.3 -> 2.3.0-alpha.4]`, alongside `com.expediagroup:graphql-kotlin-ktor-server [9.3.0 ->
  10.2.1]` (Story 7.12's major) and the Gradle wrapper hold above. Everything else in the report is under "The
  following dependencies are using the latest release version". Recorded so a future reader does not read the
  prerelease noise as remaining sweep work.

## Deferred from: Stories 7.8 + 7.9 — @types/node 26 and Vite 8 (2026-08-13)

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The `createUserViaUi` flake is SIZE-DRIVEN, not random, and its mechanism is now measured.** The admin
  panel renders **every** user row in the persistent database (`AdminUsers` at
  `bp_front/src/lib/admin/adminQueries.ts:21` is unpaginated), and the create-user dialog's close is gated behind that
  re-render. At **~5.5k** user rows a no-other-load probe measured **5015 ms** to close against `admin.spec.ts:49`'s
  **5000 ms** `toHaveCount` timeout. As the table grows, the suite fails more and more often under 12-worker parallel
  load. This is a hard blocker on the epic's E2E gate and needs an owner.
  **CORRECTED AT REVIEW — the first draft of this entry said "deterministic" and "monotonic" and those words are not
  earned; do not restore them.** 5015 ms against a 5000 ms budget is a **0.3 % margin measured once**, so the failure
  is probabilistic and load-sensitive, which is exactly why the cited `3 → 2 → 2 → 4 → 8` progression is not monotonic
  and why two full **green** runs (`baseline-e2e-rerun.txt` 05:51, `7.8-e2e.txt` 05:55, both `120 passed`) occurred
  *after* a red one at **larger** row counts. The claim "re-running cannot converge" is falsified by those two runs.
  What is established is the direction and the mechanism, not a cliff.
  evidence: verbatim, on every failing run in this pass —
  `Error: expect(locator).toHaveCount(expected) failed / Locator: getByTestId('create-user-dialog') / Expected: 0 /
  Received: 1 / Timeout: 5000ms` at `admin.spec.ts:49:56`, `at createUserViaUi
  (/home/md/projects/personal/bag-please/bp_front/e2e/admin.spec.ts:49:56)`. A no-other-load Playwright probe against
  the running `:2080` stack measured: `admin page visible in 66 ms`, `first user row rendered in 2199 ms`,
  `row count 5497`, `create-user dialog closed in 5015 ms`. Mongo at that moment:
  `users 5380 / lists 3389 / list_members 614 / items 1853 / categories 1768 / refresh_tokens 7305` (before this
  pass's own runs added more). The degradation is **monotonic** — each full suite invocation adds ~120 users, and the
  successive full runs in this pass failed **3 → 2 → 2 → 4 → 8** tests, always the same signature, always inside
  `admin.spec.ts`. `2 did not run` on every red run: the `registration-toggle-*` pair is `dependencies`-chained behind
  `chromium`/`mobile`.
  **Attribution is settled and it is not the upgrade — but NOT by the control run this entry originally credited.**
  The Vite 7.3.6 control (`attr-e2e-vite7.txt`, 12:05) ran *after* all four Vite 8 runs, at the **largest** database
  of the pass, and both compared runs sat at saturation (all 8 admin tests failing), so identical tallies carry no
  discriminating power. The evidence that does settle it: after `md` cleared the database, the **unchanged** Vite 8
  tree passed `120 passed` **twice consecutively** at `retries: 0`, with the served bundle confirmed as the Vite 8
  output (`/assets/index-D0HEEKre.js`, matching the host build). Deleting user rows does not cure a bundler
  regression. Vite 8 is inert with respect to this failure.
  Proposed fix: prune `./db/data` (a `mongodump --archive --gzip` of the whole `bag_please` DB is 1.2 MB and was taken
  in this pass before anything else — see the next entry), **and** fix the helper so the assertion does not depend on
  the size of a table it did not create. The Story 7.7 entry's proposed fix ("wait for the users query to settle
  before opening the dialog") is necessary but **not sufficient**: settling now takes >5 s on its own. A retry loop is
  still forbidden — that is the shape Story 7.3 deleted. This supersedes the "test-side race in the helper" reading in
  the Story 7.7 entry above; that reading was correct for the symptom at ~5.2k rows and is now incomplete.
  **RESOLVED FOR NOW, BUT NOT FIXED — `md` cleared the database on 2026-08-13 and the gate went green immediately.**
  `md` replaced the `./db/data` bind mount with a named Docker volume (`docker-compose.yaml`: `volumes: db_data:` and
  `db_data:/data/db`) and deleted `db/` entirely, so the stack came up on an empty database (1 seed user). Against
  that, on the unchanged Vite 8 image (`docker compose up -d --build --force-recreate`): **two consecutive full runs
  at `retries: 0`, `120 passed (42.3s)` and `120 passed (41.6s)`, exit 0 both times, zero flaky, zero failed, zero
  "did not run"**, split re-measured at `59 / 59 / 1 / 1`. So S-AC1 is discharged for both stories and the epic-level
  invariant holds *today*.
  **The defect itself is untouched and will recur.** Nothing was done to the admin panel or to
  `createUserViaUi`; only the data under them was removed. **No arrival estimate is given** — the first draft's
  "~45 more runs" came from ~120 users/run against a ~5.5k cliff, and that arithmetic does not close against the four
  row counts this pass recorded (5380 at start, a 5497 probe, 5498, 5734 at close, over ≥7 full-suite invocations), so
  the rate or one of the counts is wrong. The direction is certain; the timing is not. It will return **silently**, as
  a "flake" that re-runs seem to heal, exactly as it did for two epics. The fix that actually ends it is still the one
  below: make the helper's assertion independent of a table it did not create, and/or paginate the admin users query.
  A per-run database reset or namespace in `webServer`/`globalSetup` would also end the growth mechanically, and is
  probably the cheapest of the three. **Do not treat "the gate is green" as closure — clearing data is not a
  mechanism.**
  **Note for anyone reading the numbers above:** they were measured against a bind-mounted `./db/data`, which no
  longer exists. `project-context.md`'s E2E rule still says "the DB volume `./db/data` persists across runs" — the
  persistence claim is still true of the named volume, but the path is stale. That compose change is uncommitted at
  the time of writing and was not made by this story.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: The dev/E2E MongoDB was **not** pruned in this story — the destructive delete was proposed and declined —
  so the next E2E run starts from a still-larger users table. A full backup exists; the prune itself is `md`'s call.
  evidence: `docker exec bag-please-mongo-1 mongodump -u user -p pass --authenticationDatabase admin --db bag_please
  --archive --gzip` was taken to `.tmp/7cc77383-5cb8-4116-94d7-f5a9244538da/bag_please-backup-20260813-060357.archive.gz`
  (1.2 MB, exit 0). Of 5498 users, **5477** match the E2E-generated patterns `/_e2e_|^probe_|^sac2_/` and only **21**
  are hand-made accounts from earlier manual passes (`mia`, `john`, `manual_*`, `tmpdbg_*`, `sweep77_*`, …).
  Proposed fix: `db.users.deleteMany({username: /_e2e_|^probe_|^sac2_/})` plus `db.refresh_tokens.deleteMany({})`,
  then restart `bp_back` so its lazy in-memory user cache re-syncs. Note the `.tmp/` session directory is normally
  deleted at session close per `CLAUDE.md` — **move the archive out of `.tmp/` first if the backup is wanted.**
  **OUTCOME (2026-08-13):** `md` did not prune selectively — the whole database was discarded by switching the mongo
  volume to a named Docker volume and deleting `db/`. **All 21 hand-made accounts went with it** (`mia`, `john`,
  `manual_*`, `tmpdbg_*`, `sweep77_*`, …), along with every list, item and category they owned. The `mongodump`
  archive named above is therefore the **only** copy of that data. **It was moved out of `.tmp/` at review** —
  `CLAUDE.md` mandates deleting `.tmp/<session-id>/` at session close, which would have destroyed the sole copy — and
  now lives at **`~/bag-please-db-backup-20260813-060357.archive.gz`**. `db/.gitignore` (contents: `data`) is deleted
  in the working tree as a consequence of the volume switch; that is `md`'s change, not this story's, and this story
  takes no position on whether it should be restored.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: `bp_front/package.json`'s `allowScripts` block is **resolved by deletion** — Vite 8 removed `esbuild` from
  the tree entirely, so the key was provably dead rather than merely stale. This closes the Story 7.7 entry above.
  evidence: after the Vite 8 install, `node_modules/esbuild` is **absent** from `package-lock.json` and so is
  `node_modules/rollup`; the tree carries `rolldown 1.2.4`, `lightningcss 1.33.0` and `postcss 8.5.26` instead.
  Story 7.7's entry assumed "esbuild is a transitive dependency of vite, so the pinned key goes stale on every vite
  bump" — that assumption no longer holds at all. `npm install` and the image's `npm ci` now print **no**
  allow-scripts warning; the last one recorded before the removal was
  `npm warn install-scripts 1 package has install scripts not yet covered by allowScripts: esbuild@0.28.1
  (postinstall: node install.js)`. None of the 14 `@rolldown/binding-*` or 11 `lightningcss-*` platform packages
  needs an install script, so nothing replaced the key. No fix outstanding.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: Nothing was reverted under S-AC3 in either story. Recorded so the absence is explicit rather than inferred.
  evidence: `@types/node` 26.2.0, `vite` 8.2.1 and `@vitejs/plugin-react` 6.0.5 all landed. Both static gates and the
  production image build were green for each commit; the only red gate is the environment failure filed above, which
  a same-DB-size control run on the previous bundler reproduced identically.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: This pass left fixture data in the dev/E2E database: user `sac2_visual_probe_7_8_7_9` (S-AC2 screenshot
  fixture, with `SAC2 Visual List` + two categories + two items) and `Manual 7.9 Vite8 List` with a `Bakery` category
  and a checked `Sourdough loaf` (the manual real-browser pass). Harmless, but it is not test-generated and will not
  be caught by a `/_e2e_/` prune of the users table alone.
  evidence: the S-AC2 harness lives at `.tmp/7cc77383-5cb8-4116-94d7-f5a9244538da/shots.mjs` and deliberately reuses
  one fixed account across the before and after passes — that is the only reason all ten screenshot pairs came out
  byte-identical instead of needing an eye adjudication for the username glyph.
  **OUTCOME (2026-08-13):** moot — the database was discarded wholesale (see the entry above), so this fixture data no
  longer exists. The technique is what is worth keeping: a fixed account reused across both passes is what makes the
  S-AC2 comparison byte-exact, and the next dependency story should reuse `shots.mjs` rather than re-derive it.

## Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15)

One held-back major, with its blocking symptom reproduced in this repository rather than cited from a peer-range
string. NFR-E7-1 requires a named blocking symptom for a hold; this section is that record. The story closed `done`
(S-AC3): a held-back dependency closes its story rather than failing it.

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: **`typescript` is held at `6.0.3` while `7.0.2` is `latest`.** The blocking symptom is
  `typescript-eslint`: **no published version admits TypeScript 7**, and the whole static lint gate dies at module
  load under it. **Version attempted: `7.0.2`** (registry `latest` on 2026-08-15; `next` is `7.1.0-dev.20260815.1`,
  a prerelease and not a candidate). `6.0.3` is already the newest stable 6.x, so there is no patch to take inside
  the held major — this is a clean hold at the top of 6, not a lag.
  evidence, measurement 1 — **the registry, re-measured in this pass on 2026-08-15**:
  `npm view typescript dist-tags --json` → `"latest": "7.0.2"`. `npm view typescript-eslint@latest peerDependencies
  --json` → `{"eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0"}`; `@typescript-eslint/parser@latest`
  (8.67.0) declares the identical pair; `typescript-eslint@canary` (8.67.1-alpha.4) also declares `<6.1.0`. Swept
  across the published `typescript-eslint >=8.0.0` line, the `typescript` peer takes exactly four distinct values and
  **none** of them admits 7.x: `>=4.8.4 <6.0.0` (31), `>=4.8.4 <5.9.0` (21), `>=4.8.4 <6.1.0` (19),
  `>=4.8.4 <5.8.0` (12).
  **Corrected at review — the denominator was overstated and the claim was too strong.** Those four counts sum to 83,
  which is the number of releases that *returned a `typescript` peer*, **not** the number swept: there are **105**
  published stable 8.x releases, and the remaining 22 declare no `typescript` peer at all (`npm view` silently omits
  an absent field). A `>=8.0.0` range also excludes prereleases by definition, so **none of the 1066 published 8.x
  prereleases was swept** — only `canary` was spot-checked. The defensible claim is therefore: **no stable release,
  and neither published prerelease channel (`canary`, `rc-v8`), admits TS 7.** Do not restore "every published
  release" or "not merely no *stable* one". The *conclusion* is unaffected and does not rest on the sweep at all —
  see measurement 3: `typescript-eslint` refuses TS 7 in a **runtime check of its own**, so a release declaring no
  peer, or a widened peer, would still throw.
  evidence, measurement 2 — **the install, reproduced in the real `bp_front/` tree**, verbatim from
  `npm install typescript@7.0.2`:
  ```
  npm warn ERESOLVE overriding peer dependency
  npm warn While resolving: bp_front@0.16.0
  npm warn Found: typescript@6.0.3
  npm warn node_modules/typescript
  npm warn   peer typescript@">=4.8.4 <6.1.0" from @typescript-eslint/eslint-plugin@8.67.0
  npm warn   node_modules/@typescript-eslint/eslint-plugin
  npm warn     @typescript-eslint/eslint-plugin@"8.67.0" from typescript-eslint@8.67.0
  npm warn     node_modules/typescript-eslint
  npm warn   11 more (@typescript-eslint/parser, ...)
  npm warn
  npm warn Could not resolve dependency:
  npm warn peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.67.0
  npm warn node_modules/typescript-eslint
  npm warn   dev typescript-eslint@"^8.50.0" from the root project
  ```
  **Divergence worth knowing, measured not assumed:** this install **succeeded, exit 0** (`added 13 packages, removed
  12 packages, changed 1 package`) — npm treats an explicitly-versioned install target as authoritative and *overrides*
  the peer with a `warn` instead of failing `ERESOLVE`. **`--legacy-peer-deps` was therefore never needed and was never
  used**, and no `.npmrc` exists in `bp_front/` or `~` (`npm config get legacy-peer-deps` → `false`). Do not plan a
  future attempt around a hard install failure: **the peer conflict does not stop you, the runtime does.**
  **Corrected at review — the blocking peer is declared by exactly 8 packages, not twelve.** Measured from
  `bp_front/package-lock.json`: `typescript-eslint` plus **seven** `@typescript-eslint/*` (`eslint-plugin`, `parser`,
  `project-service`, `tsconfig-utils`, `type-utils`, `typescript-estree`, `utils`) declare `>=4.8.4 <6.1.0`. The
  "twelve" was arithmetic off npm's own elision line (`11 more (@typescript-eslint/parser, ...)`), which counts peer
  *edges*, not packages. The three other `typescript` peers in the lockfile — `ts-api-utils` (`>=4.8.4`) and two
  `cosmiconfig` copies (`>=4.9.5`, optional) — are **open-ended and do not block TS 7**.
  evidence, measurement 3 — **the lint gate, verbatim from `npm run lint` with TS 7.0.2 installed, exit code 2**:
  ```
  typescript-eslint does not support TS 7.0.
  Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.
  See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1

  Oops! Something went wrong! :(

  ESLint: 9.39.5

  Error: typescript-eslint does not support TS 7.0.
      at Object.<anonymous> (/home/md/projects/personal/bag-please/bp_front/node_modules/typescript-eslint/dist/index.js:52:11)
      at Module._compile (node:internal/modules/cjs/loader:1944:14)
  ```
  It throws at **module load**, in the config's own import — so `eslint .` lints **zero files** and reports no rule
  results at all. That is the entire static lint gate, including the `react-hooks/set-state-in-effect` rule the epic
  calls load-bearing for the render-phase-adjustment convention. Note the upstream issue's own wording: it tracks
  support for TS **>=7.1**, not 7.0 — 7.0 is not going to be supported.
  root cause, measured in-tree: TS 7 is the native (Go) port and **ships no JavaScript compiler API**. With 7.0.2
  installed, `node -e "console.log(Object.keys(require('typescript')))"` → `[ 'version', 'versionMajorMinor' ]` and
  `typeof ts.createProgram` → `undefined`; `node_modules/typescript/bin/` contains **only `tsc`** — **`tsserver` is
  gone** (6.0.3 shipped both). `@typescript-eslint/typescript-estree` `require`s that API and calls
  `ts.createSourceFile` / `ts.ScriptTarget`, none of which exist. So this is not a cosmetic peer warning and cannot be
  waved through with a range override.
  **The finding worth keeping — this codebase is already TS-7-clean.** Measured with TS 7.0.2 actually installed in
  `bp_front/`, after `rm -rf node_modules/.tmp`: `npx tsc -b tsconfig.json --force` → **exit 0, zero diagnostics**, and
  each project individually (`tsc -p tsconfig.app.json|tsconfig.node.json|tsconfig.e2e.json --noEmit`) → **exit 0**.
  Unchanged `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `moduleResolution: bundler`;
  no `@ts-ignore`, `@ts-expect-error` or weakened compiler option was added anywhere, and no tsconfig was touched. That
  separates **"our linter is not ready"** from "our code is not ready" — only the former is true. When a TS-7-capable
  `typescript-eslint` ships, **this story is expected to be a one-line version bump**, not a migration.
  **Scope this expectation honestly (added at review):** the exit-0 was measured under **7.0.2**, against the tree at
  `853b599`, on **glibc linux-x64 only**. The compiler that eventually lands will by construction *not* be 7.0.2
  (support starts at ≥7.1), and the tree will have absorbed Stories 7.11–7.15 by then. Re-run `tsc -b --force` under
  the actual 7.x at retry time before scoping the retry as one line. Note also that **the Alpine/musl image was never
  built under TS 7** — the LAND branch never ran, so `docker compose build bp_front` is an unexercised path. The
  reason to expect it to work is narrow and inferential, not measured in-image: `@typescript/typescript-linux-x64`
  ships a **statically linked** Go binary and declares no `libc` field, so npm will not filter it out on musl. Only
  1 of the 20 platform packages was ever resolved.
  **Rejected escape hatch: the sanctioned side-by-side / dual-TypeScript install.** Both the TS 7 error message above
  and the TypeScript 7.0 announcement offer it — alias TS 6 in so `typescript` still resolves to a compiler API, e.g.
  `"typescript": "npm:@typescript/typescript6@^6.0.2"` alongside `"@typescript/native": "npm:typescript@^7.0.2"`.
  Refused on three concrete costs, recorded here so a future story inherits the analysis instead of rediscovering it:
  (1) **S-AC3 forbids it in words** — "a failed bump is reverted and recorded, never worked around" — and S-AC4 forbids
  the scope it needs (a second package plus a rewritten `build` script); (2) **it would downgrade the linting
  compiler** — `@typescript/typescript6` is published at `6.0.2` while this project is on `6.0.3`, so the workaround
  makes one gate *older* than today; (3) **it splits the codebase across two type systems** — `tsc` checking with 7.0
  semantics while typescript-eslint parses with 6.0, so any divergence surfaces as an unattributable lint/build
  disagreement, precisely the failure mode the epic's one-major-at-a-time sequencing exists to prevent.
  **Weight these correctly (adjusted at review).** Only (1) is a rule and it is by itself sufficient. (2) rests on
  `@typescript/typescript6`'s published `latest` being `6.0.2` — verified against the registry at review, but it is a
  version that can move. (3) is a *prediction*, and this story's own evidence points the other way: TS 7.0.2 and TS
  6.0.3 were both measured clean on this codebase (exit 0 type-check, exit 0 lint), i.e. the two compilers agreed
  completely. So the refusal stands on S-AC3, not on three co-equal measured grounds — do not re-present it as such.
  **What the hold does NOT block:** `typescript-eslint@8.67.0` peers `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`, so
  **the TypeScript hold does not block Story 7.11 (ESLint 9 → 10).** The epic's "7.11 depends on 7.10" is satisfied by
  7.10 *closing*, not by it landing a bump. Do not read this hold as a stalled chain.
  **Bounded at review — that is the only 7.11 peer measured.** 7.11's AC1 requires *every* plugin to resolve against
  ESLint 10; `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `@eslint/js` and `globals` were **not**
  queried here, so 7.11 must still run its own peer pre-check and must not inherit an unqualified "not blocked".
  **And the hold imposes an inverse constraint on 7.11:** whatever `typescript-eslint` version it lands must still
  declare a `typescript` peer admitting the held **6.0.3** — i.e. the `<6.1.0` line. 31 of the swept releases declare
  `>=4.8.4 <6.0.0`, which does *not* admit 6.0.3, so an ESLint-driven move of `typescript-eslint` could re-open the
  same conflict from the other side.
  **Re-check trigger, concrete.** Watch
  <https://github.com/typescript-eslint/typescript-eslint/issues/10940>. (Read on 2026-08-15 during this story's
  planning pass: open, labelled *blocked by external API*, with maintainers describing tsgo as "many months away from
  being stable". That reading was **not** captured to an evidence file — treat the issue's state as needing a fresh
  look rather than as a measurement of record. What *is* evidenced, from the lint failure itself, is that support
  tracks TS **>=7.1**.)
  **The test must be a disjunction, not a single `@latest` peer-range check (widened at review).** A peer-range check
  alone will miss the likely shape of the fix: support will arrive through the native/tsgo API, which upstream may
  express as a *new* peer on the native compiler, or by dropping/optionalising the `typescript` peer, rather than by
  widening the existing range. And `typescript-eslint` ships `canary` and `rc-v8` ahead of `latest`, so `@latest`
  alone lags. **Any** of these qualifies: the `typescript` peer's upper bound admits 7.1+; the `typescript` peer is
  dropped or made optional; a new peer on the native compiler appears; or a `canary`/`rc-v9` release or the release
  notes announce TS 7 support. Check `npm view typescript-eslint dist-tags` and the release notes, not `@latest`
  alone. **Whatever the signal, the decisive confirmation is behavioural:** install the candidate pair and confirm
  `npm run lint` lints a non-zero number of files, since the refusal is a runtime check, not a peer range.
  When it lands, re-run this story: bump `bp_front/package.json`'s pinned `"typescript"` entry, bump
  `typescript-eslint` to the enabling version, then `npm run lint` + `npm run build` + the full four-project
  Playwright suite + `docker compose build bp_front` (the musl path, never exercised under TS 7). Expect the tsconfigs
  to need nothing.
  Proposed fix: **OPEN — this is a live obligation, not a closed item.** No code change is owed today, but the
  re-check above must actually be performed before any future TypeScript attempt, and nothing in the story workflow
  will resurface it now that 7.10 is `done`. Tracked as an open `action_items` entry in `sprint-status.yaml`.

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: **TypeScript 7 drops `tsserver` from the npm package**, which no gate in this project can see and which will
  matter to editor tooling on the day the bump finally lands.
  evidence: measured in-tree with 7.0.2 installed — `node_modules/typescript/bin/` contains only `tsc`, where 6.0.3
  ships `tsc` **and** `tsserver`. Every editor/LSP integration in this repo's workflow resolves the workspace
  `typescript` for its language server, and the project's global directive is to use an LSP server where one is
  available. Nothing in `npm run lint`, `npm run build`, `docker compose up --build` or the Playwright suite touches
  `tsserver`, so **all four gates would stay green while in-editor type intelligence silently stopped working** — the
  same shape as Story 7.9's invisible browser-floor change.
  Proposed fix: when the TS 7 bump is re-attempted, verify the editor path explicitly (a native-preview LSP server, or
  whatever the ecosystem has settled on by then) as a named acceptance step, rather than inferring editor health from
  four green gates that cannot observe it. Out of scope here — nothing was bumped.

## Deferred from: Story 7.11 — ESLint 9 → 10 (2026-08-16)

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `bp_front/eslint.config.mjs:47`'s `'react-refresh/only-export-components': 'off'` override for `e2e/**`
  is **unreachable configuration**, and has been since Story 7.1 introduced it.
  evidence: `eslint-plugin-react-refresh/index.js:36-40` returns `{}` for any filename containing `.spec.`, then
  gates on `shouldScan = filename.endsWith(".jsx") || filename.endsWith(".tsx") || checkJS && filename.endsWith(".js")`.
  All 14 files matched by the `bp/e2e-playwright` block are `.ts` (10 of them `.spec.ts`), so the rule never runs there
  regardless of the override. Measured with a control on the bumped tree: a component plus a non-component function
  appended to the `.ts` file `src/lib/lists/homePath.ts`, where the rule resolves to `[2]`, reports nothing (exit 0),
  while the same shape in the `.tsx` file `src/components/StoreField.tsx` reports 1 error. Consequence beyond the dead
  line itself: the epic's AC3 premise (`epics.md:3505`, "Story 7.1 excluded the rule from `e2e/` so the shared support
  module is legal") is **mistaken** — the module was always legal — and Story 7.11's first draft recorded the e2e
  silence as a falsification, which is the assertion-that-cannot-fail defect class the Epic 6 retro named. Corrected in
  the spec, `project-context.md` and `sprint-status.yaml` at review.
  Proposed fix: either delete the override and assert `npm run lint` still exits 0 (cheapest, and honest), or keep it
  and make it load-bearing with a component-shaped `.tsx` fixture under `e2e/`. Do **not** leave it carried forward as a
  verified invariant across the next ESLint major.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `bp_front/package.json` declares **no `engines` field**, while ESLint 10 narrowed the Node floor further than
  anything else in the toolchain — so a Node that builds, type-checks and E2E-tests this project can silently fail to
  lint it.
  evidence: `eslint@9.39.5` engines were `^18.18.0 || ^20.9.0 || >=21.1.0`; `eslint@10.8.1` is
  `^20.19.0 || ^22.13.0 || >=24` (both read from the lockfiles). `vite@8` admits `^20.19.0 || >=22.12.0`. So Node
  22.12.x and 23.x pass every other gate and cannot run `npm run lint`, and `npm` only emits an `EBADENGINE` **warning**.
  The two paths actually in use are fine (`mise.toml:6` = `26.4.0`; `bp_front/Dockerfile:7` = `node:26-alpine`,
  measured `v26.7.0` inside the build stage), so nothing is broken today — this is an unpinned floor, not a live defect.
  Proposed fix: add `"engines": {"node": "^20.19.0 || ^22.13.0 || >=24"}` to `bp_front/package.json`. Deliberately not
  done in Story 7.11: S-AC4 scopes that story to version numbers and changes strictly required by the upgrade.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: The `ignores`-integrity proof exercises only 2 of the array's 7 entries, and `npm run lint` cannot go red on
  a warning-only ignores regression anyway.
  evidence: `eslint.config.mjs:11-19` lists `dist`, `src/__generated__`, `test-results`, `playwright-report`,
  `blob-report`, `playwright/.cache`, `e2e/.auth`. Three of those do not exist on disk and two contain no lintable
  file, so the before/after linted-file-set comparison genuinely tests only `dist` and `src/__generated__`. Compounding:
  `package.json:12` is `eslint .` with no `--max-warnings 0`, and `src/__generated__` under `--no-ignore` yields exit 0
  with a *warning*, so a regression there would not redden the gate — the manual sorted-list diff is the only detector
  and no gate re-runs it.
  Proposed fix: `--max-warnings 0` on the lint script, and if the ignores array is to be treated as verified, a
  throwaway `.ts` under each output directory before capturing the set.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `eslint.config.mjs` lints itself with an empty rule set — it is one of the 52 files in the linted set but
  matches neither `files` block.
  evidence: the config's two rule-bearing objects are `files: ['**/*.{ts,tsx}']` (`:22`) and
  `files: ['e2e/**/*.ts', 'playwright.config.ts']` (`:36`). The measured set is 26 `.tsx`, 25 `.ts` and 1 `.mjs`; the
  `.mjs` is the config itself, walked and reported as linted while carrying no rules. Pre-existing, not caused by the
  bump.
  Proposed fix: add `'**/*.mjs'` to the first block's `files`, or accept it knowingly — but stop counting it as a
  linted file in evidence about gate coverage.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `eslint` and `@eslint/js` are now independently versioned behind caret ranges with an **optional** peer, so
  nothing mechanical keeps them coherent.
  evidence: `eslint@10.8.1` no longer depends on `@eslint/js` at all (9.39.5 pinned it exactly), and `@eslint/js@10.0.1`
  declares `eslint: ^10.0.0` with `peerDependenciesMeta.optional: true`. `package.json` carries `^10.8.1` and `^10.0.1`.
  npm will therefore accept any `^10` combination silently, and `js.configs.recommended` is where new rules arrive — so
  a future `@eslint/js` minor can redden lint with no `eslint` bump and no signal that anything moved.
  Proposed fix: pin both exactly, which is already the convention for 13 other entries in this `package.json`.

- source_spec: `spec-7-11-eslint-9-to-10.md`
  summary: `project-context.md`'s `rule_count` is adjudicated by judgement each story, and this pass shows the judgement
  is not reproducible.
  evidence: Story 7.11 counted **94 → 95** for one bullet that states three independently trippable facts (the two
  packages have separate version lines; `@eslint/eslintrc` and its bundled `globals@14` are gone from the tree;
  `js.configs.recommended` gained three rules), on the reasoning that the latter two are "consequences" of the first.
  They are not consequences in any sense an agent can derive. Either the count is short by two, or the counter is not a
  meaningful metric. The same adjudication recurs every story.
  Proposed fix: `md` to rule on what `rule_count` counts — bullets, or independently actionable directives — or retire
  it.

## Deferred from: code review of 7-10-typescript-6-to-7 (2026-08-15)

- source_spec: `spec-7-10-typescript-6-to-7.md`
  summary: `sprint-status.yaml` records a **held-back** dependency story with the same `done` value as a story that
  actually landed its bump, so the epic-close dependency-currency audit cannot tell the two apart without parsing a
  multi-thousand-character prose comment.
  evidence: `7-10-typescript-6-to-7: done` is byte-identical in form to `7-8-…: done` and `7-9-…: done`, which landed
  real version moves; the only distinguishing signal is the trailing comment. This is *sanctioned* — S-AC3 says a
  held-back dependency closes its story — and it is mitigated outside this file, since `project-context.md`'s
  Technology Stack now says the major is held. But the epic's "every direct dependency is at latest stable **or
  deliberately held back**" close criterion is a machine-checkable question being answered by prose. Story 7.12 may
  produce a second hold (`graphql-kotlin`/Kotlin) and 7.13 a third (`graphql` 16 → 17), so this compounds.
  Proposed fix: add a structured marker — a `held_dependencies:` block, or a `status: done-held` value — so the
  epic-close audit reads YAML rather than narrative. Deliberately **not** done inside Story 7.10: changing the sprint
  board's schema is outside a held story's S-AC4 scope and would affect every consumer of the file.

## Deferred from: code review of 7-8-7-9-types-node-26-and-vite-8 (2026-08-13)

Findings the review surfaced that are **not** fixable inside this story's S-AC4 boundary (version numbers and what an
upgrade strictly requires). Several are pre-existing and were merely exposed by the bundler swap.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The shipped bundle now carries zero third-party licence banners.** Vite 8 defaults `build.minify` to
  `"oxc"`, which does not preserve legal comments; `bp_front/dist/assets/index-*.js` contains **0** occurrences of
  `@license` or `Copyright (c)` while `@mui/material` and `react-dom` both ship MIT/React banners in source. MIT asks
  that the notice travel with substantial portions.
  evidence: `vite.resolveConfig(..., 'build').build.minify` returns `"oxc"` on 8.2.1; `grep -c "@license\|Copyright
  (c)" bp_front/dist/assets/*.js` returns 0. Whether Vite 7's esbuild path preserved them was NOT measured, so the
  regression is probable rather than proven — measure before acting. Proposed fix: either a `build.minify` option that
  keeps legal comments, or an emitted third-party licence file. **Both need a `build` block in `vite.config.ts`, which
  this story's intent contract forbids**, so it is a decision for `md` and not a patch. Low practical risk for a
  private app; non-zero if it is ever distributed.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Deleting `allowScripts` removed the project's install-script policy anchor, and the image's npm floats.**
  `bp_front/Dockerfile:7` is `node:26-alpine`, an unpinned tag whose npm moves independently of `mise.toml:6`. Reported
  during review: npm 11 *warns* on an unreviewed install script and still runs it, whereas npm 12 requires an explicit
  allow and blocks. If the image's npm rolls to 12 and any future dependency needs a postinstall, `npm ci` in the build
  stage skips it and the image breaks in a way that reads as unrelated.
  evidence: `allowScripts` is absent from `bp_front/package.json` after commit `9efa85c`; there is no `.npmrc`, no
  `engines` field and no `packageManager` field anywhere in the repo. Proposed fix: keep an explicit `"allowScripts":
  {}` as the policy anchor, and/or pin `packageManager` so the image's npm is a decision rather than a roll. Note this
  also means Design Notes §4's "a blocked script leaves an unusable binary" branch may have been unreachable under
  npm 11 — the deletion was still correct (the key named a package no longer in the tree), but for a simpler reason
  than the spec gave.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **A bundler swap was accepted on Chromium-only evidence.** `playwright.config.ts` declares four projects,
  all Chromium (Desktop Chrome + Pixel 7). Rolldown's and oxc's output on WebKit and Gecko is unverified, and this
  matters more now that Vite 8's baseline includes `safari16.4`/`ios16.4`.
  evidence: `playwright.config.ts:96-140`; no `webkit` or `firefox` project exists. Proposed fix: add a WebKit project
  (at least a smoke subset), or state explicitly in the E2E rules that non-Chromium output is unverified.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The lockfile's 25 optional native platform packages can be pruned by an `npm install` on a different
  platform, breaking the musl image build for everyone.** Rolldown and Lightning CSS bindings are resolved as optional
  platform deps; npm records only what it saw. A contributor on macOS or arm64 running `npm install` can drop the
  `linux-x64-musl` entries the Docker build needs.
  evidence: `package-lock.json` carries 14 `@rolldown/binding-*` and 11 `lightningcss-*` entries after this story's
  `npm install` on linux/x64/glibc; `bp_front/Dockerfile:10` runs `npm ci` under `node:26-alpine` (musl). Proposed fix:
  a check that all platform entries survive an install, or `npm install --os=... --cpu=...` guidance in the frontend
  CLAUDE.md.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Caddy's SPA fallback answers a request for a stale hashed asset with `index.html` and HTTP 200.** After
  any deploy that changes the chunk hash, a browser holding a cached `index.html` requests the old
  `/assets/index-<oldhash>.js`, receives HTML with a 200, and fails with a module-script MIME error — a blank page,
  not a retry. Pre-existing (hashing is not new), but a bundler swap guarantees a hash change.
  evidence: `routing/Caddyfile:29-33` is `root * /srv` / `try_files {path} /index.html` / `file_server` with no
  `/assets/*` carve-out and no cache-control directives. Proposed fix: a `handle /assets/*` block ahead of the SPA
  fallback so a missing asset 404s honestly, plus `Cache-Control: no-cache` on `index.html`.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`tsconfig.app.json` declares no `types` field, so `@types/node`'s globals are visible to browser code.**
  Node-only APIs type-check clean inside `src/` and fail at runtime. Pre-existing; this story made the Node typings a
  major newer.
  evidence: `bp_front/tsconfig.app.json` has no `types` key, so every package under `node_modules/@types` is included
  by default. Proposed fix: `"types": ["vite/client"]` there, keeping `tsconfig.e2e.json`'s explicit `["node"]`.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`npm run build`'s `tsc -b` has no `--force`, so a future types bump can report green having checked
  nothing.** This story's gate worked around it by deleting `node_modules/.tmp` by hand; the script itself is
  unchanged, so the trap is armed for Story 7.10 (TypeScript 6 → 7).
  evidence: `bp_front/package.json:9` is `"build": "tsc -b && vite build"`; build mode caches per project under
  `node_modules/.tmp/*.tsbuildinfo`. Proposed fix: `tsc -b --force` in the script, or a separate `typecheck` script the
  dependency stories use. Out of scope here — S-AC4 restricts the diff to version numbers.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **Nothing outside `mise.toml` pins Node for a contributor who does not use mise**, so a build on Node 22
  would type-check against `@types/node` 26 APIs its runtime lacks — the exact hazard Story 7.8's AC1 exists to
  prevent, unguarded for anyone not on the same toolchain.
  evidence: no `engines` field, no `.nvmrc`, no `.node-version`, no `packageManager`; only `mise.toml:6` and
  `bp_front/Dockerfile:7`. Proposed fix: `"engines": {"node": ">=26 <27"}` plus `engine-strict=true`.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`codegen.ts` is in no tsconfig project and codegen was never run against the Vite 8 tree**, so the
  `npm run generate` path is unverified after `esbuild` left the dependency graph. It will be discovered at the next
  schema change rather than now.
  evidence: `tsconfig.app.json` includes `src`, `tsconfig.node.json` includes only `vite.config.ts`,
  `tsconfig.e2e.json` includes `e2e` + `playwright.config.ts`; `codegen.ts` matches none. The spec forbade running
  `npm run generate` (no schema change in this epic), so this was correct to skip and is flagged rather than blamed.
  Proposed fix: run `npm run generate` once against the current tree and confirm byte-identical output.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **`./db/data` survives as a stale path across the docs and E2E comments** after `md` switched the mongo
  mount to the named volume `bag-please_db_data`.
  evidence: `_bmad-output/project-context.md:359,363,416` still teach it as the persisting E2E volume, and the same
  path appears in `docs/` and in `bp_front/e2e/` comments. Deliberately **not** swept by this story: the compose change
  is uncommitted and belongs to `md`, so rewriting standing rules around it would bake in a change that may yet be
  reverted. Proposed fix: sweep it when the compose change is committed.

- source_spec: `spec-7-8-7-9-types-node-26-and-vite-8.md`
  summary: **The paperwork commit must be path-scoped.** The working tree carries `md`'s uncommitted
  `docker-compose.yaml` (M) and `db/.gitignore` (D) alongside this story's documentation edits, so a `git commit -a`
  would sweep an environment change into a documentation commit and attribute it to this story.
  evidence: `git status --short` at review time. Handled in this pass by committing explicit paths; recorded because
  the next story inherits the same dirty tree until `md` commits or reverts it.

## Deferred from: code review of 7-7-minor-and-patch-dependency-sweep (2026-08-12)

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the sweep split the Kotlin runtime — `kotlin-stdlib` now resolves to **2.4.0** while the compiler and
  `kotlin-reflect` stay at **2.3.21** — because `arrow-core` 2.2.3 declares `kotlin-stdlib:2.4.0`.
  evidence: `./gradlew :bp_back:dependencies --configuration runtimeClasspath` shows
  `org.jetbrains.kotlin:kotlin-stdlib:2.3.21 -> 2.4.0` alongside `kotlin-reflect:2.3.21`; the running container carries
  `/app/lib/kotlin-stdlib-2.4.0.jar` and `/app/lib/kotlin-reflect-2.3.21.jar`. The POMs confirm the cause:
  `arrow-core-2.2.3.pom` declares `kotlin-stdlib` **2.4.0**, `arrow-core-2.1.2.pom` declared 2.1.21, and
  `ktor-server-core-jvm-3.5.2.pom` declares only 2.3.21 — so Arrow is the sole source. Before the sweep the highest
  request was 2.3.21 and resolution matched the compiler exactly. **AC2 as written still holds** (the declared
  `kotlin` version did not move), but the story's original claim that "no Kotlin artifact moved" did not, and has been
  corrected in the record. Not fixed here: AC1 names Arrow 2.2.3 explicitly so holding it would fail AC1, and a
  `constraints { }` pin is a new build mechanism rather than a version number (S-AC4). The skew is in the supported
  direction and the full backend suite and E2E gate are green under it. Proposed fix: either add
  `dependencies { constraints { implementation("org.jetbrains.kotlin:kotlin-stdlib:${libs.versions.kotlin.get()}") } }`
  to `bp_back/build.gradle.kts` in a dedicated change, or simply let **Story 7.12** dissolve it — that story moves
  `kotlin` with `graphql-kotlin`, and any Kotlin at or above 2.4.0 removes the skew. Whoever does 7.12 should check
  this first: it is the reason a `kotlin` bump there may look like a no-op at the classpath level.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: two more runtime libraries moved silently under the Ktor bump and were not named anywhere in the original
  record — `kotlinx-serialization-core` 1.9.0 → **1.11.0** and `kotlinx-coroutines-core` 1.10.2 → **1.11.0**.
  evidence: same `:bp_back:dependencies` resolution; `ktor-server-core-jvm-3.5.2.pom` declares
  `kotlinx-coroutines-core-jvm:1.11.0`. This matters because the spec's Design Notes §6 explicitly watched for a silent
  serialization change under the **driver** bump, and the hand-written `BsonEncoder`/`BsonDecoder` codecs in
  `mongo/model/serialization/` sit on `kotlinx-serialization` — which moved under **Ktor** instead. Both are covered in
  practice by `ListSharingTest`'s raw-BSON assertion and the full suite, which are green. Proposed fix: declare
  `kotlinx-serialization` and `kotlinx-coroutines` as explicit `[versions]` refs so they stop moving invisibly, or add
  a resolved-version assertion to the backend gate.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the shipped lockfile carries **4 npm advisories (1 moderate, 3 high)** and no closing document mentioned
  them.
  evidence: `npm audit` in `bp_front/` reports `brace-expansion` (high, two DoS advisories),
  `js-yaml 4.0.0 - 4.3.0` (high), `nanoid <3.3.17` (high) and `postcss <=8.5.22` (moderate), with
  `fix available via npm audit fix`. All four are transitive build-time dependencies (`vite`/`postcss` and
  `graphql-config`), none is in the browser bundle's runtime path. The sweep **reduced** the count — `npm install`
  logged `6 (1 moderate, 5 high)` mid-pass and the final state is 4 — but a dependency-currency story should say so
  rather than truncate the audit lines out of its quoted command output. Not fixed here: `npm audit fix` moves
  transitives beyond what any named upgrade requires (S-AC4). Proposed fix: run `npm audit fix` as its own change with
  the full gate behind it, or let Story 7.9's Vite 8 bump clear the `postcss`/`nanoid` chain and re-audit after it.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `graphql-ws` 6.0.8 → 6.2.1 was verified only over `ws://` on plain `http://localhost:2080`; the `wss://`
  path through the TLS edge was not exercised after the bump.
  evidence: the E2E gate ran at the default `baseURL`; `E2E_BASE_URL=https://bag-please.localhost npm run test:e2e`
  was not run in this pass. The subscription transport is exactly what moved, and the TLS run is also the only path
  that exercises the `Secure` + `SameSite=Strict` refresh cookie. Nothing in S-AC1 requires it, so this is not a gate
  miss — but it is the one mode the changed package is least covered in. Proposed fix: run the TLS suite once before
  epic close, when the edge is up.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: the `mobile` project's viewport comes from `devices['Pixel 7']`, which ships **inside** `playwright-core`
  and therefore moved with the 1.61.1 → 1.62.1 bump; nothing pins it.
  evidence: `playwright.config.ts` spreads `devices['Pixel 7']` with no explicit `viewport` override. A descriptor
  change would silently alter what "the mandatory mobile gate" actually tests, and the whole suite would stay green
  either way — the same failure shape as the `browser.newContext()` trap already recorded in `project-context.md`.
  Proposed fix: spread the descriptor and then pin `viewport` explicitly, or assert the resolved viewport once in a
  spec.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: nothing installs Playwright browser binaries automatically, so a future lockfile refresh can re-create the
  runner-versus-binary skew this story had to fix by hand.
  evidence: `@playwright/test` is caret-ranged (`^1.60.0`), there is no `postinstall` script, no CI step and no `mise`
  task that runs `playwright install`; this pass needed a manual `npx playwright install chromium` after the runner
  moved, and the failure mode is `Executable doesn't exist`, which reads as an environment fault rather than a
  dependency change. Proposed fix: add a `postinstall` running `playwright install chromium`, or pin
  `@playwright/test` exactly so the move is always a deliberate manifest edit.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: `graphql-kotlin` 9.3.0 declares `ktor-server-core` 3.2.3 and is force-upgraded to 3.5.2 by the catalog, so
  the shipped pairing is not the one the vendor tested.
  evidence: read from the 9.3.0 POM against the resolved classpath. It is green across `:bp_back:build`, the 115-test
  backend suite and the full E2E gate, and `graphql-java` stayed at 23.1 across 9.2.0 → 9.3.0 (so the four
  `GraphQLError` Java classes were never at risk). Recorded because Story 7.12 takes graphql-kotlin to 10.x and should
  know that the 9.x pairing shipped was already ahead of the vendor's declared Ktor.

- source_spec: `spec-7-7-minor-and-patch-dependency-sweep.md`
  summary: nothing mechanically ties `gradle/wrapper/gradle-wrapper.properties` to the `gradle:<version>-jdk25` base
  image in `bp_back/Dockerfile:1`, which is the coupling the wrapper hold depends on; and no `engines` field ties
  `@types/node` 25.x to the `node:26-alpine` image that builds and runs the frontend.
  evidence: both couplings are conventions held in prose only. Proposed fix: a one-line grep check in the build for
  the Gradle pair, and an `engines.node` field in `bp_front/package.json` for the Node pair — each cheap, each
  currently absent.

## Deferred from: code review of 7-6-backend-safety-fixes (2026-08-12)

Seven findings deferred. Four corrections the review found in the Story 7.6 section above (the idempotence claim, the
inverted cascade-ordering rationale, the "fresh leak path" framing, and the over-general codec rule) were **patched in
place** rather than deferred, and two test defects were fixed in the same pass (the overclaiming test name, and a
cascade test whose stated DECLINED rationale it did not actually exercise).

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `UserService.adminDeleteUser` deletes a user without removing their `list_members` rows, so user deletion is a
  still-open second orphan-leak path that Story 7.6's list-side cascade does not touch.
  evidence: `entity/user/UserService.kt:84` `adminDeleteUser` contains no reference to `ListMemberRepository` — the class
  is not injected at all (verified by grep). The rows it strands carry a **live** `listId`, so the detection query
  recorded with Story 7.6's no-backfill assumption (`list_members.distinct("listId")` vs `lists._id`) cannot see them;
  they need `distinct("userId")` vs `users._id`. Consequence: a phantom member row that still renders in the Share
  dialog and cannot be cleared through `removeMember`, because that path resolves the username to a user that is gone.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `ListService.deleteList`'s four-step cascade is not transactional, so any throw mid-block leaves a live list
  whose children are already deleted — and no ordering of the four statements can fix it.
  evidence: `ListService.kt:117-120` runs four independent Mongo deletes with no session. If `listRepository.delete(id)`
  throws, the list row survives while items, categories and membership rows are gone; moving the membership delete after
  it just swaps which pair is inconsistent. Membership is the worst case because there is no in-memory cache to re-sync
  it from, unlike items/categories. Proposed fix: wrap the block in a single `ClientSession` with a transaction (Mongo 8
  standalone in dev would need a replica set, which is why this is not a drive-by change).

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: a `shareList`/`acceptInvite` landing concurrently with `deleteList` can write a membership row after the
  cascade has run, re-creating exactly the orphan Story 7.6 set out to prevent.
  evidence: `ListService.deleteList` evicts the list from `listStorage` only at `:123` — *after* all four deletes — so a
  concurrent `shareList` still resolves `listStorage.getById(listId)` successfully and upserts into `list_members` in
  the window between `deleteAllInList(members)` and `evictFromCache`. Narrow but real, and it falsifies the unqualified
  form of "the cascade prevents new orphans". Proposed fix: evict from cache *before* the child deletes so concurrent
  callers raise `NotMember` mid-cascade, or take the transaction above.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: AC4's ordering clause ("after the category delete, before the list delete") is pinned by inspection only —
  moving the membership delete after `listRepository.delete` leaves the whole suite green.
  evidence: neither new test observes ordering; `AC-7.6-cascade` asserts only the post-delete row counts, which are
  identical under either order in the success path. Ordering is only observable under a partial failure, which is not
  reproducible without the transaction/fault-injection work above. Recorded so the clause is not mistaken for covered.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `ListSharingTest.connectToDb()` opens a `MongoClient` per call and never closes it, and is now the third copy
  of the hard-coded `test_user`/`test_pass`/`test` credentials.
  evidence: `ListSharingTest.kt:111-121` mirrors `ItemLifecycleTest.kt:158-168`; neither closes the client, so the two
  new tests leak one connection pool each. The repo already contains the correct shape — `utils/TestContainers.kt`
  `setUpRegistration` wraps its client in `try { … } finally { client.close() }`. Proposed fix: promote a single closing
  helper into `utils/TestContainers.kt` and delete both copies. Test-infrastructure only; no production impact.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: the new invariant "`MemberStatus` constant names are byte-identical to the persisted/wire strings" is
  cross-repo, but the frontend half compares bare literals with no compile-time check and no test.
  evidence: `bp_front/src/components/ShareMembersDialog.tsx:174` compares `member.status === 'PENDING'`; the backend
  enum is what produces that string. Story 7.6's closure of Epic-4 entry `811` rests on
  `grep '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` returning zero hits, which is true and which the original
  entry's wording ("typos silently produce broken state") is satisfied by *on the backend side only*. `bp_front/` was
  untouchable in this story by epic rule, so this is correctly out of scope — recorded so the invariant's other half is
  not assumed covered.

- source_spec: `spec-7-6-backend-safety-fixes.md`
  summary: `sprint-status.yaml`'s per-story record is a single ~10,000-character YAML comment line, and the same
  narrative now lives in three documents that have already drifted from each other.
  evidence: the 7.6 entry restates content also held in this ledger's Story 7.6 section and summarised again in
  `project-context.md`. The review found the copies disagreeing on cited line numbers within hours of being written.
  A single unwrapped line is also not reviewable by diff — any edit rewrites the whole line. This is the established
  house convention across Epics 5-7, so changing it is a process decision, not a story fix; recorded for the retro.

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

- ~~Untyped status strings `"PENDING"/"ACCEPTED"/"DECLINED"` — no sealed enum or constants; typos silently produce broken state; pre-existing design choice not introduced by this story~~
  **RESOLVED 2026-08-12 by Story 7.6 — `MemberStatus` is now the domain type; the persisted value stays a `String`.**
  `entity/list/MemberStatus.kt` (`enum class MemberStatus { PENDING, ACCEPTED, DECLINED }`) is `ListMember.status`'s
  type, so all six former literal comparisons — `ListService.kt:152,153,163,164,180,181` — plus
  `GqlListMapper.kt:18` and the two BSON filters at `ListMemberRepository.kt:50,63` are compile-time checked.
  `grep -rn '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` returns **zero** hits. The enum stops at the mapper
  boundary, exactly as `Recurring` does: `MongoListMember.status` and `GqlListMember.status` are both still `String`
  (unchanged in the diff, so the GraphQL SDL did not move), converted with `MemberStatus.valueOf` on read
  (`MongoListMemberMapper.kt:13`) and `.name` on write (`ListMemberRepository.kt:40`, `GqlListMapper.kt:19`). An enum at
  the persistence layer was rejected: `kotlinx-serialization` throws on an unknown enum value and `findActiveByListId`
  feeds six `ListApi` call sites, so one unexpected row would fail the whole `lists` query for every member of that
  list. Two residuals from this change are filed in the Story 7.6 section: the `findByListIdAndUserId` unknown-status
  throw, and the two non-equivalent "active member" predicates.
- `acceptInvite` TOCTOU double-accept race — two concurrent accepts can both pass the `PENDING` check and insert the user's UUID into `List.members` twice; spec-acknowledged acceptable at this scale
- ~~`deleteList` doesn't clean up `list_members` rows — orphaned `list_members` rows accumulate for deleted lists; `getLists` silently drops them via null-map; `deleteList` predates this story~~
  **RESOLVED 2026-08-12 by Story 7.6 — the cascade now removes membership rows, between the category delete and the list
  delete.** `ListMemberRepository.deleteAllInList(listId)` (`deleteMany(Filters.eq("listId", listId.toString()))` — the
  `.toString()` is mandatory, a raw `UUID` filter matches zero documents) is called from `ListService.deleteList`, and
  the cascade comment now reads `items → categories → members → list`. The returned count is discarded on purpose:
  surfacing it on `DeleteListResult` would be a schema change, which Epic 7 forbids. Evidence: the new Kotest test
  `AC-7.6-cascade` (`ListSharingTest.kt:636`) sets up list A with one ACCEPTED and one **DECLINED** row and list B with
  one PENDING row, deletes A through the `deleteList` mutation, and asserts on the **raw** collection that A has 0 rows
  and B still has 1. The DECLINED row is deliberate and was strengthened at review: it is the status
  `findActiveByListId` cannot see, so it is the row a status-filtered `deleteMany` would strand while every API-level
  assertion stayed green. Both breaks were observed red at `:666`: removing the cascade call gives
  `expected:<0L> but was:<2L>`, and narrowing `deleteAllInList` to `status in (PENDING, ACCEPTED)` gives
  `expected:<0L> but was:<1L>` — the stranded DECLINED row, which is the measurement proving that coverage is
  load-bearing rather than decorative. Already-orphaned rows are **not** backfilled, by `md`'s
  2026-07-29 ruling; that assumption and how to detect a future orphan are filed in the Story 7.6 section.
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

- ~~TOCTOU `synced` flag — `private var synced = false` is non-volatile; two coroutines can double-sync on startup; pre-existing pattern in `UserStorage` from story 1.2; affects `ItemStorage`, `CategoryStorage`, and new `ListStorage`~~
  **PARTIALLY RESOLVED 2026-08-12 by Story 7.6 — the visibility half is fixed in all three named classes; the
  check-then-act half is re-filed, not absorbed.** `ItemStorage.kt:13`, `CategoryStorage.kt:13` and `ListStorage.kt:13`
  each now carry `@Volatile` on the flag (with `import kotlin.concurrent.Volatile`, the platform-agnostic form —
  `@Volatile` also resolves without an import on the JVM); these are the first three uses of the annotation in
  `bp_back`, and `grep -rn '@Volatile' bp_back/src/main/` returns exactly 3 hits. Nothing else changed: the
  `if (synced.not()) { … synced = true }` bodies, every `sync()` caller, and `evictList`/`evictFromCache` (which
  deliberately do not reset the flag) are byte-unchanged. **What remains open is the double-sync itself** — the guard
  brackets a *suspending* `repository.getAll()` and sets the flag after the I/O, so two coroutines can still both see
  `false` and both load; `@Volatile` only guarantees that once one writes `true` the others reliably see it. **That
  residual is not benign** — the review established that a stale snapshot can overwrite a newer cached row, so it is a
  correctness gap, not just duplicated startup I/O; it and the `Mutex`-shaped fix are the first entry in the Story 7.6
  section. The `UserStorage`
  ancestor named in `1-2` is gone with the class. **No test:** a JMM visibility guarantee has no deterministic Kotest
  expression — see the coverage note at the end of the Story 7.6 section.
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
- ~~`UserStorage.sync()` check-then-act race — `synced` flag is not atomically guarded; double-sync possible under
  coroutine concurrency; pre-existing in storage layer~~
  **CLOSED 2026-08-12 by Story 7.6 — the named class is gone, and the surviving instances of the pattern are fixed
  here.** `UserStorage` was deleted by Story 2.0, so this entry has had no subject for four epics; it is closed rather
  than left as a phantom. The three classes that inherited the pattern (`ItemStorage`, `CategoryStorage`, `ListStorage`)
  now carry `@Volatile` on the flag — see the `4-1` entry above, which also records the half that is **not** fixed (the
  check-then-act window itself, re-filed in the Story 7.6 section with a `Mutex`-shaped proposal).
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
