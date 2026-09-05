---
title: 'Story 7.14 — Install Bag Please as a Real App'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '3391aa3'
final_revision: '317fa7b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [oversized]
# oversized: nine ACs across five layers (npm, Vite config, generated assets, Caddy, E2E), and two of
#   them (AC1, AC9) require a physical Android phone that is NOT attached to this run. Encoding the
#   measured no-device fact, the substitute instrument, and the residual-recording obligation is what
#   stops an unattended pass from either fabricating device evidence or halting on absent hardware.
---

<intent-contract>

## Intent

**Problem:** Bag Please is a browser tab. Chrome on Android offers only "Add to Home screen" — a bookmark
shortcut — because three WebAPK preconditions are unmet simultaneously: there is no web app manifest, there
are no PNG icons at any size (`bp_front/public/` holds exactly one 305-byte `favicon.svg`, and Chrome will
not build a WebAPK icon from SVG), and no service worker is registered. Missing any one downgrades the
result silently, with no error anywhere.

**Approach:** Add `vite-plugin-pwa` (the epic's last code story, after every dependency bump so any flake is
attributable to the service worker alone), generate and commit the three required PNGs from the existing
favicon artwork, author a dark-only manifest, register an auto-updating service worker whose navigation
fallback and runtime caching both exclude the API surface, and pin the manifest content type in Caddy.
Every WebAPK criterion is then verified *independently and by measurement*, because the one instrument the
epic names — the DevTools Installability panel on a real phone — is unavailable to this run.

## Boundaries & Constraints

**Always:**
- **Verify the built output, never the source.** The manifest link, the icon `<link>`s, the registration
  script and the precache manifest are all injected at build time. Every claim about them is read from
  `bp_front/dist/` and from the **served** response on `:2080`, never from `vite.config.ts`.
- **Both `theme_color` and `background_color` are `#000000`.** Measured, not recalled: `src/theme.ts` sets
  `palette.background.default: '#000000'` on a `mode: 'dark'` theme with no light variant.
  `background_color` is Android's cold-launch splash colour — `#ffffff` would flash white before an
  all-black app. This is a deliberate correction to the upstream recipe (AR-E7-14).
- **The API surface is untouchable.** `navigateFallbackDenylist: [/^\/api/]` **and** an empty
  `runtimeCaching`. The load-bearing case is `GET /api/graphiql`: it is a *navigation*, so without the
  denylist the worker answers it with the SPA shell, and it is this project's only backend-readiness check.
- **Inert-but-present stays inert-but-present.** `AppShell.tsx:119-125` already documents this invariant and
  `navigation.spec.ts:654` already tests it *naming this story*. Story 7.14 confirms and records that
  coverage; it does not re-implement or weaken it.
- **State what was not established.** Where a criterion cannot be measured in this pass, say so outright and
  file it — never substitute a weaker instrument in silence.

**Block If:**
- Any static gate (`npm run lint`, `npm run build`, `docker compose build bp_front`) or the Playwright suite
  cannot be made green **without** a forbidden workaround (a weakened assertion, a widened `ignores`, a
  `@ts-expect-error`, a `skipLibCheck` flip, an `overrides` block, `--legacy-peer-deps`, or `--force`).
- `vite-plugin-pwa` cannot be installed unflagged, or forces a **direct** dependency in
  `bp_front/package.json` to move.
- The service worker cannot be kept off `/api` — i.e. `/api/graphiql` still returns the SPA shell after the
  denylist is in place.

Absence of an Android device is **explicitly NOT a blocking condition** — see Design Note 3.

**Never:**
- No offline mode, no offline UI, no cached-data indicator, no update toast, no reload prompt, no version
  banner (UX-DR-E7-7). `runtimeCaching` stays empty.
- No `apple-touch-icon` / iOS Safari work — explicitly out of scope for FR59.
- No backend change. No `bp_back/`, `gradle/` or `db/` path in the diff, and `:bp_back:test` is out of gate.
- No change to `src/theme.ts`, `src/App.tsx`, `src/components/AppShell.tsx`, `src/routes/HomeRedirect.tsx`,
  `src/lib/lists/homePath.ts`, or any existing assertion in `e2e/navigation.spec.ts`.
- No `build`/`rollupOptions`/`optimizeDeps` block added to `vite.config.ts` to steer Rolldown.
- No fabricated device evidence. No claim that a WebAPK was installed, that a Chrome menu was inspected, or
  that the DevTools Installability panel was read.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Manifest served | `GET /manifest.webmanifest` on `:2080` | `200`, `Content-Type: application/manifest+json`, body parses as JSON with the nine required keys | Wrong type ⇒ AC5 fails; installability dies silently |
| SW scope | `GET /sw.js` on `:2080` | `200`, JS content type, served from **root** scope, no long-term `Cache-Control` | A `/assets/`-scoped worker cannot control `/` |
| GraphiQL navigation | `GET /api/graphiql` with the SW registered and controlling | GraphiQL HTML, **not** the SPA shell | Denylist miss ⇒ backend readiness check silently lies |
| GraphQL POST | `POST /api/graphql` with SW active | Identical response to pre-SW; nothing written to any cache | Any `/api` cache entry ⇒ AC4 fails |
| Subscription upgrade | `ws /api/subscriptions` with SW active | Live subscription still delivers a second session's edit with no reload | Broken realtime ⇒ AC4 fails |
| Maskable safe area | 512×512 maskable PNG | Every pixel outside the central 80%-diameter circle is pure `#1C1C1E` | Artwork in the ring ⇒ Android clips it |
| Icon format | The three committed PNGs | PNG signature, exactly 192/512/512 px square | SVG or wrong size ⇒ no WebAPK icon |
| Cold launch | Installed app at `start_url: '/'` | `HomeRedirect` `replace`s ⇒ history one deep; system back exits | Accepted, must be *recorded*, not discovered |

</intent-contract>

## Code Map

All facts measured 2026-08-20 on a clean tree at `3391aa3` (branch `epic7-maintenance`).

**Files this story changes:**
- `bp_front/package.json` — add `vite-plugin-pwa` to `devDependencies`, pinned exactly at the version
  measured `latest` in this pass (`1.3.0` when planned; re-measure). No other entry moves.
- `bp_front/package-lock.json` — the resolved tree. A dry run measured in this pass: **exit 0, +260
  packages**, `workbox-build@7.4.1` and `workbox-window@7.4.1` arriving as the plugin's own *dependencies*
  (not peers we must add), plus **10 transitive `change` lines** (`@babel/*` 7.29.7→7.29.8, `browserslist`,
  `caniuse-lite`, `electron-to-chromium`, `node-releases`, `update-browserslist-db`,
  `baseline-browser-mapping`). Those drifts are a consequence of re-resolving existing carets, not a sweep —
  record them, do not fight them, and confirm no **direct** dependency version moved.
- `bp_front/vite.config.ts` — add the `VitePWA` plugin to `plugins`. Nothing else in the file changes.
- `bp_front/src/main.tsx` — `registerSW({immediate: true})` from `virtual:pwa-register`, placed before
  `createRoot`. The provider tree is not touched.
- `bp_front/src/vite-env.d.ts` — currently the single line `/// <reference types="vite/client" />`. Add
  `/// <reference types="vite-plugin-pwa/client" />`, or `virtual:pwa-register` has no types and
  `npm run build` (`tsc -b`) fails.
