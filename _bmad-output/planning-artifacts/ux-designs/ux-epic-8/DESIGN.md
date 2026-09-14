---
title: 'DESIGN.md — the visual contract Bag Please actually ships'
epic: 8
story: '8.7'
status: 'current'
supersedes:
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-design-specification-epic-4.md
verified_at_commit: '3af2d575e852ca186467c67a051e5ddc77a6fe6d'
verified_on: '2026-09-09'
---

# DESIGN.md — Bag Please visual contract

**This document DESCRIBES what is deployed. It does not prescribe.** Every factual claim below names the file it can
be checked against, with the line as of the verification commit. Where a claim cannot have a code anchor because it
was a decision rather than an implementation, it is labelled **RULING** and carries its `epics.md` identifier
instead. The two are not interchangeable: a ruling tells you a choice was made, a code anchor tells you it is still
true.

**Verified at commit `3af2d575e852ca186467c67a051e5ddc77a6fe6d`** (`git rev-parse HEAD`, 2026-09-09), working tree
clean, `git diff --stat bp_front/src/ bp_front/e2e/ bp_back/` empty.

**Line numbers will drift.** Anchor to the *construct* named beside the number; the number is a convenience as of the
commit above, not the claim. `deferred-work.md` (Story 8.2 entry, the `noWrap` census) is the worked example of what
happens when the number is treated as the claim: Story 8.3 moved the `addedBy` attribution from `:451` to `:215` and
invalidated every figure written before it.

The behavioural half of this contract — routes, guards, screen states, dialog conventions, realtime — is
[`EXPERIENCE.md`](./EXPERIENCE.md), verified at the same commit.

---

## 1. The theme is one file, and it is small

The entire visual contract is `bp_front/src/theme.ts` — **84 lines**, a single `createTheme(…)` call exported as the
default (`theme.ts:29`, `:84`), applied once at the root together with `CssBaseline` (`main.tsx:45-46`).

There is no second theme, no `CssVarsProvider`, and no per-route theme override. The comment at `theme.ts:26-28`
records why the plain `ThemeProvider` was chosen: "Epic 5 ships dark-mode only (the design's own default); a plain MUI
ThemeProvider dark theme is intentional — CssVarsProvider is not required."

**Nothing outside `theme.ts` hardcodes a colour.** Measured this pass:
`grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src` returns hits in `src/theme.ts` only. Every component colour is a
palette reference (`'primary.main'`, `'text.secondary'`, `'background.default'`) or a `theme => theme.…` callback.

---

## 2. Palette — dark, and only dark

`theme.ts:30-53`. `mode: 'dark'` is hardcoded at **`theme.ts:31`**; there is no light branch anywhere in `src/`.

| Role | Value | Anchor |
| --- | --- | --- |
| `background.default` | `#000000` | `theme.ts:33` |
| `background.paper` | `#1C1C1E` | `theme.ts:34` |
| `primary.main` | `#4DC9BB` (teal accent) | `theme.ts:37` |
| `error.main` | `#FF453A` | `theme.ts:40` |
| `success.main` | `#30D158` | `theme.ts:43` |
| `warning.main` | `#FFD60A` | `theme.ts:46` |
| `text.primary` | `#FFFFFF` | `theme.ts:49` |
| `text.secondary` | `rgba(235,235,245,0.6)` | `theme.ts:50` |
| `divider` | `rgba(84,84,88,0.5)` | `theme.ts:52` |

**Deliberate absences, each verifiable by reading the same block:**

- **No `secondary` palette key.** `theme.ts:36-47` declares `primary`, `error`, `success`, `warning` and nothing
  else, so `color="secondary"` anywhere in the app would resolve to MUI's default purple. Nothing uses it.
- **No `info` key**, though `severity="info"` alerts exist (`ListDetailPage.tsx:214`, `ListsPage.tsx:115`) — they
  render in MUI's default info blue, which is the one place a non-palette hue reaches the screen.
- **No `mode: 'light'` path, no `colorSchemes`, no `prefers-color-scheme` handling.** See §11, Known Gaps.

