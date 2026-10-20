# Epic 10 Context: Lighter Screens, a Current Stack and Docs That Earn Their Place

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The two list screens now open straight on their header (the redundant back-to-lists links are removed; navigation is the account menu's Home / My lists entries; Story 10.1, landed). The rest of the epic brings every backend and frontend dependency to its latest stable release or explicitly hold it with recorded evidence (including retries of TypeScript 7 and graphql-kotlin 11), and cut documentation down to what agents and BMAD actually read, verified against the code. It ships as one branch, one retro and one app version.

## Stories

- Story 10.1: The list screens open on their header (done)
- Story 10.2: We know which Jackson writes our GraphQL responses
- Story 10.3: The backend runs on current minor releases
- Story 10.4: graphql-kotlin 10 -> 11
- Story 10.5: The frontend runs on current minor releases
- Story 10.6: vite-plugin-pwa 1 -> 2
- Story 10.7: TypeScript 7, tried again
- Story 10.8: Only documents something reads are kept
- Story 10.9: The agent context files match the code

## Requirements & Constraints

- Navigation requirement (amended, now in force and documented in prd/DESIGN/EXPERIENCE): `/list/:id` and `/lists/:id` have no back link; the app-bar title and account menu (Home, My lists) are the only navigation. No in-page affordance replaces them. All other existing requirements are regression-gated only.
- Every story that ships code: E2E against the production artifact (Caddy-served SPA) on desktop and the 320px floor, UI-driven (fresh user per spec, no login fixture). Nothing may overflow at 320px.
- Regression surface for bumps: auth, refresh cookie flags (`Secure`, `HttpOnly`, `SameSite=Strict`), rate limiting, `/api/health`, subscription JWT expiry, live subscriptions, silent refresh, logout disposing the socket before clearing auth.
- Verification per bump: `./gradlew :bp_back:cleanTest :bp_back:test` totals read from JUnit XML, `npm run lint`, `npm run build`, `npm run test:e2e` on all projects, `npm run generate` byte-check. Every count/version measured in the pass, never quoted. New or changed tests must be observed failing first.
- LAND or HOLD, never forced: no `--legacy-peer-deps`, `--force`, `overrides`/`resolutions`, `.npmrc` change, Gradle `force`/`strictly`, `-Xskip-metadata-version-check` or added `@Suppress` left in the tree. A blocked bump is reverted to byte-identical manifests/lockfiles, recorded verbatim in `deferred-work.md`, and the story still closes `done`.
- Prereleases are never candidates. Registry versions in the epics file are a planning snapshot; re-measure on the day and target any newer stable.
- Docs naming a pinned version are updated in the same commit as the bump. Sprint status reconciled at story close.

## Technical Decisions

- Inherited invariants: per-entity slice layout, one-way GQL -> Service -> Storage -> Repository; existing error classes, no new envelope; codegen regenerated (never hand-edited) with any GraphQL-server change; backend and frontend share one app version (`gradle.properties` = `package.json`).
- One variable per move: minor/patch bumps batch per side (backend / frontend); each major moves alone (a co-mover only if the artifact's published metadata requires it, cited).
- Inventory scope: `gradle/libs.versions.toml`, `bp_front/package.json` (pinned stay exact, ranged stay ranged), Docker base images, `mise.toml` toolchains.
- Jackson question first: Jackson 2 and 3 are both on the runtime classpath; which mapper serialises GraphQL HTTP bodies and WS frames is unmeasured (root `ContentNegotiation { jackson() }` in `Routing.kt`; `JacksonWebsocketContentConverter` in `GQL.kt`, possibly vestigial). Result becomes a rule in `bp_back/CLAUDE.md` plus a Kotest `testApplication` pin.
- graphql-kotlin 11 must preserve the client-visible contract: byte-identical failing-mutation and `FORBIDDEN` bodies (md5 before/after), resolver error prefix `Exception while fetching data (/<field>) : ` (stripped by `bp_front/src/lib/admin/adminErrors.ts`), `extensions.code` of the four `GraphQL*Exception` classes, `graphql-ws` subscriptions, GraphiQL status.
- TypeScript 7: held if `typescript-eslint` peer range still excludes 7.x; refresh the existing Story 7.10 ledger entry in place, run a throwaway forced install and `tsc -b --force` for evidence, restore the tree, never swap the lint stack.
- vite-plugin-pwa 2: keep `registerType: 'autoUpdate'`, `navigateFallback`/denylist for `/api`, empty `runtimeCaching`; `e2e/pwa.spec.ts` (seven tests) passes unchanged; an installed 1.x worker must be replaced cleanly by 2.x.
- Docs cleanup: a file lives only if something reads it (CLAUDE.md/AGENTS.md, BMAD config paths, live planning citations). Fold still-true facts from `docs/` scan output into the right `CLAUDE.md` once, checked against code; delete the rest. Keep `docs/feedback.md`, `prd.md`, `architecture.md`, Epic 9 spine, `ux-epic-8` pair, `epics.md`, `epics-archive.md`. `project_knowledge` must still resolve to an existing meaningful directory via the supported config path. Historical `implementation-artifacts/` records are not rewritten. Each fact lives once, in the most specific file. Stories 10.8/10.9 ship no product code (`git diff --stat bp_front/src bp_front/e2e bp_back` empty; E2E gate not applicable by decision).
- E2E navigation to the lists screen goes through the shared `openListsViaMenu()` in `e2e/support/ui.ts` (`menu-lists`); specs must not re-declare helpers.
- Out of scope unless md pulls in: ConfirmDialog consolidation, `ItemLifecycleTest.kt` split, `bmad-build-auto` resume path, `git_evidence.py` dotted story ids.

## UX & Interaction Patterns

- The shopping view header (`shopping-header`) and list management header are the first content in the page container; no back link exists on either screen and none may be reintroduced.

## Cross-Story Dependencies

- 10.1 has landed, so the E2E suite every later bump is gated against already uses `menu-lists`.
- 10.2 (Jackson measurement) precedes 10.4; 10.3 (backend minors) precedes 10.4 so graphql-kotlin is the only variable.
- 10.5 (frontend minors) precedes 10.6 (PWA major) and 10.7 (TypeScript retry, measured against newest `typescript-eslint`).
- 10.8 and 10.9 run last: version lines are final only after all bumps, and `AGENTS.md` is refreshed against final HEAD (10.9 follows 10.1-10.8).
