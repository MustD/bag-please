import {expect, type Page, test} from '@playwright/test'

import {gql, loginApi} from './support/api'
import {addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Item Editing E2E (Story 6.1, FR40 + FR44). Every asserted behaviour is
// UI-driven. There are exactly three non-UI uses, all named and justified:
//   1. membership seeding for the two-actor test (sharing UI is Story 5.7) —
//      environment prep, same rationale as shopping.spec.ts / global-setup.ts;
//   2. seeding `recurring` on an item, because the lifecycle control is
//      deliberately deferred and NO UI path can set it;
//   3. reading `recurring` back after a UI rename — the single non-UI assertion
//      in this file. It guards INVISIBLE data loss (`saveItem` is a
//      full-document upsert, so an edit that drops `recurring` silently wipes an
//      item's cadence), which is precisely why no UI path can cover it.
//
// Runs on chromium + mobile (Pixel 7); the mobile gate is mandatory. Every
// scenario registers a FRESH unique user through the register UI (`admin` is
// blocked from all list resources) and asserts only on data it created — the
// ./db/data volume persists across runs and both projects run concurrently.
//
// The shopping view is always reached by page.goto(`/list/:id`), never through
// Story 6.2's title/back links, so 6.1 stands alone.

async function openEditDialog(page: Page, itemName: string): Promise<void> {
  await page.getByTestId(`item-row-${itemName}`).getByTestId('edit-item-button').click()
  await expect(page.getByTestId('edit-item-dialog')).toBeVisible()
}

async function saveEditDialog(page: Page): Promise<void> {
  await page.getByTestId('edit-item-submit').click()
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
}

// Change only the store on an existing item, through the UI.
async function setStoreViaEdit(page: Page, itemName: string, store: string): Promise<void> {
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store').fill(store)
  await saveEditDialog(page)
}

// --- API-only setup helpers (membership seeding, recurring seed/read-back) ---

interface ApiItem {
  id: string
  name: string
  category: string
  checked: boolean
  store: string | null
  recurring: string | null
}

async function fetchItem(listId: string, itemName: string, token: string): Promise<ApiItem> {
  const data = await gql<{getItems: ApiItem[]}>(
    `{ getItems(listId: "${listId}") { id name category checked store recurring } }`,
    token,
  )
  const item = data.getItems.find(i => i.name === itemName)
  if (!item) throw new Error(`Item ${itemName} not found on list ${listId}`)
  return item
}

test('FR40 — renaming an item and moving it to another category persists across a reload', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'rename', testInfo.project.name)
  const listName = `Rename ${Date.now()}`
  const dairy = `Dairy ${Date.now()}`
  const fridge = `Fridge ${Date.now()}`
  const before = `Milk ${Date.now()}`
  const after = `Whole milk ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, dairy)
  await addCategory(page, fridge)
  await addItem(page, dairy, before)

  // The row starts under Dairy.
  await expect(page.getByTestId(`category-row-${dairy}`).getByTestId(`item-row-${before}`)).toBeVisible()

  // Open the editor: it is seeded from the row it was opened on, with focus in
  // the name field (AC1).
  await openEditDialog(page, before)
  await expect(page.getByTestId('edit-item-name')).toHaveValue(before)
  await expect(page.getByTestId('edit-item-name')).toBeFocused()
  await expect(page.getByTestId('edit-item-store')).toHaveValue('')

  await page.getByTestId('edit-item-name').fill(after)
  await page.getByTestId('edit-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`edit-item-category-option-${fridge}`).click()
  await saveEditDialog(page)

  // The renamed row moved category — and both its controls carry the new name.
  await expect(page.getByTestId(`category-row-${fridge}`).getByTestId(`item-row-${after}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${before}`)).toHaveCount(0)
  await expect(page.getByRole('button', {name: `Edit item ${after}`})).toBeVisible()
  await expect(page.getByRole('button', {name: `Remove item ${after}`})).toBeVisible()

  // Server truth, not just local cache state.
  await page.reload()
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await expect(page.getByTestId(`category-row-${fridge}`).getByTestId(`item-row-${after}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${before}`)).toHaveCount(0)
})

test('FR44 — a store can be set (trimmed), changed and cleared, seen via the shopping-view chip', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'store', testInfo.project.name)
  const listName = `Store ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  // No store yet → no chip on the shopping view.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${itemName}`)).toHaveCount(0)

  // Set it, padded — the value is trimmed on save (never stored with padding).
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await setStoreViaEdit(page, itemName, '  Aldi  ')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}`)).toHaveText('Aldi')

  // Change it.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await setStoreViaEdit(page, itemName, 'Lidl')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}`)).toHaveText('Lidl')

  // Clear it with whitespace only → null, not '', so the chip is gone entirely
  // (an empty string would render an empty chip).
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await setStoreViaEdit(page, itemName, '   ')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${itemName}`)).toHaveCount(0)
})

test('FR44 — store suggestions are absent on a store-less list, then appear and are clickable', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'suggest', testInfo.project.name)
  const listName = `Suggest ${Date.now()}`
  const categoryName = `Pantry ${Date.now()}`
  const first = `Rice ${Date.now()}`
  const second = `Pasta ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)

  // A brand-new list has no stores → the suggestion row is absent entirely: no
  // container, no placeholder.
  //
  // Wait for the suggestions response BEFORE asserting absence. Without it the
  // assertion passes while the cache-and-network query is still in flight, so it
  // could not distinguish "absent because empty" from "not arrived yet" — which
  // is the only failure mode it exists to catch.
  const suggestionsLoaded = page.waitForResponse(
    res =>
      res.request().method() === 'POST' &&
      res.url().includes('/api/graphql') &&
      (res.request().postData() ?? '').includes('"ItemStoreSuggestions"'),
  )
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await expect(page.getByTestId('add-item-store')).toBeVisible()
  await suggestionsLoaded
  await expect(page.getByTestId('add-item-store-suggestions')).toHaveCount(0)
  await expect(page.getByTestId('add-item-store-suggestions-error')).toHaveCount(0)
  await page.getByTestId('add-item-cancel').click()
  await expect(page.getByTestId('add-item-dialog')).toHaveCount(0)

  // Add an item WITH a store straight from the add dialog (no second trip
  // through an editor), then a second store-less item.
  await addItem(page, categoryName, first, 'Aldi')
  await addItem(page, categoryName, second)

  // The edit dialog now offers Aldi as a clickable suggestion, and clicking it
  // fills the still-freely-editable field.
  await openEditDialog(page, second)
  await expect(page.getByTestId('edit-item-store-suggestions')).toBeVisible()
  const chip = page.getByTestId('edit-item-store-suggestion-Aldi')
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByTestId('edit-item-store')).toHaveValue('Aldi')
  // Still typable after the chip click.
  await page.getByTestId('edit-item-store').fill('Aldi Nord')
  await expect(page.getByTestId('edit-item-store')).toHaveValue('Aldi Nord')
  await saveEditDialog(page)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${second}`)).toHaveText('Aldi Nord')
  await expect(page.getByTestId(`shopping-item-store-${first}`)).toHaveText('Aldi')
})

test('FR40 — editing a checked item keeps it checked (full-document upsert regression)', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'checked', testInfo.project.name)
  const listName = `Checked ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const before = `Bananas ${Date.now()}`
  const after = `Ripe bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, before, 'Aldi')

  // Check it off through the shopping UI.
  await page.goto(`/list/${listId}`)
  const checkbox = page.getByTestId(`shopping-item-${before}`).getByRole('checkbox')
  await checkbox.click()
  await expect(checkbox).toBeChecked()

  // Rename it from the management screen. `saveItem` is a full-document upsert,
  // so a payload missing `checked`/`store` would silently un-check the item and
  // wipe its store.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await openEditDialog(page, before)
  await expect(page.getByTestId('edit-item-store')).toHaveValue('Aldi')
  await page.getByTestId('edit-item-name').fill(after)
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${after}`)).toBeVisible()

  // Still checked, still carrying its store.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${after}`).getByRole('checkbox')).toBeChecked()
  await expect(page.getByTestId(`shopping-item-store-${after}`)).toHaveText('Aldi')
})

