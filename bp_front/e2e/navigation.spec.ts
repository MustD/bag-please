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
// Home resolution itself lives in one shared resolver, useHomePath (admin →
// /admin, no lists → /lists, otherwise the oldest list by createdAt — Story 7.5
// moved it out of HomeRedirect so the app bar could observe the same answer).
// These tests assert the title link reaches it, and — for the Story 7.5 block at
// the bottom — that the app bar suppresses the click when the resolved answer IS
// the current route. Neither asserts the app bar re-derives anything.

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

// ─── Story 7.5 ─────────────────────────────────────────────────────────────
// FR38's numeric home resolution and FR57's inert-when-already-home guard. The
// six tests below extend this file rather than starting a new spec: they assert
// the same app-bar affordance the ten above do, reuse `titleLink`/`ADMIN`, and
// the `nav` prefix already owns this namespace. The guard is a `preventDefault()`
// on the anchor's click and nothing else — no attribute but `aria-current` is
// added, no element is swapped — which is why every test above still passes
// unedited, including the two that stand on a route that IS the resolved home
// (`styling` at /lists with no lists, and `everywhere` at /list/:id with one).

test('FR38 — the oldest list is chosen numerically: a whole-second createdAt beats a sub-second one', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'precision', testInfo.project.name)
  const first = `PrecisionA ${Date.now()}`
  const second = `PrecisionB ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  // Two real lists in creation order: A is genuinely older than B.
  const aId = await createListAndOpen(page, first)
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
  const bId = await createListAndOpen(page, second)

  // PHASE 1 — the non-vacuity anchor. With the genuine server timestamps `/`
  // must resolve to A. If this ever failed, the phase-2 result would prove
  // nothing about the comparator (it could be landing on B for any reason).
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/list/${aId}$`))
  await expect(page.getByTestId('shopping-header')).toContainText(first)

  // PHASE 2 — the precision pair, which cannot be produced through the UI:
  // `createdAt` is server-generated and `Instant.toString()` only omits the
  // fractional part when the nanos happen to be exactly zero (~1 in 1000). So
  // patch the RESPONSE, not the database, and patch only the two `createdAt`
  // strings — every other field, id and __typename stays genuine, so Apollo's
  // cache is satisfied and no list id is fabricated. Fabricating an id would be
  // actively harmful here: `/list/<id the user is not a member of>` is FORBIDDEN
  // and ListShoppingPage redirects to /lists, which would race the URL assertion.
  //
  // The patch INVERTS the real order — the later-created B becomes the
  // numerically older one (5000ms < 5100ms) — so a run that silently missed the
  // interception lands back on A and goes red instead of passing by accident.
  // Under the old lexicographic compare B's `…:05Z` sorts AFTER A's
  // `…:05.100Z` ('Z' 0x5A > '.' 0x2E) and the redirect picks A.
  // Counted, not assumed (review patch): if a future transport batched or
  // persisted the query, the JSON.parse below would fall through to
  // route.continue(), phase 2 would land back on A, and the failure would read as
  // a comparator bug instead of a harness one. The counter names the real cause.
  let patched = 0
  await page.route('**/api/graphql', async route => {
    const post = route.request().postData()
    let operationName: string | undefined
    if (post !== null) {
      try {
        operationName = (JSON.parse(post) as {operationName?: string}).operationName
      } catch {
        operationName = undefined
      }
    }
    // Only the `Lists` operation is touched; items, categories and every
    // mutation pass through untouched.
    if (operationName !== 'Lists') {
      await route.continue()
      return
    }
    // Apollo can abort an in-flight query on unsubscribe, which rejects
    // route.fetch(); let that surface as an aborted request rather than an
    // unhandled rejection that fails the test for an unrelated reason.
    let res
    try {
      res = await route.fetch()
    } catch {
      await route.abort()
      return
    }
    const body = await res.json() as {
      data?: {lists?: {lists?: Array<{id: string, createdAt: string}> | null} | null} | null
    }
    for (const list of body.data?.lists?.lists ?? []) {
      if (list.id === aId) list.createdAt = '2026-01-01T00:00:05.100Z'
      if (list.id === bId) list.createdAt = '2026-01-01T00:00:05Z'
    }
    patched += 1
    // Explicit status + content type rather than `response: res`: re-serialising
    // the body while inheriting the upstream headers would carry a stale
    // content-length/content-encoding the moment Caddy compresses /api/graphql,
    // and that breaks as an opaque decode error rather than a legible failure.
    await route.fulfill({status: res.status(), contentType: 'application/json', body: JSON.stringify(body)})
  })

  // A full page load, so the redirect resolves from a cold Apollo cache and the
  // patched response is what it reads.
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/list/${bId}$`))
  await expect(page.getByTestId('shopping-header')).toContainText(second)
  // The interception really is what produced that result.
  expect(patched).toBeGreaterThan(0)

  await page.unroute('**/api/graphql')
})

test('FR57 — a user with no lists gets an inert title link on /lists, which is their resolved home', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'inertindex', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  // The third home outcome, and the one the other inert tests do not reach: with
  // zero lists `/` resolves to /lists, so the index IS home. Untested until this
  // review pass — and it is the route with no back affordance of its own, so the
  // link must be inert-but-present here too. The auto-retrying attribute matcher
  // is also the synchronisation point for the cache-only observe window.
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')

  const historyBefore = await page.evaluate(() => window.history.length)
  await titleLink(page).click()
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await expect(page.getByTestId('home-redirect-loading')).toHaveCount(0)
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
})

test('FR57 — activating the title link while already home moves nothing: no URL, spinner, scroll or history change', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'inert', testInfo.project.name)
  const listName = `Inert ${Date.now()}`
  const categoryName = `InertCat ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  // Enough rows that the shopping view genuinely scrolls at a short viewport.
  await addItem(page, categoryName, `InertOne ${Date.now()}`)
  await addItem(page, categoryName, `InertTwo ${Date.now()}`)
  await addItem(page, categoryName, `InertThree ${Date.now()}`)

  // Arrive on the resolved home route through a REAL navigation from /lists/:id
  // — the user owns exactly one list, so /list/:id is home. This click is also
  // the proof that the guard does not over-fire on the way in.
  await titleLink(page).click()
  await expect(page).toHaveURL(new RegExp(`/list/${listId}$`))
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  // Synchronise on the resolved state before asserting inertness — the app bar
  // observes the lists cache only, so it reports "not home" until that cache is
  // populated (see the same note on the `inertlook` test). Warm here because the
  // index already ran the query, but asserted rather than assumed.
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')

  // Short viewport (the 360px precedent above) so there is something to scroll.
  await page.setViewportSize({width: 360, height: 400})
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const scrollBefore = await page.evaluate(() => window.scrollY)
  // Non-vacuity: without a real scroll offset the "scroll unmoved" assertion
  // below would pass on 0 === 0 forever. If this ever fails, the scroll
  // container is not the document — FIND it, do not delete the assertion.
  expect(scrollBefore).toBeGreaterThan(0)

  const historyBefore = await page.evaluate(() => window.history.length)
  await titleLink(page).click()

  // Nothing moved. Without the guard the click pushes `/` (history.length + 1)
  // and HomeRedirect then `replace`s back to this same route, so the URL
  // assertion alone would still pass — the history-depth and goBack assertions
  // are what actually discriminate.
  await expect(page).toHaveURL(new RegExp(`/list/${listId}$`))
  await expect(page.getByTestId('home-redirect-loading')).toHaveCount(0)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)

  // The FR57 symptom in one assertion: ONE Back press must leave for the
  // previous screen, not spend itself undoing a no-op navigation.
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/lists/${listId}$`))
  await expect(page.getByTestId('list-detail-back')).toBeVisible()
})

test('FR57 — the already-home title link stays a real, focusable, unchanged-looking link', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'inertlook', testInfo.project.name)
  const listName = `InertLook ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)

  // Stand on the resolved home route (one list ⇒ /list/:id) via a goto rather
  // than by clicking the title: a click leaves the POINTER over the link, and
  // `underline="hover"` would then report textDecorationLine 'underline' and
  // fail the at-rest contract below for a reason that has nothing to do with
  // this story. `inert` above covers the click-in path.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()

  // Inert-but-PRESENT: still exposed as a link named "Bag Please", still
  // href="/", plus the one added attribute.
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')

  // The same at-rest visual contract the `styling` test asserts on a live link:
  // an inert home link is not allowed to look different.
  const atRest = await page.getByTestId('app-bar-home').evaluate(el => {
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

  // A fresh load before Tab, for the reason documented on the `keyboard` test:
  // Chromium keeps the sequential-focus origin at the last-interacted element,
  // so only a real Tab press after a page load yields :focus-visible.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  // SYNCHRONISE, do not race (review patch, 2026-08-11). `list-shopping-page`
  // renders before its lists query resolves — ListShoppingPage's own `loading`
  // flag covers only items and categories — and the app bar observes the cache
  // ONLY, so for ~100ms after a cold load `aria-current` is absent and the link
  // is legitimately live. Without this wait the Enter assertion below raced that
  // window and failed 2 of 6 isolated runs. This is an auto-retrying matcher, so
  // it is the synchronisation point; it is not a duplicate of the assertion
  // above (that one ran after a different page load).
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Tab')
  await expect(titleLink(page)).toBeFocused()
  const outlineWidth = await page.getByTestId('app-bar-home')
    .evaluate(el => getComputedStyle(el).outlineWidth)
  expect(outlineWidth).not.toBe('0px')

  // Enter on a focused anchor dispatches a click, so the same preventDefault
  // covers keyboard activation: nothing navigates.
  //
  // The history depth is the DISCRIMINATING assertion here and the URL is not.
  // Measured with the guard removed: Enter pushes `/`, HomeRedirect then
  // `replace`s back to this very route with a warm cache, so the URL is
  // unchanged and no spinner ever renders — this test passed unguarded until the
  // depth check was added. Do not drop it.
  const historyBefore = await page.evaluate(() => window.history.length)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/list/${listId}$`))
  await expect(page.getByTestId('home-redirect-loading')).toHaveCount(0)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
})

test('FR57/FR38 — the guard does not over-fire: the link still navigates home from a non-home list and from change-password', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'nooverfire', testInfo.project.name)
  const oldest = `NoOverfireOld ${Date.now()}`
  const newer = `NoOverfireNew ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const oldestId = await createListAndOpen(page, oldest)
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
  const newerId = await createListAndOpen(page, newer)

  // /lists/:id of the NEWER list — home resolves elsewhere, so the link is live.
  // (The existing tests cover /lists, a non-home /list/:id, change-password for a
  // user with NO lists, and admin; these two routes were uncovered.)
  await expect(page).toHaveURL(new RegExp(`/lists/${newerId}$`))
  await expect(page.getByTestId('app-bar-home')).not.toHaveAttribute('aria-current', 'page')
  await titleLink(page).click()
  await expect(page).toHaveURL(new RegExp(`/list/${oldestId}$`))
  await expect(page.getByTestId('shopping-header')).toContainText(oldest)

  // /account/password — reached through the user menu, the route with no back
  // affordance of its own.
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-change-password').click()
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(page.getByTestId('change-password-page')).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).not.toHaveAttribute('aria-current', 'page')
  await titleLink(page).click()
  await expect(page).toHaveURL(new RegExp(`/list/${oldestId}$`))
  await expect(page.getByTestId('shopping-header')).toContainText(oldest)
})

