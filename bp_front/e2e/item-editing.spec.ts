import {expect, type Page, test} from '@playwright/test'

import {gql, loginApi} from './support/api'
import {expectNoHorizontalOverflow} from './support/layout'
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
// db_data named volume persists across runs and both projects run concurrently.
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

// Add one store to an existing item, through the UI. Enter is the store field's
// commit key — it preventDefaults, so it adds a chip instead of submitting.
async function addStoreViaEdit(page: Page, itemName: string, store: string): Promise<void> {
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store').fill(store)
  await page.getByTestId('edit-item-store').press('Enter')
  await expect(page.getByTestId(`edit-item-store-chip-${store.trim()}`)).toBeVisible()
  await saveEditDialog(page)
}

// Remove one store from an existing item, through the UI.
async function removeStoreViaEdit(page: Page, itemName: string, store: string): Promise<void> {
  await openEditDialog(page, itemName)
  await page.getByTestId(`edit-item-store-chip-remove-${store}`).click()
  await expect(page.getByTestId(`edit-item-store-chip-${store}`)).toHaveCount(0)
  await saveEditDialog(page)
}

// --- API-only setup helpers (membership seeding, recurring seed/read-back) ---

interface ApiItem {
  id: string
  name: string
  category: string
  checked: boolean
  stores: string[]
  recurring: string | null
}

