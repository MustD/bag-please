---
title: 'Story 6.2 — Back to Home & Back to Lists Navigation'
type: 'feature'
created: '2026-07-28'
status: 'done'
baseline_revision: 'f49d2ec'
final_revision: '5d56e58'
review_loop_iteration: 0
followup_review_recommended: false  # discharged 2026-07-29 at the Epic 6 retro (action item B7) — the recommended follow-up review was performed; no further findings
followup_review_completed: '2026-07-29'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** No guarded screen offers a way home — the "Bag Please" app-bar title is inert text — and the shopping view
`/list/:id` has no back-to-lists link, though its sibling management screen `/lists/:id` already ships one. Users depend
on the browser back button.

**Approach:** Make the app-bar title a real link to `/` in `AppShell`, delegating all home resolution to the existing
`HomeRedirect`; add a back-to-lists link to `ListShoppingPage` copying `ListDetailPage`'s existing idiom. Frontend only,
plus FR57-tagged Playwright coverage on both viewport projects.

## Boundaries & Constraints

**Always:**

- Frontend only: `git diff` shows no change under `bp_back/` or `bp_front/src/__generated__/`. No schema or GraphQL
  operation change, so no `npm run generate`.
- Navigate with `component={RouterLink}`; `RouteGuard` stays the sole owner of auth-driven redirects.
- Home resolution belongs to `HomeRedirect`, reached via `to="/"` — never re-derived in the app bar.
- New `data-testid`s follow the kebab-case idiom; the back link uses the `-back` suffix (`list-detail-back` precedent).
- Epic 6 standing constraints apply (see `epic-6-context.md`): MUI v9 APIs looked up via `mcp__mui-mcp__fetchDocs` before
  writing; theme + `sx` styling only; manual browser pass before each test; E2E green on `chromium` **and** `mobile`.

**Block If:**

- Keeping the title's current type scale/weight/colour while making it a genuine AT-exposed link needs a theme change
  rather than `sx` on the component.
- The back link cannot sit above the shopping title without altering switcher-chip-row or filter-bar spacing.
- Any change under `bp_back/` or `src/__generated__/` appears necessary.

**Never:**