- `bp_front/public/icons/` — **new**: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, committed.
- `routing/Caddyfile` — inside the existing final `handle` block only. The route order
  (`/api/subscriptions` → `/api/*` → SPA) is preserved verbatim.
- `bp_front/e2e/pwa.spec.ts` — **new**, one spec file, untagged (so `+2` runs per test across `chromium` and
  `mobile`).
- `bp_front/.gitignore` — only if the plugin writes `dev-dist/`; verify rather than assume.
- Paperwork: `deferred-work.md`, `_bmad-output/project-context.md`,
  `_bmad-output/implementation-artifacts/sprint-status.yaml`.

**Read-only — the verification targets and the things that must not move:**
- `bp_front/src/theme.ts` — `background.default '#000000'`, `background.paper '#1C1C1E'`,
  `primary.main '#4DC9BB'`, `palette.mode 'dark'`, no light theme. The manifest colours derive from here.
- `bp_front/public/favicon.svg` — 305 bytes, `viewBox="0 0 32 32"`, `rect rx=7 fill=#1C1C1E` +
  `path fill=#4DC9BB`. The sole source artwork for all three PNGs.
- `bp_front/index.html` — links only `/favicon.svg`; declares **no** manifest and no `theme-color`. The
  plugin injects the manifest link; verify in `dist/index.html`.
- `bp_front/src/components/AppShell.tsx:119-165` — the inert-but-present title link, `aria-current="page"`,
  `data-testid="app-bar-home"`; plus the user menu (`user-menu-button`, `menu-lists`,
  `menu-change-password`, `menu-admin`, `menu-logout`).
- `bp_front/src/App.tsx:15-33` — the routes. `/lists`, `/account/password` and `/admin/*` have **no** back
  affordance of their own; `/lists/:id` and `/list/:id` do (`list-detail-back`, `list-shopping-back`).
- `bp_front/e2e/navigation.spec.ts:654` — "FR57 — every guarded route keeps a live in-app exit", whose
  comment at `:659-661` names this story; and `:695-698`, the launch-history-depth assertion.
- `bp_front/e2e/support/{api,ui}.ts` — `BACKEND`, `gql`, `loginApi`; `PASSWORD`, `uniqueUsername`,
  `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`.
- `bp_front/playwright.config.ts` — `retries: process.env.CI ? 2 : 0`; `CI` must stay unset. Baseline split
  re-measured in this pass: **120 = 59 / 59 / 1 / 1**.
- `bp_front/eslint.config.mjs:12-20` — the `ignores` array (`dist`, `src/__generated__`, …). It may gain
  `dev-dist` only if that directory is actually produced; it may not be widened for any other reason.

## Tasks & Acceptance

**Execution:**

- [x] **Baseline, before anything moves.** Confirm `git status --short` is clean on `epic7-maintenance` at
      `3391aa3`. Create `.tmp/<session-id>/`. Copy `bp_front/package.json` and `package-lock.json` aside with
      their md5s. Capture `npm run lint`, `rm -rf bp_front/node_modules/.tmp && npm run build` (chunk
      name + size + module count), and `npm audit --package-lock-only`. Then `docker compose up -d --build`
      and a full `npm run test:e2e` at `retries: 0`, with the split read via
      `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` (never `--list --project=`).
      **If the baseline suite is red, re-run once**; if still red, HALT — a red baseline makes AC6
      unattributable, which is the whole reason this story is sequenced last.
- [x] **`bp_front/package.json` + lockfile — install the plugin.** `npm view vite-plugin-pwa dist-tags` and
      its `peerDependencies`/`engines` re-measured in this pass (planned figures: `latest 1.3.0`, peer
      `vite ^3||^4||^5||^6||^7||^8`, `@vite-pwa/assets-generator` optional). Then plain
      `npm i -D vite-plugin-pwa@<latest>` with **no flags**; capture exit code and output verbatim. Confirm
      `git diff bp_front/package.json` shows exactly one added line and confirm from the lockfile diff that
      no direct dependency's resolved version moved.
- [x] **`bp_front/public/icons/` — generate and commit the three PNGs.** Rasterise from
      `public/favicon.svg` with the local `rsvg-convert` (librsvg), **not** `npx pwa-asset-generator`: the
      generator is a network-fetched one-off that pulls a headless Chromium, while `rsvg-convert` is present
      on this machine and deterministic. AR-E7-14 names the generator as a means, and AC2 constrains only
      the artefacts. Record the deviation.
      - `icon-192.png` 192×192 and `icon-512.png` 512×512 — direct rasterisations, artwork full-bleed.
      - `icon-512-maskable.png` 512×512 — the artwork rasterised at ~60% (≈307 px) and centred on an opaque
        `#1C1C1E` field filling the whole canvas (maskable icons must be full-bleed; transparency at the
        edge is what produces the letterboxed "broken install" look).
      - Assert programmatically from the PNG IHDR: signature, exact dimensions, and for the maskable variant
        that **every pixel outside the central 80%-diameter circle is exactly `#1C1C1E`**. That single check
        discharges AC2's circle-and-squircle requirement objectively, because every Android adaptive mask
        contains that 80% safe circle — say so rather than claiming two masks were eyeballed.
- [x] **`bp_front/vite.config.ts` — add `VitePWA`.** `registerType: 'autoUpdate'`,
      `includeAssets: ['favicon.svg']`, the manifest of AC3 (`id`, `name`, `short_name`, `start_url`,
      `scope`, `display`, `theme_color`, `background_color`, `icons` — the 192, the 512, and the 512
      `purpose: 'maskable'`), and `workbox: {navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api/], runtimeCaching: [], cleanupOutdatedCaches: true}`. Add no
      `build`/`rollupOptions`/`optimizeDeps` block. Verify from `dist/` that the registration script is
      injected **exactly once** (the virtual import in `main.tsx` plus `injectRegister`'s default must not
      double-register).
- [x] **`bp_front/src/main.tsx` + `src/vite-env.d.ts` — register the worker.**
      `registerSW({immediate: true})` from `virtual:pwa-register`, and the
      `/// <reference types="vite-plugin-pwa/client" />` triple-slash directive. No provider-tree change.
- [x] **`routing/Caddyfile` — pin the manifest content type.** Add an explicit `header` for
      `/manifest.webmanifest` (`Content-Type: application/manifest+json`) and a no-long-term-cache header for
      `/sw.js`, **inside the final `handle` block**, leaving `/api/subscriptions` → `/api/*` → SPA order
      untouched. **State the measurement honestly:** `caddy:2-alpine` (v2.11.4,
      `sha256:5f5c8640aae0…`) was measured in this pass to already serve `.webmanifest` as
      `application/manifest+json` and `sw.js` as `text/javascript` with no `Cache-Control`. AR-E7-15's hazard
      is therefore **not currently live**; the directive is a deliberate pin against image drift, and the
      record must not claim it repaired a broken MIME table.
