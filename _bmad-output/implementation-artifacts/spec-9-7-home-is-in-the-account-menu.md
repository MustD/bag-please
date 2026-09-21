---
title: 'Story 9.7 — Home is in the account menu'
type: 'feature'
created: '2026-09-21'
baseline_revision: '4f56549146c50e3ef86df9b20063e685b02047fb'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The only way home is the "Bag Please" title, which is inert on the home route and easy to miss. In the
installed PWA (no URL bar, no Back button) an empty `/lists` is one menu away from a dead end, because the account menu
has no Home entry and users look for navigation in the menu. `useHomePath`'s `if (error)` branch also runs in observe
mode, where it can make the title link inert on `/lists` while the lists query is failing.

**Approach:** Add a Home entry as the first account-menu item. It goes where the title link goes, and on the resolved
home route it only closes the menu. Gate `useHomePath`'s error branch on resolve mode so observe mode can never
resolve to `/lists` from an error. Correct `EXPERIENCE.md` and close the four riding deferred entries.

## Boundaries & Constraints

**Always:**
- Home reuses `useHomePath('observe')` and the existing `alreadyHome` comparison in `AppShell`; it never re-derives
  home (AR-E6-7 / AR-E7-8 / AD-10). Off the home route it navigates to `/`, so `HomeRedirect` resolves it exactly as
  the title link does (admin → `/admin`, no lists → `/lists`, else the oldest list).
- Menu order: Home, Lists, Change password (non-admin) or Admin (admin), Logout. Home is a `MenuItem` with
  `data-testid="menu-home"` and a small `@mui/icons-material` icon at `fontSize="small"` in a `ListItemIcon`, exactly
  like its siblings; the existing `Lists` entry stays. Keyboard reach/activation comes from MUI `MenuItem`; do not
  replace it with a custom control.
- On the resolved home route Home closes the menu and does nothing else: no `navigate`, no URL change, no
  `history.length` change. While home is unresolved (`homePath === null`) it navigates.
- `useHomePath`: in observe mode the error branch never fires. In resolve mode a lists-query failure still resolves to
  `/lists` (`HomeRedirect` must not spin forever on error). Observe mode stays `fetchPolicy: 'cache-only'`.
- Behaviour proven UI-driven on `chromium` **and** `mobile`; the new floor case at 320px; every new
  test observed failing first, except the resolve/observe error characterization, which pins behaviour the current
  code already exhibits (the gate is hardening of a branch Apollo does not reach today).
- `EXPERIENCE.md` is corrected in the same commit as the menu it describes.

**Never:**
- Do not touch the title link's inert-but-present behaviour, its `aria-current`, or its existing tests.
- Do not change observe mode's fetch policy, add a second lists query to the app bar, or add a context provider.
- No toast/snackbar, no new palette key or theme override, no new dependency, no schema/backend change, no version
  bump (frontend-only).
- Do not add the Feedback entry (Story 9.9) or touch `AddItemDialog` (9.11).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Home off the home route | User with two lists on the newer list's `/lists/:id` opens the menu, chooses `menu-home` | Menu closes; lands on `/list/<oldest id>` (what the title link does) | No error expected |
| Home on the home route | User on their oldest list's `/list/:id` (cache warm), chooses `menu-home` | Menu closes; URL and `history.length` unchanged | No error expected |
| Zero-lists user | User with no lists on `/lists` opens the menu | Home and Lists both present; Home closes the menu, URL and history unchanged | No error expected |
| Admin | Admin off `/admin` (via `menu-lists`) chooses Home; admin on `/admin` chooses Home | `/admin`; on `/admin` only the menu closes | No error expected |
| Menu content | Non-admin / admin opens the menu | Non-admin: Home, Lists, Change password, Logout. Admin: Home, Lists, Admin, Logout | No error expected |
| Keyboard | Focus on the menu button, Enter, then Enter on the focused first item | Home activates without a pointer | No error expected |
| Lists query failing | `Lists` forced to HTTP 500, cold load of `/` | `HomeRedirect` resolves to `/lists`; the title link on `/lists` has no `aria-current` (observe mode did not read the error) | Existing lists error surface unchanged |

</intent-contract>

## Code Map

- `bp_front/src/components/AppShell.tsx:29-75,200-236` -- `homePath`/`alreadyHome` (`:48-53`) already exist and are
  the whole decision; add `goHome` beside `goToLists` (`:62`) and a first `MenuItem` (`:208`) with `HomeIcon`. The
  header comment (`:22-28`) lists the menu entries — amend it. Title link `:126-165` is read-only.