The seed is recorded at `theme.ts:26`: "Dark palette, seeded from `design/theme.js` (dark) + the dark teal accent."
`design/theme.js` is Epic 4 material and is *not* the authority — `theme.ts` is.

---

## 3. `custom.bp.*` — six declared tokens, two consumed

`theme.ts` augments MUI's `Theme` with a `custom.bp` namespace (module augmentation at `theme.ts:5-24`, values at
`theme.ts:72-81`) so that "later stories can reach the design tokens that don't map onto MUI's palette"
(`theme.ts:3-4`).

| Token | Value | Anchor | Status |
| --- | --- | --- | --- |
| `bg2` | `#0E0E10` | `theme.ts:74` | **declared, unconsumed** |
| `card2` | `#2C2C2E` | `theme.ts:75` | **declared, unconsumed** |
| `navBg` | `rgba(0,0,0,0.78)` | `theme.ts:76` | **consumed** — `AppShell.tsx:102` |
| `sheetBg` | `#1C1C1E` | `theme.ts:77` | **declared, unconsumed** |
| `accentSoft` | `rgba(77,201,187,0.18)` | `theme.ts:78` | **consumed** — `WelcomeBanner.tsx:37` |
| `stripe` | `rgba(255,255,255,0.03)` | `theme.ts:79` | **declared, unconsumed** |

> **RE-MEASURED, and it contradicts the planning text.** `epics.md:1247-1251` (UX-DR-E8-11) says the closing story
> "**documents** the deployed design — including the `custom.bp.*` tokens in `theme.ts`", which reads as a namespace
> in use. It is not: `grep -rn 'custom\.bp' bp_front/src | grep -v 'src/theme.ts'` returns **exactly two hits**, both
> named above. **Four of the six tokens have zero consumers** and are recorded here as declared-and-unconsumed, never
> as in-use tokens. The correction is filed in `deferred-work.md` under Story 8.7.

`sheetBg` (`#1C1C1E`) is byte-identical to `background.paper` (`theme.ts:34`), so even if it were adopted it would
add no new surface value. `bg2`, `card2` and `stripe` name a two-tier surface system and a zebra-stripe treatment
that the deployed app does not have.

---

## 4. Typography

`theme.ts:54-64` declares exactly three things:

- **`fontFamily`** (`theme.ts:55`): `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif`. A system stack — no webfont is loaded anywhere (`index.html:1-18` links no font, and there is no
  `@font-face` in `src/`).
- **`body1`** (`theme.ts:56-59`): `fontSize: '1.0625rem'` (17px at a 16px root), `lineHeight: 1.3`.
- **`body2`** (`theme.ts:60-63`): `fontSize: '0.8125rem'` (13px), `lineHeight: 1.4`.

**Every other variant is MUI's default.** That is not an omission this document is papering over — it is what the
screens use. `h4` is the page title on `/lists` (`ListsPage.tsx:99`), `/lists/:id` (`ListDetailPage.tsx:148`),
`/list/:id` (`ListShoppingPage.tsx:404`), `/admin` (`AdminPage.tsx:87`), `/auth` (`AuthPage.tsx:233`) and
`/account/password` (`ChangePasswordPage.tsx:113`); `h6` is the section/group heading (`AppShell.tsx:130` on the home
link, `ListDetailPage.tsx:262` category name, `ListShoppingPage.tsx:483` group name, `AdminPage.tsx:93,139`,
the empty-state headlines at `ListsPage.tsx:124`, `ListDetailPage.tsx:223`, `ListShoppingPage.tsx:465`); `caption` is
the `addedBy` attribution (`ListShoppingPage.tsx:197`). All of those resolve to MUI's own scale.

So the **declared** type scale is: family + `body1` + `body2`. The **used** scale adds `h4`, `h6`, `caption` at MUI
defaults. Anything claiming a fuller custom scale is describing a document, not this app.

---

## 5. Component defaults — there are exactly three

`theme.ts:65-71`. The whole `components` block:

| Component | Override | Anchor |
| --- | --- | --- |
| `MuiButton` | `styleOverrides.root = {borderRadius: 8, textTransform: 'none'}` | `theme.ts:66-68` |
| `MuiTextField` | `defaultProps = {variant: 'outlined'}` | `theme.ts:69` |
| `MuiAppBar` | `defaultProps = {elevation: 0}` | `theme.ts:70` |

