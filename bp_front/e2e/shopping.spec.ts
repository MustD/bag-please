import {randomUUID} from 'node:crypto'

import {expect, test, type Page} from '@playwright/test'

import {gql, loginApi} from './support/api'
import {
  addCategory,
  addItem,
  countGraphqlRequests,
  createListAndOpen,
  openListsViaMenu,
  PASSWORD,
  registerViaUi,
  uniqueUsername,
  withCategoryMenu,
} from './support/ui'

// List View / Shopping / Real-Time E2E (Story 5.6). UI-driven only for every
// asserted behaviour; the sole non-UI use is test SETUP that seeds a second
// member via the backend shareList/acceptInvite mutations (sharing UI is Story
// 5.7) — mirroring global-setup's API use. Runs on chromium + mobile (Pixel 7);
// the mobile gate is mandatory. FR mappings are in the test names.
//
// Every scenario registers FRESH unique users per run/project via the register
// UI — `admin` is blocked from list resources and the ./db/data volume persists
// across runs while the two projects run concurrently — so tests only ever
// assert on data they created, never on totals.

test('FR40 — checking an item persists across a reload, and it can be unchecked', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'check', testInfo.project.name)
  const listName = `Check ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  // Open the shopping view.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  // Since Story 8.3 the ROW is the checkbox (role + aria-checked on the row
  // element), so the check-off target is the row locator itself — there is no
  // checkbox descendant to reach through any more.
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).not.toBeChecked()

  // The row's state is controlled by server state (no optimistic flip), so click
  // once and let the assertion poll for the mutation's normalized-cache update
  // rather than using check()/uncheck() (which re-click on a state mismatch).
  await row.click()
  await expect(row).toBeChecked()

  // Persists across a full reload (server truth, not just local UI state).
  await page.reload()
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toBeChecked()

  // Uncheck it back.
  await page.getByTestId(`shopping-item-${itemName}`).click()
  await expect(page.getByTestId(`shopping-item-${itemName}`)).not.toBeChecked()
})

test('reframe 7.1 — category, checked-status and search filters each narrow the visible items', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'filters', testInfo.project.name)
  const listName = `Filters ${Date.now()}`
  const produce = `Produce ${Date.now()}`
  const bakery = `Bakery ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  const bread = `Bread ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, produce)
  await addCategory(page, bakery)
  await addItem(page, produce, bananas)
  await addItem(page, bakery, bread)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()

  // Category filter: pick Produce → only Bananas remains. Since Story 8.4 the
  // Select is `multiple` and its menu STAYS OPEN after a selection, so the
  // dismissal is explicit — without it the next `filter-checked-*` click below
  // lands on the menu backdrop and silently does nothing.
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${produce}`).click()
  })
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toHaveCount(0)
  // Reset to all categories.
  await withCategoryMenu(page, async () => {
    await page.getByTestId('filter-category-option-all').click()
  })
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()

  // Checked-status filter: check Bananas, then "To buy" hides it (Bread remains),
  // and "Done" shows only it. Wait for the checked state to settle (async cache)
  // before filtering.
  const bananasRow = page.getByTestId(`shopping-item-${bananas}`)
  await bananasRow.click()
  await expect(bananasRow).toBeChecked()
  await page.getByTestId('filter-checked-unchecked').click()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toHaveCount(0)
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()
  await page.getByTestId('filter-checked-checked').click()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toHaveCount(0)
  await page.getByTestId('filter-checked-all').click()

  // Search filter: a non-matching term hides everything; "Bread" narrows to it.
  await page.getByTestId('filter-search').fill('zzz-no-match')
  await expect(page.getByTestId('shopping-no-matches')).toBeVisible()
  await page.getByTestId('filter-search').fill(bread)
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toHaveCount(0)
})

test('FR38 — visiting `/` redirects an authenticated user to their oldest list', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'redirect', testInfo.project.name)
  const oldest = `Oldest ${Date.now()}`
  const newer = `Newer ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  // Create two lists in order → the first is the oldest by createdAt. Go back to
  // the index between them (createListAndOpen leaves us on the detail screen).
  const oldestId = await createListAndOpen(page, oldest)
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await createListAndOpen(page, newer)

  // `/` resolves to the oldest list's shopping view (min createdAt), and its
  // header reflects that list — not the newer one.
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/list/${oldestId}$`))
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId('shopping-header')).toContainText(oldest)
})

