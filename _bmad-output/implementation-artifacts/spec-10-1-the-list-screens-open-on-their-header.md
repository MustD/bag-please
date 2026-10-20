---
title: 'The list screens open on their header'
type: 'refactor'
created: '2026-10-20'
status: 'done'
baseline_revision: '022be9e9de4e2ada0483579a287a0baec3a9dc88'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_front/CLAUDE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `/list/:id` and `/lists/:id` each carry a "Back to lists" link that duplicates the account menu's Home / My lists entries and pushes the header down.

**Approach:** Delete both links (and their orphaned imports/spacing), move all E2E navigation onto the shared `openListsViaMenu()`, and amend FR57, `EXPERIENCE.md` and `DESIGN.md` in the same commit.

## Boundaries & Constraints

**Always:** Header is the first content in the page container on both screens; no leftover `mb: 2` gap; no horizontal overflow at 320px; app-bar title + account menu (Home, My lists) unchanged; no spec re-declares a helper; every changed/new test observed failing against the pre-change build first.

**Never:** Add any replacement in-page navigation; touch backend; rewrite historical `implementation-artifacts/` records; hand-edit generated GraphQL types.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shopping view | signed-in on `/list/:id` | `list-shopping-back` absent; `shopping-header` first in container | N/A |
| Management | signed-in on `/lists/:id` | `list-detail-back` absent; header block first in container | N/A |
| Menu nav | account menu → My lists | lands on `/lists`; Home/title go to resolved home | N/A |

</intent-contract>

## Code Map

- `bp_front/src/routes/ListShoppingPage.tsx` -- back `Link` + comment at ~478-488; imports `ArrowBackIcon` (l.17), `Link` (l.12), `RouterLink` (l.2, keep `Navigate/useNavigate/useParams`)
- `bp_front/src/routes/ListDetailPage.tsx` -- back `Link` at ~140-148; imports `ArrowBackIcon` (l.20), `Link` (l.11), `RouterLink` (l.2); verify no other `Link` use (grep shows none)
- `bp_front/e2e/support/ui.ts:84` -- existing `openListsViaMenu()`; reuse
- `bp_front/e2e/{navigation,shopping,sharing,lists,admin}.spec.ts` -- every `list-detail-back`/`list-shopping-back` use; `sharing.spec.ts:31` local `backToLists()` to delete; navigation.spec.ts lines ~160,220-234,282,362,520,605,682-689,769,861; `item-editing.spec.ts` comment mentions back links
- `_bmad-output/planning-artifacts/prd.md:748-755` -- FR57 text + frontmatter `editHistory`; new wording is in `epics.md:163-169`
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md:259-277` -- icon inventory (drop `ArrowBack`, 21→20 distinct, update count line) and the "icon inside a text Link on the two back links" bullet
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md:308,368,591-597` -- anatomy lines, nav table, "one back-link pattern" note

## Tasks & Acceptance

**Execution:**
- `ListShoppingPage.tsx`, `ListDetailPage.tsx` -- remove back link, comment, orphaned imports -- header becomes first child
- E2E specs -- replace back-link clicks with `openListsViaMenu(page)`; delete `backToLists()`; rewrite navigation.spec tests that assert a back link shows into absence assertions (`toHaveCount(0)` for both ids on both screens) -- spec follows FR57 amendment
- `prd.md` -- amend FR57 to Epic 10 wording; add dated `editHistory` entry; `EXPERIENCE.md`/`DESIGN.md` -- correct as in Code Map
- Sprint status (`_bmad-output/implementation-artifacts/sprint-status.yaml` if present) -- reconcile at close

**Acceptance Criteria:**
- Given either list screen, when rendered, then neither back test id is in the DOM and the header is the first content in the container, on desktop and at 320px without horizontal overflow
- Given the account menu, when My lists is chosen from either screen, then the URL is `/lists`
- Given `grep -rn "list-detail-back\|list-shopping-back" bp_front/` (excluding node_modules/dist), then only absence assertions remain in navigation.spec.ts and src has none
- Given the full gate, then `npm run lint`, `npm run build`, `npm run test:e2e` pass on all projects

## Verification

**Commands:**
- `cd bp_front && npm run lint && npm run build` -- expected: pass
- `cd bp_front && npm run test:e2e` -- expected: all projects pass (production stack on :2080 via `docker compose up --build`)

## Auto Run Result

Status: done
- Removed both back links and orphaned imports; E2E moved to `openListsViaMenu()`; FR57, EXPERIENCE.md, DESIGN.md amended.
- Patches applied: 3 (1 medium, 2 low); deferred: 0.
- Verification: lint, build pass; full `npm run test:e2e` 283 passed / 29 skipped / 0 failed (pre-patch); navigation.spec 50 passed after patches. New navigation test observed failing against pre-change build.
- Follow-up review recommended: false.
