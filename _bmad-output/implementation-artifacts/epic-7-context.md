# Epic 7 Context: Item Integrity, a Trustworthy Test Suite & Dependency Currency

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Three data-correctness defects shipped live by explicit prior-epic decision are removed by one server-side change:
editing an item stops stealing the original author's attribution, stops wiping the check-off timestamp the recurring
scheduler reads, and can no longer resurrect a deleted item or strand it under a deleted category. Alongside those,
`/` starts resolving to the genuinely oldest list, and the app-bar home link stops costing a spinner flash and a dead
Back press when the user is already home. Behind the repairs, the epic makes the project's own hard gate trustworthy —
the E2E suite enters the static gates, its duplicated helpers collapse into one module, and a long-tolerated
cross-project race is deleted rather than retried — then brings every direct npm and Gradle dependency current behind
that repaired gate, and finally ships the app as a genuinely installable Android app. The harness and dependency work is
explicitly not claimed as user value; it is what makes the repairs verifiable.

## Stories

- Story 7.1: Bring the E2E suite inside the frontend quality gates
- Story 7.2: Extract one shared E2E support module
- Story 7.3: Delete the `registrationEnabled` race
- Story 7.4: An item edit modifies the stored item instead of reconstructing it
- Story 7.5: Resolve home correctly, and make the home link inert when already home
- Story 7.6: Backend safety fixes riding the same unfreeze
- Story 7.7: Minor and patch dependency sweep
- Story 7.8: `@types/node` 25 → 26
- Story 7.9: Vite 7 → 8 with `@vitejs/plugin-react` 5 → 6
- Story 7.10: TypeScript 6 → 7
- Story 7.11: ESLint 9 → 10
- Story 7.12: `graphql-kotlin` 9 → 10, with Kotlin
- Story 7.13: `graphql` 16 → 17
- Story 7.14: Install Bag Please as a real app
- Story 7.15: Give the dev-auto warnings a measured verdict

## Requirements & Constraints

- **An item save is a merge, not a reconstruction.** Only the fields the item editor sends change; recorded author,
  check-off timestamp, and soft-delete state survive unchanged. Create vs. update is discriminated by *whether the id
  already exists on the target list*, never by whether an id was supplied — the client generates ids for new items too.
  An id found on a different list is an error, not a cross-list move. A category not belonging to the target list is
  rejected rather than written as a dangling reference.
- **Dependency currency at epic close.** Every direct frontend and Gradle dependency is at latest stable or deliberately
  held back with a named blocking symptom recorded in the shared deferred-work ledger — not in an agent rules file. "We
  did not get to it" is not a reason. A held-back major closes its story rather than failing it.
- **The E2E suite is green at zero retries and stays green.** Two consecutive full runs at `retries: 0` pass on both
  desktop and mobile. Measured twice: when the race-fix story claims it, and again at epic close after every major and
  the service worker have landed.
- **The E2E directory is inside both static gates** — lint and the type-check build both cover it.
- **Every backend behaviour change ships test coverage, and every new test is observed failing first** (break the
  guarded behaviour, confirm red on both projects, restore). Applies to backend unit tests as well as browser specs.
- **Dependency upgrades are visually inert.** Theme tokens, the ~360px and desktop layouts, and every existing assertion
  hold unchanged. A rendering difference is an upgrade failure, not cosmetic drift. Verification includes a real-browser
  pass against the production stack, not only a green suite.
- **Each major is independently attributable** — lands, verified green alone, then the next starts. Bundling majors in
  one commit is forbidden. A bump that cannot be made green is reverted with its symptom recorded, never worked around
  or carried forward half-migrated.
- **The service worker never intercepts the API surface.** GraphQL HTTP, auth REST, and the subscription WebSocket
  upgrade are excluded from navigation fallback *and* runtime caching. The concrete trap is the GraphiQL endpoint — a
  navigation that will otherwise be answered with the SPA shell.
- **Installability requires HTTPS, a linked manifest with 192×192 and 512×512 PNG icons, and a registered service worker
  with a fetch handler, simultaneously.** Missing any one silently downgrades to a bookmark shortcut with no error. SVG
  icons do not qualify; a maskable variant with safe-area padding is required or the icon gets letterboxed.