test('FR40 — editing an item preserves its recurring cadence', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'recurring', testInfo.project.name)
  const listName = `Recurring ${Date.now()}`
  const categoryName = `Pantry ${Date.now()}`
  const before = `Coffee ${Date.now()}`
  const after = `Ground coffee ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, before)

  // SETUP ONLY: `recurring` has NO UI surface (the lifecycle control is deferred,
  // blocked on the server-side checkedAt fix), so no UI path can set it. Seed
  // WEEKLY through the API. Valid values: ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY.
  const token = await loginApi(username, PASSWORD)
  const seeded = await fetchItem(listId, before, token)
  await gql(
    `mutation { saveItem(item: {id: "${seeded.id}", listId: "${listId}", name: "${before}", ` +
      `category: "${seeded.category}", checked: false, recurring: "WEEKLY"}) { id recurring } }`,
    token,
  )

  // Reload so the page's ItemsQuery picks up the seeded cadence — the edit form
  // can only carry forward what it fetched, and /lists/:id is refetch-driven.
  await page.reload()
  await expect(page.getByTestId('list-detail-page')).toBeVisible()

  // Rename through the UI.
  await openEditDialog(page, before)
  await page.getByTestId('edit-item-name').fill(after)
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${after}`)).toBeVisible()

  // The one non-UI ASSERTION in this file, justified: this guards invisible data
  // loss on a field with no UI surface at all.
  const edited = await fetchItem(listId, after, token)
  expect(edited.recurring).toBe('WEEKLY')
  expect(edited.id).toBe(seeded.id)
})