test('FR56/FR57 — an admin already on /admin has an inert but fully present title link', async ({page}) => {
  // No testInfo and no uniqueUsername here, mirroring the FR56 test above: this
  // scenario logs in as the guaranteed first-boot admin, and tsconfig.e2e.json
  // sets noUnusedParameters, so an unused `testInfo` would be a BUILD error.
  await page.goto('/auth')
  await page.getByTestId('login-username').fill(ADMIN.username)
  await page.getByTestId('login-password').fill(ADMIN.password)
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-admin').click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()

  // For admin, home IS /admin — so standing here the link is inert. That is the
  // RULED outcome (AR-E7-8a), not an over-fire: admin's app is a single screen,
  // ChangePasswordPage bounces admin away from /account/password, and /admin has
  // no back affordance of its own. Which is exactly why inert must mean
  // inert-but-PRESENT: a title that vanished here would read as a broken render,
  // and without browser chrome this link plus the user menu are the only exits.
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('href', '/')
  await expect(page.getByTestId('app-bar-home')).toHaveAttribute('aria-current', 'page')

  const historyBefore = await page.evaluate(() => window.history.length)
  await titleLink(page).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()
  await expect(page.getByTestId('home-redirect-loading')).toHaveCount(0)
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)

  // The complement — an admin standing anywhere ELSE still navigates — is
  // asserted separately by the FR56 test above, which clicks the link from
  // /lists and lands on /admin.
})

