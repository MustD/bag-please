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

- **Shared `registrationEnabled` flag races the E2E suite; masked by `retries: 2` rather than fixed.**
  **STILL OPEN — now an Epic 7 story with a decided approach (Epic 6 retro):** keep registration **enabled** as the
  steady state and run the registration-disabled test **non-parallel**, rather than serializing the whole toggle spec.
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

- **`HomeRedirect` sorts `createdAt` lexicographically, so FR38 can send a user to the wrong list.**
  `[...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]` against a backend that emits
  `Instant.toString()`, which omits the fractional part entirely when nanos are zero — so `…:05Z` compares *greater*
  than
  `…:05.100Z` (`'Z'` 0x5A > `'.'` 0x2E) and the earlier list sorts last. ~1-in-1000 per list pair; also makes the FR38
  specs in `navigation.spec.ts` and `shopping.spec.ts` flaky at the same rate. Shipped in Story 5.6, untouched since.
  Fix: compare `Date.parse(createdAt)` numerically, or emit a fixed-precision timestamp. Now an Epic 7 story (Epic 6
  retro action B6).

- **Activating the app-bar home link while already on the resolved home route is a visible no-op that still pushes a
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

- **`global-setup.ts` overlaps `support/api.ts` in all but name.** Its `BASE_URL` is the same literal as `BACKEND`, and
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

- **BUG-E6-1 — `saveItem` re-attributes `addedBy` to whoever edited the item, stealing authorship.**
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

- **BUG-E6-2 — `saveItem` resets `checkedAt` to `null`, clearing the check-off clock the recurring scheduler reads.**
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
  proposed fix: server-side, the same `ItemService.saveItem` change that fixes BUG-E6-1/E6-2 should also reject an
  upsert whose id does not exist (make `saveItem` create-or-update explicitly rather than blind-upsert), and validate that
  `category` still belongs to the list. Client-side alternatives (refetch-before-save, or clearing `editItemTarget` when
  the item leaves `items`) only shrink the race.

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

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`
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
- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md`
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

## Deferred from: code review of 7-2-shared-e2e-support-module (2026-08-08)

- source_spec: `_bmad-output/implementation-artifacts/spec-7-2-shared-e2e-support-module.md`
  summary: `PASSWORD` lives in `support/ui.ts`, so any pure-API consumer must import the runner-importing module to get a
  credential — the exact coupling the two-file split exists to prevent.
  evidence: all seven `loginApi(x, PASSWORD)` call sites pair `./support/api`'s function with `./support/ui`'s constant,
  and `ui.ts` imports `@playwright/test` at the top level. Story 7.3 converges `global-setup.ts` onto `api.ts` and will
  hit this immediately. `PASSWORD` is a bare string literal with no Playwright dependency; moving it to `api.ts`
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