## Technical Decisions

- **The backend freeze ends only in a scoped way.** Only the item-save merge, the backend safety fixes, and the backend
  GraphQL/Kotlin major may touch the backend, each naming the files it may change. A backend need discovered elsewhere
  stops the story and escalates.
- **The save defect family has one cause and one fix,** in the item service: load the stored item by id and list, then
  copy only the fields the GraphQL input carries. The input type is unchanged — **no schema change and no codegen run
  anywhere in this epic.** Check, uncheck, and the scheduler cycle already copy the stored item and are the reference
  pattern; their existing tests are the regression net. Uncheck deliberately clears the timestamp — scheduler contract,
  not the bug.
- **Resurrection is downgraded, not fixed, and that is recorded.** Item delete is a hard delete, so a save against a
  deleted id takes the create branch. After the merge it returns as a genuinely new row (correct author, null timestamp,
  removable via UI) instead of silent corruption. A real fix needs soft-delete tombstones, outside the scoped unfreeze —
  log it in the deferred-work ledger as a severity downgrade with the proposed fix, never close it silently.
- **The E2E directory enters the gates as a third TypeScript project** referenced from the root config, plus a widened
  lint script. Specs are Node-side: Playwright types and Node globals, and the React-refresh export-shape rule must not
  apply to them — a support module full of exported functions is exactly what the next story needs. Expect real
  pre-existing errors in never-type-checked code; fixing them is in scope.
- **The shared support module lands before the race fix, deliberately** — the registration helper carries the race
  workaround, so fixing the race first means fixing it four times. It is a support module, not a login fixture and not
  stored auth state: each spec still registers a fresh user through the UI and asserts only on data it created.
- **The race is deleted, not retried.** One shared application-config document is contended by the concurrently running
  desktop and mobile projects. Registration stays enabled as the steady state; the registration-disabled test gets
  genuine *cross-project* exclusivity (per-file serial mode only serializes within a project). Restore the enabled state
  in a `finally`. Once the race is gone, remove the retry workaround from the shared helper — leaving both makes the
  next flake invisible.
- **Home resolution must compare timestamps numerically.** The current lexicographic compare runs against
  variable-precision instant strings, where a whole-second value sorts *after* a sub-second one. Fix on the frontend by
  parsing to a numeric time; emitting fixed-precision timestamps from the backend is explicitly rejected as a
  wire-format change made to paper over a frontend comparison bug.
- **The home no-op guard lives with the redirect logic, not the app bar** — the app bar must not re-derive the home
  path; expose the resolved path from the redirect component or a shared hook over the same query. The link stays a real
  anchor (Tab-reachable, Enter-activated, exposed as a link), never a button or an imperative navigate. **Inert must
  mean inert-but-present:** never removed, hidden, or disabled.
- **Dependency sequencing is load-bearing.** Build-tool and React-plugin majors are one atomic step (either alone breaks
  the build). TypeScript comes after the E2E gate story so it checks the whole codebase. Lint comes after TypeScript
  because the TS-lint bridge must satisfy both; the set-state-in-effect rule must survive — it is load-bearing for the
  render-phase-adjustment convention. The backend GraphQL major moves *with* the language version (pinned to the newest
  the library supports; the language bump is deliberately excluded from the minor sweep) and lands before the frontend
  GraphQL major so that one verifies against the final schema. The frontend GraphQL major is last and most likely held
  back — it is a simultaneous peer of the client, the WebSocket transport, and both codegen packages; verify all four
  accept it first.
- **The backend safety fixes are three catalogued low-risk items:** volatile the startup sync flags in the three storage
  classes; type invite status as an enum **in the domain model only**, leaving persistence a string (the codebase's
  existing mapper-boundary convention — an enum at the persistence layer would fail an entire common query on one
  unexpected value); and cascade-delete a list's membership rows inside the existing ordered delete block. No backfill
  of already-orphaned rows is in scope.
