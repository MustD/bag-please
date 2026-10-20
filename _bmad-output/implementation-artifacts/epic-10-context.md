# Epic 10 Context: Lighter Screens, a Current Stack and Docs That Earn Their Place

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the two list screens open straight on their header (the back-to-lists links are gone; the account menu's Home / My lists entries and the app-bar title handle navigation). Bring every backend and frontend dependency to its latest stable release, or hold it with recorded evidence (this includes another try at TypeScript 7 and graphql-kotlin 11). Then cut the documentation down to what agents and BMAD actually read, and check what stays against the code. Stories 10.1–10.6 have landed: the links are removed, the Jackson question is settled, backend and frontend minors are current, graphql-kotlin is on 11.0.0 and `vite-plugin-pwa` is on 2.0.0. What is left is the TypeScript 7 retry and the two documentation stories. The epic ships as one branch, one retro and one app version.

## Stories

- Story 10.1: The list screens open on their header (done)
- Story 10.2: We know which Jackson writes our GraphQL responses (done)
- Story 10.3: The backend runs on current minor releases (done)
- Story 10.4: graphql-kotlin 10 -> 11 (done)
- Story 10.5: The frontend runs on current minor releases (done)
- Story 10.6: vite-plugin-pwa 1 -> 2 (done)
- Story 10.7: TypeScript 7, tried again
- Story 10.8: Only documents something reads are kept
- Story 10.9: The agent context files match the code

## Requirements & Constraints

- Navigation (amended, in force): `/list/:id` and `/lists/:id` have no back link. The app-bar title and the account menu (Home, My lists) are the navigation. No in-page affordance may replace them. Every other requirement is regression-gated only.
- Stories that ship code: E2E runs against the production artifact (Caddy-served SPA + backend + Mongo) on desktop and at the 320px floor, UI-driven, with a fresh user per spec and no login fixture. Nothing may overflow at 320px.
- Regression surface for the bumps: PWA install and update, auth, refresh-cookie flags (`Secure`, `HttpOnly`, `SameSite=Strict`), rate limiting, `/api/health`, subscription JWT close-on-expiry, live subscriptions, silent refresh, and logout disposing the socket before it clears auth.
- Verification per bump: `npm run lint`, `npm run build`, `npm run test:e2e` on every Playwright project, and the `npm run generate` byte-check for any GraphQL-server change. Backend totals come from `cleanTest test` JUnit XML. Measure every count and version in the pass, never quote one. Watch any new or changed test fail before accepting it.
- LAND or HOLD, never forced. The tree may not keep any of: `--legacy-peer-deps`, `--force`, `overrides`/`resolutions`, an `.npmrc` change, Gradle `force`/`strictly`, `-Xskip-metadata-version-check`, or an added `@Suppress`. A blocked bump is reverted until manifests and lockfiles are byte-identical, the symptom is recorded verbatim in `deferred-work.md`, and the story still closes `done`.
- Prereleases are never candidates. Registry versions in the plan are a snapshot: re-measure on the day and target any newer stable.
- Docs that name a pinned version are updated in the same commit as the bump. Sprint status is reconciled when a story closes.
- Known E2E flakes from earlier stories (recorded in `deferred-work.md`): the FR60 one-timer subscription-delete test (`shopping.spec.ts:549`, chromium) and a single `[mobile] shopping.spec.ts:476` failure. They exist before 10.6/10.7, so don't read them as regressions from a bump. Re-running to green is the current, weak gate.

## Technical Decisions

- Inherited invariants: per-entity slice layout; one-way GQL -> Service -> Storage -> Repository; the existing error classes, no new envelope; codegen is regenerated, never hand-edited; backend and frontend share one app version (`gradle.properties` = `package.json`).
- Inventory scope: `gradle/libs.versions.toml`, `bp_front/package.json` (pinned stay exact, ranged stay ranged), Docker base images, `mise.toml` toolchains.
- One variable per move: each major moves alone. It may take a co-mover only when the artifact's published metadata requires it, and the requirement is cited.
- Current base for the frontend majors: `typescript` held at `6.0.3`, `typescript-eslint` `^8.72.0`, `vite-plugin-pwa` `2.0.0` (10.6 landed).
- vite-plugin-pwa 2 (10.6):
  - List each breaking change against the options in use: `registerType: 'autoUpdate'`, `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api/]`, empty `runtimeCaching`, manifest and icons.
  - `dist/` must still emit the manifest with Caddy's content type kept correct, `sw.js` at root scope and exactly one manifest link.
  - `e2e/pwa.spec.ts` (seven tests) passes unchanged.
  - Verify the 1.x -> 2.x worker replacement by building 1.x, loading it, rebuilding on 2.x and reloading.
  - A `routing/Caddyfile` change is allowed only inside the story and covered by those tests.
- TypeScript 7 (10.7):
  - Record `npm view typescript version` and the `typescript-eslint` peer range verbatim.
  - If the range admits 7.x, land with a plain install. Change `tsconfig*.json` only where a captured diagnostic forces it, and keep `src/__generated__` excluded.
  - Otherwise HOLD: run a throwaway forced install, capture the install and lint errors and the `tsc -b --force` exit code, then restore the tree (`npx tsc --version` = `6.0.3`, `git status` empty).
  - Update the existing Story 7.10 ledger entry in place. Never swap the lint stack.
- Docs cleanup (10.8):
  - A file stays only if something reads it: a `CLAUDE.md`/`AGENTS.md`, a BMAD config path or skill, or a citation in a live planning document. Record per-file consumers and a verdict (delete / keep / fold-then-delete) in a table.
  - Fold still-true facts from the `docs/` scan output once, into the `CLAUDE.md` whose tree they describe, checked against source. Drop false facts.
  - Keep `docs/feedback.md`, `prd.md`, `architecture.md`, the Epic 9 spine, the `ux-epic-8` pair, `epics.md` and `epics-archive.md`.
  - `project_knowledge` (now `{project-root}/docs`) must still resolve to a meaningful existing directory, changed only through the supported config path and confirmed with `uv run _bmad/scripts/resolve_config.py --project-root .`.
  - Fix live links to deleted files in the same commit. Never rewrite historical `implementation-artifacts/` records.
- Agent context (10.9):
  - Refresh the `AGENTS.md` managed `bmad:context` block with `bmad-project-context`. The Verified line must name HEAD and the date, and content outside the markers is kept.
  - Check the four `CLAUDE.md` files line by line: run each command or confirm its target exists, and match versions to manifests and Dockerfiles. Record each fix or deletion with its evidence in a table.
  - Each fact lives once, in the most specific file that loads where it is needed.
  - Time-bound notes, such as the `./db/data` migration note, are removed or reworded by md's ruling, never silently.
  - Keep `mise.toml` and `.zed/tasks.json` in sync (`sync-zed-mise-tasks`) if any command changes.
- 10.8 and 10.9 ship no product code: `git diff --stat bp_front/src bp_front/e2e bp_back` must be empty, and the E2E gate is recorded as not applicable by decision.
- E2E navigation to the lists screen goes through the shared `openListsViaMenu()` in `e2e/support/ui.ts` (`menu-lists`); specs must not re-declare helpers.
- Out of scope unless md pulls them in: ConfirmDialog consolidation, the `ItemLifecycleTest.kt` split, the `bmad-build-auto` resume path, `git_evidence.py` dotted story ids, and the `SubscriptionScopingTest` / FR60 liveness-race fixes.

## UX & Interaction Patterns

- The shopping view header (`shopping-header`) and the list management header are the first content in the page container; no back link exists on either screen and none may be reintroduced.

## Cross-Story Dependencies

- 10.6 and 10.7 build on the landed 10.5 base. Each moves its single major as the only variable. 10.7 is measured against the newest `typescript-eslint`.
- 10.8 and 10.9 run last because version lines are final only after every bump. 10.9 follows 10.1–10.8 so `AGENTS.md` is refreshed against the final HEAD. Whichever of 10.6/10.7 lands updates any version line that names it (`CLAUDE.md`, `bp_front/CLAUDE.md`, `AGENTS.md`, `architecture.md`) in its own commit; 10.6 found none naming `vite-plugin-pwa`.
- `bp_back/CLAUDE.md`'s "Which Jackson writes what" rule and `JacksonSerializationTest` (from 10.2, re-checked in 10.4) are facts that 10.9 must keep accurate, not re-derive.
