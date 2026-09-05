import {type Browser, expect, type Page, test} from '@playwright/test'

import {uniqueUsername} from './support/ui'

// Admin User Management E2E (Story 5.4). UI-driven only — no API shortcuts for
// the asserted behaviour (the sole exception is the one-time registration-enable
// in global-setup.ts). Runs on both the chromium and mobile (Pixel 7) projects
// (see playwright.config.ts); the mobile gate is mandatory. FR mappings are in
// the test names.
//
// Managed users get a UNIQUE username per run/project (the ./db/data volume
// persists across runs and the two projects run concurrently), so tests only
// ever assert on rows they created — never on a total row count. Assertions that
// exercise a managed user's own session (login, redirect) run in a FRESH browser
// context so the admin session in `page` is never disturbed.

const ADMIN = {username: 'admin', password: 'admin'}
const DEFAULT_PW = 'e2e-password-123'

async function loginViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/auth')
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

// Sign in as the guaranteed first-boot admin and open the panel through the
// role-gated menu affordance (FR30) — never by navigating to /admin directly.
async function loginAsAdmin(page: Page): Promise<void> {
  await loginViaUi(page, ADMIN.username, ADMIN.password)
  // Admin lands on /admin via the `/` redirect (Story 5.6); assert authenticated
  // route-agnostically, then reach the panel through the role-gated menu.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-admin').click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()
}

// Create a user via the panel dialog and wait for the new row to appear without
// a page reload (refetch-driven).
async function createUserViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.getByTestId('admin-create-user-button').click()
  await expect(page.getByTestId('create-user-dialog')).toBeVisible()
  await page.getByTestId('create-user-username').fill(username)
  await page.getByTestId('create-user-password').fill(password)
  await page.getByTestId('create-user-submit').click()
  await expect(page.getByTestId('create-user-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`admin-user-row-${username}`)).toBeVisible()
}

// Drive the registration Switch to a desired state deterministically. Waits for
// the switch to be enabled (the previous mutation has settled) before reading or
// clicking, then confirms the resolved state — so it converges whatever value it
// finds (a prior run, or the chromium link of the toggle chain, may have left
// the persisted flag in either state).
async function setRegistration(page: Page, on: boolean): Promise<void> {
  const input = page.getByTestId('registration-toggle').locator('input')
  await expect(input).toBeEnabled()
  if ((await input.isChecked()) !== on) {
    await page.getByTestId('registration-toggle').click()
    if (on) await expect(input).toBeChecked()
    else await expect(input).not.toBeChecked()
  }
}

// Load a fresh, unauthenticated /auth in its own context and run assertions on
// it, then dispose the context. Used to observe the registration toggle's
// public effect without touching the admin session.
async function withFreshAuthPage(
  browser: Browser,
  baseURL: string | undefined,
  fn: (p: Page) => Promise<void>,
): Promise<void> {
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const p = await ctx.newPage()
    await p.goto('/auth')
    await expect(p.getByTestId('auth-page')).toBeVisible()
    await fn(p)
  } finally {
    await ctx.close()
  }
}

test('FR13/FR14 — admin creates a user via the panel; the new user can log in', async ({
                                                                                         browser,
                                                                                         page,
                                                                                         baseURL
                                                                                       }, testInfo) => {
  const username = uniqueUsername('admin', 'create', testInfo.project.name)
  await loginAsAdmin(page)
  await createUserViaUi(page, username, DEFAULT_PW)

  // Fresh context: the created user signs in through the UI and lands home.
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const userPage = await ctx.newPage()
    await loginViaUi(userPage, username, DEFAULT_PW)
    // The managed regular user lands on /lists via the `/` redirect (Story 5.6).
    await expect(userPage).not.toHaveURL(/\/auth$/)
    await expect(userPage.getByTestId('app-bar')).toBeVisible()
    await expect(userPage.getByTestId('user-chip')).toContainText(username)
  } finally {
    await ctx.close()
  }
})

test('FR16/FR17 — admin resets a user password via the confirm dialog; new password works, old fails', async ({
                                                                                                                browser,
                                                                                                                page,
                                                                                                                baseURL
                                                                                                              }, testInfo) => {
  const username = uniqueUsername('admin', 'reset', testInfo.project.name)
  const newPassword = 'e2e-reset-pw-789'
  await loginAsAdmin(page)
  await createUserViaUi(page, username, DEFAULT_PW)

  // Reset via the confirmation dialog (FR17 — fires only from the confirm btn).
  await page.getByTestId(`admin-user-row-${username}`).getByTestId('reset-password-button').click()
  await expect(page.getByTestId('reset-password-dialog')).toBeVisible()
  await page.getByTestId('reset-password-input').fill(newPassword)
  await page.getByTestId('reset-password-confirm').click()
  await expect(page.getByTestId('reset-password-dialog')).toHaveCount(0)

  // Fresh context: the OLD password now fails and the NEW one succeeds (FR16 —
  // the reset really changed the credential and revoked sessions).
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const userPage = await ctx.newPage()
    await loginViaUi(userPage, username, DEFAULT_PW)
    await expect(userPage.getByTestId('auth-error')).toBeVisible()
    await expect(userPage).toHaveURL(/\/auth$/)

    await userPage.getByTestId('login-password').fill(newPassword)
    await userPage.getByTestId('login-submit').click()
    await expect(userPage).not.toHaveURL(/\/auth$/)
    await expect(userPage.getByTestId('app-bar')).toBeVisible()
  } finally {
    await ctx.close()
  }
})

