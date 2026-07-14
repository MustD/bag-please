import {defineConfig, devices} from '@playwright/test'

// E2E runs against the PRODUCTION image (built Vite SPA served by Caddy on
// :2080), not the dev server — this closes the "green on dev, broken in the
// shipped bundle" gap for the whole epic. The webServer builds and starts the
// full docker stack; locally it reuses an already-running :2080.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', {open: 'never'}]],
  use: {
    baseURL: 'http://localhost:2080',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'docker compose up -d --build',
    // Relative to this config's directory → the repo root.
    cwd: '..',
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