test('FR36 — the switcher changes the active list (header + URL) and resets filters', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'switch', testInfo.project.name)
  const listA = `Alpha ${Date.now()}`
  const listB = `Bravo ${Date.now()}`
  const catA = `Fruit ${Date.now()}`
  const catB = `Bread ${Date.now()}`
  const itemA = `Apple ${Date.now()}`
  const itemB = `Loaf ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  const listAId = await createListAndOpen(page, listA)
  await addCategory(page, catA)
  await addItem(page, catA, itemA)
  await page.getByTestId('list-detail-back').click()
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await createListAndOpen(page, listB)
  await addCategory(page, catB)
  await addItem(page, catB, itemB)

  // Open list A's shopping view and filter to its only category.
  await page.goto(`/list/${listAId}`)
  await expect(page.getByTestId('shopping-header')).toContainText(listA)
  // Same explicit dismissal as above — the `multiple` menu does not self-close
  // (Story 8.4), and the search field below is unreachable behind its backdrop.
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${catA}`).click()
  })
  await expect(page.getByTestId(`shopping-item-${itemA}`)).toBeVisible()
  // …and a search term and a checked-status choice on top of it, so the reset
  // below is asserted over ALL THREE controls rather than the category alone.
  await page.getByTestId('filter-search').fill(itemA)
  await page.getByTestId('filter-checked-checked').click()
  await expect(page.getByTestId('shopping-no-matches')).toBeVisible()

  // Switch to list B via the switcher chip: URL + header follow the active list,
  // and the category filter (A's category id), the search term and the
  // checked-status toggle are ALL reset so B's items are NOT hidden as
  // "no matches".
  await page.getByTestId(`switcher-chip-${listB}`).click()
  await expect(page).toHaveURL(/\/list\/[^/]+$/)
  await expect(page.getByTestId('shopping-header')).toContainText(listB)
  await expect(page.getByTestId(`shopping-item-${itemB}`)).toBeVisible()
  await expect(page.getByTestId('shopping-no-matches')).toHaveCount(0)
  await expect(page.getByTestId('filter-category')).toContainText('All categories')
  await expect(page.getByTestId('filter-search')).toHaveValue('')
  await expect(page.getByTestId('filter-checked-all')).toHaveAttribute('aria-pressed', 'true')
})