test('FR15/FR17 — admin deletes a user via the confirm dialog; the row disappears', async ({page}, testInfo) => {
  const username = uniqueUsername('admin', 'delete', testInfo.project.name)
  await loginAsAdmin(page)
  await createUserViaUi(page, username, DEFAULT_PW)

  await page.getByTestId(`admin-user-row-${username}`).getByTestId('delete-user-button').click()
  await expect(page.getByTestId('delete-user-dialog')).toBeVisible()
  await page.getByTestId('delete-user-confirm').click()
  await expect(page.getByTestId('delete-user-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`admin-user-row-${username}`)).toHaveCount(0)
})

// The ONLY test that writes the shared `registrationEnabled` document. The
// `@registration-toggle` tag is what routes it: playwright.config.ts grepInverts
// the tag out of `chromium`/`mobile` and grep-selects it into the two
// `registration-toggle-*` projects, which are chained behind them with
// `dependencies`. So this body runs only after every register-based spec on both
// viewports has finished — the OFF window is exclusive ACROSS projects, which is
// the one thing `test.describe.configure({mode: 'serial'})` cannot give (it
// serializes within a project; this race was between them). Story 7.3.
test('FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it', {
  tag: '@registration-toggle',
}, async ({browser, page, baseURL}, testInfo) => {
  await loginAsAdmin(page)

  // Known ON baseline — still load-bearing, for a NEW reason. The concurrent
  // project that used to strand the flag is gone, but the chain runs this same
  // test twice in sequence (registration-toggle-chromium, then -mobile), so if
  // the chromium copy dies between the OFF flip and its restore, this is what
  // recovers the flag for the mobile copy.
  await setRegistration(page, true)

  // The OFF window no longer races anything: `dependencies` guarantees nothing
  // else is registering while it is open (Story 7.3 deleted the race; the
  // reload-until-visible retry wrapper in support/ui.ts went with it). The shape
  // below is kept anyway — pre-create the observer context so only the /auth
  // load+assert sits inside the window, and restore ON in an inner finally — so
  // a stranded OFF flag cannot outlive this test and poison the NEXT run's
  // register-based specs through the persisted ./db/data volume.
  const offCtx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  const offPage = await offCtx.newPage()
  try {
    try {
      await setRegistration(page, false)
      await offPage.goto('/auth')
      await expect(offPage.getByTestId('auth-page')).toBeVisible()
      await expect(offPage.getByTestId('contact-admin')).toBeVisible()
      await expect(offPage.getByTestId('to-register-link')).toHaveCount(0)
    } finally {
      // Restore ON immediately — closes the OFF window whatever happened above.
      // Do NOT rethrow (a throw here would mask a failing assertion above), but
      // do NOT swallow silently either: record a genuine restore failure so a
      // stranded OFF flag — which would break the mobile link of the chain and,
      // via the persisted ./db/data volume, the NEXT run's register-based specs
      // before global-setup re-enables it — is visible in the report instead of
      // invisible.
      await setRegistration(page, true).catch((err: unknown) => {
        testInfo.annotations.push({
          type: 'registration-restore-failed',
          description: String(err),
        })
      })
    }

    // With the flag already back ON (no open window), confirm a fresh /auth
    // shows the Register link again.
    await withFreshAuthPage(browser, baseURL, async p => {
      await expect(p.getByTestId('to-register-link')).toBeVisible()
    })
  } finally {
    await offCtx.close()
  }
})

test('FR30/FR31 — a non-admin has no Admin menu item and is redirected from /admin', async ({
                                                                                              browser,
                                                                                              page,
                                                                                              baseURL
                                                                                            }, testInfo) => {
  const username = uniqueUsername('admin', 'nonadmin', testInfo.project.name)
  // Provision a regular user via the admin panel — deterministic and independent
  // of the shared registration flag the toggle scenario flips. FR31 is a
  // role-gating requirement, satisfied by any role==='user' account.
  await loginAsAdmin(page)
  await createUserViaUi(page, username, DEFAULT_PW)

  // In a fresh context, that user signs in and sees NO admin affordances.
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const userPage = await ctx.newPage()
    await loginViaUi(userPage, username, DEFAULT_PW)
    // The managed regular user lands on /lists via the `/` redirect (Story 5.6).
    await expect(userPage).not.toHaveURL(/\/auth$/)
    await expect(userPage.getByTestId('app-bar')).toBeVisible()

    // The user menu offers Logout but NOT Admin (affordance-hiding, FR31).
    await userPage.getByTestId('user-menu-button').click()
    await expect(userPage.getByTestId('menu-logout')).toBeVisible()
    await expect(userPage.getByTestId('menu-admin')).toHaveCount(0)
    await userPage.keyboard.press('Escape')

    // A direct visit to /admin bounces the non-admin away (AdminGuard → `/` →
    // HomeRedirect → /lists — deterministic: this freshly-created user owns no
    // lists, FR30/FR31).
    await userPage.goto('/admin')
    await expect(userPage).toHaveURL(/\/lists$/)
    await expect(userPage.getByTestId('app-bar')).toBeVisible()
  } finally {
    await ctx.close()
  }
})