- No edit, delete, or swipe-to-delete affordance on the shopping view — `/list/:id` stays check-off only (AR-E6-5).
- No new imperative `navigate()`; no `<Button>` for the title (no ripple, uppercase transform, or padding shift).
- No new affordance on any admin screen; no change to the menu items, the username chip markup, or `HomeRedirect`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Title link, ≥2 lists | Signed in, viewing newest list at `/list/:id`; activate title | `/` → `HomeRedirect` replaces to `/list/{oldest by createdAt}` | No error expected |
| Title link, no lists | Signed in, no lists; activate title | `/` → replaces to `/lists` | No error expected |
| Title link, admin | Signed in as `admin`; activate title | `/` → replaces to `/admin`; lists query stays skipped | No error expected |
| Title link, keyboard | Tab to the title, press Enter | Same navigation as a click; element is `role=link` | No error expected |
| Back-to-lists link | On `/list/:id`; activate it | Navigates to `/lists`; index renders | No error expected |
| Unauthenticated | Signed out on `/auth` | No app bar, no title link, no back link rendered | No error expected |
| ~360px viewport | Any guarded screen | Title link and username chip both fully visible and tappable; bar stays one line; no horizontal page scroll | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/components/AppShell.tsx` -- **edit.** Line ~84 holds `<Typography variant="h6" color="text.primary"
  sx={{flexGrow: 1, fontWeight: 600}}>Bag Please</Typography>`. The `flexGrow: 1` is what pushes the username chip right,
  so it must move to a wrapper (see Design Notes). Needs `Link as RouterLink` + MUI `Link` imports; keep the existing
  `useNavigate` (the menu items use it).
- `bp_front/src/routes/ListShoppingPage.tsx` -- **edit.** Line ~257: the `shopping-header` `Typography` is the first child
  of `<Container maxWidth="md">`; insert the back link immediately before it. Needs MUI `Link`, `Link as RouterLink`,
  `ArrowBackIcon` — none imported today.
- `bp_front/src/routes/ListDetailPage.tsx:79-87` -- **reference, do not modify.** The idiom to copy: `Link
  component={RouterLink} to="/lists"`, `sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2}}`,
  `<ArrowBackIcon fontSize="small"/>`, text "Back to lists".
- `bp_front/src/routes/HomeRedirect.tsx` -- **read-only.** Owns `/`: admin → `/admin`; no lists or query error →
  `/lists`; else oldest `createdAt` → `/list/:id`.
- `bp_front/src/App.tsx` -- **read-only.** `AppShell` is a child layout of `RouteGuard` and `/auth` is the only route
  outside both, which is what makes the unauthenticated row of the matrix hold structurally.
- `bp_front/e2e/navigation.spec.ts` -- **new.** No shared E2E helpers exist here; every spec re-declares its own. Copy
  `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen` from `e2e/shopping.spec.ts:21-64` —
  including `registerViaUi`'s `expect(...).toPass()` wrapper that absorbs the shared `registrationEnabled` race. Flat
  `test(...)` calls, no `describe`, titles formatted `'FR… — lowercase sentence'`, anchored `toHaveURL` regexes.

## Tasks & Acceptance

**Execution:**

- [x] `bp_front/src/components/AppShell.tsx` -- fetch MUI v9 `Link` docs (`component`, `underline`, `variant`), then
  replace the title `Typography` with `<Link component={RouterLink} to="/" variant="h6" color="text.primary"
  underline="hover" data-testid="app-bar-home">`, keeping `fontWeight: 600`, adding an explicit visible `&:focus-visible`
  style, and moving `flexGrow: 1` + `minWidth: 0` to a wrapping `Box` -- a genuine link to home on every guarded screen
  without widening the hit area to the whole toolbar or displacing the username chip.
- [x] `bp_front/src/routes/ListShoppingPage.tsx` -- add the three imports and insert the back link as the first child of
  `<Container maxWidth="md">` with `data-testid="list-shopping-back"`, leaving every existing `mb`/`spacing` value on
  `shopping-header`, `list-switcher` and `shopping-filters` untouched -- one back-link pattern in the app, not two.
- [x] `bp_front/dist/` via `docker compose up -d --build` (`:2080`) -- rebuild the production image and manually exercise
  all seven matrix rows in a real browser at a desktop width and at ~360px, before writing any test -- the project's
  stated gate, which has caught bugs no type check reaches.
- [x] `bp_front/e2e/navigation.spec.ts` -- new FR57-tagged spec: one test per matrix row plus the no-management-affordance
  check, using `getByRole('link', {name: 'Bag Please'})` for AT exposure, keyboard `Enter` activation,
  `browser.newContext({baseURL, ignoreHTTPSErrors: true})` for the signed-out case, and the narrow-viewport assertion in
  Design Notes -- the matrix is the contract, so each row gets a test rather than a manual note.

**Acceptance Criteria:**

- Given any guarded screen (`/lists`, `/lists/:id`, `/list/:id`, `/account/password`, `/admin`), when the app bar renders,
  then "Bag Please" is exposed as `role=link` targeting `/`, is Tab-reachable and Enter-activatable, keeps its current
  `h6` scale / 600 weight / `text.primary` colour, has no underline at rest, and has a visible hover **and**
  focus-visible state. (AC1)
- Given the implementation, when reviewed, then the title is not a `Button` and no imperative `navigate()` or competing
  redirect owner was introduced. (AC1, AC5)
- Given `/list/:id`, when the page renders, then a "Back to lists" link with `ArrowBackIcon fontSize="small"` sits above
  the list title using the same idiom as `list-detail-back`, carries `data-testid="list-shopping-back"`, and the switcher
  chip row and filter bar keep their current spacing. (AC7)
- Given `/list/:id`, when item rows render, then they still offer check-off only — no edit control, no delete control, no
  swipe gesture. (AC8)
- Given the story is complete, then `npm run lint` and `npm run build` pass, `git diff` shows no change under `bp_back/`
  or `bp_front/src/__generated__/`, and the new specs pass on both projects. (AC10)

## Spec Change Log

## Review Triage Log

### 2026-07-28 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 5, low 3)
- defer: 4: (high 0, medium 2, low 2)
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` The title link had no `whiteSpace: 'nowrap'`, so `minWidth: 0` on the wrapper let "Bag Please"
    wrap below ~340px (or under a large minimum font size) and grow the bar to two lines — added `nowrap` in
    `AppShell.tsx`.
  - `[medium]` `[patch]` The narrow-viewport test's `barBox.height <= 72` could not detect the wrap it claimed to guard: a
    two-line h6 is ~64px of content, which a 56px single-line Toolbar absorbs. Replaced with an assertion on the link's
    own height, bounded by 2× its rendered font size.
  - `[medium]` `[patch]` The unauthenticated test built its own context with `browser.newContext()`, which does not
    inherit the project `use` block — it silently ran at a desktop viewport on the `mobile` project, voiding the mandatory
    mobile gate for AC9. The fresh context was also unnecessary (the `page` fixture is already per-test isolated), so it
    now uses `page`.
  - `[medium]` `[patch]` AC1's styling half was verified only by the manual pass: added a test asserting `h6` scale, 600
    weight, no underline at rest, hover underline, no Button decoration (`text-transform`, padding).
  - `[medium]` `[patch]` The one design invariant the change exists to protect — `flexGrow: 1` on the wrapper so only the
    text is clickable — was untested; every other assertion would still pass if it moved back onto the link. Added a
    link-width-vs-bar-width assertion.
  - `[low]` `[patch]` The keyboard test used `.focus()`, which does not put a link into `:focus-visible` in Chromium, so
    the added focus ring was never exercised and Tab-reachability was never proven. Now presses a real `Tab` from a fresh
    load (Chromium keeps the sequential-focus origin at the last element clicked, so tabbing after a click resumes from
    there) and asserts a non-zero computed `outline-width`.
  - `[low]` `[patch]` The admin test asserted `toHaveURL(/\/lists$/)` immediately after `goto` — satisfiable by a
    transient state, so a future admin bounce would satisfy the `/admin` assertion without the link doing the work. Added
    a `lists-page` visibility assertion before the click.
  - `[low]` `[patch]` The chip-bounds assertion hardcoded `360` instead of the real `clientWidth`, making it looser than
    intended when a classic scrollbar narrows the content box; and the file header overclaimed that every asserted
    behaviour goes through a rendered affordance while using direct URL entry to reach screens. Both corrected.