test('FR52 — a check by one member appears live in another member\'s view without a refresh', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('shopping', 'owner', testInfo.project.name)
  const member = uniqueUsername('shopping', 'member', testInfo.project.name)
  const listName = `Shared ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`

  // Owner creates the list + category + item through the UI.
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  // Second member registers (UI) in an isolated context.
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // SETUP ONLY (sharing UI is Story 5.7): make `member` an accepted member via
    // the backend shareList (owner) + acceptInvite (member) mutations, using each
    // user's own API login token. This is not the asserted behaviour.
    const ownerToken = await loginApi(owner, PASSWORD)
    const memberToken = await loginApi(member, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)

    // Owner views the shopping page; the item starts unchecked.
    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    const ownerRow = page.getByTestId(`shopping-item-${itemName}`)
    await expect(ownerRow).not.toBeChecked()

    // Member opens the same list and checks the item via the UI.
    await memberPage.goto(`/list/${listId}`)
    await expect(memberPage.getByTestId('list-shopping-page')).toBeVisible()
    const memberRow = memberPage.getByTestId(`shopping-item-${itemName}`)
    await memberRow.click()
    await expect(memberRow).toBeChecked()

    // The owner's view reflects the check LIVE — no reload (FR52 realtime).
    await expect(ownerRow).toBeChecked()
  } finally {
    await ctx.close()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.3 — Check Off an Item by Tapping Its Row (FR60).
//
// The row IS the checkbox: `role="checkbox"` + `aria-checked` on the element
// carrying `data-testid="shopping-item-<name>"`, with the visible box demoted to
// a presentational icon. That is why every locator below is the ROW and there is
// no `shopping-item-checkbox-<name>` testid any more (the selector-split
// decision recorded in deferred-work.md).
// ─────────────────────────────────────────────────────────────────────────────

// AC4 demands a COUNT, not a settled state: a check+uncheck double-fire settles
// on the correct visible state while being wrong, so it is invisible to
// `toBeChecked()`. Attach BEFORE the activation under test and read the counter
// after; `page.on` cannot be detached mid-test cheaply, so tests take deltas.
function countToggleRequests(page: Page): () => number {
  let calls = 0
  page.on('request', r => {
    if (
      r.method() === 'POST' &&
      r.url().includes('/api/graphql') &&
      /checkItem|uncheckItem/.test(r.postData() ?? '')
    ) {
      calls++
    }
  })
  return () => calls
}

// SETUP ONLY — bulk items so the shopping page is genuinely SCROLLABLE. Two of
// the specs below assert on scrolling (AC3's "Space does not scroll the page",
// AC5's scroll guard) and both would be hollow on a page that cannot scroll at
// all. Driving 20 add-item dialogs through the UI is the same environment
// preparation at 20x the runtime, so it goes through the API like the
// membership seeding above (AR-E7-5).
async function seedItems(
  token: string,
  listId: string,
  categoryId: string,
  names: ReadonlyArray<string>,
  recurring?: 'ONE_TIME',
): Promise<void> {
  for (const name of names) {
    const recurringField = recurring === undefined ? '' : `, recurring: "${recurring}"`
    await gql(
      `mutation { saveItem(item: { id: "${randomUUID()}", name: "${name}", checked: false,` +
        ` category: "${categoryId}", listId: "${listId}"${recurringField} }) { id } }`,
      token,
    )
  }
}

// SETUP ONLY — the id of a category created through the UI, needed to address
// `saveItem`.
async function categoryIdOf(token: string, listId: string, categoryName: string): Promise<string> {
  const {getCategories} = await gql<{getCategories: Array<{id: string; name: string}>}>(
    `query { getCategories(listId: "${listId}") { id name } }`,
    token,
  )
  const match = getCategories.find(c => c.name === categoryName)
  if (!match) throw new Error(`No category ${categoryName} on list ${listId}`)
  return match.id
}

test('FR60 — a stationary activation on ANY region of the row toggles the item', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'rowtap', testInfo.project.name)
  const listName = `RowTap ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  // A store is required for region 2, and `addedBy` (region 3) is server-set
  // from the caller, so adding through the UI as this user populates it.
  await addItem(page, categoryName, itemName, 'Aldi')

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).not.toBeChecked()

  // The premise of the story: the target is the row, not a ~40px box. 300px is
  // the figure the AC names and holds at the desktop container width; the
  // `mobile` project renders at NFR-E8-1's 320px floor, where the container's
  // own padding puts the row just under it.
  const box = (await row.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(testInfo.project.name === 'mobile' ? 270 : 300)

  // Region 1 — the item name.
  await row.getByText(itemName, {exact: true}).click()
  await expect(row).toBeChecked()

  // Region 2 — the store chip.
  await page.getByTestId(`shopping-item-store-${itemName}`).click()
  await expect(row).not.toBeChecked()

  // Region 3 — the addedBy avatar + username.
  await page.getByTestId(`shopping-item-addedby-${itemName}`).click()
  await expect(row).toBeChecked()

  // Region 4 — empty space: the row's own right-hand padding, past every child.
  const after = (await row.boundingBox())!
  await page.mouse.click(after.x + after.width - 4, after.y + after.height / 2)
  await expect(row).not.toBeChecked()
})

test('FR60 — the row is ONE control: one accessible name, one checked state, one tab stop', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'onecontrol', testInfo.project.name)
  const listName = `OneControl ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  // Deterministic order: items are sorted by name inside a category, so `first`
  // renders above `second` and Tab must move between exactly those two.
  const first = `Aaa apples ${Date.now()}`
  const second = `Zzz zucchini ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, first, 'Aldi')
  await addItem(page, categoryName, second)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${first}`)

  // The row itself carries the role, the name and the state.
  await expect(row).toHaveRole('checkbox')
  await expect(row).toHaveAccessibleName(`Toggle ${first}`)
  await expect(row).not.toBeChecked()

  // …and nothing inside it does. A control inside a control is the defect this
  // story removes: the old MUI Checkbox rendered a real <input> here.
  await expect(row.getByRole('checkbox')).toHaveCount(0)
  await expect(row.locator('input, button, a, select, textarea, [tabindex]')).toHaveCount(0)

  // Exactly one thing on the whole page answers to this item's name and state.
  await expect(page.getByRole('checkbox', {name: `Toggle ${first}`})).toHaveCount(1)

  // …but the store and the `addedBy` name are NOT lost to assistive technology
  // in the process. `role="checkbox"` makes the row's children presentational
  // and the author-supplied label displaces name-from-content, so both would be
  // announced by nothing without the row's accessible DESCRIPTION. The NAME
  // asserted above must stay exactly `Toggle <item>`, which is why this rides on
  // the description rather than being folded into the label.
  await expect(row).toHaveAccessibleDescription(new RegExp(`Aldi[\\s\\S]*${username}`))

  // One tab stop per row: Tab from the first row lands on the SECOND row, so no
  // stop hides between them.
  await row.focus()
  await expect(row).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId(`shopping-item-${second}`)).toBeFocused()
})