test('FR40 — saving an unchanged item issues no SaveItem mutation and closes the dialog', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'noop', testInfo.project.name)
  const listName = `Noop ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Apples ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName, 'Aldi')

  // Observing traffic — this does not fake or substitute for the behaviour under
  // test, it is the only way to see an absent request. Attached AFTER setup, so
  // the setup's own saveItem calls are not counted. `"SaveItem"` (quoted) matches
  // Apollo's operationName field, not the query text.
  let saveItemRequests = 0
  page.on('request', req => {
    if (
      req.method() === 'POST' &&
      req.url().includes('/api/graphql') &&
      (req.postData() ?? '').includes('"SaveItem"')
    ) {
      saveItemRequests += 1
    }
  })

  // Open and submit with nothing changed. A no-op save would only re-attribute
  // the item's `addedBy` server-side for no benefit, so no mutation is sent —
  // and the dialog closes exactly as on a successful save.
  await openEditDialog(page, itemName)
  await expect(page.getByTestId('edit-item-name')).toHaveValue(itemName)
  await expect(page.getByTestId('edit-item-store')).toHaveValue('Aldi')
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
  expect(saveItemRequests).toBe(0)

  // A real change still sends one, proving the counter is wired to something.
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store').fill('Lidl')
  await saveEditDialog(page)
  await expect.poll(() => saveItemRequests).toBe(1)
})

test('FR40 — a co-member (not the owner) can edit, and the change lands live on another member\'s shopping view', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('item_editing', 'owner', testInfo.project.name)
  const member = uniqueUsername('item_editing', 'member', testInfo.project.name)
  const listName = `Shared ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const before = `Bananas ${Date.now()}`
  const after = `Green bananas ${Date.now()}`

  // The OBSERVER — whose /list/:id rendering is what the mandatory mobile gate
  // must cover — sits on the `page` fixture, because browser.newContext() does
  // NOT inherit the project's `use` block (see navigation.spec.ts) and a
  // hand-built context would silently run at a desktop viewport on the mobile
  // project. So the OWNER observes on `page` and the co-member EDITS in the
  // hand-built context: that also makes the editor a non-owner, which is the
  // point (editing is a member right, not an owner right).
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, before)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // SETUP ONLY (sharing UI is Story 5.7): make `member` an accepted member via
    // the backend shareList (owner) + acceptInvite (member) mutations, using each
    // user's own API login token. Not the asserted behaviour.
    const ownerToken = await loginApi(owner, PASSWORD)
    const memberToken = await loginApi(member, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)

    // The owner parks on the shopping view and stays there — no reload from here.
    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    await expect(page.getByTestId(`shopping-item-${before}`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-store-${before}`)).toHaveCount(0)

    // The CO-MEMBER edits an item the OWNER added, from the management screen.
    // No client-side owner gate may block this (AC3).
    await memberPage.goto(`/lists/${listId}`)
    await expect(memberPage.getByTestId('list-detail-page')).toBeVisible()
    await openEditDialog(memberPage, before)
    await memberPage.getByTestId('edit-item-name').fill(after)
    await memberPage.getByTestId('edit-item-store').fill('Aldi')
    await saveEditDialog(memberPage)
    // The dialog closed rather than surfacing an error → the save succeeded.
    await expect(memberPage.getByTestId('edit-item-error')).toHaveCount(0)
    await expect(memberPage.getByTestId(`item-row-${after}`)).toBeVisible()

    // The owner sees both the rename and the new store LIVE, without reloading,
    // through the existing per-list subscription and cache merge (AC4).
    await expect(page.getByTestId(`shopping-item-${after}`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-store-${after}`)).toHaveText('Aldi')
    await expect(page.getByTestId(`shopping-item-${before}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

test('FR40 — at ~360px both item controls fit, the name truncates, and the page does not scroll sideways', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'narrow', testInfo.project.name)
  const listName = `Narrow ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const longName = `Extra long semi skimmed organic milk carton ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, longName)

  // Narrow to the ~360px floor. Uses the `page` fixture (not a hand-built
  // context) so the rest of the project's `use` block still applies.
  await page.setViewportSize({width: 360, height: 760})
  const row = page.getByTestId(`item-row-${longName}`)
  const edit = row.getByTestId('edit-item-button')
  const remove = row.getByTestId('remove-item-button')

  // Both controls are visible and reachable.
  await expect(edit).toBeVisible()
  await expect(remove).toBeVisible()
  await expect(edit).toHaveAttribute('aria-label', `Edit item ${longName}`)
  await expect(remove).toHaveAttribute('aria-label', `Remove item ${longName}`)

  // Both sit fully inside the viewport, and neither overlaps the name.
  const nameBox = (await row.locator('p').first().boundingBox())!
  const editBox = (await edit.boundingBox())!
  const removeBox = (await remove.boundingBox())!
  expect(editBox.x + editBox.width).toBeLessThanOrEqual(360)
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(360)
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(editBox.x)

  // The name truncates rather than wrapping.
  const nameMetrics = await row.locator('p').first().evaluate(el => ({
    truncated: el.scrollWidth > el.clientWidth,
    whiteSpace: getComputedStyle(el).whiteSpace,
    textOverflow: getComputedStyle(el).textOverflow,
  }))
  expect(nameMetrics.truncated).toBe(true)
  expect(nameMetrics.whiteSpace).toBe('nowrap')
  expect(nameMetrics.textOverflow).toBe('ellipsis')

  // The document does not scroll horizontally.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)

  // The edit control still works at this width.
  await openEditDialog(page, longName)
  await expect(page.getByTestId('edit-item-name')).toHaveValue(longName)
  await page.getByTestId('edit-item-cancel').click()
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
})

test('FR40 — clearing the name blocks the save with an inline field error, sending no mutation', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'blankname', testInfo.project.name)
  const listName = `Blank ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Pears ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  let saveItemRequests = 0
  page.on('request', req => {
    if (
      req.method() === 'POST' &&
      req.url().includes('/api/graphql') &&
      (req.postData() ?? '').includes('"SaveItem"')
    ) {
      saveItemRequests += 1
    }
  })

  // Validation is on submit only — the error appears after Save is pressed, not
  // on the keystroke that emptied the field.
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-name').fill('   ')
  await expect(page.getByTestId('edit-item-dialog')).not.toContainText('Name is required')
  await page.getByTestId('edit-item-submit').click()

  // The dialog stays open, carrying an inline field error, and nothing was sent.
  await expect(page.getByTestId('edit-item-dialog')).toBeVisible()
  await expect(page.getByTestId('edit-item-dialog')).toContainText('Name is required')
  expect(saveItemRequests).toBe(0)

  // The error clears as soon as the field changes, and the save then goes through.
  await page.getByTestId('edit-item-name').fill(itemName)
  await expect(page.getByTestId('edit-item-dialog')).not.toContainText('Name is required')
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
})