**Deliberate absences:**

- **No top-level `shape` key** (so `shape.borderRadius` is MUI's default 4; the button's `8` is a per-component
  override, not a global rounding).
- **No `MuiPaper` override.** Every `Paper` in the app is MUI stock on `background.paper` — the list card
  (`ListsPage.tsx:140`), the empty states (`ListsPage.tsx:123`, `ListDetailPage.tsx:222,231`,
  `ListShoppingPage.tsx:464,473`), the category cards (`ListDetailPage.tsx:245`), the shopping groups
  (`ListShoppingPage.tsx:481`), the admin panels (`AdminPage.tsx:92,129`).
- **No `MuiDialog`, `MuiAlert`, `MuiChip` or `MuiIconButton` override.** The dialog and alert consistency described
  in `EXPERIENCE.md` §6 is achieved by every call site passing the same props, not by a theme default. That is a
  real, load-bearing difference: it is enforced by review and by copying, and nothing fails if a new dialog forgets.
- **No `spacing` or `breakpoints` key**, so both are MUI defaults (8px spacing unit; `xs 0 / sm 600 / md 900 /
  lg 1200 / xl 1536`). Every `sx` figure in this document is in those units.

---

## 6. Surfaces, density and layout rhythm

**The app bar** (`AppShell.tsx:98-106`) is the one surface with a bespoke treatment:
`bgcolor: theme => theme.custom.bp.navBg` (`:102`), `backdropFilter: 'blur(20px)'` (`:103`), and
`borderBottom: 1px solid ${theme.palette.divider}` (`:104`) instead of a shadow — which is what `MuiAppBar`'s
`elevation: 0` default (`theme.ts:70`) makes possible. It is `position="sticky"` (`AppShell.tsx:99`), so it stays put
while a list scrolls under the blur. The shell is a `100dvh` flex column (`AppShell.tsx:97`) with the routed content
in a `<Box component="main">` that grows (`AppShell.tsx:240-242`).

**Page frame.** All four content routes share one shape: a full-height `Box` with `py: {xs: 3, sm: 4}` wrapping a
`<Container maxWidth="md">` — `ListsPage.tsx:84-85`, `ListDetailPage.tsx:115-116`,
`ListShoppingPage.tsx:389-390`, `AdminPage.tsx:85-86`. The two form routes break the pattern deliberately: `/auth`
centres a `maxWidth: 360` column on `100dvh` with no container and no card (`AuthPage.tsx:199-210`), described in its
own comment as "edge-to-edge on the dark background (UX 'ambient identity', no card)" (`AuthPage.tsx:20`);
`/account/password` uses the same 360px column, centred inside the shell rather than the viewport
(`ChangePasswordPage.tsx:100-112`).

**Card padding is responsive and consistent**: `p: {xs: 3, sm: 4}` on every centred empty state
(`ListsPage.tsx:123`, `ListDetailPage.tsx:222,231`, `ListShoppingPage.tsx:464,473`), `p: {xs: 2, sm: 3}` on the two
admin panels (`AdminPage.tsx:92,129`).

**Row density.** A shopping row is `px: 2, py: 1` with a `gap: 1.5` (`ListShoppingPage.tsx:139-141`) — tighter than
a management row, which is a stock MUI `ListItem` with `gap: 1` (`ListDetailPage.tsx:330`). A category header row is
`px: 2, py: 1.5` (`ListDetailPage.tsx:252-253`), matching the shopping group heading's `px: 2, py: 1.5`
(`ListShoppingPage.tsx:486`). Groups are separated by `<Stack spacing={2}>` on both screens
(`ListDetailPage.tsx:237`, `ListShoppingPage.tsx:479`), and rows within a shopping group by a `Divider`
(`ListShoppingPage.tsx:491`).

**Focus.** Two bespoke focus rings exist, both in `primary.main`: the app-bar home link uses a 2px outline at
`outlineOffset: 3` and pairs `.Mui-focusVisible` with the native `:focus-visible` selector (`AppShell.tsx:157-160`,
with the reason at `:155-156`); the shopping row uses a 2px outline at `outlineOffset: -2` so the ring stays inside
the row's own bounds (`ListShoppingPage.tsx:144-148`). Everything else uses MUI's stock focus treatment.

