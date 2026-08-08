import {expect, type Page, test} from '@playwright/test'

import {addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Global Navigation E2E (Story 6.2, FR57 — with FR38/FR56 for the home-resolution
// outcomes the title link delegates to). Covers the app-bar "Bag Please" title as
// a genuine link to `/` on every guarded screen, and the shopping view's new
// back-to-lists link. Every asserted behaviour is driven through the rendered
// affordance (click or keyboard) and never through an API shortcut; the only
// environment preparation is global-setup.ts enabling registration. Direct URL
// entry is used only to *reach* a screen under test (as shopping.spec does for
// /list/:id, which has no in-app entry point besides HomeRedirect and the
// switcher chips) — never to stand in for the behaviour being asserted. Runs on
// both the chromium and mobile (Pixel 7) projects (see playwright.config.ts); the
// mobile gate is mandatory.
//
// Every scenario registers a FRESH unique regular user per run/project via the
// register UI — `admin` is blocked from all list resources and there is no seeded
// regular account, while the ./db/data volume persists across runs and the two
// projects run concurrently — so tests only ever assert on lists they created,
// never on totals. The admin scenario uses the guaranteed first-boot admin.
//
// Home resolution itself lives in HomeRedirect (admin → /admin, no lists →
// /lists, otherwise the oldest list by createdAt); these tests assert the title
// link reaches it, not that it re-derives it.

const ADMIN = {username: 'admin', password: 'admin'}

// The title as the accessibility tree sees it: a link named "Bag Please".
function titleLink(page: Page) {
  return page.getByRole('link', {name: 'Bag Please'})
}

test('FR57 — the app-bar title is a link to home on every guarded screen', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'everywhere', testInfo.project.name)
  const listName = `Everywhere ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)

  // /lists (the index).
  await openListsViaMenu(page)
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')

  // /lists/:id (the management view) — reached through the index UI.
  const listId = await createListAndOpen(page, listName)
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')

  // /list/:id (the shopping view) — a legitimate goto of the id just created,
  // the same way shopping.spec reaches this route.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')

  // /account/password — reached through the user menu.
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-change-password').click()
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(page.getByTestId('change-password-page')).toBeVisible()
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')

  // The href resolves to the app root, so `/` (HomeRedirect) owns resolution.
  const resolved = await page.getByTestId('app-bar-home').evaluate(
    el => new URL((el as HTMLAnchorElement).href).pathname,
  )
  expect(resolved).toBe('/')
})

test('FR57 — the title link keeps the title\'s look and only the text is clickable', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'styling', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const link = page.getByTestId('app-bar-home')

  // The visual contract: unchanged h6 scale/weight/colour, no underline at rest,
  // and none of a Button's decoration (AC1).
  const atRest = await link.evaluate(el => {
    const s = getComputedStyle(el)
    return {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      textDecorationLine: s.textDecorationLine,
      textTransform: s.textTransform,
      padding: s.padding,
    }
  })
  expect(atRest.fontSize).toBe('20px')
  expect(atRest.fontWeight).toBe('600')
  expect(atRest.textDecorationLine).toBe('none')
  expect(atRest.textTransform).toBe('none')
  expect(atRest.padding).toBe('0px')

  // Hover is visibly indicated (underline="hover").
  await link.hover()
  await expect(async () => {
    const hovered = await link.evaluate(el => getComputedStyle(el).textDecorationLine)
    expect(hovered).toBe('underline')
  }).toPass({timeout: 2000})

  // The clickable area is the TEXT, not the whole toolbar. `flexGrow: 1` lives on
  // the wrapper Box for exactly this reason; if it ever moves back onto the Link
  // the anchor stretches across the bar and empty space navigates home. Every
  // other assertion in this file would still pass, so guard it here.
  const linkBox = await link.boundingBox()
  const barBox = await page.getByTestId('app-bar').boundingBox()
  if (!linkBox || !barBox) throw new Error('app-bar-home or app-bar has no bounding box')
  expect(linkBox.width).toBeLessThan(barBox.width / 2)
})

test('FR57 — the title link is Tab-reachable and activatable with Enter', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'keyboard', testInfo.project.name)
  const listName = `Keyboard ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)

  // Stand on the lists index: it is not where home resolves to (the user has one
  // list), so the navigation is observable, and nothing on it autofocuses — so
  // the first Tab from a fresh load must land on the title link, which is the
  // first focusable element in the shell. Drive it from the keyboard only: no
  // click and no programmatic .focus(), since only a real Tab press puts the link
  // into :focus-visible, which is what AC1 asks for.
  // A fresh load, not an in-app click: Chromium keeps the sequential-focus origin
  // at the last element interacted with, so tabbing after a click would resume
  // from there. A page load is the real "arrive and press Tab" scenario.
  await page.goto('/lists')
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(titleLink(page)).toBeFocused()

  // Keyboard focus is visibly indicated (the explicit ring, not a UA default of 0).
  const outlineWidth = await page.getByTestId('app-bar-home')
    .evaluate(el => getComputedStyle(el).outlineWidth)
  expect(outlineWidth).not.toBe('0px')

  await page.keyboard.press('Enter')

  // The user's only list is the one just created, so home resolves to it.
  await expect(page).toHaveURL(new RegExp(`/list/${listId}$`))
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
})

