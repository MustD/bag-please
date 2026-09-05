import {defineConfig, devices} from '@playwright/test'

// E2E runs against the PRODUCTION image (built Vite SPA served by Caddy on
// :2080), not the dev server — this closes the "green on dev, broken in the
// shipped bundle" gap for the whole epic. The webServer builds and starts the
// full docker stack; locally it reuses an already-running :2080.
//
// The origin under test is configurable via E2E_BASE_URL. It defaults to the
// plain-HTTP Caddy entrypoint (http://localhost:2080) so CI/default runs stay
// hermetic. Point it at the TLS edge domain to exercise the real HTTPS +
// Secure-cookie path through the external edge proxy, e.g.
//   E2E_BASE_URL=https://bag-please.localhost npm run test:e2e
// (the edge must be running — docker compose only starts :2080, not the edge).
// ignoreHTTPSErrors is on so a self-signed/untrusted local edge cert doesn't
// fail the run.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:2080'

export default defineConfig({
  testDir: './e2e',
  // Enable public registration once before the suite (see e2e/global-setup.ts)
  // so the real register → auto-login flow can succeed.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', {open: 'never'}]],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'docker compose up -d --build',
    // Relative to this config's directory → the repo root.
    cwd: '..',
    // Readiness probe targets the compose-managed Caddy entrypoint directly,
    // independent of E2E_BASE_URL: docker compose starts :2080, not the edge.
    url: 'http://localhost:2080',
    reuseExistingServer: !process.env.CI,
    // Cold runs build the backend + frontend images before the stack is ready.
    timeout: 600 * 1000,
  },
  // Two viewports. The mobile project is mandatory: Epic 4's regression was a
  // mobile-only failure, so every smoke flow is proven on a Pixel-class device.
  //
  // Four projects, not two, since Story 7.3 — and the extra pair is a MUTUAL
  // EXCLUSION mechanism, not extra coverage. `registrationEnabled` is one shared
  // Mongo document; the FR20/FR21 admin test flips it OFF for real, and while it
  // was OFF the ~50 UI registrations in the *other* viewport project hit
  // "Registration is disabled" or found no Register link at all. Measured at
  // `00e95cf` with the mechanism off: three consecutive `retries: 0` runs failed
  // 3, 5 and 4 tests, every one of them inside `registerViaUi`.
  //
  // The fix routes that single test — tagged `@registration-toggle` — out of both
  // viewport projects and into two projects chained behind them, so its OFF
  // window opens only once nothing anywhere is registering. Why this and not the
  // alternatives: `test.describe.configure({mode: 'serial'})` serializes within
  // ONE project and this race is BETWEEN projects, so it cannot see the other
  // project's workers; a worker-scoped file lock would work but puts an
  // acquire/release at every register site — i.e. it re-introduces waiting
  // exactly where the deleted `expect(...).toPass()` retry loop used to be.
  // `dependencies` is the construct that orders work across projects. (It is not
  // the ONLY one — `testProject.teardown` also orders across projects, and unlike
  // `dependencies` it still runs when the run is red, which would remove the cost
  // named below. It was not evaluated before this landed; filed in the ledger.)
  //
  // The cost, stated up front and measured (see the story record): when a
  // dependency project FAILS, Playwright does not run the dependent one — it
  // reports it as "did not run" and exits non-zero. So a red `chromium` means the
  // toggle test does not execute at all. That is the correct trade (the run is
  // already red) but it changes how a failing report reads: absence of the
  // toggle result is a consequence of the chain, not a silent skip. To get the
  // answer anyway while something else is broken, add `--no-deps` — WITHOUT it,
  // `--project=registration-toggle-chromium` re-runs the still-broken dependency
  // and fails identically.
  //
  // Two collection facts worth knowing before you trust a green run:
  //   * THE TOTAL PROVES NOTHING; the per-project split does. Drop or misspell
  //     the tag and the tagged test simply runs in chromium+mobile while both
  //     toggle projects collect zero — and the total is *unchanged*, because the
  //     tag reroutes a test rather than duplicating it. The INVARIANT to check is
  //     therefore structural, not numeric: exactly ONE test in each
  //     `registration-toggle-*` project, everything else split evenly across the
  //     two viewport projects (every untagged test runs in both, so a new spec is
  //     +2 runs). Read it with:
  //       npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
  //     Never with `--list --project=<name>`: `--project` drags in that project's
  //     `dependencies` and the toggle projects then report inflated counts.
  //     Figures are dated on purpose — re-measure, never quote:
  //       2026-08-08 (Story 7.3): 104 = 51 / 51 / 1 / 1
  //       2026-08-10 (Story 7.4): 106 = 52 / 52 / 1 / 1
  //       2026-08-11 (Story 7.5): 120 = 59 / 59 / 1 / 1  (+7 untagged nav tests)
  //       2026-09-05 (Story 8.1, pre-story baseline): 134 = 66 / 66 / 1 / 1
  //         — i.e. the 2026-08-11 row above was already stale by 14 before this
  //         story changed anything; 7 untagged specs had landed unrecorded.
  //       2026-09-05 (Story 8.1, post): 150 = 74 / 74 / 1 / 1  (+8 untagged
  //         narrow-viewport tests, +2 runs each, against that 134 baseline)
  //   * `--project=chromium` (or `mobile`) on its own runs NO FR20/FR21 case at
  //     all — it is grepInverted out of both, and reports as absent, not skipped.
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
      grepInvert: /@registration-toggle/,
    },
    {
      name: 'mobile',
      // NFR-E8-1's narrow floor: 320px. The `devices['Pixel 7']` spread is
      // RETAINED and only `viewport.width` is overridden — the Chrome-on-Android
      // UA and the touch emulation are what this project exists for (Story 8.3's
      // scroll guard depends on the latter), and replacing the descriptor would
      // drop both. Pixel 7's own 412px width was never chosen for a reason
      // (AR-E8-1); 320 is the width the requirement names.
      //
      // The HEIGHT is left at Pixel 7's 839 on purpose. The resulting 320x839 box
      // is not a real device and is not meant to be: NFR-E8-1 is a requirement
      // about WIDTH, and a taller-than-life viewport only means less scrolling in
      // the tests. Do not "correct" the aspect ratio — shrinking the height would
      // change what every spec in this project sees above the fold, for no
      // requirement.
      use: {...devices['Pixel 7'], viewport: {...devices['Pixel 7'].viewport, width: 320}},
      grepInvert: /@registration-toggle/,
    },
    // Runs only after BOTH viewport projects finish → nothing is registering
    // while the flag is OFF. `fullyParallel: false` is a guard for the future,
    // not for today's single test: a SECOND `@registration-toggle` test would
    // otherwise run beside the first inside this project and race it on the same
    // flag. It serialises tests within a file; two tagged tests in DIFFERENT
    // files would still parallelise, so keep them in one file.
    {
      name: 'registration-toggle-chromium',
      use: {...devices['Desktop Chrome']},
      grep: /@registration-toggle/,
      dependencies: ['chromium', 'mobile'],
      fullyParallel: false,
    },
    // Chained behind the chromium copy rather than run beside it: two concurrent
    // toggle tests would race each other on the same flag — the very bug being
    // fixed, at smaller scale.
    //
    // What this project actually adds is narrower than "the mobile gate", and the
    // comment that used to sit here claimed otherwise: the FR20/FR21 test asserts
    // the public /auth effect in hand-built `browser.newContext()` contexts
    // (`offCtx`, `withFreshAuthPage`), which do NOT inherit this `use` block, so
    // those assertions run at a desktop viewport in BOTH toggle projects. What is
    // genuinely Pixel-7-emulated here is the admin-panel half — reaching /admin
    // through the role-gated menu and driving the registration Switch. That is
    // worth having and is why the pair exists; it is not full mobile coverage of
    // the requirement. Filed in the ledger.
    {
      name: 'registration-toggle-mobile',
      use: {...devices['Pixel 7']},
      grep: /@registration-toggle/,
      dependencies: ['registration-toggle-chromium'],
      fullyParallel: false,
    },
  ],
})