async function fetchItem(listId: string, itemName: string, token: string): Promise<ApiItem> {
  const data = await gql<{getItems: ApiItem[]}>(
    `{ getItems(listId: "${listId}") { id name category checked stores recurring } }`,
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

test('FR44 — several stores can be added (trimmed, deduped), removed one by one, and cleared', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'store', testInfo.project.name)
  const listName = `Store ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  // No stores yet → no chip and no container on the shopping view.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-stores-${itemName}`)).toHaveCount(0)

  // Add one, padded — the name is trimmed, never stored with padding.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await addStoreViaEdit(page, itemName, '  Aldi  ')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Aldi`)).toHaveText('Aldi')

  // Add a SECOND one: the item is in both shops now, which is the whole story.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await addStoreViaEdit(page, itemName, 'Lidl')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Aldi`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Lidl`)).toBeVisible()

  // A duplicate by case-insensitive KEY is refused inline, with the reason, and
  // no save is attempted: the field still holds exactly the names it had.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store').fill('  lidl  ')
  await page.getByTestId('edit-item-store').press('Enter')
  await expect(page.getByTestId('edit-item-store-duplicate')).toContainText('already added')
  // …and it is ANNOUNCED: an alert, and the invalid input points at it, so a
  // screen-reader user hears why the text they typed vanished.
  await expect(page.getByTestId('edit-item-store-duplicate')).toHaveAttribute('role', 'alert')
  await expect(page.getByTestId('edit-item-store')).toHaveAccessibleDescription(/already added/)
  await expect(page.getByTestId('edit-item-store')).toHaveValue('')
  await expect(page.getByTestId('edit-item-store-chip-Lidl')).toBeVisible()
  await expect(page.getByTestId('edit-item-store-chip-lidl')).toHaveCount(0)
  await page.getByTestId('edit-item-cancel').click()
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)

  // Remove ONE store; the other survives.
  await removeStoreViaEdit(page, itemName, 'Aldi')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Lidl`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Aldi`)).toHaveCount(0)

  // Remove the last one → the container is gone entirely, not an empty chip row.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await removeStoreViaEdit(page, itemName, 'Lidl')
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${itemName}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-stores-${itemName}`)).toHaveCount(0)
})

test('FR44 — the store field is fully keyboard-operable, and the category Select stays the only combobox', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'keys', testInfo.project.name)
  const listName = `Keys ${Date.now()}`
  const categoryName = `Pantry ${Date.now()}`
  const itemName = `Oats ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName, ['Aldi'])

  await openEditDialog(page, itemName)

  // The field has a VISIBLE associated label, and the dialog still holds exactly
  // one combobox — the category Select. A second one would break every scoped
  // `getByRole('combobox')` in the suite, which is why this is not an
  // Autocomplete (UX decision kept, not re-opened, by Story 9.6).
  await expect(page.getByTestId('edit-item-dialog').getByRole('combobox')).toHaveCount(1)
  // `exact` because the chip container ("Selected stores") and each chip's
  // remove button ("Remove store <name>") are labelled too — this asserts the
  // INPUT has a visible associated label, which is the accessibility contract.
  await expect(page.getByTestId('edit-item-dialog').getByLabel('Store', {exact: true})).toBeVisible()

  // Type a name and commit it with Enter — the dialog must NOT submit.
  await page.getByTestId('edit-item-store').focus()
  await page.keyboard.type('Rewe')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('edit-item-store-chip-Rewe')).toBeVisible()
  await expect(page.getByTestId('edit-item-dialog')).toBeVisible()

  // Remove an individual store by keyboard: the per-chip control is a real
  // button, so Enter activates it.
  await page.getByTestId('edit-item-store-chip-remove-Aldi').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('edit-item-store-chip-Aldi')).toHaveCount(0)
  await expect(page.getByTestId('edit-item-store-chip-Rewe')).toBeVisible()

  await saveEditDialog(page)
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Rewe`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${itemName}-Aldi`)).toHaveCount(0)
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
  await addItem(page, categoryName, first, ['Aldi'])
  await addItem(page, categoryName, second)

  // The edit dialog now offers Aldi as a clickable suggestion, and clicking it
  // ADDS it as a chip (it no longer fills a single-value field). The input
  // stays empty and freely typable.
  await openEditDialog(page, second)
  await expect(page.getByTestId('edit-item-store-suggestions')).toBeVisible()
  const chip = page.getByTestId('edit-item-store-suggestion-Aldi')
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByTestId('edit-item-store-chip-Aldi')).toBeVisible()
  await expect(page.getByTestId('edit-item-store')).toHaveValue('')
  // A suggestion already selected is no longer offered: it would be a duplicate
  // key, and the field would refuse it.
  await expect(page.getByTestId('edit-item-store-suggestion-Aldi')).toHaveCount(0)
  // Still typable after the chip click — and this second name is committed by
  // BLUR (the Save button's pointerdown), not by Enter, which is what keeps
  // "type a name, click Save" from silently dropping it.
  await page.getByTestId('edit-item-store').fill('Aldi Nord')
  await saveEditDialog(page)

  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-store-${second}-Aldi`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${second}-Aldi Nord`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-store-${first}-Aldi`)).toBeVisible()
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
  await addItem(page, categoryName, before, ['Aldi'])

  // Check it off through the shopping UI.
  await page.goto(`/list/${listId}`)
  // Since Story 8.3 the row IS the checkbox — no checkbox descendant to reach.
  const row = page.getByTestId(`shopping-item-${before}`)
  await row.click()
  await expect(row).toBeChecked()

  // Rename it from the management screen. `saveItem` is a full-document upsert,
  // so a payload missing `checked`/`stores` would silently un-check the item and
  // wipe its stores.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await openEditDialog(page, before)
  await expect(page.getByTestId('edit-item-store-chip-Aldi')).toBeVisible()
  await page.getByTestId('edit-item-name').fill(after)
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${after}`)).toBeVisible()

  // Still checked, still carrying its stores.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId(`shopping-item-${after}`)).toBeChecked()
  await expect(page.getByTestId(`shopping-item-store-${after}-Aldi`)).toBeVisible()
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
      `category: "${seeded.category}", checked: false, recurring: "WEEKLY", stores: []}) { id recurring } }`,
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
  await addItem(page, categoryName, itemName, ['Aldi'])

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
  await expect(page.getByTestId('edit-item-store-chip-Aldi')).toBeVisible()
  await saveEditDialog(page)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
  expect(saveItemRequests).toBe(0)

  // A real change still sends one, proving the counter is wired to something.
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store').fill('Lidl')
  await page.getByTestId('edit-item-store').press('Enter')
  await saveEditDialog(page)
  await expect.poll(() => saveItemRequests).toBe(1)

  // Story 9.6 — a CASING-ONLY edit is a real change and must be sent. Store
  // identity is the lowercased key, but the stored casing is display data, so
  // the dialog compares by exact string equality over the normalized arrays.
  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-store-chip-remove-Lidl').click()
  await page.getByTestId('edit-item-store').fill('LIDL')
  await page.getByTestId('edit-item-store').press('Enter')
  await saveEditDialog(page)
  await expect.poll(() => saveItemRequests).toBe(2)
  await openEditDialog(page, itemName)
  await expect(page.getByTestId('edit-item-store-chip-LIDL')).toBeVisible()
  await page.getByTestId('edit-item-cancel').click()
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
    await expect(page.getByTestId(`shopping-item-stores-${before}`)).toHaveCount(0)

    // The CO-MEMBER edits an item the OWNER added, from the management screen.
    // No client-side owner gate may block this (AC3).
    await memberPage.goto(`/lists/${listId}`)
    await expect(memberPage.getByTestId('list-detail-page')).toBeVisible()
    await openEditDialog(memberPage, before)
    await memberPage.getByTestId('edit-item-name').fill(after)
    await memberPage.getByTestId('edit-item-store').fill('Aldi')
    await memberPage.getByTestId('edit-item-store').press('Enter')
    await memberPage.getByTestId('edit-item-store').fill('Lidl')
    await memberPage.getByTestId('edit-item-store').press('Enter')
    await saveEditDialog(memberPage)
    // The dialog closed rather than surfacing an error → the save succeeded.
    await expect(memberPage.getByTestId('edit-item-error')).toHaveCount(0)
    await expect(memberPage.getByTestId(`item-row-${after}`)).toBeVisible()

    // The owner sees both the rename and BOTH new stores LIVE, without reloading,
    // through the existing per-list subscription and cache merge (AC4).
    await expect(page.getByTestId(`shopping-item-${after}`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-store-${after}-Aldi`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-store-${after}-Lidl`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-${before}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

test('FR40 — at ~360px both item controls fit, the name wraps, and the page does not scroll sideways', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'narrow', testInfo.project.name)
  const listName = `Narrow ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const longName = `Extra long semi skimmed organic milk carton ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, longName)

  // 360px is a SPECIFIC WIDTH THIS TEST OWNS, not "the floor" — NFR-E8-1's floor
  // is 320 and is covered by narrow-viewport.spec.ts, which asserts these same
  // controls there with `expectInsideViewport`. Kept at 360 because in the
  // retargeted `mobile` project this call now WIDENS the viewport, and dropping
  // to 320 would change what this FR40 test measures without anyone having
  // measured the result first. Uses the `page` fixture (not a hand-built context)
  // so the rest of the project's `use` block still applies.
  await page.setViewportSize({width: 360, height: 760})
  const row = page.getByTestId(`item-row-${longName}`)
  const edit = row.getByTestId('edit-item-button')
  const remove = row.getByTestId('remove-item-button')

  // Both controls are visible and reachable.
  await expect(edit).toBeVisible()
  await expect(remove).toBeVisible()
  await expect(edit).toHaveAttribute('aria-label', `Edit item ${longName}`)
  await expect(remove).toHaveAttribute('aria-label', `Remove item ${longName}`)

  // Both sit fully inside the viewport, and neither overlaps the name. Bound by
  // the real clientWidth rather than a hardcoded 360 — a classic scrollbar
  // narrows the content box and would make a hardcoded bound looser than
  // intended, the same reasoning navigation.spec.ts applies to the app-bar chip.
  //
  // The name is reached by `item-name` (added in Story 8.1), not by
  // `locator('p').first()`: Story 8.2 rewrites this element, and a structural
  // path would break there for a selector reason that reads as a layout
  // regression.
  const name = row.getByTestId('item-name')
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const nameBox = (await name.boundingBox())!
  const editBox = (await edit.boundingBox())!
  const removeBox = (await remove.boundingBox())!
  expect(editBox.x + editBox.width).toBeLessThanOrEqual(clientWidth)
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(clientWidth)
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(editBox.x)

  // The name WRAPS rather than truncating on one line (Story 8.2, UX-DR-E8-2).
  //
  // Until 8.2 these lines asserted `truncated`/`nowrap`/`ellipsis` — report #2's
  // defect encoded as a requirement, filed in deferred-work.md as owed by this
  // story. The replacement is the same claim inverted.
  //
  // NOT `expectNotClipped` here, deliberately. `longName` is PATHOLOGICAL by
  // construction (an "extra long" phrase plus a 13-digit uniqueness suffix), and
  // at 360px it wants three lines — so it is the case the two-line bound exists
  // FOR: the name may not grow without limit beside the controls. Measured
  // 2026-09-05 against the fix: scrollHeight 66 vs clientHeight 44, i.e. the
  // clamp holding a three-line name to two. `expectNotClipped` is asserted in
  // narrow-viewport.spec.ts, at the 320px FLOOR, on a name that fits the bound —
  // that is where AC1's "fully readable" claim lives, and duplicating it here on
  // a name chosen to exceed the bound would only assert the bound away.
  // Asserted as OUTCOMES, not as the CSS that produces them: `white-space` and
  // `-webkit-line-clamp` are one implementation of the bound, and pinning them
  // would fail a correct future change to another. Counting lines needs a numeric
  // line-height, so that is checked rather than allowed to poison the arithmetic
  // with NaN.
  const nameMetrics = await name.evaluate(el => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
    return {
      lineHeight,
      clippedHorizontally: el.scrollWidth > el.clientWidth,
      boundedVertically: el.scrollHeight > el.clientHeight,
      lines: el.clientHeight / lineHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }
  })
  // `> 0`, not merely finite: `Number.isFinite(0)` is `true`, and a computed
  // line-height of 0 makes `lines` Infinity, which sails through the "wrapped
  // onto more than one line" assertion below while measuring nothing at all.
  // Corrected at review Pass 2 — the finite check alone did not do the job its
  // own comment claimed.
  expect(
    nameMetrics.lineHeight,
    'line-height must resolve to a positive number for the line count to mean anything',
  ).toBeGreaterThan(0)
  // Not truncated on its line — the ellipsis report #2 described is gone.
  expect(nameMetrics.clippedHorizontally, 'the name must not be clipped horizontally').toBe(false)
  // Actually wrapped, not merely short enough to fit.
  expect(Math.round(nameMetrics.lines), 'the name must wrap onto more than one line').toBeGreaterThan(1)
  // Actually bounded: this name wants a third line and does not get one. Measured
  // 2026-09-05 at scrollHeight 66 vs clientHeight 44.
  expect(
    nameMetrics.boundedVertically,
    `this pathological name must be truncated by the bound (scrollHeight ${nameMetrics.scrollHeight}, clientHeight ${nameMetrics.clientHeight})`,
  ).toBe(true)

  // The document does not scroll horizontally. Uses the shared helper rather than
  // a second inline copy of the same measurement (NFR-E8-5).
  await expectNoHorizontalOverflow(page)

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

