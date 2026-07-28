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
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'mobile',
      use: {...devices['Pixel 7']},
    },
  ],
})