## Design Notes

The `flexGrow: 1` move is the one non-obvious change: on the link itself it would make the whole empty stretch of the
toolbar navigate home. Wrap instead —

```tsx
<Box sx={{flexGrow: 1, minWidth: 0}}>
  <Link component={RouterLink} to="/" variant="h6" color="text.primary" underline="hover"
        data-testid="app-bar-home" sx={{fontWeight: 600, '&:focus-visible': {/* visible ring */}}}>
    Bag Please
  </Link>
</Box>
```

`minWidth: 0` stops the flex child refusing to shrink at ~360px, which is what would push the username chip off-screen.
`underline="hover"` is exactly "none at rest, visible on hover"; the focus ring is declared, not left to the UA default.

Narrow-viewport assertion, deterministic rather than pixel-perfect: `app-bar-home` and `user-chip` both visible, the
chip's bounding box inside the viewport, the app bar's height within a single-line Toolbar bound, and
`document.documentElement.scrollWidth <= clientWidth`.

## Verification

**Commands:**

- `cd bp_front && npm run lint` -- exit 0, no new warnings.
- `cd bp_front && npm run build` -- `tsc -b` clean, Vite build succeeds.
- `docker compose up -d --build` -- stack up; `http://localhost:2080/api/graphiql` loads (no health endpoint exists).
- `cd bp_front && npm run test:e2e` -- full suite green on `chromium` and `mobile`, including `navigation.spec.ts`. Known
  pre-existing flakiness from the shared `registrationEnabled` toggle must be distinguished from a real regression.
- `git diff --stat -- bp_back bp_front/src/__generated__` -- empty output.

**Manual checks:**

- At ~360px on `/list/:id`: title link and username chip fully visible and tappable, bar on one line, back link above the
  title, switcher chips and filters visually unmoved relative to each other.
- Tab from page load: focus reaches the title link with a visible ring; Enter navigates home.

## Auto Run Result

