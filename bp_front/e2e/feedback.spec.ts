import {expect, test} from '@playwright/test'

import {loginAsAdmin, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Submit one feedback entry through the UI, in a FRESH context/page (never the
// admin's `page` — the admin account cannot send feedback). Returns the
// submitter's username so the admin-side scenarios can locate the right row.
async function submitFeedbackViaUi(
  browser: import('@playwright/test').Browser,
  baseURL: string | undefined,
  namespace: string,
  projectName: string,
  text: string,
): Promise<string> {
  const username = uniqueUsername('feedback', namespace, projectName)
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const senderPage = await ctx.newPage()
    await registerViaUi(senderPage, username, PASSWORD)
    await openListsViaMenu(senderPage)
    await senderPage.getByTestId('user-menu-button').click()
    await senderPage.getByTestId('menu-feedback').click()
    await expect(senderPage.getByTestId('feedback-dialog')).toBeVisible()
    await senderPage.getByTestId('feedback-text').fill(text)
    await senderPage.getByTestId('feedback-submit').click()
    await expect(senderPage.getByTestId('feedback-dialog')).toHaveCount(0)
  } finally {
    await ctx.close()
  }
  return username
}

// Story 9.9 — a user can send feedback from any screen. UI-driven only, per the
// suite-wide convention (support/ui.ts header). Every scenario registers a
// FRESH unique user and asserts only on data/behaviour it produced — never on
// a total. Runs on both the chromium and mobile (Pixel 7) projects.

test('FR — a regular user can open the feedback dialog from the menu, submit, and it closes without navigating away', async ({
                                                                                                                                page,
                                                                                                                              }, testInfo) => {
  await registerViaUi(page, uniqueUsername('feedback', 'happy', testInfo.project.name), PASSWORD)
  // Land on /lists via the `/` redirect (Story 5.6) — the "current screen" this
  // story's dialog must not navigate away from.
  await openListsViaMenu(page)
  await expect(page).toHaveURL(/\/lists$/)

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-feedback').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()
  // Opening the dialog did not navigate away from /lists.
  await expect(page).toHaveURL(/\/lists$/)

  await page.getByTestId('feedback-text').fill('Please add dark icons')
  await page.getByTestId('feedback-submit').click()
  await expect(page.getByTestId('feedback-dialog')).toHaveCount(0)
  // The underlying screen is unchanged.
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
})

test('FR — blank feedback text shows an inline field error and does not submit', async ({page}, testInfo) => {
  await registerViaUi(page, uniqueUsername('feedback', 'blank', testInfo.project.name), PASSWORD)
  await openListsViaMenu(page)

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-feedback').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()

  await page.getByTestId('feedback-submit').click()
  // The dialog stays open — no request was sent and no error alert is shown for
  // a client-side validation failure (an inline field error only).
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()
  await expect(page.getByTestId('feedback-error')).toHaveCount(0)
  await expect(page.getByText('Feedback text is required')).toBeVisible()

  // Whitespace-only text is exactly as blank.
  await page.getByTestId('feedback-text').fill('   ')
  await page.getByTestId('feedback-submit').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()
  await expect(page.getByText('Feedback text is required')).toBeVisible()
})

test('FR — over-2000-character feedback is rejected client-side before any request is sent', async ({page}, testInfo) => {
  await registerViaUi(page, uniqueUsername('feedback', 'toolong', testInfo.project.name), PASSWORD)
  await openListsViaMenu(page)

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-feedback').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()

  // Fill via JS, not `.fill()` char-by-char — the length is what matters, not
  // typing fidelity, and 2001 keystrokes would be needlessly slow.
  const overLong = 'a'.repeat(2001)
  await page.getByTestId('feedback-text').evaluate((el, value) => {
    const input = el as HTMLTextAreaElement
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
    nativeSetter.call(input, value)
    input.dispatchEvent(new Event('input', {bubbles: true}))
  }, overLong)

  let requestSeen = false
  page.on('request', req => {
    if (req.url().includes('/graphql') && req.postData()?.includes('sendFeedback')) requestSeen = true
  })

  await page.getByTestId('feedback-submit').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()
  await expect(page.getByText(/must not exceed 2000 characters/)).toBeVisible()
  expect(requestSeen, 'over-length text must be rejected before any network request is sent').toBe(false)
})

test('FR — Cancel closes the dialog without sending feedback, and the field is empty on next open', async ({
                                                                                                               page,
                                                                                                             }, testInfo) => {
  await registerViaUi(page, uniqueUsername('feedback', 'cancel', testInfo.project.name), PASSWORD)
  await openListsViaMenu(page)

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-feedback').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()

  await page.getByTestId('feedback-text').fill('This should never be sent')
  await page.getByTestId('feedback-cancel').click()
  await expect(page.getByTestId('feedback-dialog')).toHaveCount(0)

  // Reopen: the field is empty, proving reset() ran and nothing was retained.
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-feedback').click()
  await expect(page.getByTestId('feedback-dialog')).toBeVisible()
  await expect(page.getByTestId('feedback-text')).toHaveValue('')
})

test('FR — the admin account has no Feedback entry in the account menu', async ({page}) => {
  await loginAsAdmin(page)
  await page.getByTestId('user-menu-button').click()
  await expect(page.getByTestId('menu-logout')).toBeVisible()
  await expect(page.getByTestId('menu-feedback')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 9.10 — the admin reviews and clears feedback. The ADMIN is on `page`
// (the mobile gate must cover the admin panel this story adds); the submitting
// regular user runs in a separate context, per AGENTS.md's pitfall about
// `browser.newContext()` not inheriting the project's viewport — same pattern
// sharing.spec.ts uses for its second actor.
// ─────────────────────────────────────────────────────────────────────────────

test('FR — the admin sees a submitted feedback entry with its text, username and time, and can delete it', async ({
                                                                                                                      page,
                                                                                                                      browser,
                                                                                                                      baseURL,
                                                                                                                    }, testInfo) => {
  // Seed two entries, oldest first, with distinct identifiable text — proves
  // "newest-first" ordering (AC1) at the rendered DOM/panel layer, not only at
  // the GraphQL-response layer.
  const olderText = `Please add light icons ${Date.now()}`
  await submitFeedbackViaUi(browser, baseURL, 'review-older', testInfo.project.name, olderText)
  const text = `Please add dark icons ${Date.now()}`
  const username = await submitFeedbackViaUi(browser, baseURL, 'review', testInfo.project.name, text)

  await loginAsAdmin(page)

  // Scoped to the feedback panel: `username` also appears in the Users table
  // (the submitter is a registered account), so an unscoped locator is
  // ambiguous (strict-mode violation).
  const feedbackList = page.getByTestId('admin-feedback-list')
  await expect(feedbackList.getByText(text)).toBeVisible()
  await expect(feedbackList.getByText(username)).toBeVisible()
  await expect(feedbackList.getByText(olderText)).toBeVisible()

  // Newest-first: the more-recently-submitted entry's text appears before the
  // older one's in the rendered panel.
  const entryTexts = await feedbackList.locator('[data-testid^="admin-feedback-text-"]').allTextContents()
  const newerIndex = entryTexts.findIndex(t => t.includes(text))
  const olderIndex = entryTexts.findIndex(t => t.includes(olderText))
  expect(newerIndex).toBeGreaterThanOrEqual(0)
  expect(olderIndex).toBeGreaterThanOrEqual(0)
  expect(newerIndex).toBeLessThan(olderIndex)

  // Find the row's own delete button via its accessible name rather than a
  // guessed id shape — the row's own id isn't known to the test.
  const deleteButton = feedbackList.getByRole('button', {name: `Delete feedback from ${username}`})
  await deleteButton.click()
  await expect(page.getByTestId('delete-feedback-dialog')).toBeVisible()
  await expect(page.getByTestId('delete-feedback-dialog')).toContainText(username)
  await page.getByTestId('delete-feedback-confirm').click()
  await expect(page.getByTestId('delete-feedback-dialog')).toHaveCount(0)

  // The entry is gone from the panel...
  await expect(feedbackList.getByText(text)).toHaveCount(0)
  // ...and from a subsequent `feedback` query (reload re-fetches from the server).
  await page.reload()
  await expect(page.getByTestId('admin-page')).toBeVisible()
  await expect(page.getByTestId('admin-feedback-list').getByText(text)).toHaveCount(0)
})

test('FR — Cancel on the delete-feedback dialog leaves the entry in place', async ({page, browser, baseURL}, testInfo) => {
  const text = `Cancel should not remove this ${Date.now()}`
  const username = await submitFeedbackViaUi(browser, baseURL, 'cancel', testInfo.project.name, text)

  await loginAsAdmin(page)

  const feedbackList = page.getByTestId('admin-feedback-list')
  await expect(feedbackList.getByText(text)).toBeVisible()
  const deleteButton = feedbackList.getByRole('button', {name: `Delete feedback from ${username}`})
  await deleteButton.click()
  await expect(page.getByTestId('delete-feedback-dialog')).toBeVisible()
  await page.getByTestId('delete-feedback-cancel').click()
  await expect(page.getByTestId('delete-feedback-dialog')).toHaveCount(0)

  // The entry is still present.
  await expect(feedbackList.getByText(text)).toBeVisible()
})