**Text overflow is NOT uniform, and that is a measured inconsistency** — see §7.

---

## 7. Text truncation: the measured census

This is the one part of the visual contract that is genuinely inconsistent across the app. It is recorded here as
measured, not tidied.

### 7.1 `noWrap` with a numeric cap — **four** sites

> **RE-MEASURED, and the census figure in `deferred-work.md` is superseded — as a SCOPING call, not a miscount.**
> The Story 8.2 entry (`deferred-work.md:1860-1868`, quoted sentence at `:1862-1864`) states, twice-corrected and
> dated 2026-09-07:
>
> > "Verified by grep at review Pass 2 and again 2026-09-07: `noWrap` with a fixed pixel cap survives at exactly
> > three sites — `AppShell.tsx:192`, `ListsPage.tsx:195`, `AdminPage.tsx:200`. `ListShoppingPage.tsx:215` **is a
> > fourth `noWrap` + numeric cap** and is discussed, unresolved, in the entry below."
>
> So that entry had already IDENTIFIED the fourth site; it excluded it from the count and routed it to a neighbouring
> entry instead. The superseded figure is therefore the census total — "exactly three" — and what supersedes it is a
> scoping judgement, not a correction of a bad grep: a `noWrap` with a hard numeric cap is the same construct
> wherever it sits, so the census here is **four**. `grep -rn 'noWrap' bp_front/src` at the verification commit
> returns those four plus three uncapped sites (§7.2). Note also that the old entry's own anchor has drifted a second
> time: `ListShoppingPage.tsx:215` (itself a 2026-09-07 correction of `:451`) is now **`:197`** — the construct, the
> `addedBy` attribution `Typography` with `maxWidth: 100`, is what the entry is about. Filed in `deferred-work.md`
> under Story 8.7.

| Site | Cap | Anchor |
| --- | --- | --- |
| App-bar username chip | `{xs: 140, sm: 220}` | `AppShell.tsx:192-193` |
| `/lists` row name | `{xs: 200, sm: 420}` | `ListsPage.tsx:195` |
| `/admin` username cell | `{xs: 140, sm: 260}` | `AdminPage.tsx:200` |
| `/list/:id` `addedBy` attribution | `100` | `ListShoppingPage.tsx:197` |

### 7.2 `noWrap` with no numeric cap — three sites

`ListShoppingPage.tsx:166-175` (the shopping item name, inside a `minWidth: 0` flex box at `:165`),
`ListShoppingPage.tsx:403-411` (the page header, `maxWidth: '100%'`), `ListShoppingPage.tsx:482-489` (the group
heading, `maxWidth: '100%'`). These clip by the flex mechanism rather than by a number: a `noWrap` element inside a
`minWidth: 0` flex parent resolves its own min-width to zero, so its siblings squeeze it and `overflow: hidden`
ellipsises the result. `maxWidth: '100%'` does not prevent that. There is no fixed pixel cap to point at, which is
why these three are not in the §7.1 census and why a grep for a number will not find them.

### 7.3 The three other treatments

- **Two-line clamp**, `/lists/:id` item name: `display: '-webkit-box'`, `WebkitBoxOrient: 'vertical'`,
  `WebkitLineClamp: 2`, `overflow: 'hidden'`, `overflowWrap: 'anywhere'` — `ListDetailPage.tsx:338-349`. The comment
  at `:333-337` records that the clamp sits on the element holding the text so the E2E `expectNotClipped` height
  branch measures the real text box.
- **Wrap, never truncate**: the `/lists/:id` page title (`overflowWrap: 'anywhere'`, no `noWrap`, no `maxWidth` —
  `ListDetailPage.tsx:147-154`, with the reason at `:133-136`) and the category heading
  (`ListDetailPage.tsx:261-268`, reason at `:256-260`).
- **Nowrap by CSS rather than by prop**: the app-bar home link sets `whiteSpace: 'nowrap'` directly
  (`AppShell.tsx:153`) to stop the bar growing to two lines below ~340px (`:150-152`).