- `bp_front/src/lib/lists/homePath.ts:31-49` -- the `if (error)` branch (`:45`) precedes `if (!data)` (`:46`). Becomes
  `if (mode === 'resolve' && error)`; observe mode reaches `!data` → `null`. Rewrite the header comment (`:9-30`) so it
  states the mode split and why the error branch cannot be reordered after `!data` in resolve mode (dataless failure
  would spin forever — the Story 7.5 review's semantic-difference entry).
- `bp_front/src/routes/HomeRedirect.tsx:9-20` -- comment says the app bar "reads `null` … if the query fails"; already
  true, tighten if it now contradicts. Behaviour read-only.
- `bp_front/e2e/navigation.spec.ts:39-714` -- home/title-link cases live here; `titleLink()` (`:37`), the
  `page.route('**/api/graphql')` `Lists` interception pattern (`:388-425`) and the inert history assertions
  (`:467-521`) are the templates. New cases go in a `Story 9.7` block at the end. Existing tests untouched.
- `bp_front/e2e/support/ui.ts:75-88` -- `loginAsAdmin`, `openListsViaMenu` (uses `menu-lists`); `createListAndOpen`
  returns the id. Reuse; no new helper unless two specs need it.
- `bp_front/e2e/narrow-viewport.spec.ts:750-790` -- floor cases use `expectInsideViewport`
  (`support/layout.ts:131`); the mobile-only `test.skip(testInfo.project.name !== 'mobile')` idiom applies.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- §1.1 menu table (`:57-90`, add the Home row
  and re-derive the `AppShell.tsx` anchors), §3 (`:122-150`, branch 2 is now resolve-only, "two modes" bullets), §7.1
  (`:534`, the `/lists` menu string).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close in place with the
  `✅ CLOSED by Story 9.7 (2026-09-21): … Was: …` idiom used at `:36-46`: index bullets `:71-74` (the "Rides FR57"
  block), body entries `:201-207` (empty `/lists`), `:412-431` (cache-first question — closed as leave-as-is, md
  2026-09-15) and `:432-442` (unreachable `error` branch), and the epic-7 post-factum entry at `:537-545`. The
  `:470-476` spinner entry stays open (still true in resolve mode).
- `_bmad-output/implementation-artifacts/sprint-status.yaml:121` -- `9-7-…: backlog` → `review` at story close.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/navigation.spec.ts` -- **written FIRST, run red.** Story 9.7 block: menu order and `menu-home` present
  for user and admin; Home off-home lands on the oldest list; Home on home leaves URL and `history.length` unchanged
  and closes the menu; zero-lists user has Home and Lists and Home is a no-op; admin off/on `/admin`; keyboard
  activation; `Lists` forced to 500 characterization. -- discharges FR57 and AR-E9-13 through the UI.
- `bp_front/e2e/narrow-viewport.spec.ts` -- mobile-only case: at the 320px floor open the menu and assert every entry
  (`menu-home`, `menu-lists`, `menu-change-password`, `menu-logout`) is inside the viewport. -- floor gate.
- `bp_front/src/components/AppShell.tsx` -- add `goHome` and the first `MenuItem` (`menu-home`, `HomeIcon`); amend the
  header comment. -- the feature.
- `bp_front/src/lib/lists/homePath.ts` -- gate the error branch on `mode === 'resolve'`; rewrite the comment. --
  AR-E9-13 hardening.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- §1.1 table + prose, §3 branch table and mode
  bullets, §7.1 menu string. -- same-commit doc correction.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close the five entries in place. -- ledger.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `9-7-…: review` at story close.

**Acceptance Criteria:**
- Given a regular user or the admin on an authenticated screen that is not their home, when they open the account menu
  and choose `menu-home`, then they land where the title link goes (oldest list, `/lists` with none, `/admin` for the
  admin).
- Given the user is already on their resolved home route, when they choose `menu-home`, then the menu closes and neither
  the URL nor `history.length` changes.
- Given the account menu opens, then its entries are Home, Lists, Change password (non-admin) or Admin (admin), Logout,
  in that order, and Home carries a small `@mui/icons-material` icon and is reachable and activatable by keyboard.
- Given a user with no lists on `/lists`, when they open the menu, then Home and Lists are both available.
- Given `useHomePath` in observe mode while the lists query is failing, when the app bar renders, then the title link
  stays live (no `aria-current`), while `HomeRedirect` in resolve mode still resolves to `/lists`; observe mode is still
  `cache-only`.
- Given the title link, when its existing tests run, then they pass unchanged.
- Given `npm run lint && npm run build`, then both are clean.

## Spec Change Log

## Review Triage Log

### 2026-09-21 — Review pass
- verdicts: 26 findings — high 0, medium 0, low 22, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind: closure text says an empty `/lists` "has a second in-app exit", but Home and Lists both resolve to the page the user is already on — the two `deferred-work.md` closures were reworded to name the exits that actually leave the page (create a list, Change password, Logout).
  - `[low]` `[reject]` Blind: `epic-9-context.md` rewrite is unrelated to 9.7 — step-01 regenerates the cached epic context when a planning artifact is newer; it is a compiled cache and the planning docs stay the source of truth (same rejection as Story 9.5).
  - `[low]` `[reject]` Blind: the `mode === 'resolve'` gate has no regression test — Apollo `cache-only` never surfaces an error, so no browser test can tell gated from ungated, and the repo has no unit harness; a pure-function extraction adds surface for a branch unreachable today. Recorded under residual risks.
  - `[low]` `[reject]` Blind: Home while the lists query is failing pushes a history entry — `alreadyHome` is null-safe by contract (unknown ⇒ navigate, UX-DR-E7-4) and the intent forbids the app bar issuing its own request.
  - `[low]` `[patch]` Blind: the cold-cache history window is documented for the title link only — EXPERIENCE.md §1.1 Home paragraph now names the window and the failing-query case.
  - `[low]` `[reject]` Blind: Home has no `aria-current`/selected state on the home route — the spec and UX-DR-E9-3 ask for a plain closing no-op; a selected style would add an unspecified visual state.
  - `[low]` `[patch]` Blind: stale EXPERIENCE.md anchors — the two header-comment anchors (`AppShell.tsx:25-27`, `:27-28`) re-pointed to `:27-28` and `:28-29`. The claimed stale §7.2 "only exit" blockquote does not exist (no such text) and DESIGN.md has no account-menu text.
  - `[false]` `[reject]` Blind: deferred-work edits damage `source_spec:` fields and cite an unsupported `md` decision — the `md` 2026-09-15 leave-as-is ruling is recorded in AR-E9-13 (epics.md) and the "✅ CLOSED … Was:" prefix is the idiom the file already uses.
  - `[low]` `[reject]` Blind: spec says "four" entries in Intent and "five" in Tasks, Design Notes reconcile an AC — the `<intent-contract>` is read-only and the fix would edit this build's spec.
  - `[low]` `[patch]` Blind: test hygiene — `HomeIcon` import moved into alphabetical order; inline admin login matches the file's existing inline pattern (`loginAsAdmin` ends on `/admin`, not home), floor test non-admin only, and `unroute` at the end of the body follow the existing idiom, so those were rejected.
  - `[low]` `[reject]` Edge: gate unpinned (same as row 3).
  - `[low]` `[reject]` Edge: Home on home in the cold window adds a history entry (same as row 5, covered by the doc patch).
  - `[low]` `[reject]` Edge: Home from a sub-path of home (`/admin/x`) compares unequal and navigates — the title link's comparison is identical and the spec says not to touch it.
  - `[low]` `[reject]` Edge: Home is not disabled while logout is in flight — Lists and Change password are not either, and `RouteGuard` redirects to `/auth` once `clearAuth()` runs.
  - `[low]` `[reject]` Edge: floor test omits the admin's `menu-admin` — the entry has the same shape as its siblings and the admin viewport is not a floor concern named by the spec.
  - `[false]` `[reject]` Edge: no-op assertions pass vacuously — `history.length` is read synchronously after the click, and `navigate('/')` would push before any redirect.
  - `[low]` `[patch]` Edge: closure says `navigation.spec.ts` "pins both" — reworded to say it pins the resolve half and the live title link, and that the observe gate is unpinned hardening.
  - `[low]` `[reject]` Edge: Intent says four entries, Tasks five (same as row 9).
  - `[low]` `[reject]` Edge: `epic-9-context.md` rewrite (same as row 2).
  - `[low]` `[reject]` Verification gap: gate unpinned — filed disposition was defer; not deferred because the branch is unreachable with today's Apollo and the only fix adds a testing surface; noted under residual risks.
  - `[low]` `[reject]` Verification gap (other): choosing Home from a cold cache on the home route is untested — the same accepted window as the title link, now documented.
  - `[low]` `[reject]` Intent alignment: `epic-9-context.md` regenerated beyond 9.7's scope (same as row 2).
  - `[low]` `[reject]` Intent alignment: the Lists-500 test cannot fail before the change (same as row 3; the spec calls it a characterization).
  - `[low]` `[reject]` Intent alignment: cold-cache path untested (same as row 21).
  - `[false]` `[reject]` Intent alignment: no evidence the tests ran — `npm run lint`, `npm run build` and the E2E run (75 passed for the two specs, 249 passed full suite) were executed.
  - `[false]` `[reject]` Intent alignment: EXPERIENCE.md anchor renumbering is a large surface — the spec's task was to re-derive the anchors the added lines shifted.

## Design Notes

**Reconciling "gated on resolve mode, after the `!data` check".** Read literally, an error branch placed after
`if (!data) return null` would make resolve mode spin forever on a failed, dataless query — contradicting the same
criterion's "`HomeRedirect` in resolve mode still resolves to `/lists`". The observable outcomes are unambiguous, so
the implementation is:

```ts
if (isAdmin) return '/admin'
if (mode === 'resolve' && error) return '/lists'   // observe never reads an error
if (!data) return null                              // observe: cold/failed ⇒ null ⇒ live link
```

Observe mode therefore reaches `!data` before it could ever consult `error`, which is the ordering the criterion cares
about; resolve mode keeps its graceful failure path. Comment it so nobody "fixes" the order.

**Why `navigate('/')` and not `navigate(homePath)`.** Home must not re-derive home: it delegates to `/` exactly like the
title link, so a cold cache (`homePath === null`) still resolves correctly through `HomeRedirect`, and the two entry
points cannot drift.

## Verification

**Commands:**
- `cd bp_front && npm run lint && npm run build` -- expected: clean.
- `cd bp_front && npm run test:e2e -- navigation.spec.ts narrow-viewport.spec.ts` -- expected: new cases red before the
  `AppShell` change (no `menu-home`), all green after, on `chromium` and `mobile`; every pre-existing case unmodified
  and green.
- `cd bp_front && npm run test:e2e` -- expected: full suite green against the rebuilt production image on `:2080`.

## Auto Run Result

Status: done

**Implemented change.** The account menu's first entry is now Home (`menu-home`, `HomeIcon`). Off the resolved home
route it navigates to `/`, so `HomeRedirect` resolves it exactly as it does for the title link; on the resolved home
route (`alreadyHome`) it only closes the menu. `useHomePath` gates its error branch on `mode === 'resolve'`, so observe
mode can never resolve to `/lists` from an error, while resolve mode keeps `error` before `!data` so a dataless failure
cannot spin forever (the AC's "after the `!data` check" wording is reconciled in Design Notes).

**Files changed.**

- `bp_front/src/components/AppShell.tsx:73` — `goHome` and the first `MenuItem`.
- `bp_front/src/lib/lists/homePath.ts:57` — error branch gated on resolve mode; comment rewritten.
- `bp_front/src/routes/HomeRedirect.tsx` — comment only.
- `bp_front/e2e/navigation.spec.ts` — eight `Story 9.7` cases (menu contents for user and admin, Home off and on the home
  route, zero-lists user, admin, keyboard, `Lists` forced to HTTP 500).
- `bp_front/e2e/narrow-viewport.spec.ts` — 320px case: every menu entry inside the viewport.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` — §1.1 menu table and Home paragraph, §3 branch
  table and mode bullets, §7.1 menu string, re-derived anchors.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the FR57 index bullets and four body entries closed in place.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `9-7-…: review`.
- `_bmad-output/implementation-artifacts/epic-9-context.md` — regenerated by this run because a planning artifact was
  newer than the cache.

**Review findings.** 26 findings across four layers: 5 patched (all `low`: closure wording twice, cold-cache doc
sentence, stale anchors, import order), 0 deferred, 21 rejected with the reasons in the triage log (chiefly: the gate
is unpinned hardening of a branch Apollo does not reach, the `epic-9-context.md` regeneration is a compiled cache, and
four claims were false).

**Follow-up review recommended: false.** No `high` and no `medium` entries were patched (patched counts: high 0,
medium 0, low 5).

**Verification.**

- Red first: the 15 new cases that need `menu-home` (7 per project plus the 320px case) failed against the old image;
  the two `Lists`-500 characterization cases passed, as the spec expected.
- `cd bp_front && npm run lint && npm run build` — clean, re-run after the review patches.
- `npm run test:e2e -- navigation.spec.ts narrow-viewport.spec.ts` — 75 passed, 23 skipped (mobile-only cases on
  chromium), 0 failed; every pre-existing title-link case unmodified.
- Full `npm run test:e2e` (implementation run) — 249 passed, 25 skipped by design, 0 failed.
- Matrix audit: every I/O row has a covering case that ran and passed.

**Residual risks.** The observe-mode error gate has no test that fails without it: Apollo `cache-only` reports a miss
as `data: undefined, error: undefined`, so the `Lists`-500 case passes with or without the gate. If a future Apollo
surfaces an error there, the ungated branch would make the title link inert on `/lists`; the gate prevents that but
nothing would notice its removal. The post-review edits were documentation, comment-adjacent ledger wording and an
import reorder, so the E2E suite was not re-run after them (lint and build were).