test('FR44 — Enter in an EMPTY store field submits the dialog, like Enter in every other field', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'emptyenter', testInfo.project.name)
  const listName = `EmptyEnter ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Kiwis ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, itemName)

  await openEditDialog(page, itemName)
  await page.getByTestId('edit-item-name').fill(`${itemName} edited`)
  // Nothing typed in the store field: Enter has no draft to commit, so it must
  // fall through to the form's own submit instead of silently doing nothing.
  await page.getByTestId('edit-item-store').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName} edited`)).toBeVisible()

  // A NON-empty draft is still committed as a chip, not submitted (asserted in
  // full by the keyboard test above); a whitespace-only draft counts as empty.
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await openEditDialog(page, `${itemName} edited`)
  await page.getByTestId('edit-item-store').fill('   ')
  await page.getByTestId('edit-item-store').press('Enter')
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
})

test('9.6 — an orphaned item cannot be saved untouched: the dialog stays open and says why', async ({page}, testInfo) => {
  const username = uniqueUsername('item_editing', 'orphan', testInfo.project.name)
  const listName = `Orphan ${Date.now()}`
  const keptName = `Kept ${Date.now()}`
  const goneName = `Gone ${Date.now()}`
  const itemName = `Orphaned ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, keptName)
  await addCategory(page, goneName)
  await addItem(page, goneName, itemName)

  // No API path can orphan an item any more (Story 9.3), so the fixture is built
  // at the wire: the `Categories` response loses the item's category while the
  // `Items` response is untouched — exactly what legacy data looks like to the
  // client. Only that one operation is rewritten; everything else passes through.
  await page.route('**/api/graphql', async route => {
    let operationName: string | undefined
    try {
      operationName = (JSON.parse(route.request().postData() ?? '') as {operationName?: string}).operationName
    } catch {
      operationName = undefined
    }
    if (operationName !== 'Categories') {
      await route.continue()
      return
    }
    let res
    try {
      res = await route.fetch()
    } catch {
      await route.abort()
      return
    }
    const body = await res.json() as {data?: {getCategories?: Array<{name: string}>}}
    if (body.data?.getCategories) {
      body.data.getCategories = body.data.getCategories.filter(c => c.name !== goneName)
    }
    await route.fulfill({response: res, json: body})
  })

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

  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await openEditDialog(page, itemName)

  // Save WITHOUT touching anything. Before the guard this passed validation, hit
  // the "nothing changed" short-circuit and closed silently, the orphan still
  // orphaned and the user none the wiser.
  await page.getByTestId('edit-item-submit').click()
  await expect(page.getByTestId('edit-item-dialog')).toBeVisible()
  await expect(page.getByTestId('edit-item-dialog')).toContainText('Choose a category')
  expect(saveItemRequests).toBe(0)

  // Choosing a real category clears it and the save goes through.
  await page.getByTestId('edit-item-category').click()
  await page.getByTestId(`edit-item-category-option-${keptName}`).click()
  await expect(page.getByTestId('edit-item-dialog')).not.toContainText('Choose a category')
  await page.getByTestId('edit-item-submit').click()
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
  expect(saveItemRequests).toBe(1)
})