**So the same entity — an item name — truncates two different ways on the two list screens**: a two-line clamp on
`/lists/:id` (`ListDetailPage.tsx:338-349`), a single-line `noWrap` on `/list/:id`
(`ListShoppingPage.tsx:166-175`). Recorded, not fixed; filed in `deferred-work.md` under Story 8.7.

---

## 8. Iconography

All icons are `@mui/icons-material` (`@mui/icons-material` 9.3.1, `package.json:20`); no custom SVG icon set exists
in `src/`. The complete set in use, measured this pass by
`grep -rho "from '@mui/icons-material/[A-Za-z0-9]*'" bp_front/src | sort -u` (21 raw import lines resolve to)
— **16 distinct icons**:

`Add`, `AdminPanelSettings`, `ArrowBack`, `CheckBox`, `CheckBoxOutlineBlank`, `Close`, `DeleteOutlined`,
`EditOutlined`, `FormatListBulleted`, `GroupOutlined`, `LockReset`, `Logout`, `LogoutOutlined`, `PersonAddAlt1`,
`PersonRemoveOutlined`, `Storefront`.

Conventions that hold across the set:

- **Outlined variants for destructive and secondary actions** (`DeleteOutlined`, `EditOutlined`, `GroupOutlined`,
  `LogoutOutlined`, `PersonRemoveOutlined`); filled for the primary/menu ones.
- **`fontSize="small"` wherever an icon sits beside text or inside a row.** Three different hosts, all consistent:
  an `IconButton` child (`ListDetailPage.tsx:284,298,308,359,369`, `ListsPage.tsx:159,170,183`,
  `AdminPage.tsx:215,228`, `ShareMembersDialog.tsx:161`, `WelcomeBanner.tsx:30`); a `ListItemIcon` inside a
  `MenuItem` — the app bar has **no** `IconButton` at all (`AppShell.tsx:210,217,226,232`); and an icon inside a text
  `Link` on the two back links (`ListDetailPage.tsx:123`, `ListShoppingPage.tsx:399`).
- **`color="error"` marks the destructive path.** Nine sites, and they are not all controls. Seven are: the row
  `IconButton`s (`ListDetailPage.tsx:303,364`, `ListsPage.tsx:165,178`, `AdminPage.tsx:221`,
  `ShareMembersDialog.tsx:156`) and the delete-user confirm `Button` (`DeleteUserDialog.tsx:91`). The other two are
  **error TEXT, not controls** — the bare `Typography role="alert"` on `/auth` (`AuthPage.tsx:286`) and
  `/account/password` (`ChangePasswordPage.tsx:196`), which are the alert-idiom deviations recorded in
  `EXPERIENCE.md` §6.2. So "destructive ⇒ `color="error"`" holds; the converse does not.
- **Every icon-only control has an `aria-label` naming its target**, e.g. `` `Remove category ${group.name}` ``
  (`ListDetailPage.tsx:304`), `` `Delete ${user.username}` `` (`AdminPage.tsx:220`),
  `` `Remove ${member.username}` `` (`ShareMembersDialog.tsx:157`). **Most, but not all, are also wrapped in a
  `Tooltip`**: only four files import `Tooltip` (`AdminPage.tsx`, `ListsPage.tsx`, `ListDetailPage.tsx`,
  `ShareMembersDialog.tsx`), and `WelcomeBanner.tsx:23-29`'s dismiss button carries
  `aria-label="Dismiss welcome message"` with no `Tooltip`. The `aria-label` is the invariant; the `Tooltip` is the
  list-screen and admin-panel habit.
- **The shopping checkbox glyphs are presentational**: `CheckBoxIcon` / `CheckBoxOutlineBlankIcon` at
  `ListShoppingPage.tsx:152-164`, with the comment at `:151` recording that the state they show lives on the row.
  They are *not* a `Checkbox` component — see `EXPERIENCE.md` §5.3.1.

**App identity mark.** `bp_front/public/favicon.svg` — a 32×32 rounded-square (`rx="7"`) in `#1C1C1E` carrying a teal
`#4DC9BB` shopping-bag glyph. Those are exactly `background.paper` (`theme.ts:34`) and `primary.main`
(`theme.ts:37`); the mark is the palette. It is linked as the tab icon at `index.html:5` and shipped into the PWA
build via `includeAssets: ['favicon.svg']` (`vite.config.ts:23`).

