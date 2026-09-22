import {expect, test} from '@playwright/test'

import {loginAsAdmin, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

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