test('FR40 — a rejected save keeps the dialog open and shows the backend message inline', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('item_editing', 'revokeowner', testInfo.project.name)
  const member = uniqueUsername('item_editing', 'revoked', testInfo.project.name)
  const listName = `Revoked ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Plums ${Date.now()}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // SETUP ONLY: seed accepted membership so the member can reach the list.
    const ownerToken = await loginApi(owner, PASSWORD)
    const memberToken = await loginApi(member, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)

    await memberPage.goto(`/lists/${listId}`)
    await expect(memberPage.getByTestId('list-detail-page')).toBeVisible()
    await openEditDialog(memberPage, itemName)
    await memberPage.getByTestId('edit-item-name').fill(`${itemName} edited`)

    // Membership is revoked while the dialog sits open, so the save is rejected
    // server-side. This is the only realistic way to reach the mutation's catch
    // branch — the branch every Epic 5 form convention exists to protect.
    await gql(`mutation { removeMember(listId: "${listId}", username: "${member}") { id } }`, ownerToken)

    await memberPage.getByTestId('edit-item-submit').click()

    // The dialog stays open with the backend's own message surfaced inline via an
    // alert — never a toast, and never a silent close that looks like success.
    const alert = memberPage.getByTestId('edit-item-error')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveAttribute('role', 'alert')
    await expect(alert).not.toBeEmpty()
    await expect(memberPage.getByTestId('edit-item-dialog')).toBeVisible()

    // The owner's copy is untouched by the rejected edit.
    await page.goto(`/lists/${listId}`)
    await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
  } finally {
    await ctx.close()
  }
})
