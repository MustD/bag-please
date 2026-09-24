import {type Browser, expect, type Page, test} from '@playwright/test'

import {
  ADMIN,
  createListAndOpen,
  loginAsAdmin,
  loginViaUi,
  openListsViaMenu,
  shareWith,
  uniqueUsername,
} from './support/ui'
import {countUsersApi, createUserApi, deleteUserApi, listE2eUsers, loginApi} from './support/api'

// Admin User Management E2E (Story 5.4). UI-driven only — no API shortcuts for
// the asserted behaviour (the sole exception is the one-time registration-enable
// in global-setup.ts). Runs on both the chromium and mobile (Pixel 7) projects
// (see playwright.config.ts); the mobile gate is mandatory. FR mappings are in
// the test names.
//
// Managed users get a UNIQUE username per run/project (the db_data named volume
// persists across runs and the two projects run concurrently), so tests only
// ever assert on rows they created — never on a total row count. Assertions that
// exercise a managed user's own session (login, redirect) run in a FRESH browser
// context so the admin session in `page` is never disturbed.

const DEFAULT_PW = 'e2e-password-123'

// FR13's page size, mirrored from AdminPage.tsx so the pager arithmetic below
// reads against the requirement rather than a bare 20.
const PAGE_SIZE = 20

// `ADMIN`, `loginViaUi` and `loginAsAdmin` moved to support/ui.ts in Story 9.2:
// narrow-viewport.spec.ts now signs in as the admin too, and a second copy in a
// spec is the duplication NFR-E8-5 forbids.

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
  // This user owns nothing, so the Story 9.4 cascade sentence must be ABSENT —
  // the zero case of the count, and the only place it is asserted.
  await expect(
    page.getByTestId('delete-user-dialog'),
    'a user who owns no lists gets no cascade sentence',
  ).not.toContainText('This also deletes')
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
  // register-based specs through the persisted db_data named volume.
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
      // via the persisted db_data named volume, the NEXT run's register-based specs
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 9.2 (FR13) — the users table is SERVER-PAGED.
//
// WHAT THESE MAY AND MAY NOT ASSERT. `db_data` persists across runs and the two
// viewport projects run CONCURRENTLY, so the table's absolute size is not a
// property any run controls. Both tests below therefore measure the total before
// they seed and assert a DELTA against it — never a literal — exactly as the
// file header has required since Story 5.4. Exact ordering, clamping and
// `around` semantics are pinned in AdminUserManagementTest, where the data is
// controlled; what is asserted here is the rendered pager.
// ─────────────────────────────────────────────────────────────────────────────

test('FR13 — the users table pages at 20 with a total, and the pager walks pages', async ({page}, testInfo) => {
  const token = await loginApi(ADMIN.username, ADMIN.password)
  const before = await countUsersApi(token)

  // 45 rows under one run-unique prefix — enough for three pages to exist
  // regardless of what else is in the table. Seeded via the API: this test is
  // about the PAGER, and driving 45 creates through the dialog would be testing
  // the create flow 45 times.
  const prefix = uniqueUsername('pager', 'seed', testInfo.project.name)
  for (let i = 0; i < 45; i++) {
    await createUserApi(token, `${prefix}_${String(i).padStart(3, '0')}`, DEFAULT_PW)
  }

  await loginAsAdmin(page)

  // THE TOTAL, as a measured delta. `>=` and not `===`: the sibling viewport
  // project runs this same test concurrently and seeds its own 45, so rows can
  // land between the read above and this assertion. Asserting `=== before + 45`
  // would rebuild the "assert on a total you did not create" defect this story
  // exists to remove.
  const shownTotal = Number((await page.getByTestId('admin-users-total').textContent()) ?? '')
  expect(shownTotal, 'the total counts the rows this test seeded').toBeGreaterThanOrEqual(before + 45)

  // /admin opens on the first page.
  const rows = page.locator('[data-testid^="admin-user-row-"]')
  const names = () => page.getByTestId('admin-user-name').allTextContents()
  await expect(page.getByTestId('admin-users-page')).toHaveText(/^1 \/ \d+$/)
  await expect(rows, 'a full page is exactly the page size').toHaveCount(PAGE_SIZE)
  await expect(page.getByTestId('admin-users-prev'), 'no previous page to go to').toBeDisabled()
  await expect(page.getByTestId('admin-users-next'), '45 seeded rows guarantee a next page').toBeEnabled()

  const firstPage = await names()
  expect(firstPage, 'usernames ascend within the page').toEqual([...firstPage].sort())

  // next → next → previous lands on the expected pages.
  await page.getByTestId('admin-users-next').click()
  await expect(page.getByTestId('admin-users-page')).toHaveText(/^2 \/ \d+$/)
  await expect(rows).toHaveCount(PAGE_SIZE)
  const secondPage = await names()
  expect(secondPage, 'usernames ascend within the page').toEqual([...secondPage].sort())
  // The page really ADVANCED rather than re-rendering the same rows. `>=` covers
  // the one benign case: a concurrent insert ahead of this page shifts every row
  // down by one, making this page's first name the previous page's last.
  expect(
    secondPage[0] >= firstPage[firstPage.length - 1],
    'page 2 starts where page 1 ended',
  ).toBe(true)

  await page.getByTestId('admin-users-next').click()
  await expect(page.getByTestId('admin-users-page')).toHaveText(/^3 \/ \d+$/)

  await page.getByTestId('admin-users-prev').click()
  await expect(page.getByTestId('admin-users-page')).toHaveText(/^2 \/ \d+$/)
  await expect(rows).toHaveCount(PAGE_SIZE)
  const backAgain = await names()
  expect(backAgain, 'usernames ascend within the page').toEqual([...backAgain].sort())
})

