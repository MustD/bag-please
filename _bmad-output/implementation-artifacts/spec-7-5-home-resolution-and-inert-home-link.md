---
title: 'Story 7.5 — Resolve home correctly, and make the home link inert when already home'
type: 'bugfix'
created: '2026-08-11'
status: 'done'
baseline_revision: '45f9073'
final_revision: 'PENDING'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [multiple-goals, oversized] # multiple-goals: the FR38 comparator fix and the FR57 inert-link guard are
# independently shippable; they are kept in one story because the epic scopes them together and both need the same
# resolved-home-path abstraction. oversized: ~3.4k tokens — the measured line numbers, the four existing
# navigation.spec.ts tests that must NOT regress, and the two E2E traps (fabricated list ids get redirected away;
# browser.newContext() voids the mobile gate) are load-bearing and cannot be compressed without losing the facts.
---

<intent-contract>

## Intent

**Problem:** Two shipped frontend defects. (1) `HomeRedirect` picks the oldest list with
`a.createdAt.localeCompare(b.createdAt)` against `Instant.toString()`, which drops the fractional part entirely at zero
nanos — so `…:05Z` sorts *after* `…:05.100Z` (`'Z'` 0x5A > `'.'` 0x2E) and `/` occasionally opens the wrong list
(~1-in-1000 per list pair; FR38). (2) Activating the app-bar title link while already standing on the route `/`
resolves to pushes `/`, flashes `home-redirect-loading`, then `replace`s back to the same route — a spinner blink and a
wasted Back press (FR57).

**Approach:** One shared hook in `src/lib/lists/` resolves the home path from the existing `ListsQuery` using a numeric
`Date.parse` comparator. `HomeRedirect` consumes it in a fetching mode (it owns the redirect); `AppShell` consumes it in
a cache-only observing mode and, when the resolved path equals the current pathname, calls `preventDefault()` on the
anchor's click — the link keeps its `href="/"`, its role, its focusability and its styling, and gains
`aria-current="page"`.

## Boundaries & Constraints

**Always:**
- The comparison is numeric (`Date.parse`). The backend wire format is **not** touched (AR-E7-7 rejects that
  explicitly): `git diff bp_back/` must be empty at close.
- Home resolution has exactly **one** implementation, in the shared hook. `AppShell` may compare the path it is given
  against `useLocation().pathname`; it may **not** re-derive it (AR-E6-7, AR-E7-8).
- Inert means **inert-but-present**: still rendered, still `getByRole('link', {name: 'Bag Please'})`, still
  `href="/"`, still Tab-reachable with a visible focus ring, same type scale/weight/colour, hover underline intact
  (AR-E7-8, NFR-E6-3, UX-DR-E7-2). Never `Button`, `disabled`, `aria-disabled`, `tabIndex={-1}`, hidden, or unmounted.
- Never an imperative `navigate()` for the home link — `RouteGuard` owns auth redirects; the anchor stays declarative.
- The observing consumer must **never issue** the membership-gated `lists` request — `fetchPolicy: 'cache-only'`, the
  same reason `ListDetailPage.tsx:52` uses it. Unknown path ⇒ **not inert** (fail toward navigating, never toward a
  dead control — UX-DR-E7-4).
- Every new test is observed **failing for the right reason** on **both** `chromium` and `mobile` before acceptance,
  with verbatim output in the record. Every negative assertion carries a non-vacuity guard (Epic 6 retro: 6 of 17
  review patches were assertions that could not fail).
- `await` every web-first matcher by hand — type-aware linting is off, so a missing `await` passes both gates.

**Block If:**
- The inert guard cannot be made to suppress navigation without changing the anchor's `href`, role, or focusability
  (i.e. `preventDefault()` in the MUI-`Link`→`RouterLink` onClick chain does not stop react-router). Do not fall back
  to a `Button`, `aria-disabled`, or an imperative `navigate()` — HALT with that symptom.
- Any change under `bp_back/` turns out to be required. The epic's scoped unfreeze does not cover this story.

