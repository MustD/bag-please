import {expect, type Page, test} from '@playwright/test'

import {addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Sharing & Membership E2E (Story 5.7). UI-driven for every asserted behaviour:
// the sharing itself is driven through the owner's Share & Members dialog and the
// invitee's Accept/Decline in the Pending Invites section — never the
// shareList/acceptInvite API (unlike 5.6, whose only API use was membership
// SETUP). Runs on chromium + mobile (Pixel 7); the mobile gate is mandatory. FR
// mappings are in the test names.
//
// Membership has NO real-time channel, so an invitee sees a new invite only on
// their next /lists load: after the owner shares, the invitee context does a full
// `goto('/lists')` reload rather than waiting for a live update.
//
// Every scenario registers FRESH unique users per run/project via the register UI
// and asserts only on self-created data (the ./db/data volume persists across
// runs and the two projects run concurrently).

// Owner-side share through the Share & Members dialog (UI, not API). Leaves the
// dialog open so the caller can assert on the members list or an error.
async function openShareDialog(page: Page, listName: string): Promise<void> {
  await page.getByTestId(`manage-members-${listName}`).click()
  await expect(page.getByTestId('share-members-dialog')).toBeVisible()
}

async function shareWith(page: Page, listName: string, username: string): Promise<void> {
  await openShareDialog(page, listName)
  await page.getByTestId('share-username-input').fill(username)
  await page.getByTestId('share-submit').click()
}

// Return the owner to the lists index from a list detail screen.
async function backToLists(page: Page): Promise<void> {
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
}

test('FR39/FR41/FR50 — owner shares; invitee accepts and can write to the shared list', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('sharing', 'owner_share', testInfo.project.name)
  const invitee = uniqueUsername('sharing', 'invitee_share', testInfo.project.name)
  const listName = `Shared ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await backToLists(page)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const inviteePage = await ctx.newPage()
    // The target must exist before the owner can invite them.
    await registerViaUi(inviteePage, invitee, PASSWORD)

    // Owner shares via the dialog; the invitee shows up as a PENDING member.
    await shareWith(page, listName, invitee)
    await expect(page.getByTestId(`member-row-${invitee}`)).toBeVisible()
    await expect(page.getByTestId(`member-row-${invitee}`)).toContainText('Pending')
    await page.getByTestId('share-members-close').click()

    // No realtime: the invitee sees the invite only after reloading /lists.
    await inviteePage.goto('/lists')
    await expect(inviteePage.getByTestId('lists-page')).toBeVisible()
    await expect(inviteePage.getByTestId(`pending-invite-${listName}`)).toBeVisible()
    await expect(inviteePage.getByTestId(`pending-invite-${listName}`)).toContainText(`Invited by ${owner}`)

    // Accept → the invite disappears and the list appears in their index.
    await inviteePage.getByTestId(`accept-invite-${listName}`).click()
    await expect(inviteePage.getByTestId(`pending-invite-${listName}`)).toHaveCount(0)
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toBeVisible()

    // Peer write: open the management detail and add an item under the owner's
    // category — no FORBIDDEN, the item persists.
    await inviteePage.getByTestId(`list-open-${listName}`).click()
    await expect(inviteePage.getByTestId('list-detail-page')).toBeVisible()
    await addItem(inviteePage, categoryName, itemName)
    await expect(inviteePage.getByTestId(`item-row-${itemName}`)).toBeVisible()

    // Sanity: the shared list is reachable in the shopping view too (no redirect).
    await inviteePage.goto(`/list/${listId}`)
    await expect(inviteePage.getByTestId('list-shopping-page')).toBeVisible()
  } finally {
    await ctx.close()
  }
})

test('FR39 — share errors (unknown user, self, duplicate) show the exact backend message inline', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('sharing', 'owner_err', testInfo.project.name)
  const invitee = uniqueUsername('sharing', 'invitee_err', testInfo.project.name)
  const ghost = uniqueUsername('sharing', 'ghost_err', testInfo.project.name)
  const listName = `Errors ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await backToLists(page)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    // Register a real second user so the duplicate case has a valid target.
    const inviteePage = await ctx.newPage()
    await registerViaUi(inviteePage, invitee, PASSWORD)

    // Unknown user.
    await shareWith(page, listName, ghost)
    await expect(page.getByTestId('share-error')).toContainText(`User '${ghost}' not found`)

    // Self.
    await page.getByTestId('share-username-input').fill(owner)
    await page.getByTestId('share-submit').click()
    await expect(page.getByTestId('share-error')).toContainText('You cannot share a list with yourself')

    // First (valid) share of the real user succeeds — becomes PENDING.
    await page.getByTestId('share-username-input').fill(invitee)
    await page.getByTestId('share-submit').click()
    await expect(page.getByTestId(`member-row-${invitee}`)).toBeVisible()

    // Duplicate share of the same user → already-pending error.
    await page.getByTestId('share-username-input').fill(invitee)
    await page.getByTestId('share-submit').click()
    await expect(page.getByTestId('share-error')).toContainText(`User '${invitee}' already has a pending invite`)
  } finally {
    await ctx.close()
  }
})