// TAGGED, and the tag is load-bearing — see playwright.config.ts.
//
// This test has to ARRANGE a last page holding exactly one row, which is a
// property of the table's TOTAL. Under `fullyParallel: true` the rest of the
// suite creates users continuously (296 in a measured 75-second run, ~4/sec
// across 12 workers) and the two viewport projects run this same test
// concurrently, so the total is stale the moment it is read: measured red at
// `toHaveCount(1)` receiving 5 (chromium) and 2 (mobile). No tightening of the
// window fixes that — an admin login plus navigation is seconds, and seconds are
// dozens of rows.
//
// So it runs where nothing else is creating users: the `@serial-users` tag
// routes it into the projects chained behind both viewport projects, exactly as
// `@registration-toggle` does for the shared registration flag. It is NOT a
// retry loop and NOT a raised timeout — those remain forbidden.
test('FR13/FR15 — deleting the only user on the last page moves the table back a page', {
  tag: '@serial-users',
}, async ({page}, testInfo) => {
  const token = await loginApi(ADMIN.username, ADMIN.password)

  // ARRANGE a last page holding exactly one row.
  //
  // `zzz_`-prefixed names sort after every other username the suite creates
  // (every other prefix is a lowercase word), so these pad rows form the tail of
  // the table, and the `zzzz` row created through the UI below sorts after even
  // those. Pad until the total is 1 (mod 20) COUNTING that row, which then lands
  // alone on a brand-new last page.
  const padPrefix = uniqueUsername('zzz_pad', 'tail', testInfo.project.name)
  const total = await countUsersApi(token)
  const padCount = (PAGE_SIZE - (total % PAGE_SIZE)) % PAGE_SIZE
  for (let i = 0; i < padCount; i++) {
    await createUserApi(token, `${padPrefix}_${String(i).padStart(3, '0')}`, DEFAULT_PW)
  }

  const lastUser = uniqueUsername('zzzz', 'last', testInfo.project.name)
  await loginAsAdmin(page)
  // The create lands on another page entirely, so this also exercises AC-3: the
  // panel shows the page CONTAINING the new row without walking pages.
  await createUserViaUi(page, lastUser, DEFAULT_PW)

  const rows = page.locator('[data-testid^="admin-user-row-"]')
  await expect(rows, 'the new row is alone on a fresh last page').toHaveCount(1)
  await expect(page.getByTestId('admin-users-next'), 'there is no page after this one').toBeDisabled()

  const label = (await page.getByTestId('admin-users-page').textContent()) ?? ''
  const [pageNumber, pageCount] = label.split('/').map(part => Number(part.trim()))
  expect(pageNumber, 'the create landed on the LAST page').toBe(pageCount)
  const totalBefore = Number((await page.getByTestId('admin-users-total').textContent()) ?? '')

  await page.getByTestId(`admin-user-row-${lastUser}`).getByTestId('delete-user-button').click()
  await expect(page.getByTestId('delete-user-dialog')).toBeVisible()
  await page.getByTestId('delete-user-confirm').click()
  await expect(page.getByTestId('delete-user-dialog')).toHaveCount(0)

  // What the delete left behind: the row is gone, the table sits one page back,
  // the total is one lower, and that page is FULL again. These are web-first and
  // retry until the post-delete answer lands, so they pin the settled result —
  // NOT the cache eviction that produced it (they would pass without it too).
  await expect(page.getByTestId(`admin-user-row-${lastUser}`)).toHaveCount(0)
  await expect(page.getByTestId('admin-users-page')).toHaveText(`${pageNumber - 1} / ${pageCount - 1}`)
  await expect(page.getByTestId('admin-users-total')).toHaveText(String(totalBefore - 1))
  await expect(rows).toHaveCount(PAGE_SIZE)
})