Status: `done`

### Implemented change

The app-bar "Bag Please" title is now a real link to `/` on every guarded screen, delegating all home resolution to the
existing `HomeRedirect` (oldest list → `/lists` when there are none → `/admin` for admin). The shopping view at
`/list/:id` gained the back-to-lists affordance its sibling management screen already had, copying that screen's idiom
rather than inventing a second pattern. Frontend only: no backend file, no GraphQL schema or operation change, no codegen.

### Files changed

- `bp_front/src/components/AppShell.tsx` — title `Typography` → `Link component={RouterLink} to="/"` with
  `data-testid="app-bar-home"`, `underline="hover"`, an explicit focus-visible ring and `whiteSpace: 'nowrap'`;
  `flexGrow: 1` + `minWidth: 0` moved to a wrapping `Box` so only the text is clickable and the chip is never displaced.
- `bp_front/src/routes/ListShoppingPage.tsx` — back-to-lists `Link` inserted as the first child of the `Container`, above
  `shopping-header`, with `data-testid="list-shopping-back"`; no existing spacing or layout prop touched.
- `bp_front/e2e/navigation.spec.ts` — new, 10 FR-tagged specs (20 runs across both projects) covering every row of the
  I/O matrix plus the check-off-only guard, the styling contract, and the click-target invariant.
- `_bmad-output/implementation-artifacts/deferred-work.md` — four deferred entries appended.
- `_bmad-output/implementation-artifacts/epic-6-context.md` — new, compiled epic context (first Epic 6 run).

### Review findings breakdown

8 patches applied (5 medium, 3 low) — one product-code fix (`whiteSpace: 'nowrap'`) and seven that hardened the new E2E
suite, including restoring mobile emulation to the unauthenticated scenario, replacing a wrap assertion that could not
detect a wrap, and adding the AC1 styling/keyboard coverage that had rested on the manual pass alone. 4 items deferred
(2 medium, 2 low). 11 rejected as noise or as contradicting an explicit acceptance criterion — notably the suggestion to
extract a shared back-link component, which AC7/AR-E6-8 explicitly forbids in favour of copying the existing idiom with
its own testid.

No intent gaps and no spec defects: no repair loopback was needed.

### Verification performed

- `npm run lint` → exit 0, no warnings.
- `npm run build` → `tsc -b` clean, Vite build succeeded.
- `docker compose up -d --build` → stack rebuilt so E2E ran against the shipped bundle, not the dev server.
- Manual browser pass on the production image before the tests were written: all seven matrix rows exercised at desktop
  width and at 360×800, including a screenshot and computed-style checks (20px/600/`text.primary`, no underline at rest,
  underline on hover, teal focus ring, one-line bar, no horizontal scroll).
- `npx playwright test e2e/navigation.spec.ts` → **20 passed** (10 tests × `chromium` + `mobile`).
- `npx playwright test --retries=2` (full suite) → **84 passed, 0 failed, 0 flaky**.
- `git diff --stat -- bp_back bp_front/src/__generated__` → empty.

### Residual risks

- **The oldest-list assertion inherits a real pre-existing sort bug.** `HomeRedirect` compares `createdAt` strings
  lexicographically, which is wrong for the variable-precision instants the backend emits. Deferred with evidence; it
  makes both the new FR38 spec and the existing `shopping.spec.ts` FR38 spec flaky at roughly 1-in-1000.
- **The new spec file is neither linted nor type-checked**, like every other spec — `eslint src/` and the tsconfig
  includes exclude `e2e/`. Deferred.
- **Suite flakiness pressure increased.** This story adds 14 UI registrations per full run, widening the window for the
  already-tracked shared `registrationEnabled` race. One post-story run showed 4 flaky (all in the untouched
  `lists.spec.ts`, all healed on retry); the final run was clean. Not papered over — deferred with both data points.
- **Tab-reachability is asserted from a fresh page load**, because Chromium keeps the sequential-focus origin at the last
  element clicked. The assertion is honest about what it proves; it does not prove the link is reachable by tabbing
  backwards or from mid-page.
- The story ran on branch `epic-4-lists`, a stale name carried over from Epic 4 that also hosted all seven Epic 5
  stories. Flagged, not blocked.