- [x] **`bp_front/e2e/pwa.spec.ts` — one new spec file.** Follow the house style exactly: flat top-level
      `test()` calls, titles `'<REQ-IDS> — <behaviour in lowercase prose>'`, `async ({page}, testInfo)`,
      `uniqueUsername('pwa', <label>, testInfo.project.name)` for any registering scenario, no tag (so it
      runs in both viewport projects), and `page.goto` only to *reach* a screen. Cover:
      `FR59` the served manifest — status, `Content-Type`, and the nine keys with `background_color` asserted
      `#000000` explicitly; `FR59` the three icons reachable with correct byte signatures;
      `FR59` `dist`-injected `<link rel="manifest">` present on a served page;
      `NFR-E7-7` the worker registers and reaches `activated` with a fetch handler;
      `NFR-E7-7` `/api/graphiql` returns GraphiQL and **not** the SPA shell while the worker controls the
      page; `NFR-E7-7` no cache entry whose key matches `/api` exists after an authenticated session
      (read `caches.keys()` + `cache.keys()` via `page.evaluate`).
      **Observe each new assertion fail first** — break the guarded behaviour, confirm red on both projects,
      restore — per the epic's standing convention.
- [x] **AC7 — confirm, do not rebuild.** Re-run and cite `navigation.spec.ts:654` (every guarded route keeps
      a live in-app exit) and `:695-698` (launch history depth). Record the one-deep launch as **accepted**:
      `HomeRedirect` uses `<Navigate … replace/>`, so an installed launch at `start_url: '/'` leaves history
      one entry deep and the Android system back gesture exits the app from the home screen. Note precisely
      why the in-browser test asserts `2` and not `1` (a `newPage` starts at `about:blank`), rather than
      quietly reporting the browser number as the installed one.
- [x] **The gates.** `npm run lint` exit 0; `rm -rf bp_front/node_modules/.tmp && npm run build` exit 0 with
      chunk name/size/module count compared against the baseline **and** `dist/manifest.webmanifest`,
      `dist/sw.js` and `dist/icons/*.png` present (**not** `dist/registerSW.js` — corrected at review; with the
      virtual import in `main.tsx`, `injectRegister: 'auto'` correctly stands down and emitting that file would
      mean a double registration); `docker compose build bp_front`
      exit 0 (the load-bearing one — `npm ci` under `node:26-alpine` on musl); then
      `docker compose up -d --build && npm run test:e2e`.
- [x] **AC6 — two consecutive full runs at `retries: 0`.** Both green on all four projects, split
      re-measured each time (expect `59+N / 59+N / 1 / 1` where `N` is the number of new untagged tests —
      state the arithmetic). Any new flake is attributed to the service worker and **fixed**, never absorbed
      by retries or by re-running until green.
- [x] **AC1 / AC9 — the substitute instrument, and the residual.** `adb devices` was measured **empty** in
      this pass and no Chrome/Chromium is installed on the host, so the WebAPK install, the Chrome menu
      wording and the DevTools → Application → Manifest Installability panel **cannot be produced by this
      run**. Do the automatable maximum instead and label it as such: verify each WebAPK precondition
      independently (secure context, linked manifest, PNG 192 + 512, registered worker with a fetch
      handler), and probe Chromium for a `beforeinstallprompt` event on `http://localhost:2080` — a
      trustworthy origin — recording whatever it yields, including a non-fire. **Record the unperformed
      device verification as a residual** in `deferred-work.md` with the exact `chrome://inspect`
      port-forwarding procedure and the panel as the evidence to capture. Do not claim it was done.
- [x] **`deferred-work.md`** — a `## Deferred from: Story 7.14 — installable PWA (2026-08-20)` section. The
      insertion point measured in this pass is **line 1343**, i.e. after the Story 7.13 section (1257–1342)
      and before `## Deferred from: code review of 7-12-…`. Re-measure before editing and verify both
      surrounding regions unchanged afterwards. Must carry: the unperformed device verification (AC1/AC9),
      the Caddy MIME pin recorded as a pin rather than a fix, the `+260` package dev-dependency footprint,
      and anything the pass discovers.
- [x] **`_bmad-output/project-context.md`** — a PWA entry under the Frontend stack section (there is
      currently **no** `pwa`/`manifest`/`service worker`/`workbox` rule anywhere in the file). Prepend a
      Story 7.14 entry to the `_Last Updated` chain and adjudicate `rule_count` from **101** with the
      arithmetic stated inline. Detail goes to the ledger, not here (NFR-E7-1).
- [x] **`sprint-status.yaml`** — `:124` `7-14-installable-pwa: backlog` → `done` with the measured evidence,
      `:38 last_updated` refreshed. Do not touch other stories' entries or open `action_items`.
- [x] **Commit alone.** One commit on `epic7-maintenance`. `git show --stat` shows only the paths named in
      the Code Map — no `bp_back/`, no `gradle/`, no `db/`, and no edit to `AppShell.tsx`, `App.tsx`,
      `HomeRedirect.tsx`, `homePath.ts`, `theme.ts` or `navigation.spec.ts`.

**Acceptance Criteria:**

- Given AC1, when the story closes, then each WebAPK precondition is recorded as **independently measured**
  (secure context, linked manifest read from the served page, PNG icons at 192 and 512, a registered worker
  observed reaching `activated` with a fetch handler), and the two device-only claims — Chrome's menu
  wording and the DevTools Installability panel — are recorded as **not performed**, with `adb devices`
  empty quoted as the reason and the procedure filed for a human to run.
- Given AC2, when the story closes, then `bp_front/public/icons/` holds three committed PNGs verified from
  their IHDR at exactly 192×192, 512×512 and 512×512, all derived from `public/favicon.svg`, and the
  maskable variant is proven safe by asserting that every pixel outside the central 80%-diameter circle is
  exactly `#1C1C1E` — with that check stated as what discharges the circle/squircle requirement.
- Given AC3, when the manifest is authored, then the **served** `/manifest.webmanifest` parses as JSON
  declaring `id: '/'`, `name` and `short_name` `"Bag Please"`, `start_url: '/'`, `scope: '/'`,
  `display: 'standalone'`, `theme_color: '#000000'`, `background_color: '#000000'` and the three icons; and
  `dist/index.html` is inspected and shown to carry the injected `<link rel="manifest">`.
- Given AC4, when the worker is registered, then `navigateFallbackDenylist: [/^\/api/]` is present with
  `runtimeCaching` empty; `GET /api/graphiql` is observed returning GraphiQL and not the SPA shell **while a
  service worker controls the page**; a GraphQL query, a mutation and a live subscription over
  `/api/subscriptions` are exercised by hand on `:2080` and behave as before; and the Cache Storage contents
  are enumerated after an authenticated session and shown to contain **no** `/api` entry.
- Given AC5, when the story closes, then `curl -I http://localhost:2080/manifest.webmanifest` shows
  `application/manifest+json` **from the served response**, `/sw.js` is served from the root scope without a
  long-term `Cache-Control`, the `Caddyfile` route order `/api/subscriptions` → `/api/*` → SPA is unchanged,
  and the record states that `caddy:2-alpine` v2.11.4 was measured already correct so the directive is a pin
  and not a repair.
- Given AC6, when the story closes, then **two consecutive** full `npm run test:e2e` runs at `retries: 0`
  are recorded green across all four projects, with the per-project split re-measured on each run and the
  new-test arithmetic stated — and no flake was absorbed by a retry or by re-running until green.