test('FR60 — Space and Enter each toggle the focused row exactly once, and Space does not scroll', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'keyboard', testInfo.project.name)
  const listName = `Keyboard ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Aaa bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  // Make the page taller than the viewport so "Space did not scroll" is a real
  // assertion rather than a statement about an unscrollable page.
  const token = await loginApi(username, PASSWORD)
  const categoryId = await categoryIdOf(token, listId, categoryName)
  await seedItems(token, listId, categoryId, Array.from({length: 24}, (_, i) => `Filler ${i} ${Date.now()}`))

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).not.toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true)

  const toggles = countToggleRequests(page)
  await row.focus()
  await page.keyboard.press(' ')
  await expect(row).toBeChecked()
  // Counted, not inferred: a Space that both keyed and clicked would settle
  // checked while firing twice.
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await page.keyboard.press('Enter')
  await expect(row).not.toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(2)
})

test('FR60 — one pointer activation issues exactly ONE check/uncheck request', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'onecall', testInfo.project.name)
  const listName = `OneCall ${Date.now()}`
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
  await expect(row).not.toBeChecked()

  const toggles = countToggleRequests(page)
  await row.click()
  await expect(row).toBeChecked()
  // Settle first: a second request racing in behind the first would otherwise
  // land after the count is read.
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)

  await row.click()
  await expect(row).not.toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(2)
})

test('FR60 — a touch that becomes a scroll never checks an item, while a stationary touch still does', async ({page}, testInfo) => {
  // Real touch emulation (and therefore a real scroll gesture) exists only on
  // the Pixel 7 projects — the same project guard narrow-viewport.spec.ts uses.
  test.skip(testInfo.project.name !== 'mobile', 'needs the mobile project\'s touch emulation')

  const username = uniqueUsername('shopping', 'scrollguard', testInfo.project.name)
  const listName = `ScrollGuard ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Aaa bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  const token = await loginApi(username, PASSWORD)
  const categoryId = await categoryIdOf(token, listId, categoryName)
  await seedItems(token, listId, categoryId, Array.from({length: 40}, (_, i) => `Filler ${i} ${Date.now()}`))

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).not.toBeChecked()
  await expect(row).toBeInViewport()

  const toggles = countToggleRequests(page)
  const box = (await row.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  // A real finger: down on the row, dragged well past the movement threshold,
  // then lifted. Playwright's touchscreen API only taps, so the drag goes
  // through CDP — the same input pipeline a real touch uses, which is what makes
  // the page actually scroll instead of merely dispatching synthetic events.
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, points: Array<{x: number; y: number}>) =>
    cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points} as never)
  await touch('touchStart', [{x, y}])
  for (const dy of [20, 60, 110, 170]) await touch('touchMove', [{x, y: y - dy}])
  await touch('touchEnd', [])

  // The gesture really scrolled…
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  // …and it did NOT check anything.
  await page.waitForTimeout(500)
  await expect(row).not.toBeChecked()
  expect(toggles()).toBe(0)

  // The guard has not over-fired: a stationary touch on the SAME row still
  // toggles. Without this half, a handler that never activates at all would sail
  // through every assertion above.
  //
  // The gesture flung the row off screen, so bring it back programmatically —
  // that is test plumbing, not the behaviour under test — and let the scroll
  // come to rest before measuring, or the tap lands on whichever row has slid
  // under the coordinates by then.
  await row.evaluate(el => el.scrollIntoView({block: 'center'}))
  await expect
    .poll(async () => {
      const first = await page.evaluate(() => window.scrollY)
      await page.waitForTimeout(150)
      return first === (await page.evaluate(() => window.scrollY))
    })
    .toBe(true)
  await expect(row).toBeInViewport()

  const moved = (await row.boundingBox())!
  await page.touchscreen.tap(moved.x + moved.width / 2, moved.y + moved.height / 2)
  await expect(row).toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)
})