// The prefix this test's two rows carry. It sorts after every other username the
// suite creates, the `zzz_pad`/`zzzz` rows of the last-page case included, which
// is what puts this case's rows at the tail of the table.
const TAIL_PREFIX = 'zzzzz_purge'

// TAGGED, and the tag is load-bearing — same reason as the last-page test above.
//
// This test has to keep TWO SPECIFIC ROWS on the page the admin panel is showing
// while a third actor works in another context, and the only way the panel can
// locate a row at all is the `around` jump a create performs. Under
// `fullyParallel: true` the suite creates ~4 users/second, so any row's page is
// stale the moment it is read. `@serial-users` routes this into the projects
// chained behind both viewport projects, where nothing else touches the users
// table, and the table is then padded to a page boundary exactly as the test
// above does — so the two rows land, deterministically, alone on a fresh last
// page.
//
// The admin is on the `page` fixture on purpose: the new cascade sentence in the
// delete confirmation is this story's new rendering, and that is what the
// 320px project must cover. The owner and the member drive their halves in
// hand-built contexts (desktop-sized, as `browser.newContext()` never inherits
// the project's `use` block) — their surfaces are already covered at the floor
// by sharing.spec.ts.
test('FR15 — deleting a list owner states the owned-list count and takes the list from its members', {
  tag: '@serial-users',
}, async ({browser, page, baseURL}, testInfo) => {
  const token = await loginApi(ADMIN.username, ADMIN.password)

  // `zzzzz_` sorts after every other username the suite creates, including the
  // `zzz_pad`/`zzzz` rows the last-page test leaves behind, so this case's rows
  // form the tail of the table. Padding the total to a multiple of the page size
  // first puts them — and nothing else — on a brand-new last page.
  const owner = uniqueUsername(TAIL_PREFIX, 'owner', testInfo.project.name)
  // Sorts IMMEDIATELY after the owner: no username can fall between a name and
  // that same name with a suffix. It also inherits the owner's `_e2e_` marker,
  // so the per-run sweep still collects it.
  const member = `${owner}_m`
  // A third account, created only to make the admin panel re-read the owner's
  // owned-list count after the second list exists. It sorts right after the
  // member, so all three rows stay on the same page.
  const refetchTrigger = `${member}_x`
  // Project-scoped like the usernames: the two chained projects run the same
  // case, and `list-row-<name>` is a testid two concurrent runs could collide on.
  const listName = `Purged ${testInfo.project.name} ${Date.now()}`
  // A SECOND owned list, so the confirmation's count reaches 2 and its wording
  // switches to the plural branch. Both are destroyed by the delete; only the
  // first is shared.
  const secondListName = `Purged second ${testInfo.project.name} ${Date.now()}`

  const padPrefix = uniqueUsername('zzz_pad', 'purge', testInfo.project.name)
  const total = await countUsersApi(token)
  const padCount = (PAGE_SIZE - (total % PAGE_SIZE)) % PAGE_SIZE
  for (let i = 0; i < padCount; i++) {
    await createUserApi(token, `${padPrefix}_${String(i).padStart(3, '0')}`, DEFAULT_PW)
  }

  await loginAsAdmin(page)
  await createUserViaUi(page, owner, DEFAULT_PW)

  const ownerCtx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  const memberCtx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    // The owner creates the list that the delete must destroy.
    const ownerPage = await ownerCtx.newPage()
    await loginViaUi(ownerPage, owner, DEFAULT_PW)
    await expect(ownerPage).not.toHaveURL(/\/auth$/)
    await expect(ownerPage.getByTestId('app-bar')).toBeVisible()
    await openListsViaMenu(ownerPage)
    const listId = await createListAndOpen(ownerPage, listName)
    await ownerPage.getByTestId('list-detail-back').click()
    await expect(ownerPage.getByTestId('lists-page')).toBeVisible()

    // Creating the member re-reads the users page AFTER the first list exists,
    // which is what puts a truthful owned-list count in front of the admin — and
    // it lands both rows on the same (last) page. The panel re-reads on a create
    // or a delete and nothing else, so each count below needs a create before it.
    await createUserViaUi(page, member, DEFAULT_PW)
    await expect(page.getByTestId(`admin-user-row-${owner}`)).toBeVisible()

    // ONE owned list — the singular branch of the sentence, asserted verbatim
    // and then cancelled out of. Without this, interpolating "lists"
    // unconditionally would pass the whole suite.
    await page.getByTestId(`admin-user-row-${owner}`).getByTestId('delete-user-button').click()
    await expect(page.getByTestId('delete-user-dialog')).toBeVisible()
    await expect(
      page.getByTestId('delete-user-dialog'),
      'one owned list reads in the singular',
    ).toContainText('This also deletes the 1 list they own, with their items and categories.')
    await page.getByTestId('delete-user-cancel').click()
    await expect(page.getByTestId('delete-user-dialog')).toHaveCount(0)

    // A second owned list, and a throwaway account whose create is what makes the
    // panel re-read the count as 2.
    await createListAndOpen(ownerPage, secondListName)
    await ownerPage.getByTestId('list-detail-back').click()
    await expect(ownerPage.getByTestId('lists-page')).toBeVisible()
    await createUserViaUi(page, refetchTrigger, DEFAULT_PW)
    await expect(page.getByTestId(`admin-user-row-${owner}`)).toBeVisible()

    // The member accepts the invite and can read the list.
    const memberPage = await memberCtx.newPage()
    await loginViaUi(memberPage, member, DEFAULT_PW)
    // `loginViaUi` only SUBMITS the form; without waiting for the landing the
    // reload below would race the in-flight sign-in and find /auth.
    await expect(memberPage).not.toHaveURL(/\/auth$/)
    await expect(memberPage.getByTestId('app-bar')).toBeVisible()
    await shareWith(ownerPage, listName, member)
    await expect(ownerPage.getByTestId(`member-row-${member}`)).toBeVisible()
    await ownerPage.getByTestId('share-members-close').click()
    await memberPage.goto('/lists')
    await memberPage.getByTestId(`accept-invite-${listName}`).click()
    await expect(memberPage.getByTestId(`list-row-${listName}`)).toBeVisible()
    await memberPage.goto(`/list/${listId}`)
    await expect(memberPage.getByTestId('list-shopping-page')).toBeVisible()

    // The confirmation names what the delete destroys beyond the account.
    await page.getByTestId(`admin-user-row-${owner}`).getByTestId('delete-user-button').click()
    await expect(page.getByTestId('delete-user-dialog')).toBeVisible()
    await expect(
      page.getByTestId('delete-user-dialog'),
      'the confirm states the cascade, with the owned-list count',
    ).toContainText('This also deletes the 2 lists they own, with their items and categories.')
    await page.getByTestId('delete-user-confirm').click()
    await expect(page.getByTestId('delete-user-dialog')).toHaveCount(0)
    await expect(page.getByTestId(`admin-user-row-${owner}`)).toHaveCount(0)

    // The member's next load of the deleted owner's list redirects (the Story
    // 5.6 FORBIDDEN guard), and the list is gone from their index — the phantom
    // membership this story removes would have kept both alive.
    await memberPage.goto(`/list/${listId}`)
    await expect(memberPage).toHaveURL(/\/lists$/)
    await memberPage.goto('/lists')
    await expect(memberPage.getByTestId(`list-row-${listName}`)).toHaveCount(0)
  } finally {
    await memberCtx.close()
    await ownerCtx.close()
    // TEARDOWN, not an assertion. These rows sort AFTER the `zzzz` tail the
    // last-page case above arranges, so a leftover one would push that case's
    // "alone on a fresh last page" row into a full page — measured, as a failure
    // of THAT test on the second chained project. The per-run sweep is too late
    // for a sibling in the same file, so they go now. Keyed on THIS run's `owner`
    // (the member and the trigger are both derived from it), never on the shared
    // prefix: that would delete the sibling project's rows out from under it.
    for (const row of await listE2eUsers(token)) {
      if (row.username.startsWith(owner)) await deleteUserApi(token, row.id)
    }
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
