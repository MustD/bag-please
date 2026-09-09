---
title: 'Story 8.7 — Write Down the Design This App Actually Has'
type: 'chore'
created: '2026-09-09'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['oversized'] # spec is ~5.1k tokens; the story's deliverable is a verified anchor map, and trimming it would drop anchors
deferred:
  - summary: >-
      Nothing forward-references the two new design documents from the places a future story actually
      enters through: epics.md frontmatter still lists both stale UX specs as inputDocuments, and the
      Epic 8 UX source note names no replacement.
    evidence: |-
      Verified 2026-09-09: epics.md frontmatter inputDocuments lists ux-design-specification.md and
      ux-design-specification-epic-4.md; the UX source note at epics.md:1165-1166 says both are stale
      without naming what supersedes them; epic-8-context.md is untouched. The banners only reach a
      reader who already opened a stale spec. Not fixed here because AC4 settled the discoverability
      mechanism as a banner on the stale specs, and editing epics.md is beyond that instrument.
    location: >-
      _bmad-output/planning-artifacts/epics.md:6,11,1165-1166
    severity: medium
  - summary: >-
      Three further stale description surfaces carry no superseded marker - the two ux-design-directions
      HTML artefacts and the docs/ frontend descriptions - and the stale specs remain machine-readable as
      current because their banners are prose, not frontmatter.
    evidence: |-
      Verified 2026-09-09: ux-design-directions.html and ux-design-directions-epic-4.html both exist
      unmarked; docs/component-inventory-bp_front.md and docs/architecture-bp_front.md describe the same
      frontend; neither stale spec gained a status/superseded_by frontmatter key, while both new documents
      declare supersedes:. A tool reading frontmatter still sees two authoritative UX specs. Not fixed here
      because AC4 names exactly two files and specifies a banner at the top, which is satisfied.
    location: >-
      _bmad-output/planning-artifacts/
    severity: low
baseline_revision: '3af2d575e852ca186467c67a051e5ddc77a6fe6d'
---

<intent-contract>

## Intent

**Problem:** The project's two UX specifications are both stale — `ux-design-specification.md` describes the Next.js
app Epic 5 replaced, `ux-design-specification-epic-4.md` a bottom-tab design that never shipped — so Epics 6, 7 and 8
each re-derived the design by reading source, and several load-bearing rulings (manage-vs-use, inert-but-present home
link, no-toast, the closed shopping row) live only in epic prose.

**Approach:** Write `DESIGN.md` (deployed visual identity) and `EXPERIENCE.md` (deployed IA, routes, screen states,
navigation) under `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/`, every claim anchored to a source file and
verified at a recorded commit; mark the two stale specs superseded without deleting them. This story ships no code.

## Boundaries & Constraints

**Always:** Describe what shipped, never prescribe. Every factual claim names the file it can be checked against.
Re-measure every count, token, value and line number in this pass — never copy a figure from `epics.md`,
`epic-8-context.md`, `deferred-work.md` or another spec, and correct any figure this pass finds stale. Record the
verification commit (`git rev-parse HEAD`) in both documents. Attribute each non-code ruling to where it was decided
(`epics.md` AR/UX-DR identifier, or the story spec).

**Never:** Change anything under `bp_front/src/`, `bp_front/e2e/` or `bp_back/`. Implement or design light mode, a
design-token overhaul, or bottom-tab navigation — they are recorded as known gaps only. Delete or rewrite the two
stale specs beyond prepending a banner. Treat NFR-E8-6 (production-artifact E2E on both viewports) as applicable:
it is deliberately not, and that must be stated in the story record rather than left as a silent omission.

**Rules of the pass, applied to every claim written:** a fact that survives re-checking against source at HEAD is
written with its `file:line` anchor; a planning figure that disagrees with source is replaced by the measured value
and the superseded figure is named; a `custom.bp.*` key with zero consumers is recorded as declared-and-unconsumed,
never as an in-use token; a decision with no code anchor is recorded with its `epics.md` identifier and labelled a
ruling rather than a code fact; and each known gap is listed with the reason it is out of scope and is not implemented.

</intent-contract>

## Code Map

**Files this story writes (the only files it changes):**

- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` -- **NEW.** Directory does not exist; create it.
  Visual identity: palette, tokens, type scale, component defaults, surfaces, density, iconography, PWA colours.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- **NEW.** IA: route map, guards, the
  manage-vs-use split, screen states, navigation model, dialog conventions, realtime, testid conventions, auth UX.
- `_bmad-output/planning-artifacts/ux-design-specification.md` -- **change: prepend a banner only** (AC4). Frontmatter
  closes at `:13`; the `# UX Design Specification bag-please` title is `:15`. Put the banner between the two so the
  YAML stays parseable. Superseded by this story's `DESIGN.md` +
  `EXPERIENCE.md`; stopped being accurate at **Epic 5** (which replaced the Next.js app it describes).
- `_bmad-output/planning-artifacts/ux-design-specification-epic-4.md` -- **change: prepend a banner only** (AC4).
  Same shape: frontmatter closes at `:12`, title at `:14`. Stopped being accurate at **Epic 5** — its bottom-tab design never shipped.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- **change at close.** `:111`
  `8-7-write-down-the-design-this-app-actually-has: backlog` -> `done`.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- **change.** Append this story's entries (see Tasks).

**Source evidence, all READ-ONLY — verified 2026-09-09 at `3af2d575e852ca186467c67a051e5ddc77a6fe6d`:**

- `bp_front/src/theme.ts` -- the whole visual contract, 84 lines. `:31` `mode: 'dark'` hardcoded; `:33-34` background
  `#000000` / paper `#1C1C1E`; `:37` primary `#4DC9BB`; `:40` error `#FF453A`; `:43` success `#30D158`; `:46` warning
  `#FFD60A`; `:49-50` text `#FFFFFF` / `rgba(235,235,245,0.6)`; `:52` divider `rgba(84,84,88,0.5)`. **No `secondary`
  key and no top-level `shape`.** Typography `:54-64` declares only `fontFamily`, `body1` (`1.0625rem`/1.3) and
  `body2` (`0.8125rem`/1.4) — every other variant is MUI default. `components` `:65-71` has exactly three entries:
  `MuiButton` root `{borderRadius: 8, textTransform: 'none'}`, `MuiTextField` `variant: 'outlined'`, `MuiAppBar`
  `elevation: 0`. Module augmentation `:5-24`; token values `:72-81`.