test('FR57/FR38 — activating the title link from the newer list lands on the oldest list', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'oldest', testInfo.project.name)
  const oldest = `Oldest ${Date.now()}`
  const newer = `Newer ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  // Create two lists in order → the first is the oldest by createdAt. Return to
  // the index between them (createListAndOpen leaves us on the detail screen).
  const oldestId = await createListAndOpen(page, oldest)
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
  const newerId = await createListAndOpen(page, newer)

  // Stand on the NEWER list's shopping view, then activate the title link.
  await page.goto(`/list/${newerId}`)
  await expect(page.getByTestId('shopping-header')).toContainText(newer)
  await titleLink(page).click()

  await expect(page).toHaveURL(new RegExp(`/list/${oldestId}$`))
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId('shopping-header')).toContainText(oldest)
})

test('FR38 — activating the title link with no lists lands on the lists index', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'nolists', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)

  // A brand-new user owns no lists. Stand on a non-home screen first so the
  // navigation is a real transition.
  await page.goto('/account/password')
  await expect(page.getByTestId('change-password-page')).toBeVisible()
  await titleLink(page).click()

  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
})

test('FR56 — admin activating the title link lands on the admin area with no list affordance', async ({page}) => {
  await page.goto('/auth')
  await page.getByTestId('login-username').fill(ADMIN.username)
  await page.getByTestId('login-password').fill(ADMIN.password)
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()

  // Reach the panel through the role-gated menu affordance, then leave it so the
  // title-link navigation is observable.
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-admin').click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()

  // The admin screen is a guarded screen too: it carries the same title link.
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')

  // Admin at /lists gets the graceful notice and stays put (it does not bounce),
  // so assert we are really settled there before clicking — otherwise a future
  // redirect would satisfy the /admin assertion below without the link doing it.
  await page.goto('/lists')
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()

  await titleLink(page).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()

  // The admin area gains no list-related affordance from this story.
  await expect(page.getByTestId('create-list-button')).toHaveCount(0)
  await expect(page.getByTestId('list-shopping-back')).toHaveCount(0)
  await expect(page.getByTestId('list-detail-back')).toHaveCount(0)
})

test('FR57 — the shopping view\'s back link returns to the lists index', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'back', testInfo.project.name)
  const listName = `Back ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId('list-shopping-back')).toBeVisible()
  await page.getByTestId('list-shopping-back').click()

  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
})

test('FR57 — the shopping view\'s item rows still offer check-off only', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'checkonly', testInfo.project.name)
  const listName = `CheckOnly ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).toBeVisible()

  // Check-off is the row's only affordance: the checkbox is present and works…
  const checkbox = page.getByTestId(`shopping-item-checkbox-${itemName}`).getByRole('checkbox')
  await expect(checkbox).toBeVisible()
  await checkbox.click()
  await expect(checkbox).toBeChecked()

  // …and no management control leaked onto this surface (AR-E6-5).
  await expect(page.getByTestId('remove-item-button')).toHaveCount(0)
  await expect(row.getByRole('button', {name: /remove/i})).toHaveCount(0)
  await expect(row.getByRole('button', {name: /edit/i})).toHaveCount(0)
  await expect(row.getByRole('button')).toHaveCount(0)
})

test('FR57 — an unauthenticated visitor gets no app bar and no title link', async ({page}) => {
  // The `page` fixture is already an isolated context per test, so no session
  // leaks in from another scenario. Deliberately NOT browser.newContext(): a
  // hand-built context does not inherit the project's `use` block, which would
  // silently run this at a desktop viewport on the mobile project and void the
  // mandatory mobile gate for this scenario.
  await page.goto('/auth')
  await expect(page.getByTestId('login-submit')).toBeVisible()

  await expect(page.getByTestId('app-bar')).toHaveCount(0)
  await expect(page.getByTestId('app-bar-home')).toHaveCount(0)
  await expect(titleLink(page)).toHaveCount(0)
  await expect(page.getByTestId('list-shopping-back')).toHaveCount(0)
})

test('NFR-E6-2 — at 360px the title link and username chip both stay inside a single-line bar', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'narrow', testInfo.project.name)
  const listName = `Narrow ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)

  await page.setViewportSize({width: 360, height: 800})
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()

  // Both affordances are rendered and visible, not collapsed away.
  await expect(page.getByTestId('app-bar-home')).toBeVisible()
  await expect(page.getByTestId('user-chip')).toBeVisible()

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

  // The chip is not pushed off-screen by the title link's flex growth. Bound by
  // the real clientWidth, not a hardcoded 360 — a classic scrollbar narrows the
  // content box and would make a hardcoded bound looser than intended.
  const chipBox = await page.getByTestId('user-chip').boundingBox()
  if (!chipBox) throw new Error('user-chip has no bounding box')
  expect(chipBox.x).toBeGreaterThanOrEqual(0)
  expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(overflow.clientWidth)

  // The title did not wrap. Measured on the LINK, not the bar: a two-line h6 is
  // ~64px of content, which a single-line Toolbar's 56px minHeight absorbs almost
  // entirely — so a bar-height bound is too coarse to catch a wrap, while the
  // link's own height is exactly one line box or two.
  const linkBox = await page.getByTestId('app-bar-home').boundingBox()
  if (!linkBox) throw new Error('app-bar-home has no bounding box')
  // Derived from the rendered font size rather than hardcoded: one 20px h6 line
  // box is ~32px and two are ~64px, so 2× the font size separates them cleanly.
  const fontSize = await page.getByTestId('app-bar-home')
    .evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(linkBox.height).toBeLessThan(fontSize * 2)

  // The bar itself is still one Toolbar row.
  const barBox = await page.getByTestId('app-bar').boundingBox()
  if (!barBox) throw new Error('app-bar has no bounding box')
  expect(barBox.height).toBeLessThanOrEqual(72)

  // …and the page does not scroll horizontally.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
})