---

## 9. The PWA / browser colour chain

The app is installable (Story 7.14) and its colour identity has to hold in three places that the app's own
`ThemeProvider` never reaches. All three are black, and the chain is deliberate.

| Surface | Value | Anchor |
| --- | --- | --- |
| Browsing-session address bar | `<meta name="theme-color" content="#000000">` | `index.html:11` |
| Installed app UI colour | `theme_color: '#000000'` | `vite.config.ts:36` |
| Android cold-launch splash | `background_color: '#000000'` | `vite.config.ts:37` |

The reason is recorded verbatim at `vite.config.ts:31-35`: "BOTH colours are black on purpose. The app is dark-only
(`src/theme.ts`: mode 'dark', `background.default` '#000000', no light variant), and `background_color` is Android's
cold-launch splash colour — the recipe's '#ffffff' would flash white before an all-black app (AR-E7-14)." The
`index.html` half carries the same argument at `:7-10`: the manifest's `theme_color` only applies once installed, so
without the meta tag "Chrome on Android paints a default light address bar above an all-black, dark-only app".

**The rest of the manifest, verbatim from `vite.config.ts:24-43`:** `id: '/'`, `name: 'Bag Please'`,
`short_name: 'Bag Please'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, and three icons —
`/icons/icon-192.png` (192×192), `/icons/icon-512.png` (512×512), `/icons/icon-512-maskable.png` (512×512,
`purpose: 'maskable'`).

**Launcher icons are generated, not hand-drawn.** `npm run icons` (`package.json:13`) runs
`bp_front/scripts/generate-icons.sh`, which rasterises `public/favicon.svg` with `rsvg-convert` and composes the
maskable variant with ImageMagick. The maskable icon is the artwork at ~60% (307px) centred on an **opaque `#1C1C1E`
field** filling the 512 canvas — `#1C1C1E` again being `background.paper`. The geometric reason is at
`generate-icons.sh:35-40`: the glyph's extreme corner sits 0.46 of the icon width from centre, so a full-bleed raster
would land it 235px out against Android's 204.8px safe radius and be clipped by the adaptive mask. A clean re-run is
byte-identical (`generate-icons.sh:12-17`).

**`display: 'standalone'` is a visual decision with a navigational cost**, and it is the reason the app-bar home link
may never disappear — see `EXPERIENCE.md` §7.2 and **RULING AR-E7-8a** (`epics.md:606-630`).

---

## 10. What is deliberately absent

Recorded so an absence is not mistaken for an oversight. Where this pass could not tell which it is, it says so.

| Absent | Decided? | Evidence |
| --- | --- | --- |
| Light mode / any `prefers-color-scheme` handling | **Decided.** | `theme.ts:26-28`, `vite.config.ts:31-35`, **RULING UX-DR-E8-11** (`epics.md:1247-1251`) |
| A `secondary` palette key | **Undetermined.** No decision is recorded anywhere; nothing uses `color="secondary"`, so it has never been needed. | `theme.ts:36-47` |
| A top-level `shape` / global border radius | **Undetermined.** The `borderRadius: 8` on `MuiButton` (`theme.ts:67`) suggests a rounding intent that was never globalised. | `theme.ts:65-71` |
| A `MuiPaper` / `MuiDialog` / `MuiAlert` theme override | **Undetermined.** Consistency is achieved by every call site passing the same props (all 10 dialogs are `fullWidth maxWidth="xs"`). | `theme.ts:65-71`; the 10 `Dialog` call sites |
| A toast / snackbar layer | **Decided.** No `Snackbar` exists in `src/`; measured this pass, every `toast`/`snackbar` string in `src/` is a comment asserting its absence (11 occurrences across 10 files). See the note below on the one in-flow banner that does ship. | **RULING UX-DR-E8-10** (`epics.md:1243-1245`), carried from **UX-DR-E7-7** (`epics.md:1157-1161`) |
| A webfont | **Undetermined**, but consistent: the stack is native-first (`theme.ts:55`) and no font is linked in `index.html`. | `theme.ts:55`, `index.html:1-18` |
| An offline UI / cached-data indicator | **Decided.** | **RULING UX-DR-E7-7** (`epics.md:1157-1161`): "There is no offline mode in scope"; `vite.config.ts:52` `runtimeCaching: []` |