- `bp_front/src/components/AppShell.tsx` -- app bar `:98-106` (`custom.bp.navBg` at `:102`, `blur(20px)` `:103`,
  divider border `:104`); home link `:127-164` — `aria-current` `:134`, `preventDefault` for plain primary clicks only
  `:135-147`, the inert-but-present rationale in the comment at `:119-125`; user chip `:177-197` (`noWrap` `:192`,
  `maxWidth: {xs: 140, sm: 220}` `:193`); menu `:200-236` (Lists always, Change password non-admin, Admin
  admin-only, Logout always/disabled while in flight).
- `bp_front/src/App.tsx` -- the whole route map, 35 lines: `/auth` public `:17`; everything else under `RouteGuard`
  `:21` then `AppShell` `:22`; `/` `:23`, `/lists` `:24`, `/lists/:id` `:25`, `/list/:id` `:26`,
  `/account/password` `:27`, `/admin/*` double-guarded `:28`, `*` -> `/` replace `:30`.
- `bp_front/src/routes/RouteGuard.tsx:11-31`, `AdminGuard.tsx:9-22` -- render `null` (no flash) and redirect in an
  effect; RouteGuard carries the `passwordChanged` / `?expired=1` variants.
- `bp_front/src/routes/HomeRedirect.tsx:22-39` + `bp_front/src/lib/lists/homePath.ts:31-49` -- home resolution in one
  place: admin -> `/admin` (`:41`, lists query skipped `:37`), error -> `/lists` (`:45`), unresolved -> `null` (`:46`),
  no lists -> `/lists` (`:48`), else oldest list (`:49`). `'resolve'` is cache-first, `'observe'` cache-only (`:38`) —
  which is why the app bar never re-derives home (AR-E7-8 / AR-E6-7).
- `bp_front/src/lib/lists/order.ts` -- `byCreatedAtAsc` `:51-59`, `byName` `:75-77`, private `byNameThenId` `:91-93`,
  `UNCATEGORIZED_KEY`/`_NAME` `:97-98`, `groupItemsByCategory` `:132-174`. `keepEmpty` (`:120-131`) is the ONE
  deliberate difference between the two surfaces; the synthetic bucket always sorts last.
- `bp_front/src/lib/lists/itemFilter.ts` -- `EMPTY_ITEM_FILTER` `:26`, `CheckedFilter` `:34`, `matchesItemFilter`
  `:44-52`, `isItemFilterActive` `:57-59`, `useItemFilter` `:72-106`. Empty selection means ALL (`:19-23`).
- `bp_front/src/components/ListFilters.tsx:47-162` -- presentational, one definition, two call sites; sorts with
  `byName` `:66`; omits the checked toggle when the props are absent `:136`; `filter-category-option-<name>` `:127`.
- `bp_front/src/routes/ListDetailPage.tsx` -- management: cache-only title query `:56-57`, per-list queries `:59-60`,
  **no subscription** (`:404-419` says why), refetch after every mutation; header `:126-176` (column below `sm`,
  title without `noWrap`/`maxWidth` `:147-153`, buttons `flexShrink: 0` `:157`); filter row gate `:189-204`; state
  branches `:213-235` (`list-detail-notice` severity **info**, `-loading`, `-empty`, `-no-matches`); item name
  2-line clamp `:353-356`; category controls only when `category` is non-null `:277-311`.
- `bp_front/src/routes/ListShoppingPage.tsx` -- shopping: `ShoppingItemRow` `:61-223` is the single control —
  `role="checkbox"` `:80`, `aria-checked` `:81`, `aria-label={`Toggle ${item.name}`}` `:82`, `aria-describedby`
  `:83`, `tabIndex={0}` `:84`; pointer pair with `MOVE_TOLERANCE_PX` `:39,85-113`, synthetic-click gate `detail === 0`
  `:114-125`, key handling `:126-135`; store chip `:176-185` and `addedBy` `:187-201` are inside it (AR-E8-8a's
  closed surface); no optimistic update, revert-by-cache + `shopping-action-error` `:373-386,449-453`. Subscriptions
  `:261-284` / `:288-308`; `keepEmpty: false` `:359-361`; FORBIDDEN -> `/lists` `:369-371`; switcher `:414-436`.
- `bp_front/src/lib/lists/listsQueries.ts:264-305` -- the two subscriptions, consumed only via `subscribeToMore`;
  `:42-43` records that membership has no subscription and consumers refetch.
- `bp_front/src/routes/AuthPage.tsx` -- one route, two modes `:15,45,97-105`; adaptive registration `:56-75,296-319`;
  one-shot banners `:211-231`; top-level error is a bare `Typography role="alert"` `:283-293`.
- `bp_front/src/routes/ChangePasswordPage.tsx:40,73-93,193-203`; `bp_front/src/routes/AdminPage.tsx:155-165`
  (`role="status"` success alert, the only one) -- the three documented deviations from the inline-`Alert` idiom.
- `bp_front/src/components/CreateListDialog.tsx:25,60-72,92,99-126` -- canonical dialog: native `<form>` + `noValidate`,
  validate-on-submit, `NAME_MAX = 100` enforced twice, error `Alert` last in `DialogContent`, `{dialog}-{field|cancel|
  submit|error}` testids. `EditItemDialog.tsx:56-81` and `ConfirmDialog.tsx:47-62` are the render-phase open-transition
  seeding pattern (no `setState` in an effect — project lint). `ConfirmDialog` has no `<form>`, deliberately.
