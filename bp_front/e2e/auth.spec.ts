import {expect, test} from '@playwright/test'

// Authentication E2E (Story 5.2). UI-driven only — no API shortcuts except the
// one-time registration-enable in global-setup.ts. Runs on both the chromium
// and mobile (Pixel 7) projects (see playwright.config.ts); the mobile gate is
// mandatory. FR mappings are in the test names.

test('FR1/FR4/FR2/FR3/FR10 — register → auto-login → logout → log back in', async ({page}, testInfo) => {
  // Unique per run AND per project so the two concurrent projects never collide
  // on the shared, persisted user store (mirror the "assert only what you
  // created / unique IDs" rule).
  const username = `mia_e2e_${testInfo.project.name}_${Date.now()}`
  const password = 'e2e-password-123'

  // Register (FR1) — the Create-account affordance is present because
  // registration is genuinely enabled (global-setup), exercising the real
  // /api/auth/config read.
  await page.goto('/auth')
  await page.getByTestId('to-register-link').click()
  await page.getByTestId('register-username').fill(username)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-submit').click()

  // Auto-login: no separate sign-in step, lands authenticated (FR4, FR2). `/` is
  // now a redirect (Story 5.6), so a new user lands on /lists rather than a home
  // placeholder — assert route-agnostic auth (off /auth + app-bar) + the chip.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
  await expect(page.getByTestId('user-chip')).toContainText(username)

  // Logout (via the app-bar user menu) returns to /auth and invalidates the
  // session (FR3, FR10).
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-logout').click()
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByTestId('auth-page')).toBeVisible()

  // Log back in with the same credentials (FR2).
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
  await expect(page.getByTestId('user-chip')).toContainText(username)
})

test('FR8/FR9/FR33 — session-expiry banner shows on ?expired=1 and clears on typing', async ({page}) => {
  // Contract-only: the banner + ?expired=1 param. The full Apollo-driven
  // 401 → refresh-fail → redirect path is wired and hand-verified in 5.2, and
  // gets automated E2E in the first query-bearing story (no GraphQL query
  // exists here to force a 401), per the AC #7 scope decision.
  await page.goto('/auth?expired=1')
  const alert = page.getByTestId('session-expired-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('session has expired')

  // Engaging a field clears the banner AND drops the query param — assert both,
  // so a regression that only hides the banner (leaving ?expired=1 to re-show it
  // on the next re-render) is caught.
  await page.getByTestId('login-username').fill('someone')
  await expect(alert).toBeHidden()
  await expect(page).toHaveURL(/\/auth$/)
})

test('FR21/FR32 — registration disabled hides Register link and shows contact-admin', async ({page}) => {
  // Mock ONLY the config read (the input to the conditional render). The
  // thing under test — the UI's disabled-state branch — stays real, and no
  // shared backend state is touched, so this is race-free across both projects.
  await page.route('**/api/auth/config', route =>
    route.fulfill({json: {registrationEnabled: false}}),
  )

  // Wait for the mocked config read to resolve before asserting. The page
  // renders neither affordance while the flag is unresolved (null), so
  // contact-admin appearing genuinely proves the resolved-false branch — it is
  // no longer satisfied by the loading state.
  const configResponse = page.waitForResponse('**/api/auth/config')
  await page.goto('/auth')
  await expect(page.getByTestId('auth-page')).toBeVisible()
  await configResponse
  await expect(page.getByTestId('contact-admin')).toBeVisible()
  await expect(page.getByTestId('to-register-link')).toHaveCount(0)
})