**Never:**
- No `npm run generate` and no schema change (no operation is added or edited).
- No unit-test framework introduced in `bp_front/` (AC2's vehicle is a Playwright `page.route` interception).
- No `createdAt` values written directly into MongoDB.
- No `toPass` added — the suite has exactly one occurrence (`navigation.spec.ts:100`) and it must stay one.
- No `browser.newContext()` (it does not inherit the project `use` block and silently voids the mobile gate). Use
  `page.context().newPage()` when a fresh history stack is needed — it inherits `use` *and* the refresh cookie.
- No weakening of the graceful-redirect branches (`HomeRedirect`'s error→`/lists`, `ListShoppingPage:233`) — without a
  URL bar they are the only recovery (UX-DR-E7-6b).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Precision pair | two lists, `createdAt` `…:05Z` and `…:05.100Z` | resolves to the `…:05Z` list (5000 < 5100 ms) | none expected |
| Regular user, lists | `lists.length > 0` | `/list/<numerically-oldest id>` | none expected |
| Regular user, none | `lists.length === 0` | `/lists`, `state.welcome` forwarded | none expected |
| Lists query error | `error` truthy | `/lists`, `state.welcome` forwarded (unchanged) | graceful redirect |
| Admin | `role === 'admin'` | `/admin`, query skipped entirely | none expected |
| Resolving | `data` undefined (loading, or cold cache in observe mode) | path `null` → `HomeRedirect` shows the spinner; `AppShell` renders a **live** link | not inert |
| Already home | resolved path `===` `location.pathname` | click/Enter suppressed: no navigation, no history entry, no spinner, scroll unmoved; `aria-current="page"` | none expected |
| Admin on `/admin` | home `=== /admin` | inert **and present** — the route's only in-app affordance besides the user menu (AR-E7-8a) | none expected |

</intent-contract>

## Code Map

All line numbers measured at `45f9073` (clean tree).

**New file:**
- `bp_front/src/lib/lists/homePath.ts` — exports `byCreatedAtAsc(a, b)` (numeric) and
  `useHomePath(mode: 'resolve' | 'observe'): string | null`. Lives in `lib/lists/` beside `listsQueries.ts` and
  `storeValue.ts`; `src/` has no `hooks/` directory and `useAuth` (`lib/auth/AuthContext.tsx:43`) is the only existing
  custom hook, so this is the conventional home. A `.ts` module of named exports — `react-refresh/only-export-components`
  does not apply.

**Change:**
- `bp_front/src/routes/HomeRedirect.tsx` — `:23` `useQuery(ListsQuery, {skip: role === 'admin'})`, `:25` admin branch,
  `:27-33` the `home-redirect-loading` spinner (keep the testid), `:37` error branch, `:39-42` empty branch,
  `:44` **the bug**: `[...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]`. All of it collapses into
  the hook plus one `<Navigate>`; `:19` `welcome` handling stays.
- `bp_front/src/components/AppShell.tsx` — `:1` already imports `type MouseEvent`; `:2` imports from
  `react-router-dom` (add `useLocation`). The title link is `:91-114` (`to="/"` at `:93`, testid at `:97`,
  focus-visible outline `:107-110`, label `:113`), wrapped in the `flexGrow` Box at `:90`. Add the hook call, the
  pathname compare, `aria-current`, and the `onClick` guard. Nothing else in the file changes.
- `bp_front/src/routes/ListShoppingPage.tsx:66-72` — the list-switcher `useMemo` carries the **identical**
  `a.createdAt.localeCompare(b.createdAt)` at `:69`. **Outside the epic's `Files:` line — a recorded deviation, not an
  absorbed one** (see Design Notes). Swap in `byCreatedAtAsc`; the `useMemo`, the `activeList` lookup at `:73` and the
  switcher render at `:283-303` are otherwise untouched.
- `bp_front/e2e/navigation.spec.ts` — 326 lines, 10 tests, prefix `nav`, labels already used:
  `everywhere` `:35`, `styling` `:72`, `keyboard` `:113`, `oldest` `:146`, `nolists` `:170`, `back` `:220`,
  `checkonly` `:236`, `narrow` `:280`. Local helper `titleLink(page)` at `:30-32`; `ADMIN` at `:27`. Six tests are
  added here.
- `bp_front/playwright.config.ts:78-82` — the count comment says `Total: 104` / `51/51/1/1`; reality at `45f9073` is
  **106** / **52/52/1/1**, and this story moves it again. Rewrite it to state the *invariant* (exactly 1 test in each
  `registration-toggle-*` project, everything else in the two viewport projects) plus the figures with a date. Also a
  recorded deviation from the `Files:` line.

**Read-only (must not change):**
- `bp_front/src/lib/lists/listsQueries.ts:44-68` — operation name is **`Lists`** (`:45`), not `ListsQuery`. Selected
  per list: `id name emoji ownerId ownerUsername createdAt members{userId username status}`; sibling
  `pendingInvites{listId listName listEmoji ownerUsername}`. Shape `data.lists.lists`. Typenames the cache requires:
  `ListsResult`, `List`, `ListMember`, `PendingInvite` (`src/__generated__/graphql.ts:74`).
- `bp_front/src/App.tsx:21-31` — every guarded route is inside `RouteGuard` → `AppShell`: `/` `:23`, `/lists` `:24`,
  `/lists/:id` `:25`, `/list/:id` `:26`, `/account/password` `:27`, **`/admin/*`** `:28` (splat; `AdminPage` declares no
  nested routes, so the pathname is `/admin` in practice), `*` → `/` `:30`.
- `bp_front/src/routes/ListDetailPage.tsx:52` — `fetchPolicy: 'cache-only'` with the "never fires its own
  membership-gated request" rationale at `:49-51`: the precedent the observe mode copies. Back link `list-detail-back`
  `:82-90`. `ListShoppingPage.tsx:261-269` back link `list-shopping-back` (testid `:264`); `:290-299` the switcher
  chip's `active ? undefined : onClick` + `aria-current` — the nearest inert-affordance precedent, but a `Chip`, so it
  drops the handler rather than preventing a real anchor's default.
- `bp_front/src/routes/ChangePasswordPage.tsx:40` — `if (role === 'admin') return <Navigate to="/" replace/>`.
  `/account/password` and `/admin` have **no** back affordance of their own (verified: zero `RouterLink`/`navigate`
  hits in either file) — AR-E7-8a confirmed.
- `bp_front/src/lib/apollo/ApolloProvider.tsx:107-110` — no `defaultOptions`, so the default is `cache-first`;
  `:140-151` `clearStore()` on logout (cache cold ⇒ path `null` ⇒ link live, which is the safe direction).
- `bp_front/e2e/support/ui.ts` — `PASSWORD` `:20`, `uniqueUsername` `:22`, `registerViaUi` `:28`, `openListsViaMenu`
  `:51`, `createListAndOpen` `:61` (returns the id), `addCategory` `:73`, `addItem` `:84`; prefix registry comment
  `:16-18` (`nav` already registered — **no registry edit needed**). `e2e/support/api.ts` is not needed by this story.
- `bp_front/e2e/shopping.spec.ts:102-119` — the other FR38 spec; both it and `navigation.spec.ts:145` are flaky at the
  defect's rate today and stop being so after the fix.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the two rollup entries to close: FR38 sort `163-169`,
  home no-op `171-175`; their Story-6.2-review duplicates `1067-1077` and `1088-1097`. The Story 7.2/7.3/7.4 sections
  (`275-362`, `363-406`, `407-520`) **must stay byte-unchanged**.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:115` — key `7-5-home-resolution-and-inert-home-link`.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/` — **baseline first.** `git status --short` empty at `45f9073`. Record `npx playwright test --list`
      total **and** the per-project split (`--list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`; never `--project`,
      which drags in dependencies). Expected 106 and 52/52/1/1 — re-measure, do not quote.
- [x] `bp_front/src/lib/lists/homePath.ts` — new. `byCreatedAtAsc` + `useHomePath` per Design Notes. Branch order is
      load-bearing: admin → error → `!data` → empty → oldest.
- [x] `bp_front/src/routes/HomeRedirect.tsx` — consume `useHomePath('resolve')`. `path === null` renders the existing
      `home-redirect-loading` spinner **with its testid intact**; otherwise one `<Navigate to={path} replace
      state={path === '/lists' ? {welcome} : undefined}/>`. Behaviour must be bit-for-bit the same on all five existing
      branches — confirm `welcome` still reaches `/lists` on both the error and empty paths.
- [x] `bp_front/src/components/AppShell.tsx` — `useHomePath('observe')` + `useLocation()`; `alreadyHome = path !== null
      && path === pathname`; on the `:91-114` Link add `aria-current={alreadyHome ? 'page' : undefined}` and
      `onClick={alreadyHome ? e => e.preventDefault() : undefined}`. Do not touch `to`, `component`, the testid, or the
      `sx` block. Consult `mcp__mui-mcp__fetchDocs` before editing the MUI v9 `Link` — do not recall the API.
- [x] `bp_front/src/routes/ListShoppingPage.tsx:66-72` — replace the inline `localeCompare` with `byCreatedAtAsc`.
      Recorded deviation; state it in the record **and the commit body**.
- [x] `bp_front/` — `npx tsc -b` and `npm run lint` green **before** touching E2E (a spec type error fails the Docker
      image build, not just the gate).
- [x] `bp_front/e2e/navigation.spec.ts` — add the six tests in Design Notes (labels `precision`, `inert`, `inertlook`,
      `nooverfire`, `exits`, plus the admin one). Prefix `nav`; no `test.describe`; no `@registration-toggle` tag (none of
      them writes the registration flag). Five register a fresh user and take `testInfo`; `adminhome` logs in as
      `admin` and therefore takes **no** `testInfo` and no `uniqueUsername`, mirroring `:183` — `tsconfig.e2e.json`
      sets `noUnusedParameters`, so an unused `testInfo` is a build error, not a warning. **Manually exercise both
      flows in a real browser at `:2080` first and say so in the record.**
- [x] `bp_front/playwright.config.ts:78-82` — rewrite the stale count comment as invariant + dated figures.
- [x] `bp_front/` — **rebuild is mandatory** (`src/` changed): `docker compose up -d --build --force-recreate`, then
      `docker compose ps` to confirm the containers were actually recreated. `--build` alone rebuilt the images but
      left stale containers running during Story 7.4, and the `/api/graphiql` readiness poll cannot see that.
- [x] `bp_front/` — **observe every new test red, on both projects.** (a) revert `byCreatedAtAsc` to `localeCompare`
      → `precision` red; (b) revert the `AppShell` guard → `inert`, `inertlook`, `adminhome` red. Capture verbatim
      output for each, restore, and confirm `git diff` is byte-exact to the intended change.
- [x] `bp_front/` — gates in this order, each result recorded: `npx tsc -b`; `npm run lint` (exit 0, zero output);
      `--list` total + per-project split; `npm run test:e2e` green on both projects at `retries: 0`;
      `git diff --stat bp_back/` **empty**; `grep -rn toPass bp_front/e2e/` exactly one hit
      (`navigation.spec.ts:100`); `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/` zero hits.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — new `## Deferred from: Story 7.5 — home resolution and
      the inert home link (2026-08-11)` section immediately after the Story 7.4 section (before
      `## Deferred from: code review of 7-4-…` at `521`). Close all four entries (`163-169`, `171-175`, `1067-1077`,
      `1088-1097`) with the house strikethrough + `Retained for history:` convention, naming this story. File the new
      entries from Design Notes. Verify the 7.2/7.3/7.4 sections are byte-unchanged (md5 before/after).
- [x] `_bmad-output/project-context.md` — the resolved-home-path rule (one implementation, two modes, the cache-only
      observe reason), the inert-but-present contract, and the corrected E2E counts. Rules only; new debt to the
      ledger (NFR-E7-1).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-5-home-resolution-and-inert-home-link: done`,
      refresh `last_updated`, and record the two `Files:`-line deviations.

**Acceptance Criteria:**
- Given the app bar's link and `HomeRedirect` must agree, when the code is inspected, then the oldest-list choice and
  the `/lists`/`/admin` fallbacks exist in exactly one place, `AppShell` derives no path of its own, and
  `git diff bp_back/` is empty.
- Given AC2's precision case cannot be produced through the UI (`createdAt` is server-generated), when the
  `precision` test runs, then it lands on the whole-second list — and its first phase asserts the *unpatched*
  response resolves to the genuinely older list, so the fabrication is proven load-bearing rather than assumed.
- Given AC3, when the title link is activated while standing on the resolved home route, then the URL is unchanged,
  `home-redirect-loading` never appears, `window.history.length` is unchanged, a single `goBack()` returns to the
  *previous* screen, and `window.scrollY` is unchanged — the scroll assertion preceded by `expect(scrollY)
  .toBeGreaterThan(0)` so it cannot pass vacuously.
- Given AC4, when the link is inert, then `getByRole('link', {name: 'Bag Please'})` still resolves, `href` is still
  `/`, a real `Tab` press focuses it with a non-zero `outlineWidth`, `aria-current` is `page`, and its computed
  `fontSize`/`fontWeight`/`textDecorationLine`/`textTransform` match the at-rest contract asserted at
  `navigation.spec.ts:79-93`.
- Given AC5, when the link is activated from `/lists/:id` and from `/account/password` by a user who owns two lists,
  then both navigate to the numerically oldest list — and the four existing navigation tests that activate the link
  from a non-home route (`:112` keyboard, `:145` newer-list, `:169` no-lists, `:183` admin-from-`/lists`) pass with
  **zero edits**. A red one means the guard over-fires.
- Given AC5's admin clause and AR-E7-8a together, when an admin stands on `/admin`, then the link is inert **and
  present** (that is the ruled outcome, not an over-fire), while an admin standing on `/lists` still navigates to
  `/admin` — the two are asserted separately and the single-screen outcome is recorded as deliberate.
- Given AC6, when the `exits` test walks `/lists`, `/lists/:id`, `/list/:id` and `/account/password`, then each
  exposes at least one live in-app navigation affordance, and `window.history.length` on a freshly opened page at `/`
  is asserted (expected `1`; if measurement differs, assert the measured value with a comment stating it).
- Given NFR-E7-4's convention, when the story closes, then each new test has been observed failing for the right
  reason on **both** `chromium` and `mobile` with verbatim output recorded, and the suite is green at `retries: 0`
  with the per-project split showing the new tests in both viewport projects and still exactly 1 in each
  `registration-toggle-*` project.

## Spec Change Log

### 2026-08-11 — implementation pass

**(a) Where the spec's prescriptions held, and where they were wrong on contact.**

Every line number in the Code Map was correct, and every design note in `## Design Notes` was implementable as written —
`homePath.ts` is verbatim the sketched module (plus comments), the `preventDefault()` mechanism worked first try, and all
ten pre-existing `navigation.spec.ts` tests passed with zero edits. The **Block If** conditions did not trigger. Six
claims measured differently:

1. **"`git status --short` empty at `45f9073`" — WRONG.** The planning pass left two uncommitted artifacts: `M
   _bmad-output/implementation-artifacts/sprint-status.yaml` (`7-5-…: backlog` → `ready-for-dev`) and `??` the spec file
   itself. `bp_front/src/` was clean, which is what the baseline was actually protecting, so this was not treated as a
   blocker. Recorded because a literal reading of that task fails immediately.
2. **`--list` baseline — CORRECT.** 106 / 52+52+1+1, as predicted. Post-change **118 / 58+58+1+1**, also exactly as
   predicted.
3. **`grep -rn "localeCompare" src/` must return "exactly three" hits — WRONG, it returns FOUR.** The three legitimate
   *name* sorts are all present but two moved by +1: `components/StoreField.tsx:37` (unchanged),
   `routes/ListShoppingPage.tsx:209` (spec said `:208`) and `routes/ListShoppingPage.tsx:326` → **`:327`** — the shift is
   this story's own edit, which is net +1 line in that file. The fourth hit is the **word `localeCompare` inside a
   comment** in the new `homePath.ts:13`, which explains the defect being fixed. `grep -rn "createdAt.localeCompare"
   src/` is zero, which is the assertion that actually matters.
4. **AC6's "expected `1`" history depth — WRONG; measured `2`, on both projects and for both a regular user and admin.**
   A freshly opened Playwright page starts on `about:blank`, so `goto('/')` is the second entry; the `/` → `/list/:id`
   redirect adds none, which is the property under test. The spec explicitly permitted this ("if measurement differs,
   assert the measured value with a comment stating it"), so `exits` asserts `2` with the reason inline — and the
   assertion was proven non-vacuous by changing `<Navigate replace>` to a push, which makes it `3`.
5. **The spinner half of the FR57 symptom could NOT be reproduced.** Both the Intent and the ledger describe the no-op as
   "flashes `home-redirect-loading`". It does not: standing on the resolved home route means the `Lists` cache is warm,
   so the round trip renders no spinner. Measured — with the guard removed, `home-redirect-loading` has count 0 in every
   one of the six affected runs, and the `inert` test's spinner assertion **passes unguarded**. The real, discriminating
   symptom is the wasted history entry (5 → 6). The spinner assertions were kept (they cost nothing and pin the
   already-warm-cache behaviour) but they are explicitly *not* what the fix is verified by, and the record says so where
   it matters. The ledger closure carries the correction.
6. **Design note 3's "stand on the resolved home route as above" for `inertlook` — NOT USABLE as written.** "As above"
   means arriving by clicking the title link, which leaves the **pointer over the anchor**; with `underline="hover"` the
   at-rest contract then reads `textDecorationLine: 'underline'` and AC4 fails for a reason unrelated to this story.
   `inertlook` therefore arrives by `goto('/list/:id')` (the click-in path is covered by `inert`), with the reason in a
   comment.

**A seventh finding is a defect in the spec's own test design, not just a number.** Design note 3 specifies for
`inertlook`: "then `press('Enter')` and assert the URL is unchanged and no spinner appeared." **Those two assertions
cannot fail.** Measured: with `preventDefault()` removed but `aria-current` kept, `inertlook` went **green** — Enter
pushes `/`, `HomeRedirect` `replace`s straight back to the same route off a warm cache, so the URL is unchanged and no
spinner ever renders. This is precisely the Epic-6 retro anti-pattern (an assertion that cannot fail for the reason it
was written) and it survived into the spec. Fixed by adding a `window.history.length` comparison around the Enter press,
after which the test is red on both projects. Any future spec that asserts "activation did nothing" on a route that is
its own redirect target must assert history depth; URL and spinner are both insensitive.

**(b) Deviations from the epic's `Files:` line — stated, not absorbed.**

Two, both anticipated by the spec, and no others. No file outside them was touched; `git diff --stat bp_back/` is empty.

1. **`bp_front/src/routes/ListShoppingPage.tsx`** — its `:69` carried the *identical*
   `a.createdAt.localeCompare(b.createdAt)` against the same field, ordering the switcher chips the user reads as "which
   list is first". Shipping a numeric comparator while leaving its twin two files away is the half-fix the epic forbids
   ("never worked around or carried forward half-migrated"). Swapped to `byCreatedAtAsc`; the `useMemo`, the `activeList`
   lookup and the switcher render are untouched. It is **not structurally forced** — that is exactly why it is recorded
   here, in `sprint-status.yaml` and in the commit body rather than absorbed. No test covers chip order and none was
   added.
2. **`bp_front/playwright.config.ts`** — its count comment claimed `Total: 104` / `51/51/1/1`, already stale at 106
   before this story and moved again by it. Rewritten as the *structural invariant* (exactly one test in each
   `registration-toggle-*` project, everything else split across the two viewport projects, so a new spec is +2) plus
   three dated figures (7.3: 104 = 51/51/1/1; 7.4: 106 = 52/52/1/1; 7.5: 118 = 58/58/1/1) and the reason the total
   proves nothing (the tag **reroutes** a test rather than duplicating it, so dropping it leaves the total unchanged).

**(c) What the spec did not anticipate, for whoever comes next.**

- **`fetchPolicy: 'cache-only'` makes the inert state unreachable after a full page load on any route that does not
  query `Lists`.** This is not a bug — it is UX-DR-E7-4's fail-toward-navigating direction working — but it has a direct
  consequence for test authors that the spec did not state: **a test that means to exercise the inert state must arrive
  at the route through in-app navigation, or warm the cache first; a `goto` is not equivalent.** It was measured, not
  reasoned: under a deliberately over-firing guard, three of the four existing link-activating tests went red on both
  projects while `FR38 — activating the title link with no lists lands on the lists index` stayed **green**, because it
  reaches `/account/password` by a full page load and nothing there queries `Lists`, so the observed path is `null` and
  the link is live regardless of the guard. Filed in the ledger.
- **Reverting the guard wholesale is a weaker red observation than it looks.** Removing both `aria-current` and the
  `onClick` makes `inertlook` and `adminhome` fail on the *attribute* assertion, which sits before their behavioural
  ones — so the suppression itself is never exercised. A second, narrower revert (keep `aria-current`, drop only the
  `onClick`) is what actually proved those two tests. A future story breaking a guard that has both a visible marker and
  a behaviour should break them **separately**, or the behavioural half is unverified.
- **One full-suite run went red immediately after `docker compose up -d --build --force-recreate` and could not be
  reproduced** — three `mobile` `admin.spec.ts` tests (`:110`, `:145`, `:219`), on the first traffic against the
  freshly recreated stack; the next three consecutive full runs were `118 passed`, 0 flaky, and three isolated
  `admin.spec.ts --project=mobile --no-deps` runs passed 4/4 each. **Its failure text was not captured** (output was
  `tail`-ed and the next green run overwrote `test-results/`). Filed in the ledger with that limitation stated. Practical
  lesson: pipe full-suite output through `tee` before reading it, because the following run destroys the evidence.
- **`cp` is aliased to `cp -i` in this shell.** A `cp` used to stash/restore a file during a red observation blocks
  forever on an invisible overwrite prompt. Use `/bin/cp -f`. (A `pkill -f` aimed at the stuck job also killed the
  calling shell — the loop is best avoided rather than escaped.)
- **`route.fulfill({response, json})` is the right shape for a response patch here** and needs no header or
  content-encoding handling; `Instant`-precision fabrication needed no fabricated typenames or ids, exactly as the spec
  predicted.


## Review Triage Log

### 2026-08-11 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 1, medium 3, low 5)
- defer: 5: (high 0, medium 1, low 4)
- reject: 6
- addressed_findings:
  - `[high]` `[patch]` **Two of the six new tests raced a window the implementation legitimately leaves open, and one
    failed 2 of 6 isolated runs.** `useHomePath('observe')` is `cache-only` and `ListShoppingPage.tsx:228` computes its
    `loading` flag from items/categories only, so `list-shopping-page` — and the app bar with it — renders *before* the
    lists query resolves; for ~100ms `aria-current` is absent and the link is correctly live. `inertlook` pressed Enter
    inside that window. Fixed by synchronising on the auto-retrying
    `expect(app-bar-home).toHaveAttribute('aria-current','page')` in both `inertlook` (after its second, fresh `goto`)
    and `inert`, rather than by relaxing an assertion. Re-measured: **8/8** isolated runs green, and two consecutive
    full runs `120 passed` at `retries: 0`. Routed as `patch` not `bad_spec` deliberately: the implementation is
    contract-conformant (the I/O matrix specifies a live link while resolving), the code's shape is right, and the
    defect was one missing synchronisation point — re-deriving 500 lines from an amended spec would have produced the
    same code. The residual *product* question (should the window be closed at all?) is not patchable without
    contradicting `<intent-contract>`, so it is deferred to `md` rather than decided here.
  - `[medium]` `[patch]` Modified clicks were swallowed: `preventDefault()` fired for Ctrl/Cmd/Shift/Alt+click too, so
    "open home in a new tab" silently died — while middle click, which dispatches `auxclick` and never reaches React's
    `onClick`, still worked. Two mouse gestures, two behaviours, same intent. Now guarded with
    `event.button === 0 && !metaKey && !ctrlKey && !shiftKey && !altKey`, matching react-router's own `Link`. Enter
    still suppressed (keyboard activation dispatches a click with `button === 0`), which `inertlook` proves.
  - `[medium]` `[patch]` `byCreatedAtAsc` was not a total comparator. `Date.parse` returns `NaN` for an unparseable
    `createdAt` (`String` on the wire — nothing enforces `Instant.toString()`), and a `NaN` comparator makes the
    ordering of the *whole* array implementation-defined; it also truncates to milliseconds where the string compare it
    replaced saw nanoseconds, so same-millisecond lists now tie. Fixed: unparseable values sort last, and `id` breaks
    ties so `/` resolves to the same list on every load.
  - `[medium]` `[patch]` The third home outcome had no coverage: a zero-list user standing on `/lists`, which *is* their
    resolved home, and the route with no back affordance of its own. Added a seventh test (`inertindex`) and observed it
    **red on both projects** with the guard disabled (`Expected: "page" / Received: ""`), then green after restore.
  - `[low]` `[patch]` The path compare was byte-exact, so a trailing slash (`/lists/`, which react-router matches to the
    `/lists` route) silently dropped the guard. Now compared with trailing slashes trimmed.
  - `[low]` `[patch]` The FR38 interception never verified it fired — a future batched or persisted-query transport would
    fall through `route.continue()` and fail phase 2 with a message blaming the comparator. Added a hit counter asserted
    non-zero.
  - `[low]` `[patch]` `route.fetch()` can reject when Apollo aborts an in-flight query on unsubscribe, which would fail
    the test as an unhandled rejection. Now wrapped in try/catch with `route.abort()`.
  - `[low]` `[patch]` `route.fulfill({response: res, json: body})` re-serialised the body while inheriting the upstream
    `content-length`/`content-encoding`. Works today; breaks as an opaque decode error the moment Caddy compresses
    `/api/graphql`. Now explicit `status` + `contentType` + `body`.
  - `[low]` `[patch]` Three comments overclaimed or had gone stale: `navigation.spec.ts`'s header still said home
    resolution "lives in HomeRedirect"; `HomeRedirect`'s new header claimed the app bar "observes the same answer"
    without the cache-only caveat; and `AppShell` documented `null ⇒ live link` as simply "the safe direction" without
    naming the cold-start window it creates. All three corrected, and `playwright.config.ts`'s dated figures moved to
    `120 = 59 / 59 / 1 / 1`.

  Rejected (recorded so they are not re-raised): the welcome-forwarding magic string **is** covered
  (`account.spec.ts:103`, FR5, passing); ignoring `search`/`hash` is **unreachable** (`useSearchParams` exists only in
  `AuthPage`, outside `RouteGuard`); the comparator's lack of a unit test is a project-wide constraint the spec
  explicitly forbade changing; `history.length).toBe(2)` is brittle but measured, documented, and proven discriminating
  by red-observation R4; the comment volume matches this codebase's established convention; and `error && data` both
  being present preserves the *pre-existing* branch order exactly, as required.

## Design Notes

### `homePath.ts`

```ts
export function byCreatedAtAsc(a: {createdAt: string}, b: {createdAt: string}): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

// `mode` decides whether this consumer may ISSUE the membership-gated lists request:
//   'resolve' — HomeRedirect, which owns the redirect: default cache-first, fetches.
//   'observe' — AppShell's title link, which only decorates an answer that already
//               exists: cache-only, so the app bar never fires its own request
//               (same reason as ListDetailPage.tsx:52). Cold cache ⇒ null ⇒ live link.
export function useHomePath(mode: 'resolve' | 'observe'): string | null {
  const {role} = useAuth()
  const isAdmin = role === 'admin'
  const {data, error} = useQuery(ListsQuery, {
    skip: isAdmin,
    fetchPolicy: mode === 'observe' ? 'cache-only' : 'cache-first',
  })
  if (isAdmin) return '/admin'
  if (error) return '/lists'
  if (!data) return null                 // loading, or an empty cache in observe mode
  const lists = data.lists?.lists ?? []
  if (lists.length === 0) return '/lists'
  return `/list/${[...lists].sort(byCreatedAtAsc)[0].id}`
}
```

`!data` **must** precede the empty check: without it a cold cache in observe mode yields `[]` → `/lists` → the link
goes inert on `/lists` for a user who actually has lists. `null` is the only safe unknown, and it maps to "spinner" in
`HomeRedirect` and "live link" in `AppShell` — the two correct answers.

`state={path === '/lists' ? {welcome} : undefined}` is exactly equivalent to today: `welcome` is forwarded on the error
and empty branches (both `/lists`) and on neither the admin nor the oldest-list branch.

### The inert guard

`preventDefault()` on the anchor's click is the whole mechanism: react-router 7's `Link` calls the caller's `onClick`
first and skips its internal navigation when `event.defaultPrevented`, and Enter on an anchor dispatches a click, so
keyboard activation is covered by the same line. Nothing about the element changes — which is why all ten existing
`navigation.spec.ts` tests keep passing: `href="/"` is asserted on four screens (`:42`, `:47`, `:54`, `:62`, `:200`)
and resolved to `/` at `:65-68`, and test 1 already stands on a route that *is* home (one list) at `:52-54`. Any
implementation that swaps the element, sets `aria-disabled`, or drops the `href` breaks `titleLink()` at `:30-32` and
cascades through tests 1, 3, 4, 5, 6 and 9. If `preventDefault` turns out not to stop react-router here, that is the
**Block If** — do not substitute a `Button` or an imperative `navigate()`.

`aria-current="page"` is the only added attribute; it is how the inert state is exposed to assistive technology
without changing the role, and it mirrors the switcher chip's idiom at `ListShoppingPage.tsx:297`.

### The `ListShoppingPage` deviation

`:69` is the same expression against the same field, and it orders the switcher chips the user reads as "which list is
first". Shipping a numeric comparator while leaving its twin two files away is the half-fix this epic forbids
("never worked around or carried forward half-migrated"), and the ledger entry at `deferred-work.md:167-168` already
names both FR38 specs as collateral of the one defect. It is **not** structurally forced, so it is recorded as a
deviation from the epic's `Files:` line in the spec record, `sprint-status.yaml` and the commit body — the same
treatment Story 7.4 gave `GQL.kt` and `ItemRepository.kt`. No test covers chip order; none is added.

### The six tests (all in `navigation.spec.ts`, prefix `nav`)

> **Amended by the 2026-08-11 review pass — read this before following the recipes below.** There are now **seven**:
> the review added `inertindex` (a zero-list user on `/lists`, the third home outcome, which none of the six reached).
> And every test that asserts the inert state must first **synchronise** on
> `expect(app-bar-home).toHaveAttribute('aria-current','page')` — an auto-retrying matcher — because the app bar
> observes the lists cache only and renders before that cache is filled. Recipes 2 and 3 below omitted that wait and
> raced the window; `inertlook` failed 2 of 6 isolated runs as written. See the Review Triage Log.

1. **`precision`** — `FR38 — the oldest list is chosen numerically: a whole-second createdAt beats a sub-second one`.
   Create list A then list B through the UI (A genuinely older). **Phase 1:** `goto('/')`, assert `/list/${aId}$` —
   the non-vacuity anchor, proving the comparator reads real data. **Phase 2:** install
   `page.route('**/api/graphql', …)`; parse `request.postData()` as JSON and act only when
   `operationName === 'Lists'`, else `route.continue()`. Inside, `const res = await route.fetch()`, read the JSON, and
   **patch only the two `createdAt` values** — A → `'2026-01-01T00:00:05.100Z'`, B → `'2026-01-01T00:00:05Z'` — then
   `route.fulfill({response: res, json: body})`. Every other field stays genuine, so no fabricated typenames or ids
   are needed and the cache is satisfied. `goto('/')` again and assert `/list/${bId}$`. Patching the *later*-created
   list to be the numerically older one inverts the real order, so a test that silently missed the interception lands
   on A and goes red. **Do not fabricate list ids** — `/list/<unknown id>` is FORBIDDEN for a non-member and
   `ListShoppingPage` redirects to `/lists`, which would race the URL assertion. `page.unroute` at the end.
2. **`inert`** — AC3. Register → `openListsViaMenu` → `createListAndOpen` → `addCategory` → three `addItem` calls →
   click the title link from `/lists/:id` (a real navigation) to arrive on `/list/:id`, which **is** home.
   `setViewportSize({width: 360, height: 400})` (precedent `:286`) → `scrollTo(0, document.body.scrollHeight)` →
   `expect(scrollY).toBeGreaterThan(0)` **first** (if this fails, the scroll container is not the document — find it,
   do not delete the assertion). Read `history.length`, click the title, then assert: URL unchanged,
   `home-redirect-loading` `toHaveCount(0)`, `scrollY` equal to before, `history.length` equal to before. Then
   `goBack()` → `/lists/${listId}$` with `list-detail-back` visible: the Back press reaches the *previous* screen,
   which is the FR57 symptom. Without the guard the click pushes `/` (length +1) before `<Navigate replace>` swaps it,
   so both the length and the `goBack` assertions discriminate.
3. **`inertlook`** — AC4. Stand on the resolved home route as above (one list, no items needed). Assert
   `titleLink(page)` visible, `href` `/`, `aria-current` `page`, and the `:79-93` at-rest computed-style contract.
   Then a **fresh** `goto('/list/${id}')` before `keyboard.press('Tab')` → `toBeFocused()` and `outlineWidth` not
   `'0px'` — the fresh load is mandatory for the same reason `:119-127` documents (Chromium keeps the
   sequential-focus origin at the last-interacted element, so only a real Tab press after a fresh load yields
   `:focus-visible`). Then `press('Enter')` and assert the URL is unchanged and no spinner appeared.
4. **`nooverfire`** — AC5. Two lists. From `/lists/${newerId}` click the title → `/list/${oldestId}$`. Then user menu
   → `menu-change-password` → from `/account/password` click the title → `/list/${oldestId}$`. Both routes are
   uncovered today; existing tests 3/4/5/6 cover `/lists`, a non-home list, no-lists change-password, and admin.
5. **`adminhome`** — AC5's admin clause + AC6's admin case. Log in as `ADMIN` (`:27`) through the `login-*` testids as
   `:186-196` does, reach `/admin` via `user-menu-button` → `menu-admin`. Assert the title link visible, `href` `/`,
   `aria-current` `page`; record `history.length`, click, and assert the URL is still `/admin$`, `admin-page` visible,
   `history.length` unchanged, no spinner. Comment that this inert-on-`/admin` outcome is AR-E7-8a's *ruled*
   behaviour — admin's app is one screen and `ChangePasswordPage.tsx:40` bounces admin away — which is exactly why the
   link must stay present.
6. **`exits`** — AC6. One list. Walk `/lists`, `/lists/:id`, `/list/:id`, `/account/password` and assert on each that
   `user-menu-button` is visible plus the route's own affordance where it has one (`list-detail-back`,
   `list-shopping-back`). Then the launch-depth check: `const fresh = await page.context().newPage()` →
   `fresh.goto('/')` → `list-shopping-page` visible → `expect(await fresh.evaluate(() => window.history.length))
   .toBe(1)` → `fresh.close()`. Use `context().newPage()`, **not** `browser.newContext()`: it inherits the project's
   `use` block (so the mobile gate is real) and shares the refresh cookie (so the session restores). Comment both
   reasons.

### New ledger entries

1. **`/lists` for a user with no lists is a route whose only exits are the user menu and creating a list** — the
   title link is correctly inert there and no back affordance exists. Harmless today; named because Story 7.14 removes
   browser chrome and the `exits` test asserts the user menu as the affordance of record.
2. **Nothing mechanically prevents a third `createdAt` sort site** from reappearing with `localeCompare`. Two exist
   today and both move to `byCreatedAtAsc`; a lint rule or a shared-comparator convention is the real guard.
3. **`/admin/*` is a splat route, so an admin on a hypothetical `/admin/<sub>` would see a live title link** that
   navigates to `/admin`. Correct behaviour, but the pathname equality is exact — worth knowing before `AdminPage`
   gains nested routes.
4. **The observe mode is cache-only, so on a cold cache the link is briefly live on the route it will resolve to** —
   one wasted click in a window measured in milliseconds, chosen deliberately over the app bar issuing its own
   membership-gated request (UX-DR-E7-4's fail-toward-navigating direction).

## Implementation Record

Baseline `45f9073`. Frontend only — `git diff --stat bp_back/` is empty (verified, see gates).

### Changes per file

- **`bp_front/src/lib/lists/homePath.ts` (NEW, 56 lines).** `byCreatedAtAsc(a, b)` → `Date.parse(a.createdAt) -
  Date.parse(b.createdAt)`, and `useHomePath(mode: 'resolve' | 'observe'): string | null` exactly as sketched: branch
  order admin → error → `!data` → empty → oldest, `skip: isAdmin`, `fetchPolicy: mode === 'observe' ? 'cache-only' :
  'cache-first'`. Comments state why `!data` must precede the empty check, why observe is cache-only (the
  `ListDetailPage.tsx:52` precedent) and why `null` ⇒ live link.
- **`bp_front/src/routes/HomeRedirect.tsx`** (35 lines changed → net −7). Now `useHomePath('resolve')` plus one
  `<Navigate to={path} replace state={path === '/lists' ? {welcome} : undefined}/>`; `path === null` renders the existing
  `home-redirect-loading` Box **with its testid, sx and CircularProgress byte-identical**. Dropped imports: `useQuery`,
  `ListsQuery`, `useAuth`. Branch equivalence confirmed by reading, not assumed: admin still short-circuits before any
  spinner; `welcome` still reaches `/lists` on both the error and the empty branch and on neither the admin nor the
  oldest-list branch (`state={undefined}` is identical to omitting the prop). One knowingly-accepted difference: the old
  code checked `loading` *before* `error`, the hook checks `error` before `!data`, so a hypothetical
  `loading && error` render would now redirect instead of spinning. Unreachable in practice — the component unmounts on
  redirect and never refetches.
- **`bp_front/src/components/AppShell.tsx`** (+29/−4). Added `useLocation` to the existing `react-router-dom` import, the
  `useHomePath` import, `const {pathname} = useLocation()`, `const homePath = useHomePath('observe')`,
  `const alreadyHome = homePath !== null && homePath === pathname`, and on the title `Link` exactly two new props:
  `aria-current={alreadyHome ? 'page' : undefined}` and
  `onClick={alreadyHome ? (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault() : undefined}`. `to`,
  `component`, `variant`, `color`, `underline`, the testid and the entire `sx` block are untouched; the rest of the file
  is untouched. `MouseEvent` was already imported at `:1`.
- **`bp_front/src/routes/ListShoppingPage.tsx`** (+5/−4). Recorded deviation: `:69`'s inline `localeCompare` replaced with
  `byCreatedAtAsc` (new import), plus a three-line comment naming it as the second copy of the FR38 defect. `useMemo`,
  `activeList` and the switcher render untouched.
- **`bp_front/e2e/navigation.spec.ts`** (+313). Six new tests appended (prefix `nav`, labels `precision`, `inert`,
  `inertlook`, `nooverfire`, `adminhome`, `exits`), no `test.describe`, no `@registration-toggle` tag, no new `toPass`.
  `adminhome` takes `{page}` only. **The ten existing tests are byte-unchanged** (`git diff` shows only appended lines
  plus the one edit inside the new `inertlook`).
- **`bp_front/playwright.config.ts`** (+18/−9). Recorded deviation: the stale count comment rewritten as invariant +
  dated figures.
- **MUI v9 API confirmed via the MCP tools before editing** (`useMuiDocs` → `api/link.md` + `react-link.md` at 9.3.1;
  installed 9.0.0): `Link` inherits Typography's props and forwards unlisted props to the root element, so `onClick` and
  `aria-current` reach the `RouterLink`. The `preventDefault()` mechanism was verified in the shipped router source
  before relying on it — `react-router/dist/development/chunk-KS7C4IRE.mjs:10552-10557`:
  `function handleClick(event) { if (onClick) onClick(event); if (!event.defaultPrevented) { internalOnClick(event); } }`.
- Docs/ledger: four `deferred-work.md` entries closed with the house strikethrough + `Retained for history:` convention
  (both rollups and both Story-6.2-review duplicates), a new `## Deferred from: Story 7.5 …` section inserted immediately
  before the 7-4 code-review section with five entries; `project-context.md` gained the two rules and the corrected
  counts (`rule_count` 85 → 87); `sprint-status.yaml` set to `done` with both deviations named, `last_updated` refreshed,
  and Epic-6 retro action **B6 closed** with its one scope correction (it named only `HomeRedirect`; there were two
  copies).

**The 7.2 / 7.3 / 7.4 ledger sections are byte-unchanged — verified by content, not by line range.** (The spec's
`md5 275-362 / 363-406 / 407-520` recipe is unusable once entries are closed above line 275, which shifts every later
line.) Section-by-section comparison against `HEAD`: `## Deferred from: Story 7.2 …`, `## Deferred from: Story 7.3 …`,
`## Deferred from: Story 7.4 …` and `## Deferred from: code review of 7-4-… ` all **UNCHANGED**; the only changed
sections are the two that had to change — `## Epic 5 close-out — carried forward` (the two rollups) and
`## Deferred from: code review of 6-2-… ` (the two duplicates); one heading added, none removed.

### Gate results (verbatim)

`npx tsc -b` — no output at all, exit 0:

```
=== npx tsc -b ===
EXIT: 0
```

`npm run lint` — exit 0, no findings (only the npm script banner):

```
=== npm run lint ===

> bp_front@0.16.0 lint
> eslint .

EXIT: 0
```

`npx playwright test --list | tail -1`:

```
Total: 118 tests in 10 files
```

`npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — **measured** (baseline at `45f9073` was
`52 / 52 / 1 / 1 = 106`, as the spec predicted):

```
     58 chromium
     58 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile
```

`docker compose up -d --build --force-recreate && docker compose ps` — containers genuinely recreated every time
(`--build` alone was never used):

```
NAME                    IMAGE                 COMMAND                  SERVICE    CREATED         STATUS
bag-please-bp_back-1    bag-please-bp_back    "/app/bin/bp_back"       bp_back    9 seconds ago   Up Less than a second
bag-please-bp_front-1   bag-please-bp_front   "caddy run --config …"   bp_front   7 seconds ago   Up Less than a second
bag-please-mongo-1      mongo:8               "docker-entrypoint.s…"   mongo      9 seconds ago   Up 6 seconds (healthy)
```

`npm run test:e2e` at `retries: 0` — **four full runs. Run 1 red, runs 2–4 green:**

```
run 1:   3 failed
             [mobile] › e2e/admin.spec.ts:110:1 › FR16/FR17 — admin resets a user password via the confirm dialog; new password works, old fails
             [mobile] › e2e/admin.spec.ts:145:1 › FR15/FR17 — admin deletes a user via the confirm dialog; the row disappears
             [mobile] › e2e/admin.spec.ts:219:1 › FR30/FR31 — a non-admin has no Admin menu item and is redirected from /admin
         2 did not run
         113 passed (43.9s)
run 2:   118 passed (57.8s)
run 3:   118 passed (57.9s)
run 4:   118 passed (58.5s)
```

**Honest reading of run 1:** it was the first traffic against a stack recreated seconds earlier. Not reproducible —
three isolated `npx playwright test admin.spec.ts --project=mobile --no-deps` runs passed `4 passed (11.5s)` each, and
the three subsequent full runs were clean with 0 flaky. **The failure text was not captured** (console output was
`tail`-ed and the following green run overwrote `test-results/`), so no cause can be named; suspected JVM/Mongo cold
start under 118 concurrent tests, unverified. It is **not attributable to this change** — observe mode issues no
request and `admin.spec.ts` never touches the title link — but it is filed in the ledger rather than dismissed, because
"green at zero retries" is the epic's own hard requirement. The "2 did not run" is the documented `dependencies`
consequence, not a skip.

`git -C .. diff --stat bp_back/` — **empty output** (nothing printed).

`grep -rn "toPass" e2e/` — exactly one hit, unchanged:

```
e2e/navigation.spec.ts:100:  }).toPass({timeout: 2000})
```

`grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" e2e/` — **zero hits** (nothing printed).

`grep -rn "createdAt.localeCompare" src/` — **zero hits** (nothing printed).

`grep -rn "localeCompare" src/` — **four hits, not the three the spec predicted.** Three are the untouched *name* sorts
(two at shifted line numbers); the fourth is the word inside an explanatory comment in the new module:

```
src/lib/lists/homePath.ts:13:// sub-second `…:05.100Z` under localeCompare ('Z' 0x5A > '.' 0x2E) even though
src/routes/ListShoppingPage.tsx:209:    const sortByName = (a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name)
src/routes/ListShoppingPage.tsx:327:                .sort((a, b) => a.name.localeCompare(b.name))
src/components/StoreField.tsx:37:  ].sort((a, b) => a.localeCompare(b))
```

`git -C .. diff --stat bp_front/src/` plus untracked — exactly the four intended files and nothing else:

```
 bp_front/src/components/AppShell.tsx     | 29 ++++++++++++++++++++++++--
 bp_front/src/routes/HomeRedirect.tsx     | 35 ++++++++++++--------------------
 bp_front/src/routes/ListShoppingPage.tsx |  9 ++++----
 3 files changed, 45 insertions(+), 28 deletions(-)
?? bp_front/src/lib/lists/homePath.ts
```

### Red observations — every new test, both projects

Each revert was rebuilt with `docker compose up -d --build --force-recreate` before running; each was restored
afterwards, and the final `git diff` of `src/` was read line by line to confirm it is **byte-exact** to the intended
change (no `void alreadyHome`/`void pathname` scaffolding left, `replace` restored, `Date.parse` restored).

**R1 — `byCreatedAtAsc` reverted to `a.createdAt.localeCompare(b.createdAt)` → `precision` red on both.** Phase 1 (the
non-vacuity anchor, genuine timestamps) still **passed**, so the failure is the comparator and not the fixture; phase 2
landed on the genuinely-newer list A instead of the patched-older B:

```
  1) [chromium] › e2e/navigation.spec.ts:338:1 › FR38 — the oldest list is chosen numerically: a whole-second createdAt beats a sub-second one
    Error: expect(page).toHaveURL(expected) failed
    Expected pattern: /\/list\/4ff05c7a-f8c5-47b3-a62d-b4e976610c43$/
    Received string:  "http://localhost:2080/list/44b5eac3-b57c-4f66-a195-a959b7ef8063"
      > 402 |   await expect(page).toHaveURL(new RegExp(`/list/${bId}$`))
  2) [mobile] › e2e/navigation.spec.ts:338:1 › FR38 — the oldest list is chosen numerically: a whole-second createdAt beats a sub-second one
    Error: expect(page).toHaveURL(expected) failed
    Expected pattern: /\/list\/63c05c5a-47af-4a70-8685-5d2bc1ddeaa4$/
    Received string:  "http://localhost:2080/list/6f871493-67fa-48ad-a088-7d21b7c78e27"
  2 failed
```

**R2 — the whole `AppShell` guard reverted (both `aria-current` and `onClick` removed) → `inert`, `inertlook`,
`adminhome` red, 6/6 runs.** `inert` failed on the history-depth assertion, i.e. the FR57 symptom itself:

```
  1) [chromium] › …:408:1 › FR57 — activating the title link while already home moves nothing: no URL, spinner, scroll or history change
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 5
    Received: 6
      > 448 |   expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
  2) [mobile] › …:408:1 › (same test)          Expected: 5   Received: 6
  3) [chromium] › …:457:1 › FR57 — the already-home title link stays a real, focusable, unchanged-looking link
    Error: expect(locator).toHaveAttribute(expected) failed
    Expected: "page"   Received: ""
      > 476 |   await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')
  4) [mobile] › …:457:1 › (same test)          Expected: "page"   Received: ""
  5) [mobile] › …:547:1 › FR56/FR57 — an admin already on /admin has an inert but fully present title link
    Expected: "page"   Received: ""
  6) [chromium] › …:547:1 › (same test)        Expected: "page"   Received: ""
  6 failed
```

**R2b — narrower revert: `aria-current` KEPT, only the `onClick` removed.** This exists because R2 stopped `inertlook`
and `adminhome` at their attribute assertion, leaving the *suppression* unproven. Result: `adminhome` red on both for
the right reason (the click really navigated), and **`inertlook` PASSED — its Enter assertions were vacuous**:

```
  1) [mobile] › …:547:1 › FR56/FR57 — an admin already on /admin has an inert but fully present title link
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 3
    Received: 4
      > 578 |   expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
  2) [chromium] › …:547:1 › (same test)        Expected: 3   Received: 4
  2 failed
  2 passed (11.6s)          ← the two that passed are `inertlook` on both projects
```

**R2c — same build, after adding a `window.history.length` comparison around `inertlook`'s Enter press → red on both.**
The URL and spinner assertions could not distinguish push+`replace` from suppression; the depth can:

```
  1) [chromium] › …:457:1 › FR57 — the already-home title link stays a real, focusable, unchanged-looking link
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 5
    Received: 6
      > 520 |   expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
  2) [mobile] › …:457:1 › (same test)          Expected: 5   Received: 6
  2 failed
```

**R3 — guard made to OVER-fire (`alreadyHome = homePath !== null`) → `nooverfire` and `exits` red on both:**

```
  1) [mobile]   › …:593:1 › FR57 — every guarded route keeps a live in-app exit, and landing on home costs no extra history entry
    Error: expect(locator).not.toHaveAttribute(expected) failed
    Expected: not "page"   Received: "page"
      > 623 |   await expect(page.getByTestId('app-bar-home')).not.toHaveAttribute('aria-current', 'page')
  2) [mobile]   › …:523:1 › FR57/FR38 — the guard does not over-fire: the link still navigates home from a non-home list and from change-password
    Expected: not "page"   Received: "page"
      > 538 |   await expect(page.getByTestId('app-bar-home')).not.toHaveAttribute('aria-current', 'page')
  3) [chromium] › …:523:1 › (same test)        Expected: not "page"   Received: "page"
  4) [chromium] › …:593:1 › (same test)        Expected: not "page"   Received: "page"
  4 failed
```

**R3 also answers AC5's "a red one means the guard over-fires" directly.** Under the same over-firing build the
pre-existing link-activating tests were run: **6 failed / 2 passed**, i.e. red on both projects for
`navigation.spec.ts:112` (keyboard), `:145` (newer-list) and `:183` (admin) — all `expect(page).toHaveURL(expected)
failed`. The fourth, `:169` `FR38 — activating the title link with no lists lands on the lists index`, stayed **green**,
and the reason is structural rather than a gap: it reaches `/account/password` by a full page load, which resets the
Apollo cache, and nothing on that route queries `Lists`, so under `cache-only` the observed path is `null` and the link
is live no matter what the guard says. Filed in the ledger as a rule for future authors.

**R4 — `HomeRedirect`'s `<Navigate … replace>` changed to a push → `exits`' launch-depth assertion red on both.** This is
what makes the measured `2` non-vacuous:

```
  1) [chromium] › …:593:1 › FR57 — every guarded route keeps a live in-app exit, and landing on home costs no extra history entry
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 2
    Received: 3
      > 637 |   expect(await fresh.evaluate(() => window.history.length)).toBe(2)
  2) [mobile] › …:593:1 › (same test)          Expected: 2   Received: 3
  2 failed
```

Summary: all six new tests were observed failing on **both** `chromium` and `mobile`, for the behaviour each guards —
`precision` (R1), `inert` (R2), `adminhome` (R2b), `inertlook` (R2c), `nooverfire` (R3), `exits` (R3 for the live-exit
half, R4 for the launch-depth half).

### Manual real-browser pass — done BEFORE the specs were written

Driven through a real Chromium at `http://localhost:2080` against the production image, after the first
`--build --force-recreate`, with a freshly registered user (`manual75_…`) owning two lists created through the UI.

- **Landing on `/` opened the OLDER list** (`ManualOldest`, `/list/afb271ff-…`), title `ManualOldest · Bag Please`.
- **On that route the link was inert-but-present:** `tagName` `A`, `href` `/`, `tabIndex` `0`, `aria-disabled` `null`,
  `aria-current` `page`, `home-redirect-loading` count 0.
- **The FR57 flow, desktop:** `/lists` → open `ManualNewer` → click "Bag Please" → real navigation to `/list/afb271ff-…`
  (home). Recorded `{historyLength: 6, scrollY: 0}`, clicked the title again → `{historyLength: 6, scrollY: 0,
  spinner: 0}`, URL unchanged. **One Back press left for the previous screen** (`/lists/5e07e1e1-…`) instead of staying
  put — the symptom, gone.
- **Repeated on a narrow window** (360×400, after adding a category and three items so the view genuinely scrolls):
  `scrollY` **266** before and **266** after the click, `historyLength` 7 → 7, `spinner: 0`, URL unchanged, and one Back
  press reached `/lists/afb271ff-…`. This also confirmed the document *is* the scroll container, which is what
  `inert`'s `expect(scrollBefore).toBeGreaterThan(0)` guard relies on.
- **As `admin` on `/admin`:** the title is still visibly a link — `A`, `href` `/`, `tabIndex` `0`,
  `aria-current` `page`, hover gives `textDecorationLine: 'underline'`, and after a **fresh load plus one real `Tab`
  press** it is `document.activeElement` with `outlineWidth: '2px'`. Clicking it did nothing: URL still `/admin`,
  `historyLength` 7 → 7, `admin-page` still rendered, `home-redirect-loading` count 0.
- **Launch depth was measured by hand before being asserted:** `context().newPage()` → `goto('/')` gives
  `history.length` **2** for both admin (→ `/admin`) and the regular user (→ `/list/afb271ff-…`). The new page also
  restored the session from the shared refresh cookie, confirming the spec's reason for preferring
  `context().newPage()` over `browser.newContext()`.

Not verified, stated plainly: no screen-reader was used, so `aria-current="page"` is verified as a DOM attribute and by
role/name resolution, not by how any real assistive technology announces it. The TLS-edge run mode
(`E2E_BASE_URL=https://bag-please.localhost`) was not exercised — this story changes no cookie or origin behaviour.

### Review-pass addendum (2026-08-11) — what changed after the record above

Every figure in the sections above is the **implementation pass's** measurement and is left as recorded. The review
pass then applied nine patches (see the Review Triage Log), which moved the numbers. Re-measured afterwards:

```
$ npx tsc -b                       → exit 0, no output
$ npm run lint                     → exit 0, no findings
$ npx playwright test --list        → Total: 120 tests in 10 files
$ ... | sort | uniq -c             → 59 chromium / 59 mobile
                                     1 registration-toggle-chromium / 1 registration-toggle-mobile
$ npm run test:e2e   (run 1)       → 120 passed (1.0m)
$ npm run test-e2e   (run 2)       → 120 passed (1.0m)      # two consecutive, retries: 0, zero flaky
$ git diff --stat bp_back/         → (empty)
$ grep -rn toPass bp_front/e2e/    → navigation.spec.ts:100   (exactly one, unchanged)
$ grep -rn "createdAt.localeCompare" bp_front/src/ → (zero hits)
```

**The flake, before and after.** The defect the review found was measured, not argued:

```
before the patch — 6 isolated runs of `inertlook` on chromium:
  1 passed (2.9s) / 1 failed / 1 passed (2.9s) / 1 passed (2.9s) / 1 failed / 1 passed (2.9s)
after synchronising on aria-current — 8 isolated runs:
  8 × 1 passed (~3.0s), zero failures
```

Failure mode when it did fail: `expect(history.length).toBe(historyBefore)` reporting 6 vs 5 — i.e. Enter on the
"already-home" link really did navigate, because the app bar had not yet seen the lists cache. Root cause confirmed in
the product code, not inferred: `ListShoppingPage.tsx:228` is `const loading = itemsResult.loading ||
categoriesResult.loading` — `listsResult.loading` is **not** in it, and `list-shopping-page` renders at `:258`
regardless, so the shell paints before home is knowable.

**Red observation for the seventh test** (`inertindex`), with `alreadyHome` forced false and the image rebuilt:

```
2 failed
  [chromium] › navigation.spec.ts:432 › FR57 — a user with no lists gets an inert title link on /lists …
  [mobile]   › navigation.spec.ts:432 › FR57 — a user with no lists gets an inert title link on /lists …

  Error: expect(locator).toHaveAttribute(expected) failed
  Expected: "page"   Received: ""
  14 × locator resolved to <a href="/" data-testid="app-bar-home" …>Bag Please</a>
     - unexpected value "null"
```

Restored afterwards and verified **byte-identical** to the pre-probe file (`diff` clean), then `tsc -b` green and the
image rebuilt with `--force-recreate`.

One probe artefact worth recording, because it cost a build: disabling the guard as `const alreadyHome = false && homePath
!== null && …` does **not** compile — the leading `false &&` defeats TypeScript's narrowing and `trimSlash(homePath)`
then fails with `TS2345: 'string | null' is not assignable to 'string'`, which surfaces as an opaque
`npm run build … exit code: 2` inside the Docker build. Put the never-true clause **last**
(`… && pathname === '__probe_never__'`) so narrowing survives.

## Verification

**Commands** (from `bp_front/`, in this order):
- `npx tsc -b` — expected: exit 0. Run **before** the suite; a spec type error fails the Docker image build.
- `npm run lint` — expected: exit 0, zero output.
- `npx playwright test --list | tail -3` — expected: `Total: 120 tests in 10 files` (106 + 7×2 — six tests planned,
  a seventh added by the review pass). Re-measure; the total alone proves nothing.
- `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — expected: `59 chromium`, `59 mobile`,
  `1 registration-toggle-chromium`, `1 registration-toggle-mobile`. Never pass `--project` here.
- `docker compose up -d --build --force-recreate && docker compose ps` — expected: both containers recreated
  (uptime seconds, not hours).
- `npm run test:e2e` — expected: all green at `retries: 0` (local default), zero flaky, the seven new tests present in
  both viewport projects. Two consecutive runs, per the epic's zero-retry invariant.
- `git diff --stat bp_back/` — expected: empty output.
- `grep -rn "toPass" e2e/` — expected: exactly one hit, `navigation.spec.ts:100`.
- `grep -rn "createdAt.localeCompare" src/` — expected: zero hits. `grep -rn "localeCompare" src/` must still return
  exactly **three** hits, all legitimate *name* sorts that this story does not touch: `components/StoreField.tsx:37`,
  `routes/ListShoppingPage.tsx:208`, `routes/ListShoppingPage.tsx:326`.
- `git -C .. diff --stat bp_front/src/` — expected: exactly `homePath.ts` (new), `HomeRedirect.tsx`, `AppShell.tsx`,
  `ListShoppingPage.tsx`, and nothing else.

**Manual checks:**
- In a real browser at `http://localhost:2080`, as a user with two lists: land on `/`, confirm the oldest list opens;
  click "Bag Please" and confirm nothing moves — no spinner, no scroll jump — then press Back once and confirm you
  leave for the previous screen rather than staying put. Repeat on a narrow window. Say in the record that this was
  done before the specs were written.
- As `admin`: on `/admin`, confirm the title is still visibly a link (hover underline, focus ring on Tab) and that
  clicking it does nothing.


## Auto Run Result

Status: done
Blocking condition: none

### What was implemented

`/` now resolves to the genuinely oldest list, and the app-bar title link is **inert but present** when it already
points at the current route.

Home resolution moved out of `HomeRedirect` into one shared resolver, `bp_front/src/lib/lists/homePath.ts`
(`useHomePath('resolve' | 'observe')` + `byCreatedAtAsc`). `HomeRedirect` consumes it cache-first because it owns the
redirect; `AppShell` consumes it cache-only so the app bar never issues the membership-gated lists request. The guard is
a `preventDefault()` on the existing anchor plus `aria-current="page"` and nothing else — no element swap, no
`aria-disabled`, no `tabIndex` — which is why all ten pre-existing navigation tests passed with zero edits. The FR38
comparator is numeric (`Date.parse`), so the backend wire format was not touched.

### Files changed

- `bp_front/src/lib/lists/homePath.ts` — **new.** The single resolver: `byCreatedAtAsc` (numeric, NaN-safe, `id`
  tie-break) and `useHomePath`, whose branch order (admin → error → `!data` → empty → oldest) is load-bearing.
- `bp_front/src/routes/HomeRedirect.tsx` — collapsed to the hook plus one `<Navigate>`; the `home-redirect-loading`
  testid and every one of the five original branches preserved.
- `bp_front/src/components/AppShell.tsx` — observes the resolved path, compares it to `useLocation().pathname`
  (trailing-slash tolerant), and suppresses a plain primary activation. Modified clicks pass through.
- `bp_front/src/routes/ListShoppingPage.tsx` — **deviation from the epic's `Files:` line:** `:69` held the identical
  lexicographic `createdAt` sort, so the switcher chips could order two lists differently from `/`. Now the shared
  comparator.
- `bp_front/e2e/navigation.spec.ts` — +377/−3; seven new tests. The three deletions are the file's header comment; the
  ten pre-existing tests are byte-unchanged.
- `bp_front/playwright.config.ts` — **deviation:** its count comment was already stale at 106; rewritten as the
  structural invariant plus dated figures (now `120 = 59 / 59 / 1 / 1`).
- `deferred-work.md` — four entries closed (the FR38 sort and the home no-op, each filed twice); a Story 7.5 section;
  a code-review section with five deferred findings.
- `project-context.md` — the resolved-home-path rule, the inert-but-present contract, corrected E2E counts.
- `sprint-status.yaml` — story `done`, Epic 6 action item **B6** `open → done`, both deviations recorded.

### Review findings

`intent_gap: 0` · `bad_spec: 0` · `patch: 9 (high 1, medium 3, low 5)` · `defer: 5 (medium 1, low 4)` · `reject: 6`

The high-severity patch is worth naming: the implementation shipped **green but flaky**. Because observe mode is
cache-only and `ListShoppingPage.tsx:228` excludes its own lists query from its `loading` flag, the app bar paints
before home is knowable — so for ~100ms after a cold load of the home route the link is legitimately live. Two of the
new tests raced that window; one failed **2 of 6** isolated runs. Fixed by synchronising on `aria-current` rather than
relaxing the assertion: **8/8** afterwards. Also patched: modified-click swallowing (open-in-new-tab was dead while
middle click still worked), a non-total comparator (`NaN` poisons the whole sort; ms truncation created ties), a missing
seventh test for the zero-list home outcome, trailing-slash normalisation, three interception hardenings, and three
overclaiming comments.

Five findings deferred, one of them **for `md`**: whether the cold-start window should be closed by letting the app bar
join the in-flight lists query. It is not patchable — `<intent-contract>` forbids the observing consumer from issuing
that request — and Story 7.14 makes this link the app's only exit, so it is a decision rather than an oversight.

Six findings rejected, two on measurement rather than judgment: the welcome-forwarding path *is* covered
(`account.spec.ts:103`, passing), and the `search`/`hash` concern is unreachable (`useSearchParams` exists only on the
public `/auth`).

### Verification

`tsc -b` 0 · `npm run lint` 0, no findings · `--list` `Total: 120 tests in 10 files`, split **59 / 59 / 1 / 1** ·
**two consecutive** `npm run test:e2e` runs `120 passed (1.0m)` at `retries: 0`, zero flaky, against a
`--force-recreate`d production image · `git diff bp_back/` **empty** · `toPass` still exactly one hit
(`navigation.spec.ts:100`) · zero `@ts-ignore`/`eslint-disable` in `e2e/` · zero `createdAt.localeCompare` in `src/`.

Red observed for all seven new tests on **both** `chromium` and `mobile`: comparator reverted → `precision`; guard
reverted → `inert`/`inertlook`/`adminhome`/`inertindex`; guard forced to over-fire → `nooverfire`/`exits`;
`replace`→push → the `exits` depth check. Sources restored byte-identical after each probe. Manual real-browser pass at
`:2080` on desktop and 360×400, including admin on `/admin`, done before the specs were written.

### Residual risks

- **The cold-start window is real and still open** (~100ms after a full page load of the home route). Deferred to `md`
  with the fix and its cost, not silently accepted.
- **The observe-mode `error` branch is unreachable**, so while the lists query is failing the two consumers disagree
  about where home is. Same root cause; filed.
- **`history.length).toBe(2)`** in the `exits` test couples to Chromium's `about:blank` initial-entry semantics. Proven
  discriminating by red observation, but it is a browser internal.
- **Nothing mechanically prevents a third `createdAt` sort site** from reappearing with `localeCompare`; the guard is a
  convention plus a grep in this spec's Verification section.
