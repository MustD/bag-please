import path from 'path'
import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', {open: 'never'}]],
  use: {
    baseURL: 'http://localhost:2080',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'docker compose up -d',
    cwd: path.join(__dirname, '..'),
    url: 'http://localhost:2080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
      dependencies: ['setup'],
    },
  ],
})