- **PWA shape:** Vite PWA plugin with auto-update registration; manifest name and short name both the app name;
  standalone display; **both theme and background colour black** to match the dark-only theme, or a white splash flashes
  on every launch. Icons must be generated and committed (the public directory holds only an SVG today). Navigation
  fallback to the SPA shell with the API path denylisted and no runtime API caching. Verify the injected manifest link
  in the *built* output, not the source.
- **Two silent deployment hazards:** set the manifest content type explicitly in the reverse-proxy config rather than
  trusting the base image's MIME table, and assert the served header — a wrong content type kills installability with no
  error. And real-device verification cannot use the TLS edge domain (it neither resolves nor validates on a phone); use
  remote-debugging port forwarding to a localhost origin, which counts as a secure context, and take evidence from the
  DevTools manifest installability panel, not the presence of a menu item.
- **Standing execution conventions:** every user-facing change ships requirement-tagged E2E passing on both desktop and
  mobile against the production image, each flow manually exercised in a real browser first; prior-epic form, feedback,
  and styling conventions apply verbatim, with component-library APIs looked up via the documentation MCP tool rather
  than recalled from older majors; deferred or discovered work goes in the shared ledger; sprint status is reconciled at
  story close; the epic runs on a fresh epic-7 branch.

## UX & Interaction Patterns

- **The item-edit surface gains and loses nothing.** The merge is entirely server-side: the add, edit, and store-field
  components are untouched, and no edit or delete affordance appears on the shopping view. The only visible change is a
  correction — the author avatar stops flipping to whoever last edited, and a checked item edited by a co-member stays
  checked with its clock intact.
- **The home no-op succeeds by being unnoticeable:** no spinner flash, no scroll change, no extra history entry. On
  every other screen the link behaves exactly as previously shipped.
- **The guard must not swallow a real navigation.** From the lists index, a non-home list, change-password, and any
  admin screen the link still navigates through the normal home logic — including the admin case, which resolves to the
  admin screen. Suppression applies only when the resolved destination *is* the current route.
- **Without browser chrome, in-app navigation becomes the app's only exit.** Standalone display removes both URL bar and
  browser back button. Change-password and admin have no back affordance of their own and depend entirely on the app-bar
  title link — and for the admin account the home destination *is* one of them. Hence inert-but-present: a title that
  vanishes on one screen reads as a broken render; one that simply does not navigate reads as "you are already here". No
  error state or recovery path may assume an editable address bar; the existing graceful-redirect branches are the
  recovery mechanism and none may be weakened.
- **Coverage for the chrome-less case is cheap and must not emulate an installed app:** assert history depth after
  landing on the resolved home route, and walk every guarded route asserting each exposes at least one in-app navigation
  affordance.
- **The service worker is invisible.** Auto-update means new deployments are picked up silently on next launch — no
  update toast, reload prompt, or version banner, consistent with the convention that state changes are confirmed by the
  UI changing. No offline mode is in scope and no offline indicator is added.
- The checked-in UX specification documents are stale from an earlier epic onward and do not apply here.

## Cross-Story Dependencies

- Story order is the epic's design, not a preference; each step gates the next.
- 7.2 must precede 7.3, or the race fix lands in four copies.
- 7.3 is the pivot: after it the suite can actually fail, so every later story is verified by a trustworthy gate.
- 7.10 depends on 7.1; 7.11 depends on 7.10; 7.13 depends on 7.12.
- 7.14 depends on 7.9 (the plugin peers on the build tool) and is sequenced after *every* bump so any resulting flake is
  attributable to the service worker alone. It also depends on 7.5's link, which it promotes from convenience to the
  app's only exit.
- The dependency sweep (7.7–7.13) is gated on the repaired harness (7.1–7.3) and re-verifies everything before it.
- 7.4, 7.5, 7.6 and 7.15 are independent of the chain and of each other. No story requires a later one.
- Still deferred after this epic: one-timer and recurring cadence (technical prerequisite discharged here, but the
  requirements themselves are being reconsidered), and list descriptions (needs a new backend field, outside the scoped
  unfreeze).