test('FR60 — activating the row of a ONE_TIME item removes it via the SAVED+deleted subscription', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'onetimer', testInfo.project.name)
  const listName = `OneTimer ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Party hats ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)

  // SETUP ONLY: no UI exists for the recurring cadence yet, so the one-timer is
  // seeded through `saveItem` — the cadence is the item's state under test, not
  // the behaviour under test.
  const token = await loginApi(username, PASSWORD)
  const categoryId = await categoryIdOf(token, listId, categoryName)
  await seedItems(token, listId, categoryId, [itemName], 'ONE_TIME')

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).toBeVisible()

  // Checking a one-timer makes the backend soft-delete it and publish
  // SAVED+deleted:true; the row must disappear through the new surface exactly
  // as it did through the checkbox.
  await row.click()
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toHaveCount(0)
})

// GUARD (NFR-E8-6 exemption, ratified at Story 8.2 review Pass 2): this asserts a
// branch that did not exist before the fix, so there is no pre-fix layout it can
// be observed failing against on its own terms — pre-fix the row is not a
// checkbox at all and every assertion here errors for that unrelated reason.
test('FR60 — a pointercancel discards the pending activation: the item is not checked', async ({page}, testInfo) => {
  // `pointercancel` is what the browser sends when it takes a gesture over
  // (the scroll it started belongs to the compositor now). It arrives INSTEAD
  // of `pointerup`, so only a real cancel exercises this branch — which needs
  // the Pixel 7 projects' touch emulation.
  test.skip(testInfo.project.name !== 'mobile', 'needs the mobile project\'s touch emulation')

  const username = uniqueUsername('shopping', 'ptrcancel', testInfo.project.name)
  const listName = `PtrCancel ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Aaa bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const row = page.getByTestId(`shopping-item-${itemName}`)
  await expect(row).not.toBeChecked()

  const toggles = countToggleRequests(page)
  const box = (await row.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, points: Array<{x: number; y: number}>) =>
    cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points} as never)
  // Down on the row — a stationary touch, so the movement threshold is NOT what
  // saves us here — then cancelled. A `pointerup` never comes.
  await touch('touchStart', [{x, y}])
  await touch('touchCancel', [])

  await page.waitForTimeout(500)
  await expect(row).not.toBeChecked()
  expect(toggles()).toBe(0)

  // The cancel cleared the pending origin rather than wedging the row: a normal
  // tap afterwards still toggles.
  await page.touchscreen.tap(x, y)
  await expect(row).toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)
})

// GUARD (same exemption): the failure path is PRESERVED behaviour, not new
// behaviour — it held before this story by construction, and this test exists so
// that the activation-surface change cannot quietly take it away.
test('FR60 — a rejected check leaves the row unchecked and surfaces the reason inline', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'toggleerr', testInfo.project.name)
  const listName = `ToggleErr ${Date.now()}`
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
  await expect(row).not.toBeChecked()
  await expect(page.getByTestId('shopping-action-error')).toHaveCount(0)

  // Fail ONLY the check mutation; every other GraphQL operation on the page
  // (queries, and the item subscription's own traffic) is left alone, so the
  // normalized cache stays live and can be observed NOT to have moved.
  await page.route('**/api/graphql', async route => {
    if (/checkItem/.test(route.request().postData() ?? '')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({errors: [{message: 'Item check rejected by the server'}]}),
      })
      return
    }
    await route.continue()
  })

  await row.click()

  // The reason is surfaced in the existing inline alert — no toast, no banner…
  await expect(page.getByTestId('shopping-action-error')).toHaveText('Item check rejected by the server')
  // …and the row reverted to server state on its own, because nothing wrote an
  // optimistic value into the cache to begin with.
  await expect(row).not.toBeChecked()
})