test('FR57 — every guarded route keeps a live in-app exit, and landing on home costs no extra history entry', async ({page}, testInfo) => {
  const username = uniqueUsername('nav', 'exits', testInfo.project.name)
  const listName = `Exits ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)

  // Coverage for the chrome-less case (Story 7.14 removes the URL bar and the
  // browser Back button): every guarded route must expose at least one in-app
  // navigation affordance. The user menu is the affordance of record everywhere;
  // some routes add their own.
  await openListsViaMenu(page)
  await expect(page.getByTestId('user-menu-button')).toBeVisible()

  const listId = await createListAndOpen(page, listName)
  await expect(page.getByTestId('user-menu-button')).toBeVisible()
  await expect(page.getByTestId('list-detail-back')).toBeVisible()

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId('user-menu-button')).toBeVisible()
  // This route IS home for a one-list user, so the title link is inert here —
  // which is why the route's OWN back link is what carries it.
  await expect(page.getByTestId('list-shopping-back')).toBeVisible()

  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-change-password').click()
  await expect(page.getByTestId('change-password-page')).toBeVisible()
  await expect(page.getByTestId('user-menu-button')).toBeVisible()
  // /account/password has no back affordance of its own, so its exit is the
  // title link — and it must be LIVE here (home is the list, not this route).
  await expect(titleLink(page)).toBeVisible()
  await expect(page.getByTestId('app-bar-home')).not.toHaveAttribute('aria-current', 'page')

  // Launch depth: a page opened straight onto `/` must not leave a dead entry
  // behind, because HomeRedirect uses `replace`. MEASURED value is 2, not 1: a
  // fresh Playwright page starts on about:blank and the goto adds the second
  // entry, while the `/` → /list/:id redirect adds none (that is the property
  // under test). `context().newPage()`, never `browser.newContext()` — a new
  // page inherits the project's `use` block (so the mobile gate is real here)
  // and shares the refresh cookie (so the session restores instead of bouncing
  // to /auth).
  const fresh = await page.context().newPage()
  await fresh.goto('/')
  await expect(fresh.getByTestId('list-shopping-page')).toBeVisible()
  await expect(fresh).toHaveURL(new RegExp(`/list/${listId}$`))
  expect(await fresh.evaluate(() => window.history.length)).toBe(2)
  await fresh.close()
})