- Given AC7, when the story closes, then `navigation.spec.ts:654` and `:695-698` are re-run and cited rather
  than duplicated; `/account/password` and `/admin` are each confirmed to expose at least one live in-app
  exit (noting that on `/admin` for an admin the title link is inert by design and the user menu is the live
  exit); and the one-deep launch history is recorded as an accepted consequence of `HomeRedirect`'s
  `replace`, with the in-browser `2` explained rather than reported as the installed depth.
- Given AC8, when the story closes, then `runtimeCaching` is empty, no offline UI / cached-data indicator /
  update toast / reload prompt / version banner exists anywhere in the diff, `registerType: 'autoUpdate'` is
  in place, and no `apple-touch-icon` or iOS Safari asset was added.
- Given AC9, when installability is verified, then the substitute instrument and its limits are stated
  explicitly: the `beforeinstallprompt` probe result is recorded whichever way it goes, and the absence of a
  device is quoted as measured rather than assumed.
- Given the whole story, when the final diff is reviewed, then it contains no weakened assertion, no widened
  `ignores` beyond a genuinely-produced `dev-dist`, no `@ts-expect-error`, no `overrides`/`resolutions`
  block, no `.npmrc`, no `--legacy-peer-deps` or `--force` (not even transiently), no direct-dependency
  version move, and no `bp_back/`, `gradle/` or `db/` path.

## Spec Change Log

### 2026-08-20 — Verification corrected: `dist/registerSW.js` must be ABSENT, not present

**Triggering finding (review pass 1, Blind Hunter):** the spec's Task list and Verification section both named
`dist/registerSW.js` among the artefacts to confirm present after a build. Implementation measured that it does not
exist and correctly did not manufacture it, but recorded the correction only in `deferred-work.md` and
`project-context.md` — leaving the spec itself stating the false version for the next reader.

**Amended:** both occurrences now require the file to be **absent**, with the reason inline.

**Known-bad state avoided:** a future pass reading this spec and "fixing" the missing file by setting
`injectRegister: 'script'` or adding a manual `<script src="/registerSW.js">`, which would register the worker twice —
once from the injected script and once from the `virtual:pwa-register` import in `src/main.tsx`.

**KEEP:** the rest of the Verification list is accurate and was confirmed by measurement in this pass — in
particular `dist/index.html` carrying exactly one `<link rel="manifest">` and exactly one `serviceWorker.register`
in the shipped bundle. Do not relax either to a "at least one" form.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 0, medium 6, low 6)
- defer: 10: (high 0, medium 2, low 8)
- reject: 7
- addressed_findings:
  - `[medium]` `[patch]` `registerType: 'autoUpdate'` was documented as "updates apply silently on next launch" in
    `src/main.tsx` and "no reload prompt" in `vite.config.ts`, while the generated client calls
    `window.location.reload()` on `activated` when `event.isUpdate || event.isExternal` and no `onNeedReload` is
    supplied. Both comments rewritten to state the measured behaviour, including the `isExternal` cross-tab case.
    The behaviour itself was NOT changed — see the matching defer.
  - `[medium]` `[patch]` No `<meta name="theme-color">` anywhere: the manifest's `theme_color` applies only once
    installed, so every pre-install Chrome-on-Android session painted a default light address bar above an all-black
    app. Added to `bp_front/index.html` at `#000000` and confirmed injected into `dist/index.html`.
  - `[medium]` `[patch]` AC5 mandates two Caddy behaviours and only the manifest half had a regression guard. Added
    `AR-E7-15 — sw.js is served from the root scope as JavaScript and is not long-term cached` to `e2e/pwa.spec.ts`,
    asserting status, content type, `Cache-Control: no-cache` and the root path on the SERVED response.
  - `[medium]` `[patch]` The maskable safe-zone checker — the instrument the record credits with discharging AC2 —
    existed only in a `.tmp/<session-id>/` script deleted by the cleanup convention, so the property gated nothing.
    Reimplemented as `e2e/support/png.ts` (8-bit RGB/RGBA PNG decode + safe-zone violation count) and asserted from
    the served bytes inside the existing icon test.
  - `[medium]` `[patch]` The icon generation recipe was likewise uncommitted. Added `bp_front/scripts/generate-icons.sh`
    and `npm run icons`. Making it a source of truth exposed a second defect: ImageMagick writes `tIME` plus three
    `tEXt` timestamp chunks, so two runs produced different bytes. `-strip` fixes it; the maskable icon was
    regenerated (md5 `307dfc73…` → `6fa9c998…`, 6715 → 6484 bytes, pixels unchanged) and the script is now measurably
    idempotent against the committed tree.
  - `[medium]` `[patch]` None of the three checked-in `CLAUDE.md` files mentioned that a service worker now exists —
    the root file still described the frontend as a plain "built static bundle served by Caddy". Added the PWA
    section to `bp_front/CLAUDE.md`, the two header pins and the navigation-fallback denylist to `routing/CLAUDE.md`,
    and the installability note plus `npm run icons` to the root `CLAUDE.md`.
  - `[low]` `[patch]` `registerSW()` supplied no `onRegisterError`, so the one WebAPK precondition that can fail at
    runtime failed into a no-op. Wired a `console.error`.
  - `[low]` `[patch]` The `/sw.js` `Cache-Control` comment claimed it stops a stale worker; browsers already bypass
    the HTTP cache for the top-level worker script. Rationale corrected to belt-and-braces.
  - `[low]` `[patch]` The manifest assertions checked the nine authored keys by value but nothing else, so a future
    plugin minor injecting or renaming a default would ship silently — `lang: "en"` is already injected and
    unauthored. Added an exact key-set assertion naming all ten.
  - `[low]` `[patch]` The icon loop iterated `manifest.icons` with no length guard and passed vacuously on a manifest
    shipping no icons. Added `expect(icons.length).toBe(3)`.
  - `[low]` `[patch]` `expect(cached.length).toBeGreaterThan(0)` also passes for a worker that precached only
    `favicon.svg` — the exact case its comment claimed to exclude. Replaced with a shape assertion requiring
    `index.html`, the manifest and all three icons.
  - `[low]` `[patch]` The spec's own Verification section still expected `dist/registerSW.js` to exist. Corrected in
    both places; see the Spec Change Log entry above.

## Design Notes

### 1 — The Caddy MIME hazard is real in principle and absent in fact, and the record must say so

AR-E7-15 warns that the Alpine Caddy image "cannot be relied on to carry `.webmanifest` in its MIME table",
and a wrong `Content-Type` kills installability with no error. Measured directly in this pass against a
throwaway container (`caddy:2-alpine`, v2.11.4, `sha256:5f5c8640aae0…`, serving a `.webmanifest` and a
`sw.js` through the same `try_files … / file_server` shape this repo uses):

```
GET /manifest.webmanifest → 200, Content-Type: application/manifest+json
GET /sw.js                → 200, Content-Type: text/javascript; charset=utf-8   (no Cache-Control)
```

So the header directive AC5 mandates is a **pin against image drift**, not a repair of a live defect. Ship
it — AC5 requires it and a future `caddy:2-alpine` could regress — but do not let the story record read as
though a broken MIME table was found and fixed. The `:2-alpine` tag is a moving target, which is precisely
what makes pinning worthwhile.

### 2 — Do not re-implement AC7; it was built in Story 7.5 and already names this story