test('FR40/FR48 — owner removes a member; the removed user loses access (next list load redirects)', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('sharing', 'owner_rm', testInfo.project.name)
  const invitee = uniqueUsername('sharing', 'invitee_rm', testInfo.project.name)
  const listName = `Remove ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await backToLists(page)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const inviteePage = await ctx.newPage()
    await registerViaUi(inviteePage, invitee, PASSWORD)

    // Owner shares, invitee accepts (UI) — becomes an accepted member with access.
    await shareWith(page, listName, invitee)
    await expect(page.getByTestId(`member-row-${invitee}`)).toBeVisible()
    await page.getByTestId('share-members-close').click()
    await inviteePage.goto('/lists')
    await inviteePage.getByTestId(`accept-invite-${listName}`).click()
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toBeVisible()
    await inviteePage.goto(`/list/${listId}`)
    await expect(inviteePage.getByTestId('list-shopping-page')).toBeVisible()

    // Owner removes the member via the dialog's confirm.
    await openShareDialog(page, listName)
    // Re-sharing a now-ACCEPTED member surfaces the distinct "already a member"
    // message (verbatim), separate from the pending-duplicate case.
    await page.getByTestId('share-username-input').fill(invitee)
    await page.getByTestId('share-submit').click()
    await expect(page.getByTestId('share-error')).toContainText(`User '${invitee}' is already a member`)
    await page.getByTestId(`remove-member-${invitee}`).click()
    await expect(page.getByTestId('remove-member-dialog')).toBeVisible()
    await page.getByTestId('remove-member-dialog-confirm').click()
    await expect(page.getByTestId('remove-member-dialog')).toHaveCount(0)
    await expect(page.getByTestId(`member-row-${invitee}`)).toHaveCount(0)

    // The removed user's next list load redirects to /lists (5.6 FORBIDDEN guard),
    // and the list is gone from their index.
    await inviteePage.goto(`/list/${listId}`)
    await expect(inviteePage).toHaveURL(/\/lists$/)
    await inviteePage.goto('/lists')
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

test('FR55 — a non-owner member leaves a shared list; it stays for the owner', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('sharing', 'owner_leave', testInfo.project.name)
  const invitee = uniqueUsername('sharing', 'invitee_leave', testInfo.project.name)
  const listName = `Leave ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await backToLists(page)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const inviteePage = await ctx.newPage()
    await registerViaUi(inviteePage, invitee, PASSWORD)

    await shareWith(page, listName, invitee)
    await expect(page.getByTestId(`member-row-${invitee}`)).toBeVisible()
    await page.getByTestId('share-members-close').click()
    await inviteePage.goto('/lists')
    await inviteePage.getByTestId(`accept-invite-${listName}`).click()
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toBeVisible()

    // Member leaves via the row's Leave affordance (non-owner rows have no delete).
    await expect(inviteePage.getByTestId(`list-row-${listName}`).getByTestId('delete-list-button')).toHaveCount(0)
    await inviteePage.getByTestId(`leave-list-${listName}`).click()
    await expect(inviteePage.getByTestId('leave-list-dialog')).toBeVisible()
    await inviteePage.getByTestId('leave-list-dialog-confirm').click()
    await expect(inviteePage.getByTestId('leave-list-dialog')).toHaveCount(0)
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toHaveCount(0)

    // The former member loses access; the owner keeps the list.
    await inviteePage.goto(`/list/${listId}`)
    await expect(inviteePage).toHaveURL(/\/lists$/)
    await page.goto('/lists')
    await expect(page.getByTestId(`list-row-${listName}`)).toBeVisible()
  } finally {
    await ctx.close()
  }
})

test('FR39/FR41 — invitee declines; the invite disappears and grants no access', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('sharing', 'owner_dec', testInfo.project.name)
  const invitee = uniqueUsername('sharing', 'invitee_dec', testInfo.project.name)
  const listName = `Decline ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await backToLists(page)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const inviteePage = await ctx.newPage()
    await registerViaUi(inviteePage, invitee, PASSWORD)

    await shareWith(page, listName, invitee)
    await expect(page.getByTestId(`member-row-${invitee}`)).toBeVisible()
    await page.getByTestId('share-members-close').click()

    await inviteePage.goto('/lists')
    await expect(inviteePage.getByTestId(`pending-invite-${listName}`)).toBeVisible()
    await inviteePage.getByTestId(`decline-invite-${listName}`).click()
    await expect(inviteePage.getByTestId(`pending-invite-${listName}`)).toHaveCount(0)

    // Declining grants no access: no list row, and the list is unreachable.
    await expect(inviteePage.getByTestId(`list-row-${listName}`)).toHaveCount(0)
    await inviteePage.goto(`/list/${listId}`)
    await expect(inviteePage).toHaveURL(/\/lists$/)
  } finally {
    await ctx.close()
  }
})

test('FR56 — admin at /lists sees the graceful notice and no sharing affordances', async ({page}) => {
  await page.goto('/auth')
  await page.getByTestId('login-username').fill('admin')
  await page.getByTestId('login-password').fill('admin')
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()

  await openListsViaMenu(page)

  // Graceful FORBIDDEN notice; no invites section, no rows, no share/leave/manage
  // affordances, no hanging spinner.
  await expect(page.getByTestId('lists-notice')).toBeVisible()
  await expect(page.getByTestId('lists-notice')).toContainText(/admin cannot access list resources/i)
  await expect(page.getByTestId('pending-invites-section')).toHaveCount(0)
  await expect(page.getByTestId('lists-loading')).toHaveCount(0)
  // No list rows, hence no per-list affordances leak to the admin.
  await expect(page.getByTestId('delete-list-button')).toHaveCount(0)
  await expect(page.locator('[data-testid^="manage-members-"]')).toHaveCount(0)
  await expect(page.locator('[data-testid^="leave-list-"]')).toHaveCount(0)
})
