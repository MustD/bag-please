import {expect, type Page, test} from '@playwright/test'

// User Account E2E (Story 5.3). UI-driven only — no API shortcuts for the
// asserted behaviour (the sole exception is the one-time registration-enable in
// global-setup.ts). Runs on both the chromium and mobile (Pixel 7) projects
// (see playwright.config.ts); the mobile gate is mandatory. FR mappings are in
// the test names.
//
// Every non-admin scenario registers a FRESH unique user per run/project via
// the register UI (the ./db/data volume persists across runs, and the two
// projects run concurrently), so tests only ever assert on data they created.
// The admin scenario uses the guaranteed first-boot admin/admin account purely
// to assert the ABSENCE of the change-password affordance.

const PASSWORD = 'e2e-password-123'

function uniqueUsername(label: string, projectName: string): string {
  return `acct_e2e_${label}_${projectName}_${Date.now()}`
}

// Register a brand-new account through the UI and land authenticated (FR1/FR4).
// The Create-account affordance is present because registration is enabled in
// global-setup. `/` is now a redirect (Story 5.6) — a new user lands on /lists —
// so assert route-agnostic auth (off /auth + the shared app-bar) rather than a
// specific landing route/testid.
async function registerViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/auth')
  await page.getByTestId('to-register-link').click()
  await page.getByTestId('register-username').fill(username)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
}

test('FR11/FR12 — change password signs out cleanly; new password works, old fails', async ({page}, testInfo) => {
  const username = uniqueUsername('change', testInfo.project.name)
  const newPassword = 'e2e-new-password-456'
  await registerViaUi(page, username, PASSWORD)

  // FR12: the username is shown in the app-bar chip on the authenticated screen.
  await expect(page.getByTestId('user-chip')).toContainText(username)

  // Reach Change Password from the user menu off the username chip (AC #6).
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-change-password').click()
  await expect(page).toHaveURL(/\/account\/password$/)

  await page.getByTestId('current-password-input').fill(PASSWORD)
  await page.getByTestId('new-password-input').fill(newPassword)
  await page.getByTestId('confirm-password-input').fill(newPassword)
  await page.getByTestId('change-password-submit').click()

  // Success = clean sign-out to /auth with the confirmation message (AC #3).
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByTestId('password-changed-message')).toBeVisible()

  // The OLD password now fails (sessions + credentials really changed).
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('auth-error')).toBeVisible()
  await expect(page).toHaveURL(/\/auth$/)

  // The NEW password succeeds and lands authenticated.
  await page.getByTestId('login-password').fill(newPassword)
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
  await expect(page.getByTestId('user-chip')).toContainText(username)
})

test('FR11 — confirm-mismatch blocks submit with an inline error and fires no request', async ({page}, testInfo) => {
  const username = uniqueUsername('mismatch', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)

  // Count any change-password network calls — validation must block before one.
  let changePasswordRequests = 0
  page.on('request', request => {
    if (request.url().includes('/api/auth/change-password')) changePasswordRequests++
  })

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-change-password').click()
  await expect(page).toHaveURL(/\/account\/password$/)

  await page.getByTestId('current-password-input').fill(PASSWORD)
  await page.getByTestId('new-password-input').fill('e2e-new-password-456')
  await page.getByTestId('confirm-password-input').fill('does-not-match')
  await page.getByTestId('change-password-submit').click()

  // Inline error under the confirm field; stays on the screen; no request made.
  await expect(page.getByText('Passwords do not match')).toBeVisible()
  await expect(page).toHaveURL(/\/account\/password$/)
  expect(changePasswordRequests).toBe(0)
})

test('FR11 — admin has no change-password affordance and is redirected from /account/password', async ({page}) => {
  // The guaranteed first-boot account. Used only to assert the AFFORDANCE is
  // absent — never to call change-password (the backend 403-forbids admin).
  await page.goto('/auth')
  await page.getByTestId('login-username').fill('admin')
  await page.getByTestId('login-password').fill('admin')
  await page.getByTestId('login-submit').click()
  // Admin lands on /admin via the `/` redirect (Story 5.6).
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()

  // The user menu offers Logout but NOT Change password (AC #7).
  await page.getByTestId('user-menu-button').click()
  await expect(page.getByTestId('menu-logout')).toBeVisible()
  await expect(page.getByTestId('menu-change-password')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // A direct visit to the screen redirects admin away from it (ChangePasswordPage
  // → `/` → HomeRedirect → /admin, a deterministic destination for admin).
  await page.goto('/account/password')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
})

test('FR5 — welcome banner appears once after registration, not on later logins', async ({page}, testInfo) => {
  const username = uniqueUsername('welcome', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)

  // The welcome banner relocated from the removed HomePage to ListsPage (Story
  // 5.6): a brand-new user has no lists, so `/` forwards the one-time `welcome`
  // signal to /lists, which renders the banner exactly once.
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await expect(page.getByTestId('welcome-banner')).toHaveCount(1)
  await expect(page.getByTestId('welcome-banner')).toContainText(`Welcome, ${username}!`)

  // Log out and back in — an ordinary login must NOT re-show the banner.
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-logout').click()
  await expect(page).toHaveURL(/\/auth$/)

  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  // Re-login lands the (still list-less) user on /lists — but with no welcome.
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await expect(page.getByTestId('welcome-banner')).toHaveCount(0)
})