`AppShell.tsx:119-125` carries the inert-but-present invariant as a comment, `:134` adds
`aria-current="page"` as the *only* attribute change (never `disabled`, `aria-disabled`, `tabIndex={-1}` or
an unmount), and `navigation.spec.ts:654` already asserts that every guarded route keeps a live in-app exit,
with a comment at `:659-661` pointing at Story 7.14 as the reason it exists. AC7's work here is therefore
*confirmation and recording*, not construction. Two traps:

- On `/admin` for an admin account, home resolves to `/admin` (`homePath.ts:64`), so the title link is inert
  on the one screen with no back affordance. The live exit is the user menu (`menu-logout`; `menu-lists` is
  hidden for admin). That is by design and must be stated, not "fixed".
- `AppShell.tsx:39-47` documents a ~100 ms window on cold load where the `cache-only` observe query is empty
  and the link is briefly live on home. Any assertion must synchronise on
  `toHaveAttribute('aria-current', 'page')` first — an auto-retrying matcher — never race it.

### 3 — Two acceptance criteria need hardware this run does not have, and the honest move is to measure around them, not to halt

`adb devices` returns an empty list and no `google-chrome`/`chromium` binary exists on this host. AC1's
"Chrome's menu offers Install app" and AC9's "the DevTools Installability panel output is recorded" are
therefore **unproducible by this pass**. Halting would leave the code unwritten over absent hardware; faking
would be worse. So: land the code, verify every WebAPK precondition independently by measurement, probe
Chromium for `beforeinstallprompt` on `http://localhost:2080` (a trustworthy origin, so a secure context
even over plain HTTP — the same reason the E2E suite's `Secure` refresh cookie works there), and file the
device verification as a named residual with its exact procedure. The residual is the deliverable for the
part that cannot be done, and it must appear in the ledger, the sprint-status entry and the story record.

A `beforeinstallprompt` non-fire is **informative, not fatal**: Playwright's bundled Chromium is not
Chrome-branded and install promotion heuristics differ. That is exactly why the per-criterion checks are the
primary evidence and the probe is corroboration — record the result either way rather than only when it
flatters the story.

### 4 — Vite 8 already narrowed the browser floor, and this story is where that starts to matter

`project-context.md` records that Vite 8 moved the resolved `build.target` to
`chrome111 / edge111 / firefox114 / safari16.4 / ios16.4`, dropping Safari/iOS 16.0–16.3 and Chrome 107–110
silently, and notes it "matters more than usual here because Story 7.14 makes this an installable mobile
app". No action is required in this story — the decision was taken and accepted in Story 7.9 — but the
record should acknowledge that installability lands on top of an already-narrowed floor rather than
rediscover it later as a defect.

## Verification

**Commands:**
- `npm view vite-plugin-pwa dist-tags peerDependencies engines --json` — expected: `latest`, a `vite` peer
  admitting `^8.0.0`, measured in this pass rather than quoted from this spec.
- `npm i -D vite-plugin-pwa@<latest>` with no flags — expected: exit 0, output captured verbatim.
- `python3` over each PNG's IHDR — expected: PNG signature, exact 192/512/512 dimensions; and for the
  maskable variant, zero non-`#1C1C1E` pixels outside the central 80%-diameter circle.
- `npm run lint` — expected: exit 0, `ignores` unwidened (except a genuinely-produced `dev-dist`).
- `rm -rf bp_front/node_modules/.tmp && npm run build` — expected: exit 0; `dist/manifest.webmanifest`,
  `dist/sw.js`, `dist/icons/*.png` present and `dist/registerSW.js` ABSENT (corrected at review — see the
  Spec Change Log); `dist/index.html` carrying exactly one
  `<link rel="manifest">` and exactly one registration script; chunk name/size/module count vs. baseline.
- `docker compose build bp_front` — expected: exit 0 (`npm ci` under `node:26-alpine`, musl).
- `curl -sI http://localhost:2080/manifest.webmanifest` — expected: `200` and
  `Content-Type: application/manifest+json`.
- `curl -sI http://localhost:2080/sw.js` — expected: `200`, JS content type, no long-term `Cache-Control`.
- `curl -s http://localhost:2080/api/graphiql | head` — expected: GraphiQL markup, not the SPA shell.
- `npm run test:e2e` twice — expected: exit 0 both times at `retries: 0`, split re-measured with
  `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` (never `--list --project=`) and
  the new-test arithmetic stated against the baseline `120 = 59/59/1/1`.
- `git show --stat` — expected: only Code Map paths; no `bp_back/`, `gradle/`, `db/`.

**Manual checks (if no CLI):**
- Real-browser pass on `http://localhost:2080` at ~360 px and desktop, with the service worker registered:
  theme tokens, spacing and type scale unchanged; a list query renders; an item save round-trips; a second
  session's edit arrives over `/api/subscriptions` with no reload. Then, in DevTools, enumerate Cache Storage
  and confirm no `/api` entry exists.
- **Not performable in this pass, and to be filed rather than claimed:** install the app from Chrome on a
  physical Android device reached over `chrome://inspect` port forwarding to `http://localhost:2080`, confirm
  the menu reads "Install app", and capture DevTools → Application → Manifest → Installability reporting no
  unmet criterion.

## Implementation Record

All figures below come from commands run in this pass on `epic7-maintenance` at baseline `3391aa3`. Where something
could not be measured it says so; nothing here is recalled from the spec.

### Baseline, before anything moved

`git status --short` clean apart from this untracked spec. `bp_front/package.json` md5 `d831e1d5aed0d7191637e6788fd7dbef`,
`package-lock.json` md5 `fd475bcabfeff98725cfc9c4fbb03ec3`, both copied aside. `npm run lint` exit 0.
`rm -rf node_modules/.tmp && npm run build` exit 0: **1297 modules**, `dist/assets/index-dd3zm4T-.js`
**802.34 kB / 240.67 kB gzip**, `dist/index.html` 0.36 kB. `npm audit --package-lock-only` exit 1 — **1 high**, the
`js-yaml` CVE-2026-59870 advisory (pre-existing; unchanged after the install). `docker compose up -d --build` exit 0.
Split `59 chromium / 59 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile` = **120**. Full suite
**120 passed (48.4 s)** at `retries: 0`, first try — no re-run needed, so AC6 is attributable.

### What landed

| Path | Change |
|---|---|
| `bp_front/package.json` | one added line, `"vite-plugin-pwa": "1.3.0"`, pinned exactly |
| `bp_front/package-lock.json` | resolved tree |
| `bp_front/vite.config.ts` | `VitePWA` added to `plugins`; nothing else touched |
| `bp_front/src/main.tsx` | `registerSW({immediate: true})` from `virtual:pwa-register`, before `createRoot`; provider tree untouched |
| `bp_front/src/vite-env.d.ts` | `/// <reference types="vite-plugin-pwa/client" />` added |
| `bp_front/public/icons/` | **new** — `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` |
| `routing/Caddyfile` | two `header` lines inside the final `handle` block; route order unchanged |
| `bp_front/e2e/pwa.spec.ts` | **new**, six untagged tests |

`bp_front/.gitignore` and `eslint.config.mjs` are **unchanged**: `npm run dev` was actually run (:5173 answered 200)
and **no `dev-dist/` appeared**, so there was nothing to ignore and the `ignores` array stayed unwidened.

### The install

`npm view vite-plugin-pwa dist-tags peerDependencies engines --json` re-measured: `latest 1.3.0`; peers
`vite ^3||^4||^5||^6||^7||^8` (project is 8.2.1 — satisfied), `@vite-pwa/assets-generator ^1.0.0` (optional, not
installed), `workbox-build ^7.4.1` + `workbox-window ^7.4.1`; `engines.node >=16.0.0`.

`npm i -D vite-plugin-pwa@1.3.0`, **no flags**, exit **0**: *"added 260 packages, changed 10 packages, and audited 681
packages in 18s"*, `1 high severity vulnerability` (the same pre-existing `js-yaml` one). The output carried the
project's standing `ERESOLVE`-adjacent warn about `graphql-config@5.1.6`'s `graphql` peer — Story 7.13's filed steady
state, untouched here — plus a `deprecated glob@11.1.0` notice from the new transitive tree. npm wrote `^1.3.0`; it was
re-pinned to exactly `1.3.0` and `npm install` re-run (exit 0) so the lockfile root entry reads `1.3.0`.

Direct-dependency check, done by diffing **every** direct entry's resolved version between the stashed and the new
lockfile rather than by eyeballing the diff: the only move is `vite-plugin-pwa` itself (absent → 1.3.0). Ten
**transitive** entries changed, exactly the set planning predicted: `@babel/generator|parser|traverse|types`
7.29.7→7.29.8, `baseline-browser-mapping` 2.10.44→2.11.16, `browserslist` 4.28.6→4.28.8, `caniuse-lite`
1.0.30001806→1.0.30001809, `electron-to-chromium` 1.5.394→1.5.411, `node-releases` 2.0.51→2.0.53,
`update-browserslist-db` 1.2.3→1.3.1. Consequences of re-resolving existing carets; recorded, not fought.
`workbox-build` and `workbox-window` resolve to **7.4.1** as the plugin's own dependencies.

### Icons (AC2)

Rasterised from `public/favicon.svg` with local `rsvg-convert` **2.62.3**, not `npx pwa-asset-generator` — the
generator is a network-fetched one-off that pulls a headless Chromium; `rsvg-convert` is present and deterministic.
AR-E7-14 names the generator as a *means* and AC2 constrains only the artefacts. **Deviation recorded.**

- `icon-192.png` — `rsvg-convert -w 192 -h 192`, md5 `8701db05312bd0a9f26a5ba94c2292b0`
- `icon-512.png` — `rsvg-convert -w 512 -h 512`, md5 `1d977630fc487f6e79e883412690350a`
- `icon-512-maskable.png` — artwork at **307 px** (≈60%) composited centre on an opaque `#1C1C1E` 512 canvas,
  flattened to 8-bit RGB. **Regenerated at review**, md5 `307dfc732e3b9ec975fb073cd66e821c` →
  `6fa9c9987750578a225cdcc414c18402` (6715 → 6484 bytes): the original carried ImageMagick's `tIME` and three
  `tEXt` metadata chunks, so re-running the recipe produced different bytes every time. `-strip` removes them and
  the generator is now measurably idempotent — two consecutive runs and a run against the committed tree all
  produce identical bytes. Pixels are unchanged (`magick compare -metric AE` = 0.29 against the pre-strip file,
  i.e. metadata only) and the safe-zone check still reports **0** violations.

A pure-stdlib Python check (PNG signature, IHDR, zlib-inflate + de-filter) reports: signature OK and IHDR
**192×192 / 512×512 / 512×512**, and for the maskable variant **0 pixels outside the central 80%-diameter circle that
are not exactly `#1C1C1E`**. That single assertion is what discharges AC2's circle-and-squircle requirement — every
Android adaptive mask contains that safe circle — rather than a claim that two masks were eyeballed.

**Instrument falsified first.** Compositing the artwork at 480 px instead of 307 px puts the teal glyph into the ring:
the checker reports **140** offending pixels, first at `(111,16) = #1d1d1f`, and exits 1. Restored, it reports 0 and
exits 0. The geometry behind the 60% choice, measured not guessed: the glyph's extreme corner sits 0.46 of the icon
width from centre, so a full-bleed 512 raster lands it **235 px** out against a **204.8 px** safe radius — it fails.

### Build output (AC3, and the registration-count check)

`rm -rf node_modules/.tmp && npm run build` exit 0. **1299 modules** (baseline 1297), `index-BySjKFSJ.js`
**803.39 kB / 241.14 kB gzip** (baseline 802.34 / 240.67 → **+1.05 kB raw, +0.47 kB gzip**), a new lazily-imported
`assets/workbox-window.prod.es5-Bd17z0YL.js` **5.65 kB / 2.20 kB gzip**, `manifest.webmanifest` 0.41 kB, `index.html`
0.36 → 0.41 kB. **≈ +6.7 kB shipped.** Plugin summary: `PWA v1.3.0, mode generateSW, precache 8 entries (790.48 KiB)`,
generating `dist/sw.js` + `dist/workbox-9c191d2f.js`. `dist/icons/` carries all three PNGs; `dist/favicon.svg` is
picked up by `includeAssets`.

`dist/index.html` carries **exactly one** `<link rel="manifest" href="/manifest.webmanifest">` and **zero**
`registerSW` script tags; the whole bundle contains **exactly one** `serviceWorker.register` call, in the
`workbox-window` chunk. **`dist/registerSW.js` does not exist, and that is the check passing**: `injectRegister`
defaults to `'auto'` and stands down when it sees the `virtual:pwa-register` import in `main.tsx`. The spec's
Verification list expected the file; a `registerSW.js` sitting *alongside* the virtual import is precisely the
double-registration the task warned about. Filed in the ledger as an expectation to correct, not a build to change.

`dist/sw.js` contains `denylist:[/^\/api/]`, one `registerRoute` (the navigation route — no runtime routes, because
`runtimeCaching` is empty), `cleanupOutdatedCaches`, and a precache manifest of 8 entries whose icon revisions are the
same md5s listed above.

The served manifest carries a **tenth** key nobody authored — `lang: "en"`, injected by the plugin. The nine AC3 names
are all present and correct; "exactly nine keys" would be false, so the spec asserts the nine **by value**. Filed.

### Served surface on `:2080` (AC5)

```
GET /manifest.webmanifest → 200  Content-Type: application/manifest+json                (Content-Length 414)
GET /sw.js                → 200  Content-Type: text/javascript; charset=utf-8
                                 Cache-Control: no-cache                                (root scope, 1354 bytes)
GET /icons/icon-192.png   → 200  (4741 B)   /icons/icon-512.png → 200 (13930 B)   /icons/icon-512-maskable.png → 200 (6715 B)
GET /api/graphiql         → the backend (Via: 1.1 Caddy) — 401 text without a token, GraphiQL HTML with one
```

**The two `header` directives are a pin, not a repair, and the record must not read otherwise.** Measured *before*
they landed, against the running container: `caddy version` → **v2.11.4**, image
`caddy@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648`, already serving `.webmanifest` as
`application/manifest+json` and `sw.js` as `text/javascript; charset=utf-8` with no `Cache-Control`. AR-E7-15's hazard
is real in principle and was **absent in fact**. The only byte the change actually adds today is
`Cache-Control: no-cache` on `/sw.js`. `:2-alpine` is a moving tag, which is what makes the pin worth carrying. Route
order `/api/subscriptions` → `/api/*` → SPA is byte-identical; the directives sit inside the final `handle` only.

### The new spec (`e2e/pwa.spec.ts`) and its falsification

Six flat top-level `test()` calls, house titles, `async ({page}, testInfo)`, `uniqueUsername('pwa', 'caches', …)` for
the one registering scenario, untagged. `page.request` is used for the three static artefacts on purpose: it reads
what Caddy serves, bypassing both the SPA and the worker — verification of a shipped byte stream, not an API shortcut
for a behaviour. Everything else is driven through the rendered affordances via `support/ui.ts`.

Every assertion was observed failing first, each break rebuilt through `docker compose up -d --build bp_front` and run
on **both** viewport projects:

| Break | Result |
|---|---|
| `background_color: '#ffffff'` | 2 failed — `Received: "#ffffff"` |
| `icon-192.png` regenerated at 191 px | 2 failed — `Received: "191x191"` |
| `manifest: false` | 2 failed — `toHaveCount` expected 1, `Received: 0` |
| registration removed (`injectRegister: false` + no `registerSW()` call) | 4 failed — controller wait times out (tests 4 and 6) |
| `globPatterns: []` (worker registers and controls, but has nothing to serve) | 2 failed — `page.reload: net::ERR_INTERNET_DISCONNECTED` |
| `navigateFallbackDenylist` deleted | 2 failed — `toHaveTitle` expected `"GraphiQL"`, **`Received: "Bag Please"`** |

That last row is the epic's named trap, reproduced rather than argued: **without the denylist, `/api/graphiql`
genuinely returns the SPA shell** and the project's only backend-readiness check starts lying silently.

**One of the six could not be falsified through the worker, and that is filed rather than glossed.** "No `/api` entry
in Cache Storage" resists a real break: Workbox refuses to cache `POST`, which is every GraphQL and auth call this app
makes, and forcing `/api/graphiql` into the precache instead makes the worker's **install** fail (401 without a Bearer
token), so the test reddened on the controller wait rather than on the cache assertion. It was falsified at the
**instrument** level instead: with the worker controlling, planting a real `/api/graphql` entry in Cache Storage from
the page made the identical enumeration-and-filter report `['http://localhost:2080/api/graphql']`, where it reported
`[]` before. The instrument sees what it claims to see; the behaviour break is a residual.