**The one banner that does ship, and how it squares with the ruling.** `WelcomeBanner.tsx` (43 lines) renders a
**dismissible `Alert severity="success" variant="outlined"`** at the top of `/lists` content
(`WelcomeBanner.tsx:16-42`, mounted at `ListsPage.tsx:86-88`), tinted with `custom.bp.accentSoft` on a
`primary.main` border (`:36-37`) and carrying a close `IconButton` (`:22-32`). It is the one-time post-registration
welcome (Story 5.3, FR5), shown once and never persisted. Two more in-flow banners live on `/auth`: the
`session-expired-alert` (`severity="warning"`, `AuthPage.tsx:211-220`) and the `password-changed-message`
(`severity="success"`, `:222-231`).

These do **not** contradict UX-DR-E8-10 / UX-DR-E7-7, and the reconciliation is worth stating because the rulings use
the word "banner". First, the rulings forbid **adding** one — "*Nothing in this epic adds* a toast, a snackbar or a
banner" (`epics.md:1243`) — and all three predate them by two epics. Second, none is a notification *layer*: they are
ordinary in-flow `Alert`s in the document, not floating, not auto-dismissing, not stacked, and each is a **one-shot
transition receipt** (you just registered / your session expired / your password changed) rather than a confirmation
of a state change the UI already shows. That is exactly the case the rulings' own rationale carves out — "state
changes are confirmed by the UI changing" applies to a filter applying or a row toggling, not to a fact about a
navigation the user cannot otherwise see. A *new* banner for a mutation outcome would violate the ruling; these do
not.

---

## 11. Known gaps — recorded, **not** implemented by this story

The three gaps UX-DR-E8-11 names (`epics.md:1247-1251`), and nothing else. `git diff --stat bp_front/src/
bp_front/e2e/ bp_back/` is empty at the verification commit: Story 8.7 ships no code, and none of the three is acted
on. The narrow-viewport cross-reference that used to sit here as "§11.4" is **not** a gap and now has its own
section, §12.

### 11.1 Light mode

**Out of scope because** Epic 8 is a fixes epic, not a redesign — **RULING UX-DR-E8-11** (`epics.md:1247-1251`,
`md`, 2026-09-05: "small ux fixes based on real usage"). Adding it is not a theme tweak: `mode: 'dark'` is hardcoded
(`theme.ts:31`), the PWA chain is black in three places on the explicit reasoning that there is no light variant
(`vite.config.ts:31-35`, `index.html:7-10`), and the app-bar treatment is a translucent black over blur
(`AppShell.tsx:102-103`). A light mode is a cross-cutting story with its own UX ruling, not a token swap.

### 11.2 A design-token overhaul — including the four dead tokens

**Out of scope because** UX-DR-E8-11 freezes the visual language for this epic. What a future overhaul inherits,
measured in §3: `bg2`, `card2`, `sheetBg` and `stripe` are declared in `theme.ts:72-81` and typed in the module
augmentation at `theme.ts:5-24` with **zero consumers**. `sheetBg` duplicates `background.paper` exactly. The
overhaul question is therefore not "which values" but "does the two-tier surface + stripe system these four tokens
describe belong in this app at all" — adopt them or delete them, but the current state (a typed namespace two-thirds
of which nothing reads) is the gap. The truncation inconsistencies in §7 belong to the same overhaul.

### 11.3 Epic 4 bottom-tab navigation

**Out of scope because** it never shipped and UX-DR-E8-11 names it explicitly as out of scope
(`epics.md:1247-1251`). `ux-design-specification-epic-4.md` describes a Today · Lists · Household bottom-tab design;
the deployed app has a single top `AppBar` with an overflow menu (`AppShell.tsx:98-236`) and no tab bar anywhere in
`src/`. The Epic 4 spec is retained for history and now carries a superseded banner. Note that adopting bottom tabs
would reopen **RULING AR-E7-8a** (`epics.md:606-630`), since the app-bar title link is currently the only in-app exit
from `/admin` and `/account/password`.

