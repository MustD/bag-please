import {expect, test} from '@playwright/test'

// Smoke coverage for the Epic 5 foundation. UI-driven only (no API shortcuts),
// run on both the desktop and mobile projects (see playwright.config.ts).
// FRs: infrastructure, FR29 (unauthenticated → login redirect).

test('app loads and redirects an unauthenticated visit to / → /auth', async ({page}) => {
  await page.goto('/')
  // RouteGuard sends the unauthenticated visitor to the auth screen (FR29).
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByTestId('auth-page')).toBeVisible()
})

test('unauthenticated visit to a protected route redirects to /auth', async ({page}) => {
  await page.goto('/lists')
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByTestId('auth-page')).toBeVisible()
})

test('a deep-linked client route is served by Caddy (SPA fallback)', async ({page}) => {
  // Caddy's try_files fallback must return index.html (200) for a non-root
  // client path — not a 404. The SPA then boots and the guard redirects.
  const response = await page.goto('/lists/123')
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('auth-page')).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)
})