### Gates

- `npm run lint` — exit **0**, `ignores` unwidened.
- `rm -rf node_modules/.tmp && npm run build` — exit **0**, figures above.
- `docker compose build bp_front` — exit **0**. The load-bearing one: `npm ci` under `node:26-alpine` on **musl** with
  260 new packages in the tree.
- `docker compose up -d --build` — exit 0.
- **AC6: two consecutive full `npm run test:e2e` runs at `retries: 0`, `CI` unset (verified empty), both green —
  132 passed (49.8 s) and 132 passed (50.1 s).** No flake appeared, so none was absorbed by a retry or by re-running
  until green. Split re-measured with the prescribed `--list | grep -oP … | sort | uniq -c` before each run, never
  `--list --project=`: **65 chromium / 65 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile**.
  Arithmetic: six new untagged tests × two viewport projects = **+12**; 120 + 12 = **132**, and 59 + 6 = **65** per
  viewport, with both toggle projects still holding exactly one test each — the structural invariant, not the total.

### AC4 beyond the spec file

Cache Storage enumerated after a full authenticated session (register → lists → create list → add category → add
item → reload) at both 360×780 and 1280×800: **8 entries, all in `workbox-precache-v2-http://localhost:2080/`** —
`/index.html`, the two JS chunks, `/favicon.svg`, the three icons, `/manifest.webmanifest`. **Zero `/api` entries.**
A hand pass in the same run exercised a query (the list renders), mutations (list, category and item all round-trip)
and a reload (the item survives). The **live subscription** over `/api/subscriptions` is covered by
`shopping.spec.ts:161` (*"a check by one member appears live in another member's view without a refresh"*), green on
both projects in both full runs against this worker — cited rather than re-performed by hand.