test('FR60 — the VISIBLE indicator, not just aria-checked, tracks the checked state', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'indicator', testInfo.project.name)
  const listName = `Indicator ${Date.now()}`
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
  const indicator = page.getByTestId(`shopping-item-indicator-${itemName}`)
  const name = row.getByText(itemName, {exact: true})

  // Every OTHER assertion in this file goes through `toBeChecked()`, which reads
  // `aria-checked` on the row — so deleting the icon swap or the strikethrough
  // would leave the whole suite green with a row that looks identical checked
  // and unchecked. This test is the only thing tying the pixels to the state.
  //
  // Reached by geometry and colour rather than by the icon component's own
  // `data-testid`: MUI strips those in a production build, and the E2E suite
  // runs against the production image.
  const glyph = () => indicator.locator('path').first().getAttribute('d')
  const colour = () => indicator.evaluate(el => getComputedStyle(el).color)
  const uncheckedGlyph = await glyph()
  const uncheckedColour = await colour()
  await expect(indicator).toBeVisible()
  await expect(name).toHaveCSS('text-decoration-line', 'none')

  await row.click()
  await expect(row).toBeChecked()
  await expect(indicator).toBeVisible()
  expect(await glyph()).not.toBe(uncheckedGlyph)
  expect(await colour()).not.toBe(uncheckedColour)
  await expect(name).toHaveCSS('text-decoration-line', 'line-through')

  await row.click()
  await expect(row).not.toBeChecked()
  expect(await glyph()).toBe(uncheckedGlyph)
  expect(await colour()).toBe(uncheckedColour)
  await expect(name).toHaveCSS('text-decoration-line', 'none')
})

test('FR60 — a non-primary button press on the row toggles nothing', async ({page}, testInfo) => {
  // GUARD, not evidence of the original defect: before Story 8.3 the row had no
  // activation at all, so every assertion here held vacuously. It is red only
  // against a row that activates on any button — which is what the first draft
  // of this story shipped, and what this keeps out.
  const username = uniqueUsername('shopping', 'button', testInfo.project.name)
  const listName = `Button ${Date.now()}`
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
  await expect(row).not.toBeChecked()

  const toggles = countToggleRequests(page)
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  for (const button of ['right', 'middle'] as const) {
    await page.mouse.down({button})
    await page.mouse.up({button})
  }
  await page.waitForTimeout(500)
  await expect(row).not.toBeChecked()
  expect(toggles()).toBe(0)

  // The guard has not over-fired: the primary button still activates the row.
  await page.mouse.down()
  await page.mouse.up()
  await expect(row).toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)
})

test('FR60 — holding Space autorepeats the key but issues exactly ONE request', async ({page}, testInfo) => {
  // GUARD. Pre-Story-8.3 the row had no key handler, so a held Space fired zero
  // mutations and this held vacuously. It is red against a handler that acts on
  // every `keydown` — five repeats, five mutations — which is what a naive
  // `onKeyDown` does and what a native <input type=checkbox> never did.
  const username = uniqueUsername('shopping', 'heldspace', testInfo.project.name)
  const listName = `HeldSpace ${Date.now()}`
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
  await expect(row).not.toBeChecked()
  await row.focus()

  // Playwright's keyboard API cannot set the autorepeat flag, so the held key
  // goes through CDP — same reasoning as the touch drag in the scroll-guard test
  // above.
  const cdp = await page.context().newCDPSession(page)
  const space = (autoRepeat: boolean) =>
    cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: ' ',
      code: 'Space',
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
      autoRepeat,
    } as never)

  const toggles = countToggleRequests(page)
  await space(false)
  for (let i = 0; i < 4; i++) await space(true)
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: ' ',
    code: 'Space',
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  } as never)

  await expect(row).toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)

  // A modified keystroke belongs to the browser or the OS, not to the row.
  await page.keyboard.press('Control+Space')
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(500)
  await expect(row).toBeChecked()
  expect(toggles()).toBe(1)

  // …and the guards have not over-fired: a plain, unmodified press still works.
  await page.keyboard.press(' ')
  await expect(row).not.toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(2)
})