- `bp_front/vite.config.ts:24-43` -- manifest verbatim: `id`/`start_url`/`scope` `'/'`, `name`/`short_name`
  `'Bag Please'`, `display: 'standalone'`, `theme_color`/`background_color` `'#000000'` with the dark-only reason at
  `:31-37`; `registerType: 'autoUpdate'` `:23` with the no-toast note `:17-22`. `bp_front/index.html:5,11` -- SVG
  favicon and the browsing-session `theme-color`. `bp_front/package.json:13` -- the `icons` script.
- `_bmad-output/planning-artifacts/epics.md` -- ruling anchors: AR-E7-8 / AR-E7-8a `:599-627` (inert-but-present, and
  why the app bar link is the only exit on `/admin` and `/account/password`); AR-E8-8a `:853-858` (closed row);
  AR-E8-8 `:859-872` (this story's own charter, incl. `md`'s "last, not first" ruling of 2026-09-05); UX-DR-E8-10
  `:1243-1245` and UX-DR-E7-7 `:1157-1161` (no toast); UX-DR-E8-11 `:1247-1251` (the three known gaps).
  The manage-vs-use boundary is `md`'s ruling, carried in `epic-8-context.md` under "UX & Interaction Patterns".
- `_bmad-output/implementation-artifacts/deferred-work.md:1852-1979` -- what Story 8.1's/8.2's measurement filed rather
  than fixed (AC5's cross-reference): the app-bar chip at `scrollWidth 369 > clientWidth 140`, the `/lists` and
  `/admin` caps, the name-keyed-testid collision entry, and the two 360px specs that now widen rather than narrow.

**Facts re-measured in this pass that CONTRADICT existing planning text — write the measured value, and note it:**

- `custom.bp.*` declares six tokens; only **two** have consumers — `navBg` at `AppShell.tsx:102` and `accentSoft` at
  `WelcomeBanner.tsx:37`. `bg2`, `card2`, `sheetBg`, `stripe` are declared and unconsumed.
- `noWrap` with a **numeric** cap survives at **four** sites, not the three `deferred-work.md:1860-1868` totals
  (range corrected during implementation from `:1858-1866`; the sentence quoted is at `:1862-1864`):
  `AppShell.tsx:192-193`, `ListsPage.tsx:195`, `AdminPage.tsx:200`, and `ListShoppingPage.tsx:197` (`maxWidth: 100`).
  Three further `noWrap` sites carry no numeric cap: `ListShoppingPage.tsx:167` (item name), `:406`, `:485`.
- No component file hardcodes a hex colour: `grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` hits only `theme.ts`.
- No `Snackbar` exists in `src/`; every `toast`/`snackbar` string is a comment asserting its absence.

## Tasks & Acceptance

**Execution:**
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` -- create the directory and write the visual
  contract from the Code Map's theme/surface/density/iconography/PWA anchors, each claim carrying its `file:line`,
  plus a Known Gaps section (light mode, token overhaul incl. the four dead tokens, Epic 4 bottom tabs) and the
  verification commit -- AC1, AC3, AC5.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- write the route map, guards, home
  resolution, the manage-vs-use split with `keepEmpty` as its one deliberate difference, per-route screen states,
  navigation model, dialog conventions, realtime, testid conventions and auth UX, each with its `file:line`; record
  the four rulings (manage-vs-use, inert-but-present, no-toast, closed shopping row) with their `epics.md`
  attribution; cross-reference the AR-E8-2a filed items -- AC1, AC2, AC3, AC5.
- `_bmad-output/planning-artifacts/ux-design-specification.md` -- prepend the superseded banner between the
  frontmatter and the `#` title -- AC4.
- `_bmad-output/planning-artifacts/ux-design-specification-epic-4.md` -- prepend the same-shaped banner -- AC4.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- append: the corrected fixed-cap census (four numeric
  sites, superseding the "exactly three" figure), the four unconsumed `custom.bp.*` tokens, and the three visual
  inconsistencies this pass measured (two item-name truncation mechanisms; three row-interactivity implementations;
  the `AuthPage`/`ChangePasswordPage`/`AdminPage` alert deviations) -- recorded, not fixed.
- spec Implementation Notes -- record the verification commit, the re-measured figures with the planning figures they
  supersede, and the explicit statement that NFR-E8-6 does not apply to this story -- AC6.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- flip `8-7-...` to `done` at close.

**Acceptance Criteria:**
- Given the two new documents, when any factual claim in them is read, then it names the source file (and line range
  where the claim is line-specific) it can be checked against, and the commit both were verified at is recorded in each.
- Given `DESIGN.md`, when the visual contract is read, then it records the dark palette values, the six `custom.bp.*`
  tokens with which two are actually consumed, the declared type scale, the three component defaults, the surface and
  density treatments, and the PWA/browser colour chain — all as measured in this pass, with no figure copied from a
  planning document.
- Given `EXPERIENCE.md`, when the navigation model is read, then it records every route with its guard, how `/`
  resolves in each of its five branches, and the manage-vs-use split with `keepEmpty` named as the single deliberate
  divergence between the two list screens.
- Given the decisions that are not in the code, when `EXPERIENCE.md` is read, then the manage-vs-use boundary, the
  inert-but-present home link (AR-E7-8), the no-toast convention (UX-DR-E8-10 / UX-DR-E7-7) and the closed shopping
  row (AR-E8-8a) each appear with the identifier that decided them, marked as rulings rather than code facts.
- Given a figure in `epics.md`, `epic-8-context.md` or `deferred-work.md` that this pass re-measures differently,
  when the documents are written, then the measured value is written and the superseded figure is named, and
  `deferred-work.md` carries the correction.
- Given the two stale specs, when the story is complete, then each carries a banner above its title naming what
  supersedes it and the epic at which it stopped being accurate, both files still exist, and neither has any other
  edit (`git diff` on each shows an insertion only).
- Given the known gaps, when `DESIGN.md` is read, then light mode, a design-token overhaul and the Epic 4 bottom-tab
  navigation each appear with the reason they are out of scope, and `git diff --stat bp_front/src/ bp_front/e2e/
  bp_back/` is empty — none of them is implemented, and this story ships no code.
- Given the story is closed, when the record is read, then it states that NFR-E8-6 is deliberately not applicable
  because the story ships no code, and names AC3's file-anchoring as its analogue.

## Spec Change Log

## Review Triage Log

### 2026-09-09 — Review pass

- verdicts: 40 findings — high 0, medium 18, low 20, false 2, maybe-false 0
- findings:

**Blind Hunter**

- `[medium]` `[patch]` The census correction misquotes the entry it supersedes — verified at `deferred-work.md:1863-1864`: the old entry does say "`ListShoppingPage.tsx:215` **is a fourth `noWrap` + numeric cap**". Dropping that clause turns a scoping disagreement into an apparent miscount. Patched: clause quoted in full, correction reframed.
- `[low]` `[patch]` Two ranges cited for the same superseded passage (`:1858-1866` in the spec Code Map, `:1859-1868` in `DESIGN.md` §7.1; actual `:1860-1868`) — verified. Patched to one correct range in both.
- `[low]` `[patch]` The superseded entry's own anchor `:215` has drifted to `:197` and the correction never says so — verified. Patched with a drift clause.
- `[medium]` `[patch]` "`role="alert"` appears 23 times" counts the prose comment at `ConfirmDialog.tsx:31`; rendered count is 22 — verified by grep. Patched.
- `[medium]` `[patch]` §6.2's "the other 22 `role="alert"` uses on success-shaped content" — verified false twice over: only `AuthPage.tsx:224` is a success-shaped `role="alert"`; the rest are error/warning. Patched to name the single case and drop the count.
- `[medium]` `[patch]` Published self-check commands do not return their stated results (`noWrap` returns 9 lines incl. two comments; the icons grep returns 21 lines, not 16) — verified. Patched.
- `[low]` `[patch]` §11 says "three gaps" then lists four subsections, and §11.4 duplicates `EXPERIENCE.md` §13 verbatim — verified in the diff. Patched: §11.4 renumbered out and de-duplicated.
- `[low]` `[patch]` §12's "four rulings, in one place" is not a complete index — verified: AR-E8-8 is added in prose immediately after, and UX-DR-E8-4/E7-4/E7-6b/E8-11 and AR-E8-6 are cited but absent. Patched.
- `[low]` `[patch]` Dangling "report #2" reference in `DESIGN.md` §7.2 — verified: neither document defines the term. Patched.
- `[low]` `[patch]` The Epic 4 banner's clauses contradict ("never deployed" vs "stopped being accurate at Epic 5") — verified in the diff. Patched.
- `[medium]` `[defer]` Nothing forward-references the new documents from `epics.md` (frontmatter `inputDocuments` still lists both stale specs; the UX source note at `:1165-1166` names no replacement) or `epic-8-context.md` — verified. Deferred: AC4 settled the discoverability mechanism as a banner on the stale specs; editing `epics.md` is beyond the intent's chosen instrument.
- `[low]` `[defer]` The stale specs stay machine-readable as current — no `superseded_by`/`status` frontmatter key, only prose — verified. Deferred: AC4 specifies a banner "at the top" and is satisfied; a frontmatter key is an enhancement beyond the intent's mechanism.
- `[medium]` `[reject]` The spec's own frontmatter contradicts its deliverables (`status: in-review` vs the `done` sprint row, `deferred: []`, `context: []`, empty logs) — rejected under the standing rule that a finding whose fix is to edit this build's spec is not actionable here; step-04 Finalize sets `status: done` and populates `deferred`.
- `[medium]` `[patch]` Pending invites is an undocumented shipped surface — verified: `PendingInvites.tsx` is 112 lines with its own error state and five testids, and AC1 requires the deployed IA. Patched with a subsection.
- `[low]` `[patch]` `WelcomeBanner` is never reconciled with the ruling quoted as forbidding "a banner", though it ships one and is cited three times as token evidence — verified. Patched.
- `[medium]` `[patch]` The 320px floor has no section and `playwright.config.ts` is unanchored, while §9 claims the E2E suite holds every behaviour in place — verified. Patched with a responsive-contract subsection.
- `[low]` `[patch]` No re-verification trigger or owner, in documents whose premise is inevitable drift — verified. Patched with one line.
- `[low]` `[patch]` The two "how to check" blocks disagree on working directory — verified. Patched to a common base.

**Edge Case Hunter**

- `[low]` `[patch]` "Destructive controls carry `color="error"` and nothing else does" — verified false: `DeleteUserDialog.tsx:91` and `ShareMembersDialog.tsx:156` are uncensused destructive controls, and `AuthPage.tsx:286` / `ChangePasswordPage.tsx:196` are non-control error text. Patched.
- `[low]` `[patch]` "Every icon-only control is wrapped in a Tooltip" — verified false at `WelcomeBanner.tsx:23-29` (aria-label, no Tooltip). Patched.
- `[medium]` `[patch]` The `fontSize="small"` bullet calls its anchors "IconButton child" — verified false: `AppShell.tsx` contains zero `IconButton`, and two anchors are icons inside a text `Link`. Misnaming the construct defeats the documents' own anchoring rule. Patched.
- `[medium]` `[patch]` Self-check commands do not return stated counts — same defect as the Blind Hunter row above; grouped, patched once.
- `[medium]` `[patch]` §6.2's "other 22" arithmetic — same defect as the Blind Hunter row above; grouped, patched once.
- `[low]` `[patch]` The dialog testid convention has unlisted `-confirm` exceptions (`delete-user-confirm`, `reset-password-confirm`, `${testId}-confirm`) and ShareMembers' `share-submit` with no `-cancel` — verified. Patched.
- `[medium]` `[patch]` The remove-category failure residue is described wrongly — verified at `ListDetailPage.tsx:443-452`: a failed item delete propagates before `deleteCategory` runs, so the category survives; the code comment says so. The document copied the planning-prose failure mode instead of re-measuring it. Patched.
- `[low]` `[patch]` The RouteGuard table lists three parallel conditions, but `RouteGuard.tsx:21-25` gives `passwordChanged` precedence and drops `?expired=1` — verified. Patched.
- `[low]` `[patch]` The `admin-users-empty` row omits the `&& !usersError` clause at `AdminPage.tsx:177` — verified; a test written from the table would never see that testid. Patched.
- `[low]` `[patch]` The catch-all bullet ignores the `/admin/*` splat at `App.tsx:28`, which matches first — verified. Patched.
- `[low]` `[defer]` `ux-design-directions.html` and `ux-design-directions-epic-4.html` carry no superseded marker — verified both exist. Deferred: AC4 names exactly the two `ux-design-specification*.md` files.
- `[medium]` `[patch]` §11.4 reproduces Story 8.1/8.2's 2026-09-05 runtime figures verbatim while the document's contract claims every figure was re-measured at the verification commit — verified against `deferred-work.md:1852-1979`. Patched: figures attributed to their original measurement date.

**Verification Gap**

- `[medium]` `[patch]` §6.2's "22" count — grouped with the Blind Hunter row; patched once. (The layer filed `No verification gaps found` for the change itself: the diff touches no executable code.)
- `[medium]` `[reject]` `sprint-status.yaml` `done` vs the spec's `in-review` — rejected: fix is to edit this build's spec, which Finalize performs.
- `[medium]` `[reject]` Spec frontmatter `deferred: []` while four entries were appended to the ledger — rejected on the same rule; Finalize populates it.
- `[medium]` `[patch]` Self-check commands do not produce stated output — grouped with the Blind Hunter row; patched once.
- `[low]` `[patch]` The two halves of this story cite the superseded passage with different ranges — grouped with the Blind Hunter range row; patched once.

**Intent Alignment**

- `[low]` `[reject]` The documents make rendered-behaviour claims backed only by source-text evidence, the gap NFR-E8-6 would normally close — rejected as already recorded: the story record argues the non-applicability in words and names AC3's file-anchoring as the substituted instrument, which is the honest disclosure the finding asks for.
- `[medium]` `[reject]` Status surfaces straddle (`sprint-status.yaml` closed, spec record not) — same defect as the frontmatter rows; rejected, Finalize resolves it.
- `[false]` `[reject]` "Scope expansion beyond AC5's three gaps" (four `deferred-work.md` entries) — refuted: AC3 mandates recording every figure this pass supersedes, and two of the four entries are exactly those corrections. Filing them is compliance, not expansion.
- `[low]` `[defer]` `docs/component-inventory-bp_front.md` and `docs/architecture-bp_front.md` describe the same frontend un-bannered — verified they exist; same class as the HTML directions row. Deferred: outside AC4's two named files.
- `[false]` `[reject]` Epic close-out (`epic-8: in-progress`, `epic-8-retrospective: optional`) not performed — refuted: the charter scopes this story to the two documents and the banners; the retrospective is a separate, optional sprint entry.

#### Patch application detail

What the 23 patch instructions dispatched from the routing above actually changed, grouped by kind. This is the
implementation record for the `patch` rows; the verdicts and routes are in the list above. No code was touched.

- **Fairness of the corrections (3).** The `noWrap` census correction was reframed from "miscount" to "the census
  excluded a site it had already identified", with the superseded sentence now quoted in full in `DESIGN.md` §7.1,
  `deferred-work.md` and note 1 above; the passage's range was reconciled to `:1860-1868` in all three places; and
  the old entry's twice-drifted anchor (`:451` -> `:215` -> now `:197`) is named so a reader following it does not
  land on unrelated code.
- **Claims that did not survive re-checking (7).** Corrected: the remove-category failure residue (items propagate
  and the category is left INTACT — `ListDetailPage.tsx:443-452`, not orphans); `admin-users-empty`'s
  `&& !usersError` clause (`AdminPage.tsx:177`); `RouteGuard`'s `passwordChanged`-wins precedence
  (`RouteGuard.tsx:21-25`, not three parallel conditions); the `/admin/*` splat exception to the catch-all
  (`App.tsx:28`); and three iconography claims — the `color="error"` census (9 sites, two of them error TEXT not
  controls), the `fontSize="small"` hosts (`AppShell` has zero `IconButton`; those are `ListItemIcon` in `MenuItem`),
  and "every icon-only control is wrapped in a `Tooltip`" (`WelcomeBanner.tsx:23-29` is not).
- **Counts that included comments (2).** `role="alert"` is 22 rendered + 1 comment (`ConfirmDialog.tsx:31`), stated
  as such; and the sentence indicting "the other 22 uses on success-shaped content" was wrong twice — exactly ONE
  other `role="alert"` is success-shaped (`AuthPage.tsx:224-225`) and it is now named instead of counted.
- **Self-check blocks that did not reproduce (3).** The icons grep now pipes through `sort -u` with a
  digit-tolerant pattern (21 raw lines -> 16 distinct); the `noWrap` expectation states 9 lines including the two
  prose comments at `ListDetailPage.tsx:133-134`; and both blocks now run from the repository root so they can be
  pasted one after the other. Every published command was executed and returns the stated result.
- **Structure and coverage (8).** `DESIGN.md` §11.4 was renumbered out of Known Gaps into its own §12 and is now the
  single copy, with `EXPERIENCE.md` §13 pointing at it; its 2026-09-05 runtime figures are explicitly attributed and
  marked not-re-measured. `EXPERIENCE.md` §12 was retitled to the four AC2-mandated rulings, with the other nine
  cited rulings tabled after it. "report #2's mechanism" was replaced by the mechanism itself. The epic-4 banner no
  longer says a never-deployed design "stopped being accurate". Added: a pending-invites / sharing subsection
  (§5.1.1), a responsive-contract subsection anchoring `playwright.config.ts` and `NARROW_FLOOR_PX` (§9.1), the
  `-confirm` and `ShareMembersDialog` dialog-testid exceptions and the three `PendingInvites` name-keyed testids
  (§9.2), a reconciliation of `WelcomeBanner` and the two `/auth` banners with the no-toast ruling (both documents),
  and a named re-verification trigger at the end of each document.

## Design Notes

**Why the anchors are the deliverable.** The Epic 7 retrospective's D2 finding is that stories write authoritative
prose that steers later work with nothing verifying it. A `file:line` on every claim is what makes this document
falsifiable: a future reader can diff it against the code instead of trusting it. Where a claim cannot have a code
anchor — a ruling — it gets an `epics.md` identifier instead and is labelled as a ruling, so a reader can tell a
decision from a habit. Both kinds are required; neither substitutes for the other.

**Line numbers will drift, and that is fine.** Anchor to the construct and give the line as of the recorded commit —
"`theme.ts:31` `mode: 'dark'`", not "line 31". `deferred-work.md:1861-1867` is the worked example of what happens
otherwise: Story 8.3 moved a construct from `:451` to `:215` and invalidated every number written before it.

**The contradictions are the most valuable content.** Three planning statements do not survive re-measurement (the
three-site cap census, and the implicit reading that the `custom.bp.*` namespace is in use). Writing the measured
value and naming the superseded one is exactly what AC3's "no figure is copied from another planning document"
is for — silently writing the right number would leave the wrong one live in `deferred-work.md`.

**Banner shape** (identical on both stale specs, inserted after the closing `---` of the frontmatter and before the
`#` title, so the YAML stays parseable):

    > **SUPERSEDED.** This specification describes a design that was never deployed / no longer ships. It is retained
    > for history and is not authoritative. Current design: `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md`
    > and `EXPERIENCE.md` (Story 8.7, Epic 8). Stopped being accurate at: **Epic 5** — <one clause: the Next.js app it
    > describes was replaced / its bottom-tab navigation never shipped>.

**Scope of "describes".** Record what is there and what is deliberately absent (no `secondary` palette key, no
`shape`, no `MuiPaper` override, no light-mode path, no toast layer, no membership subscription). An absence that was
decided is design; an absence nobody noticed is a gap. Where this pass cannot tell which, say so rather than guessing.

## Verification

**Commands:**
- `git rev-parse HEAD` -- the commit recorded in both documents; take it at the time of writing, verbatim.
- `grep -rn 'custom\.bp' bp_front/src | grep -v 'src/theme.ts'` -- expected: exactly two hits, `AppShell.tsx:102`
  and `WelcomeBanner.tsx:37`. Confirms the dead-token claim.
- `grep -rn 'noWrap' bp_front/src` -- expected: the four numeric-cap sites and three uncapped ones named in the Code
  Map; re-check before writing the census.
- `grep -rniE 'snackbar|toast' bp_front/src` -- expected: comments only, no component usage.
- `grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` -- expected: `src/theme.ts` only.
- `git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` -- expected: empty. This story ships no code.
- `git diff --stat _bmad-output/planning-artifacts/ux-design-specification.md
  _bmad-output/planning-artifacts/ux-design-specification-epic-4.md` -- expected: insertions only, no deletions.
- `head -20` on each stale spec -- expected: frontmatter intact and parseable, banner between it and the `#` title.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0. Runs because the epic's gate says so, not
  because this story touched code; a failure here means something else is broken and must be reported, not absorbed.

**Manual checks:**
- Spot-check five claims per document by opening the cited file at the cited construct — including at least one
  ruling anchor in `epics.md` — and confirm the claim reads true. Any claim that does not is rewritten, not softened.
- Confirm NFR-E8-6's non-applicability is stated in the story record in words, so its absence reads as a decision.

## Implementation Notes

**Verification commit.** `git rev-parse HEAD` -> `3af2d575e852ca186467c67a051e5ddc77a6fe6d`, taken at the time of
writing with a clean working tree. It is recorded in the frontmatter (`verified_at_commit`) and in the opening
paragraph of BOTH new documents. `git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` was empty before the pass and
is empty after it: **this story ships no code.**

**Files written:**
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` (NEW; directory created)
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` (NEW)
- `ux-design-specification.md`, `ux-design-specification-epic-4.md` — banner insertion only (4 lines each, 0
  deletions, frontmatter intact)
- `deferred-work.md` — four appended entries under a Story 8.7 heading
- `sprint-status.yaml` — `8-7-...: backlog` -> `done`

### Re-measured figures, and the planning figures they supersede

**1. The `noWrap` fixed-cap census: four sites, not three — a scoping call, not a miscount.**
Superseded figure: the census TOTAL in the Story 8.2 entry (`deferred-work.md:1860-1868`, sentence at `:1862-1864`,
twice-corrected and dated 2026-09-07), quoted in full: *"Verified by grep at review Pass 2 and again 2026-09-07:
`noWrap` with a fixed pixel cap survives at exactly three sites — `AppShell.tsx:192`, `ListsPage.tsx:195`,
`AdminPage.tsx:200`. `ListShoppingPage.tsx:215` **is a fourth `noWrap` + numeric cap** and is discussed, unresolved,
in the entry below."* That entry had therefore already IDENTIFIED the fourth site and excluded it from its own count;
its grep was correct. What is superseded is the total, and what supersedes it is a scoping judgement — a `noWrap`
with a hard numeric cap is the same construct wherever it sits. Measured value: **four** numeric-cap sites — those
three plus `ListShoppingPage.tsx:197` (`maxWidth: 100`). Three further `noWrap` sites carry no numeric cap
(`ListShoppingPage.tsx:167`, `:406`, `:485`). Two anchor corrections went with it: the passage's own range was cited
as `:1858-1866` in this spec's Code Map and `:1859-1868` in a first draft of `DESIGN.md` — it is `:1860-1868`, now
used in both; and the old entry's `ListShoppingPage.tsx:215` (itself a correction of `:451`) has drifted again to
`:197`. Written in `DESIGN.md` §7.1 quoting the superseded sentence in full; filed in `deferred-work.md`.

**2. `custom.bp.*`: six declared, two consumed.**
Superseded reading: `epics.md:1247-1251` (UX-DR-E8-11) — the closing story documents the deployed design "including
the `custom.bp.*` tokens in `theme.ts`", which reads as a namespace in use. Measured value: `grep -rn 'custom\.bp'
bp_front/src | grep -v 'src/theme.ts'` returns **exactly two** hits (`AppShell.tsx:102` `navBg`,
`WelcomeBanner.tsx:37` `accentSoft`). `bg2`, `card2`, `sheetBg`, `stripe` are recorded as **declared-and-unconsumed**,
never as in-use tokens. Written in `DESIGN.md` §3 and §11.2; filed in `deferred-work.md`.

**3. Line anchors in this spec's own Code Map that had drifted, corrected in the documents.**
Every anchor was re-opened at HEAD rather than copied. The ones that moved:
`ListDetailPage.tsx` item-name clamp `:353-356` -> **`:338-349`**; category controls `:277-311` -> **`:276-312`**;
filter-row gate `:189-204` -> **`:197-204`**; header `:126-176` -> **`:137-176`**.
`ListShoppingPage.tsx` subscriptions `:261-284` / `:288-308` -> **`:259-284`** / **`:286-308`**.
`vite.config.ts` `registerType` `:23` -> **`:22`** (`:23` is `includeAssets`); dark-only reason `:31-37` ->
**`:31-35`**.
`EditItemDialog.tsx` open-transition seeding `:56-81` -> **`:67-81`** (`:56-66` is its comment).
`epics.md` AR-E8-8 `:859-872` -> **`:859-870`**; AR-E7-8a is **`:606-630`**; UX-DR-E7-6b is **`:1153-1155`**.
`deferred-work.md`'s Story 8.2 census passage `:1858-1866` -> **`:1860-1868`** (see note 1).
Anchors that re-checked TRUE unchanged include `theme.ts` (all), `App.tsx` (all), `RouteGuard.tsx:11-31`,
`AdminGuard.tsx:9-22`, `HomeRedirect.tsx:22-39`, `homePath.ts:31-49`, `order.ts` (all), `itemFilter.ts` (all),
`ListFilters.tsx:47-162`, `ListDetailPage.tsx:213-235`, `ListShoppingPage.tsx:61-223` and its inner anchors,
`CreateListDialog.tsx`, `ConfirmDialog.tsx:47-62`, `AppShell.tsx` (all), `epics.md:599-605 / 853-858 /
1157-1161 / 1243-1245 / 1247-1251`, `epic-8-context.md:132-133`, `deferred-work.md:1852-1979`.

**4. Three additional facts measured this pass, all confirming the spec's expectations:** no component file hardcodes
a hex colour (`grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` hits `src/theme.ts` only); no `Snackbar` exists in
`src/` and all 11 `toast`/`snackbar` strings across 10 files are comments asserting its absence; `theme.ts` is 84
lines and `App.tsx` 35.

### Verification run

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `3af2d575e852ca186467c67a051e5ddc77a6fe6d` |
| `grep -rn 'custom\.bp' bp_front/src \| grep -v 'src/theme.ts'` | 2 hits, as expected |
| `grep -rn 'noWrap' bp_front/src` | 4 numeric-cap + 3 uncapped, as re-measured |
| `grep -rniE 'snackbar\|toast' bp_front/src` | comments only, no component usage |
| `grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` | `src/theme.ts` only |
| `git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` | empty |
| `git diff --stat` on the two stale specs | 4 insertions each, 0 deletions |
| `head -20` on each stale spec | frontmatter intact and parseable; banner between it and the `#` title |
| `cd bp_front && npm run lint` | exit 0 |
| `cd bp_front && npm run build` | exit 0 (the pre-existing >500 kB chunk-size advisory is unchanged and not an error) |

Manual spot-checks: five claims per document were re-opened at the cited construct, including the ruling anchors
AR-E7-8 (`epics.md:599-605`), AR-E7-8a (`:606-630`), AR-E8-8a (`:853-858`), UX-DR-E8-10 (`:1243-1245`) and
UX-DR-E8-11 (`:1247-1251`), plus the manage-vs-use ruling in `epic-8-context.md:132-133`. Every claim read true; the
line ranges corrected in note 3 above were rewritten rather than softened.

### NFR-E8-6 is deliberately NOT applicable to this story

**NFR-E8-6** (`epics.md:386`, restated at `:1383` and in AC6, `epics.md:2212-2214`) requires every Epic 8 change to be
verified against the production artifact on desktop and at the 320px floor, observed failing before acceptance. **It
does not apply here, and that is a decision rather than an omission:** this story ships no code
(`git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` is empty), so there is no rendered behaviour for a
production-artifact E2E run to observe and nothing that could be made to fail first. `epics.md:1383` already carves
the story out by name ("discharged by every story's gates AC (8.1–8.6; not …)"), and `epic-8-context.md:162-164`
records the same: "The production-artifact E2E constraint is deliberately not applicable to it, since it ships no
code."

**Its analogue in this story is AC3's file-anchoring.** NFR-E8-6 exists so a claim about the app is checked against
the running app instead of asserted; AC3 does the same job for a document by requiring every factual claim to name
the `file:line` it can be checked against, and every figure to be re-measured in this pass rather than copied. The
falsifiability requirement is met by a different instrument, not waived. `npm run lint` and `npm run build` were run
anyway because the epic's gate says so — both exit 0 — and a failure there would have been reported as something else
being broken, not absorbed.

## Auto Run Result

Status: done

### Implemented change

Story 8.7 writes the design contract the project has been missing since Epic 5, as two new documents under
`_bmad-output/planning-artifacts/ux-designs/ux-epic-8/`, and marks the two stale UX specifications superseded without
deleting them. Every factual claim names the `file:line` it can be checked against; every count, token and value was
re-measured at `3af2d575e852ca186467c67a051e5ddc77a6fe6d` rather than copied, and the three planning figures that did
not survive re-measurement are corrected with the superseded figure named. Rulings that exist only in prose carry
their `epics.md` identifier and are labelled as rulings rather than code facts. **This story ships no code.**

### Files changed

- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` — NEW. The visual contract: dark palette, the six
  `custom.bp.*` tokens with which two are consumed, the declared type scale, the three component defaults, surfaces
  and density, the truncation census, iconography, the PWA colour chain, deliberate absences, known gaps, and the
  narrow-viewport cross-reference.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` — NEW. Routes and guards, the five branches of
  home resolution, the manage-vs-use split with `keepEmpty` as its one deliberate divergence, per-route screen states,
  feedback conventions, the navigation model, dialog and testid conventions, realtime, auth, pending invites, the
  responsive contract, and the rulings tables.
- `_bmad-output/planning-artifacts/ux-design-specification.md` — superseded banner only (4 insertions, 0 deletions).
- `_bmad-output/planning-artifacts/ux-design-specification-epic-4.md` — superseded banner only (6 insertions, 0
  deletions).
- `_bmad-output/implementation-artifacts/deferred-work.md` — four appended Story 8.7 entries: the corrected fixed-cap
  census, the four unconsumed tokens, three measured visual inconsistencies, and a pointer to where the contract lives.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `8-7-…: backlog` -> `done`.
- `_bmad-output/implementation-artifacts/spec-8-7-…md` — this spec, with its Implementation Notes and triage log.

### Review findings breakdown

Four review layers reported **40 findings**: high 0, medium 18, low 20, false 2, maybe-false 0. Every finding was
verified against source before its verdict; all 40 have a row in the Review Triage Log above.

- **Patched — 23 findings** (0 high, 13 medium, 10 low, after grouping duplicates across layers). The substantive ones:
  four claims that did not survive re-checking (the remove-category failure residue, `admin-users-empty`'s
  `&& !usersError` gate, `RouteGuard`'s `passwordChanged` precedence, the `/admin/*` splat exception); three
  iconography claims (the `color="error"` census, the `fontSize="small"` hosts — `AppShell` has zero `IconButton` —
  and the Tooltip universal); two counts that included comments; three self-check commands that did not reproduce
  their stated output; a correction that misquoted the entry it superseded; and coverage gaps (pending invites, the
  responsive contract, the dialog-testid exceptions, the `WelcomeBanner` reconciliation, a re-verification trigger).
- **Deferred — 2 entries** (frontmatter `deferred`): no forward reference to the new documents from `epics.md` /
  `epic-8-context.md` (medium); and three further un-bannered stale description surfaces plus the stale specs staying
  machine-readable as current (low). Both are beyond AC4's chosen mechanism and its two named files.
- **Rejected — 6 findings, with reasons.** Four are the same defect seen by three layers — the spec's own frontmatter
  disagreeing with its deliverables (`status`, `deferred`, `context`, empty logs) — rejected because the fix is to
  edit this build's spec, which Finalize performs. One (rendered-behaviour claims backed only by source text) is
  rejected as already disclosed: the story record argues NFR-E8-6's non-applicability in words and names AC3's
  file-anchoring as the substituted instrument. Two are `false`: filing four deferred entries against AC5's three
  gaps is AC3 compliance rather than scope expansion, and not closing the epic is the charter, not an omission.

### Follow-up review recommended: true

Thirteen medium entries were patched on a first pass, which crosses the threshold on volume — but the specific
unverified risk is nameable and is the reason this is `true` rather than a formality: **the patch round added
material that no review layer has seen.** `EXPERIENCE.md` §5.1.1 (pending invites and sharing), §9.1 (the responsive
contract), §9.2's testid exceptions, `DESIGN.md`'s renumbered §12, and both documents' `WelcomeBanner` reconciliation
were written after the layers reported, and their anchors were verified only by the implementer and by the
spot-checks recorded below — not by an independent pass. Given that seven of the patched findings were themselves
inaccurate claims in the first draft, new prose written under time pressure in the same voice is exactly where the
next inaccuracy would sit.

### Verification

| Check | Result |
| --- | --- |
| `git diff HEAD --stat bp_front/src/ bp_front/e2e/ bp_back/` | empty — no code shipped |
| `git diff HEAD --numstat` on the two stale specs | 4 and 6 insertions, **0 deletions** — both files intact |
| YAML frontmatter of both stale specs and both new documents | parses (checked with `yaml.safe_load`) |
| `grep -rn 'custom\.bp' bp_front/src` excluding `theme.ts` | 2 hits — the dead-token claim holds |
| `grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` excluding `theme.ts` | 0 hits |
| `grep -rn 'noWrap' bp_front/src` | 4 numeric-cap + 3 uncapped + 2 comments |
| `grep -rniE 'snackbar\|toast' bp_front/src` | comments only, no component usage |
| `grep -rn 'role="status"' bp_front/src` | `AdminPage.tsx:158` only |
| unique `@mui/icons-material` imports | 16 |
| `npm run lint` | exit 0 (re-run after patches) |
| `npm run build` | exit 0 (re-run after patches; the >500 kB chunk advisory is pre-existing) |

Spot-checked after the patch round that the corrections are present in the files rather than merely reported: the
`role="alert"` wording now reads 22 rendered plus one comment, the cascade residue now reads "the category is left
intact", `EXPERIENCE.md` carries §9.1 and §9.2, and `DESIGN.md`'s cross-reference is now its own §12.

### Residual risks

- **The documents describe rendered behaviour on source-text evidence.** NFR-E8-6 is deliberately not applicable
  (the story ships no code), so claims such as the app bar blurring under a scroll, the two-line clamp ellipsising,
  and the Android splash colour are anchored to the input to rendering, not to an observation of it. Recorded as a
  decision in the Implementation Notes, not waived silently.
- **Line anchors will drift.** Both documents say so and instruct readers to anchor to the named construct; the
  Story 8.2 census entry, whose anchor drifted twice, is cited in-document as the worked example.
- **The two deferred entries leave discoverability partly open**: a reader entering through `epics.md` still gets no
  pointer to the new documents, and three further stale description surfaces remain unmarked.