Theme tokens measured with the worker controlling, identical at both widths: `body` background `rgb(0, 0, 0)`, colour
`rgb(255, 255, 255)`, font-size `17px`, app bar `rgba(0, 0, 0, 0.78)`. A 360 px screenshot was captured and inspected:
dark surface, teal accents, no layout change. The upgrade is visually inert.

### AC7 — confirmed, not rebuilt

`navigation.spec.ts:654` (*"FR57 — every guarded route keeps a live in-app exit, and landing on home costs no extra
history entry"*) re-run in isolation: **2 passed** on chromium and mobile, and again inside both full suite runs. It
already asserts `user-menu-button` on `/lists`, `/lists/:id`, `/list/:id` and `/account/password`, plus the
route-specific `list-detail-back` / `list-shopping-back`, and it names Story 7.14 in its own comment as the reason it
exists. Nothing in it was edited.

Two things stated rather than "fixed":

- On `/admin` for an admin, home resolves to `/admin` (`homePath.ts:64`), so the title link is inert on the one screen
  with no back affordance of its own. The live exit there is the user menu (`menu-logout`; `menu-lists` is hidden for
  admin). By design — `navigation.spec.ts:616` covers exactly this and passed.
- **The launch history depth is one, and the `2` in the test is a browser artefact.** `navigation.spec.ts:698` asserts
  `window.history.length === 2` because a fresh Playwright page starts on `about:blank` and the `goto('/')` adds the
  second entry, while `HomeRedirect`'s `<Navigate replace/>` adds **none** — that "adds none" is the property under
  test. An installed launch at `start_url: '/'` has no `about:blank` predecessor, so it is **one** deep and the
  Android system back gesture exits the app from home. Accepted and recorded, not discovered later as a defect.

### AC1 / AC9 — what was measured, and what was NOT

**Not performed, and not claimed: no WebAPK was installed, no Chrome menu was read, and the DevTools → Application →
Manifest → Installability panel was never opened.** Re-measured on this host: `adb devices` prints `List of devices
attached` with **no device rows**, and `which google-chrome chromium chrome` finds **none** of the three (only
`/usr/bin/adb` exists). Playwright's bundled Chromium is not Chrome-branded and has no Installability panel.

The substitute instrument, labelled as such — Pixel 7 emulation against `http://localhost:2080`, every WebAPK
precondition measured **independently**:

```
secureContext   true            origin http://localhost:2080  (localhost is a trustworthy origin)
manifest link   /manifest.webmanifest   read off the SERVED page
manifest keys   background_color, display, icons, id, lang, name, scope, short_name, start_url, theme_color
icons           192x192 | 512x512 | 512x512 maskable
display         standalone      start_url /      scope /
worker          scope http://localhost:2080/     state activated     controlling true
fetch handler   offline reload answered by the worker (auth-page still rendered with the network cut)
```

`beforeinstallprompt`: **did not fire** — `window.__bip` was `[]` after a 4 s wait with every precondition satisfied.
Recorded because it went the unflattering way. Playwright's Chromium is not Chrome-branded and install promotion is a
branded-Chrome heuristic, so a non-fire is **informative, not fatal**; the per-criterion checks above are the primary
evidence and this was only ever corroboration.

The device verification is filed as a named residual in `deferred-work.md` with the exact `adb reverse tcp:2080
tcp:2080` + `chrome://inspect#devices` procedure, and with the Installability **panel** — not the menu wording —
named as the evidence to capture.

### Forbidden-workaround audit

None used, not even transiently: no `--legacy-peer-deps`, no `--force`, no `overrides`/`resolutions`, no `.npmrc`, no
`@ts-expect-error`, no `skipLibCheck` change, no widened `ignores` (no `dev-dist` was produced), no weakened
assertion. No direct dependency moved. No `bp_back/`, `gradle/` or `db/` path. `theme.ts`, `App.tsx`, `AppShell.tsx`,
`HomeRedirect.tsx`, `homePath.ts` and `navigation.spec.ts` are untouched.

### One process note against this pass

A `git checkout bp_front/vite.config.ts` used to undo a falsification break also reverted the **story's own**
`VitePWA` block, because the file was not yet committed. It was caught immediately by the next build failing, and the
config was rewritten and byte-diffed against a scratch copy before continuing. Subsequent restores used that scratch
copy. Recorded because the failure mode — `git checkout` as "undo" on an uncommitted file — silently deletes work and
would be easy to miss in a passing gate.

### Vite 8's narrowed floor (Design Note 4)

Acknowledged rather than rediscovered: Story 7.9 moved the resolved `build.target` to
`chrome111 / edge111 / firefox114 / safari16.4 / ios16.4`, dropping Safari/iOS 16.0–16.3 and Chrome/Edge 107–110.
Installability lands **on top of** that already-narrowed floor. No action taken here; the decision was made and
accepted in 7.9.

## Auto Run Result

Status: **done**. One implementation commit plus one review commit on `epic7-maintenance`, baseline `3391aa3`.

**Note on figures:** the `## Implementation Record` above is a faithful account of the *implementation* pass and
its numbers (132 tests, 6 new specs) are left as measured then. The figures below are the **final** state after the
review pass added a seventh test and regenerated one icon.

### Implemented change

Bag Please is now an installable PWA. `vite-plugin-pwa` 1.3.0 emits a dark-only web app manifest and a Workbox
service worker; `src/main.tsx` registers it immediately; three PNG launcher icons are generated from the existing
`favicon.svg` and committed; Caddy pins the manifest content type and the worker's cache header. The service
worker's navigation fallback and runtime caching both exclude `/api`, so GraphQL, the auth REST endpoints, the
subscription WebSocket and the `GET /api/graphiql` readiness check are untouched. No offline mode was added.

### Files changed

- `bp_front/package.json` / `package-lock.json` — `vite-plugin-pwa@1.3.0` pinned exact; +260 packages; no direct
  dependency moved. Also adds the `icons` script.
- `bp_front/vite.config.ts` — the `VitePWA` plugin: manifest, `registerType: 'autoUpdate'`,
  `navigateFallbackDenylist: [/^\/api/]`, empty `runtimeCaching`.
- `bp_front/src/main.tsx` — `registerSW({immediate: true, onRegisterError})`.
- `bp_front/src/vite-env.d.ts` — the `vite-plugin-pwa/client` type reference.
- `bp_front/index.html` — `<meta name="theme-color" content="#000000">` for the uninstalled browsing session.
- `bp_front/public/icons/*.png` — 192, 512 and 512-maskable, generated and committed.
- `bp_front/scripts/generate-icons.sh` — the committed, deterministic icon recipe (`npm run icons`).
- `bp_front/e2e/pwa.spec.ts` — seven installability tests.
- `bp_front/e2e/support/png.ts` — an 8-bit PNG decoder and the maskable safe-zone checker, so that property is
  gated by the suite rather than by a deleted script.
- `routing/Caddyfile` — two `header` pins inside the existing SPA `handle` block; route order untouched.
- `CLAUDE.md`, `bp_front/CLAUDE.md`, `routing/CLAUDE.md` — the service worker now exists in the docs that load
  when someone edits these trees.
- Paperwork: this spec, `deferred-work.md`, `project-context.md`, `sprint-status.yaml`.

### Review findings breakdown

12 patches applied (6 medium, 6 low), 10 items deferred (2 medium, 8 low), 7 rejected, 0 intent gaps, 0 bad-spec
loopbacks. Both reviewers independently found the same top defect — the `autoUpdate` reload semantics being
documented as the opposite of what they are. Full detail in the Review Triage Log above.

### Verification performed

- `npm run lint` exit 0; eslint `ignores` unwidened.
- `npm run build` exit 0 after `rm -rf node_modules/.tmp` — 1299 modules, `index-DPZFex3D.js` 803.49 kB /
  241.20 kB gzip, plus a 5.65 kB `workbox-window` chunk; `precache 8 entries (790.94 KiB)`.
  `dist/registerSW.js` confirmed **absent**; `dist/index.html` carries exactly one `<link rel="manifest">` and the
  bundle exactly one `serviceWorker.register`.
- `docker compose build bp_front` exit 0 (`npm ci` under `node:26-alpine`, musl).
- **AC6 re-established on the final tree: two consecutive `npm run test:e2e` runs at `retries: 0` with `CI` unset —
  134 passed (51.9 s) and 134 passed (52.7 s).** Split re-measured `66 / 66 / 1 / 1`; the arithmetic is
  120 baseline + 7 new untagged tests × 2 viewport projects = 134, and the "exactly 1 per `registration-toggle-*`
  project" invariant holds.
- Served on `:2080`: `/manifest.webmanifest` 200 `application/manifest+json`; `/sw.js` 200 `text/javascript` with
  `Cache-Control: no-cache`; `/api/graphiql` reaches the backend (auth-gated) rather than the SPA shell.
- Maskable safe zone re-derived independently from the committed bytes: **0** non-`#1C1C1E` and **0** non-opaque
  pixels outside the central 80%-diameter circle.
- `bash scripts/generate-icons.sh` is idempotent — two consecutive runs and a run against the committed tree all
  produce identical bytes, and the two full-bleed rasters reproduce the committed files exactly.
- **Three review-added assertions falsified before being trusted**, one rebuild, all reddening on `chromium`:
  deleting the Caddy `Cache-Control` line → `expect(cache-control).toBe('no-cache')` received `undefined`;
  adding `orientation: 'portrait'` to the manifest → the exact-key-set assertion failed; re-rasterising the
  maskable icon full-bleed → **11,649** pixels outside the safe circle. All three restored and the suite re-run
  twice green.

### Residual risks

1. **The device half of AC1 and AC9 was not performed and is not claimed.** No Android device is attached
   (`adb devices` empty) and no Chrome is installed on this host, so no WebAPK was installed, no Chrome menu was
   read, and the DevTools Installability panel was never opened. Every precondition was measured independently
   instead, and `beforeinstallprompt` did not fire in Playwright's unbranded Chromium — recorded as-is. Filed with
   the exact `chrome://inspect` procedure, and separately filed as **not scheduled**, which is the sharper risk.
2. **`autoUpdate` reloads open tabs on deploy**, including from another tab's update. Now documented accurately;
   whether to suppress it is a product decision left to a human.
3. **The TLS edge mode was never exercised with a service worker**, and Chromium may refuse registration on an
   untrusted cert regardless of `ignoreHTTPSErrors` — potentially four failing tests in a documented supported
   configuration.
4. The manifest ships the minimal install surface (no `description`/`screenshots`), and the ~790 KiB precache now
   downloads during first paint on mobile.