test('FR60 — a bare synthetic click, with no pointer events at all, toggles the row', async ({page}, testInfo) => {
  // This is what assistive technology and voice control dispatch to activate a
  // control: a `click` with no preceding pointer sequence. A row that activates
  // only on `pointerup` + `keydown` is dead to exactly the users the
  // single-control rule exists for.
  const username = uniqueUsername('shopping', 'synthclick', testInfo.project.name)
  const listName = `SynthClick ${Date.now()}`
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
  await expect(row).not.toBeChecked()

  const toggles = countToggleRequests(page)
  await row.evaluate(el => (el as HTMLElement).click())
  await expect(row).toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(1)

  await row.evaluate(el => (el as HTMLElement).click())
  await expect(row).not.toBeChecked()
  await page.waitForTimeout(500)
  expect(toggles()).toBe(2)
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.4 — One Filter and Search, on Both List Screens (FR61).
//
// The category filter selects a SET of categories, not one, and the same filter
// unit is mounted on the management screen (see lists.spec.ts for that half).
//
// THE MENU NO LONGER SELF-CLOSES — see `withCategoryMenu` in ./support/ui.ts,
// which owns that fact for all three specs that drive this control. Every
// interaction below goes through it, including the two pre-existing specs above,
// which were migrated for exactly this reason. A spec here that "just works"
// without the dismissal is suspect: it is almost certainly clicking the backdrop
// rather than the control it names.
// ─────────────────────────────────────────────────────────────────────────────

// SETUP ONLY — the id of an item created through the UI, needed to address
// `deleteItem`. The counterpart to `categoryIdOf` above.
async function itemIdOf(token: string, listId: string, itemName: string): Promise<string> {
  const {getItems} = await gql<{getItems: Array<{id: string; name: string}>}>(
    `query { getItems(listId: "${listId}") { id name } }`,
    token,
  )
  const match = getItems.find(i => i.name === itemName)
  if (!match) throw new Error(`No item ${itemName} on list ${listId}`)
  return match.id
}

test('FR61 — the category filter selects SEVERAL categories at once, and "All categories" clears them', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'multicat', testInfo.project.name)
  const listName = `MultiCat ${Date.now()}`
  const produce = `Produce ${Date.now()}`
  const bakery = `Bakery ${Date.now()}`
  const dairy = `Dairy ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  const bread = `Bread ${Date.now()}`
  const milk = `Milk ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, produce)
  await addCategory(page, bakery)
  await addCategory(page, dairy)
  await addItem(page, produce, bananas)
  await addItem(page, bakery, bread)
  await addItem(page, dairy, milk)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()

  // THE DEFECT (report #4): two aisles cannot be worked together. Pick both, in
  // ONE menu session — the second click is only reachable because the menu stays
  // open, which is itself part of the fix.
  await withCategoryMenu(page, async () => {
    // CHECKBOXES IN THE MENU, and they track the selection (AC1). Without this
    // the whole suite stays green if each option is a plain text label: the
    // items would still filter, the summary would still read correctly, and the
    // user would have no way to see what is currently picked while the menu is
    // open. Asserted on the real control, so a decorative glyph does not pass.
    const produceOption = page.getByTestId(`filter-category-option-${produce}`)
    const dairyOption = page.getByTestId(`filter-category-option-${dairy}`)
    await expect(produceOption.getByRole('checkbox')).not.toBeChecked()
    await produceOption.click()
    await expect(produceOption.getByRole('checkbox')).toBeChecked()
    await page.getByTestId(`filter-category-option-${bakery}`).click()
    // …and an UNCHOSEN one stays unchecked, so "checked" is not just "rendered".
    await expect(dairyOption.getByRole('checkbox')).not.toBeChecked()
  })
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${milk}`)).toHaveCount(0)

  // The CLOSED control summarises both chosen names as text. Asserted with the
  // chip-count line below because "summary, not a chip row" is a ruling
  // (UX-DR-E8-4) that a chip implementation would satisfy on the text alone —
  // a Chip renders its label as text too.
  const control = page.getByTestId('filter-category')
  await expect(control).toContainText(produce)
  await expect(control).toContainText(bakery)
  await expect(control).not.toContainText(dairy)
  await expect(control.locator('.MuiChip-root')).toHaveCount(0)

  // "All categories" is still the clearing affordance, and an EMPTY selection
  // means ALL — not none.
  await withCategoryMenu(page, async () => {
    await page.getByTestId('filter-category-option-all').click()
  })
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${milk}`)).toBeVisible()
  await expect(control).toContainText('All categories')
})