---

## 12. Cross-reference: the narrow-viewport picture

**This section is not a known gap** — it is the single place the 320px picture is collected, for both documents.
`EXPERIENCE.md` §13 points here rather than repeating it.

Story 8.1's measurement (**AR-E8-2a**, `epics.md:772`) filed several things rather than fixing them, and they are the
visual half of the 320px story. They live in `deferred-work.md:1852-1979`.

> **The runtime figures below are QUOTED from their original 2026-09-05 measurement (Story 8.1/8.2, at 320px against
> the production image on :2080). They were NOT re-measured in this pass** — Story 8.7 ships no code and ran no
> browser. Every *source* figure elsewhere in this document is re-measured at the verification commit; these are the
> exception, and they are attributed rather than adopted.

- **The app-bar username chip truncates at the floor** (measured 2026-09-05, not re-measured here). With a 42-char
  username the chip *box* is fine — x 120.6, width 180, right edge 300.6 ≤ 320, no horizontal scroll — but the *text*
  is `scrollWidth 369 > clientWidth 140`, i.e. an ellipsis. Not fixable the way `/lists/:id` was fixed (give the
  title its own row): the app bar has no second row. Any real fix is a different treatment and wants its own story.
- **`/lists` and `/admin` carry the same uncorrected construct.** The `/lists` row name measured
  `scrollWidth 380 > clientWidth 200` at 320px (2026-09-05, not re-measured here). `/admin` *is* visited at the floor
  by `e2e/admin.spec.ts`, but makes no layout assertion there — the cap is unmeasured, not unreached.
- **Two 360px specs now widen rather than narrow.** `e2e/navigation.spec.ts` and `e2e/item-editing.spec.ts` each call
  `page.setViewportSize({width: 360})`, which in the retargeted `mobile` project widens past the 320px floor.
- **The name-keyed-testid collision** (`item-row-<name>`, `shopping-item-<name>`, `filter-category-option-<name>`,
  `add-item-category-option-<name>`) is OPEN and wants its own story; see `EXPERIENCE.md` §9.2.

---

## 13. How to check this document

Re-run **from the repository root** (the same base `EXPERIENCE.md` §14 uses, so the two blocks can be pasted one
after the other):

```bash
grep -rn 'custom\.bp' bp_front/src | grep -v 'src/theme.ts'
# expect exactly 2 lines: AppShell.tsx:102 (navBg), WelcomeBanner.tsx:37 (accentSoft)

grep -rn 'noWrap' bp_front/src
# expect 9 lines: the 4 numeric-cap sites (§7.1), the 3 uncapped ones (§7.2),
# and 2 PROSE COMMENTS at ListDetailPage.tsx:133-134 explaining why the title has none

grep -rniE 'snackbar|toast' bp_front/src
# expect 11 lines across 10 files, every one a comment; no Snackbar is imported or rendered

grep -rn '#[0-9A-Fa-f]\{3,8\}' bp_front/src
# expect src/theme.ts only

grep -rho "from '@mui/icons-material/[A-Za-z0-9]*'" bp_front/src | sort -u
# expect the 16 distinct icons in §8 (21 raw import lines collapse to 16)
```

If a count here disagrees with a count in `epics.md`, `epic-8-context.md` or `deferred-work.md`, **this document is
the one that was measured** — at `3af2d575e852ca186467c67a051e5ddc77a6fe6d`, on 2026-09-09. If it disagrees with the
source, the source wins and this document is stale: correct it, and name the figure it supersedes.

**Who re-verifies, and when.** This document goes stale the same way the two specs it supersedes did — silently. The
trigger is therefore mechanical: **re-run the block above and update the verification commit at the start of any
story that changes `bp_front/src/theme.ts`, `vite.config.ts`, `index.html` or `public/favicon.svg`, and at every epic
close**, whichever comes first. A story that finds a claim here false fixes the claim in the same commit as the code
— that is cheaper than a fifth epic re-deriving the design by reading source (**AR-E8-8**, `epics.md:859-870`).