test('FR61 — deleting ONE selected category live prunes that id and leaves the other selection standing', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'prune', testInfo.project.name)
  const listName = `Prune ${Date.now()}`
  const produce = `Produce ${Date.now()}`
  const bakery = `Bakery ${Date.now()}`
  const dairy = `Dairy ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  const bread = `Bread ${Date.now()}`
  const milk = `Milk ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, produce)
  await addCategory(page, bakery)
  await addCategory(page, dairy)
  await addItem(page, produce, bananas)
  await addItem(page, bakery, bread)
  await addItem(page, dairy, milk)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${produce}`).click()
    await page.getByTestId(`filter-category-option-${bakery}`).click()
  })
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()

  // SETUP ONLY — a concurrent member removing the category. Driven through the
  // API because the acting party is deliberately NOT this browser: the behaviour
  // under test is what THIS page does when a CategoryUpdates event arrives for a
  // category it currently has selected. The item goes first, so the deleted
  // category cannot leave an orphan that reappears in the "Uncategorized" group
  // and masks the assertion below.
  const token = await loginApi(username, PASSWORD)
  const breadId = await itemIdOf(token, listId, bread)
  const bakeryId = await categoryIdOf(token, listId, bakery)
  await gql(`mutation { deleteItem(id: "${breadId}", listId: "${listId}") { id } }`, token)
  await gql(`mutation { deleteCategory(id: "${bakeryId}", listId: "${listId}") { id } }`, token)

  // The deleted category leaves the selection…
  await expect(page.getByTestId(`shopping-item-${bread}`)).toHaveCount(0)
  const control = page.getByTestId('filter-category')
  await expect(control).not.toContainText(bakery)
  // …and the OTHER selection survives. This is the whole point: the shipped
  // single-id prune reset the filter outright, so the user lost the chilled
  // aisle because someone else tidied up the bakery one.
  await expect(control).toContainText(produce)
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${milk}`)).toHaveCount(0)
  await expect(page.getByTestId('shopping-no-matches')).toHaveCount(0)
})

// GUARD (NFR-E8-6 exemption): AC6 is PRESERVED behaviour — Story 5.6 already
// filtered client-side, so this holds against the pre-fix build too. It exists
// because widening the filter to a set and sharing it across two screens is
// exactly the change that invites a `refetch` "to be safe", and nothing else in
// the suite would notice one.
test('FR61 — filtering issues ZERO GraphQL requests and shows no loading state', async ({page}, testInfo) => {
  const username = uniqueUsername('shopping', 'nonet', testInfo.project.name)
  const listName = `NoNet ${Date.now()}`
  const produce = `Produce ${Date.now()}`
  const bakery = `Bakery ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  const bread = `Bread ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, produce)
  await addCategory(page, bakery)
  await addItem(page, produce, bananas)
  await addItem(page, bakery, bread)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()
  // Let the page's own initial traffic finish BEFORE the counter is attached, or
  // this measures the load rather than the filtering.
  await page.waitForTimeout(1000)

  const requests = countGraphqlRequests(page)
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${produce}`).click()
  })
  await expect(page.getByTestId(`shopping-item-${bread}`)).toHaveCount(0)
  await page.getByTestId('filter-search').fill('ban')
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await page.getByTestId('filter-search').fill('zzz-no-match')
  await expect(page.getByTestId('shopping-no-matches')).toBeVisible()

  // No round trip, and no loading state at any point — the spinner branch would
  // have had to render for a query to be in flight.
  await page.waitForTimeout(1000)
  expect(requests()).toBe(0)
  await expect(page.getByTestId('shopping-loading')).toHaveCount(0)
})
