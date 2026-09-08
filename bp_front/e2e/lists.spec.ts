import {expect, type Page, test} from '@playwright/test'

import {
  addCategory,
  addItem,
  countGraphqlRequests,
  countWebSockets,
  createListAndOpen,
  openListsViaMenu,
  PASSWORD,
  registerViaUi,
  uniqueUsername,
  withCategoryMenu,
} from './support/ui'

// Lists Management E2E (Story 5.5). UI-driven only — no API shortcuts for the
// asserted behaviour (the sole exception is the one-time registration-enable in
// global-setup.ts). Runs on both the chromium and mobile (Pixel 7) projects
// (see playwright.config.ts); the mobile gate is mandatory. FR mappings are in
// the test names.
//
// Every scenario registers a FRESH unique regular user per run/project via the
// register UI — `admin` is blocked from list resources and there is no seeded
// account (the ./db/data volume persists across runs and the two projects run
// concurrently), so tests only ever assert on rows they created, never on totals.

// Create a list via the index overlay and wait for its row (refetch-driven, no
// page reload / navigation).
async function createListViaUi(page: Page, name: string): Promise<void> {
  await page.getByTestId('create-list-button').click()
  await expect(page.getByTestId('create-list-dialog')).toBeVisible()
  await page.getByTestId('create-list-name').fill(name)
  await page.getByTestId('create-list-submit').click()
  await expect(page.getByTestId('create-list-dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId(`list-row-${name}`)).toBeVisible()
}

test('FR50 — a brand-new user sees the lists zero-state onboarding prompt', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'zero', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)

  await openListsViaMenu(page)

  // A fresh user owns no lists: the onboarding zero-state (not a spinner, not a
  // list) is shown with a first-list call to action.
  await expect(page.getByTestId('lists-empty')).toBeVisible()
  await expect(page.getByTestId('lists-empty-create')).toBeVisible()
  await expect(page.getByTestId('lists-loading')).toHaveCount(0)
})

test('FR34/FR46/FR51 — golden path: create list, add category + item, remove both, delete list', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'golden', testInfo.project.name)
  const listName = `List ${Date.now()}`
  const categoryName = `Produce ${Date.now()}`
  const itemName = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)

  // Create a list — appears in the index, overlay closes, no navigation.
  await createListViaUi(page, listName)

  // Open its management detail.
  await page.getByTestId(`list-open-${listName}`).click()
  await expect(page).toHaveURL(/\/lists\/[^/]+$/)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  // No categories yet: the add-item action is gated until one exists.
  await expect(page.getByTestId('list-detail-empty')).toBeVisible()
  await expect(page.getByTestId('add-item-button')).toBeDisabled()

  // Add a category (first-class entity, scoped to this list).
  await page.getByTestId('add-category-button').click()
  await expect(page.getByTestId('add-category-dialog')).toBeVisible()
  await page.getByTestId('add-category-name').fill(categoryName)
  await page.getByTestId('add-category-submit').click()
  await expect(page.getByTestId('add-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${categoryName}`)).toBeVisible()

  // Add an item under that category via the overlay's category Select.
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await page.getByTestId('add-item-name').fill(itemName)
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${categoryName}`).click()
  await page.getByTestId('add-item-submit').click()
  await expect(page.getByTestId('add-item-dialog')).toHaveCount(0)
  // The item is scoped under its category row.
  await expect(
    page.getByTestId(`category-row-${categoryName}`).getByTestId(`item-row-${itemName}`),
  ).toBeVisible()

  // Remove the item via its confirmation overlay → the row disappears.
  await page.getByTestId(`item-row-${itemName}`).getByTestId('remove-item-button').click()
  await expect(page.getByTestId('remove-item-dialog')).toBeVisible()
  await page.getByTestId('remove-item-dialog-confirm').click()
  await expect(page.getByTestId('remove-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName}`)).toHaveCount(0)

  // Remove the category via its confirmation overlay → the row disappears.
  await page.getByTestId(`category-row-${categoryName}`).getByTestId('remove-category-button').click()
  await expect(page.getByTestId('remove-category-dialog')).toBeVisible()
  await page.getByTestId('remove-category-dialog-confirm').click()
  await expect(page.getByTestId('remove-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${categoryName}`)).toHaveCount(0)

  // Back to the index and delete the list (owner) → its row disappears.
  await page.getByTestId('list-detail-back').click()
  await expect(page).toHaveURL(/\/lists$/)
  await page.getByTestId(`list-row-${listName}`).getByTestId('delete-list-button').click()
  await expect(page.getByTestId('delete-list-dialog')).toBeVisible()
  await page.getByTestId('delete-list-dialog-confirm').click()
  await expect(page.getByTestId('delete-list-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`list-row-${listName}`)).toHaveCount(0)
})

test('FR46 — removing a category that still contains an item removes the item with it (no orphan)', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'cascade', testInfo.project.name)
  const listName = `Cascade ${Date.now()}`
  const categoryName = `Dairy ${Date.now()}`
  const itemName = `Milk ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListViaUi(page, listName)

  await page.getByTestId(`list-open-${listName}`).click()
  await expect(page.getByTestId('list-detail-page')).toBeVisible()

  // Add a category, then an item under it.
  await page.getByTestId('add-category-button').click()
  await page.getByTestId('add-category-name').fill(categoryName)
  await page.getByTestId('add-category-submit').click()
  await expect(page.getByTestId(`category-row-${categoryName}`)).toBeVisible()

  await page.getByTestId('add-item-button').click()
  await page.getByTestId('add-item-name').fill(itemName)
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${categoryName}`).click()
  await page.getByTestId('add-item-submit').click()
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()

  // Remove the category WITHOUT removing the item first. The backend does not
  // cascade, so the client cascades: the category and its item both disappear —
  // the item is not left orphaned/invisible.
  await page.getByTestId(`category-row-${categoryName}`).getByTestId('remove-category-button').click()
  await page.getByTestId('remove-category-dialog-confirm').click()
  await expect(page.getByTestId('remove-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${categoryName}`)).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName}`)).toHaveCount(0)
  // Back to a clean empty list (no stranded items lurking).
  await expect(page.getByTestId('list-detail-empty')).toBeVisible()
})

test('FR37 — the owner sees a delete affordance; a non-owner never sees the list at all', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('lists', 'owner', testInfo.project.name)
  const other = uniqueUsername('lists', 'other', testInfo.project.name)
  const listName = `Owned ${Date.now()}`
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  await createListViaUi(page, listName)

  // Owner-only affordances are UI-gated on ownerUsername === current user: the
  // owner sees Delete AND Share & Members on their own row, and never a Leave
  // control (owners delete, they don't leave). The non-owner-member half is
  // covered by the role-affordance test below (Story 5.7 sharing flows).
  await expect(
    page.getByTestId(`list-row-${listName}`).getByTestId('delete-list-button'),
  ).toBeVisible()
  await expect(page.getByTestId(`manage-members-${listName}`)).toBeVisible()
  await expect(page.getByTestId(`leave-list-${listName}`)).toHaveCount(0)

  // A different, unrelated user only ever sees lists they own or are an accepted
  // member of — the owner's list is absent from their index entirely (there is
  // no delete affordance to leak because the row itself never renders). This
  // asserts the reachable half of FR37 UI-only.
  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const otherPage = await ctx.newPage()
    await registerViaUi(otherPage, other, PASSWORD)
    await openListsViaMenu(otherPage)
    await expect(otherPage.getByTestId('lists-empty')).toBeVisible()
    await expect(otherPage.getByTestId(`list-row-${listName}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

test('FR37/FR55 — role affordances: a shared member sees Leave but no Delete/Share controls', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('lists', 'roleowner', testInfo.project.name)
  const member = uniqueUsername('lists', 'rolemember', testInfo.project.name)
  const listName = `Roles ${Date.now()}`
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  await createListViaUi(page, listName)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // Owner shares with the member through the Share & Members dialog (UI).
    await page.getByTestId(`manage-members-${listName}`).click()
    await expect(page.getByTestId('share-members-dialog')).toBeVisible()
    await page.getByTestId('share-username-input').fill(member)
    await page.getByTestId('share-submit').click()
    await expect(page.getByTestId(`member-row-${member}`)).toBeVisible()
    await page.getByTestId('share-members-close').click()

    // Member reloads /lists (no realtime), accepts, and the list appears.
    await memberPage.goto('/lists')
    await expect(memberPage.getByTestId('lists-page')).toBeVisible()
    await memberPage.getByTestId(`accept-invite-${listName}`).click()
    await expect(memberPage.getByTestId(`list-row-${listName}`)).toBeVisible()

    // Member role affordance gating: Leave is present; Delete and Share & Members
    // (owner-only) are absent from their row.
    await expect(memberPage.getByTestId(`leave-list-${listName}`)).toBeVisible()
    await expect(
      memberPage.getByTestId(`list-row-${listName}`).getByTestId('delete-list-button'),
    ).toHaveCount(0)
    await expect(memberPage.getByTestId(`manage-members-${listName}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

test('FR35 — admin is blocked from list resources and sees a graceful inline notice, not a crash', async ({page}) => {
  // The guaranteed first-boot admin. The backend forbids the admin account from
  // every list resource (FORBIDDEN); the index must surface that inline.
  await page.goto('/auth')
  await page.getByTestId('login-username').fill('admin')
  await page.getByTestId('login-password').fill('admin')
  await page.getByTestId('login-submit').click()
  // Admin lands on /admin via the `/` redirect (Story 5.6) — assert authenticated
  // route-agnostically rather than the old home URL.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()

  await openListsViaMenu(page)

  // Calm inline notice, page still rendered (no crash / white screen), and no
  // list rows or spinner left hanging.
  await expect(page.getByTestId('lists-notice')).toBeVisible()
  await expect(page.getByTestId('lists-notice')).toContainText(/admin cannot access list resources/i)
  await expect(page.getByTestId('lists-page')).toBeVisible()
  await expect(page.getByTestId('lists-loading')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.4 — One Filter and Search, on Both List Screens (FR61).
//
// Reports #5 and #6: the management screen had no filter and no search at all.
// It now mounts the SAME unit the shopping view does (see shopping.spec.ts for
// that half) — with one deliberate difference in each direction:
//
//   * no checked-status toggle here, because "checked" is a shopping concept and
//     the shared component accommodates its ABSENCE rather than rendering a
//     disabled control (UX-DR-E8-7);
//   * an EMPTY category is rendered here while nothing is filtering, because this
//     is where you add items to it — whereas the shopping view hides an empty
//     group always. That asymmetry is asserted from both sides below; it is the
//     one place the two surfaces are meant to differ, and therefore the one place
//     a future "let's make them consistent" change must trip.
//
// The `multiple` Select's menu does not self-close; `withCategoryMenu` in
// ./support/ui.ts owns that fact and every selection below goes through it.
// ─────────────────────────────────────────────────────────────────────────────

test('FR61 — /lists/:id offers the same multi-select category filter and name search, AND-ed, with no checked-status toggle', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'filter', testInfo.project.name)
  const listName = `Filter ${Date.now()}`
  const produce = `Produce ${Date.now()}`
  const bakery = `Bakery ${Date.now()}`
  const dairy = `Dairy ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  const bagels = `Bagels ${Date.now()}`
  const bread = `Bread ${Date.now()}`
  const milk = `Milk ${Date.now()}`
  // AR-E8-6's other half: this screen must not gain a `subscribeToMore`. A
  // subscription rides `graphql-ws`, so it opens a WEBSOCKET and registers zero
  // POSTs — the request counter below cannot see one. Attached BEFORE the page
  // is ever mounted, and deliberately NOT where the request counter is: a
  // subscription is registered in a mount-time effect (that is how
  // ListShoppingPage does it), so its socket would open before any listener
  // attached after the page has rendered, and the assertion would pass by
  // construction — the very failure mode this line exists to remove. Nothing
  // else in this flow opens a socket, so a correct build still counts zero.
  const sockets = countWebSockets(page)
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, produce)
  await addCategory(page, bakery)
  await addCategory(page, dairy)
  await addItem(page, produce, bananas)
  await addItem(page, bakery, bagels)
  await addItem(page, bakery, bread)
  await addItem(page, dairy, milk)

  // AC6 for THIS screen: filtering is client-side over the cache the page
  // already holds. Counted from here, after the initial load has settled — a
  // `refetch` slipped into the filter path is the failure this catches, and it
  // would be invisible to every visibility assertion below.
  await expect(page.getByTestId('list-detail-filters')).toBeVisible()
  await page.waitForTimeout(1000)
  const requests = countGraphqlRequests(page)
  // Two categories at once — the same widening the shopping view got.
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${produce}`).click()
    await page.getByTestId(`filter-category-option-${bakery}`).click()
  })
  await expect(page.getByTestId(`item-row-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${bagels}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${bread}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${milk}`)).toHaveCount(0)

  // AND, not OR: the term narrows WITHIN the selected categories. `bread` is in
  // one of them and survives; `bananas` is in the other and is dropped by the
  // term; `milk` is excluded by both clauses and stays gone.
  await page.getByTestId('filter-search').fill('brea')
  await expect(page.getByTestId(`item-row-${bread}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${bagels}`)).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${bananas}`)).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${milk}`)).toHaveCount(0)

  // Case-insensitive, and on the NAME.
  await page.getByTestId('filter-search').fill(bread.toUpperCase())
  await expect(page.getByTestId(`item-row-${bread}`)).toBeVisible()

  // Whitespace alone is not a term — everything in the selection comes back.
  await page.getByTestId('filter-search').fill('   ')
  await expect(page.getByTestId(`item-row-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${bagels}`)).toBeVisible()

  // Nothing matches → the panel, and no category cards behind it.
  await page.getByTestId('filter-search').fill('zzz-no-match')
  await expect(page.getByTestId('list-detail-no-matches')).toBeVisible()
  await expect(page.getByTestId(`category-row-${produce}`)).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${bakery}`)).toHaveCount(0)

  // Clearing both controls restores everything — an empty selection means ALL.
  await page.getByTestId('filter-search').fill('')
  await withCategoryMenu(page, async () => {
    await page.getByTestId('filter-category-option-all').click()
  })
  await expect(page.getByTestId(`item-row-${milk}`)).toBeVisible()
  await expect(page.getByTestId('list-detail-no-matches')).toHaveCount(0)

  // NO checked-status control exists anywhere on this page — not disabled,
  // ABSENT. Asserted on the group and on each of the three buttons, so a
  // rendered-but-unlabelled group cannot slip through.
  await expect(page.getByTestId('filter-checked')).toHaveCount(0)
  await expect(page.getByTestId('filter-checked-all')).toHaveCount(0)
  await expect(page.getByTestId('filter-checked-unchecked')).toHaveCount(0)
  await expect(page.getByTestId('filter-checked-checked')).toHaveCount(0)
  // `aria-label="Filter by checked status"` sits on the ToggleButtonGroup, which
  // MUI renders as `role="group"` — the three BUTTONS inside it are named "All",
  // "To buy" and "Done". Querying a button by that name could never match, so it
  // could never fail; the group is what the label actually names.
  await expect(page.getByRole('group', {name: /checked status/i})).toHaveCount(0)

  await page.waitForTimeout(1000)
  expect(requests(), 'filtering must not issue a GraphQL request').toBe(0)
  expect(sockets(), 'the management screen must not open a subscription').toBe(0)
  await expect(page.getByTestId('list-detail-loading')).toHaveCount(0)
})

test('FR61 — an EMPTY category is kept on /lists/:id while nothing filters, dropped while something does, and never shown on /list/:id', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'emptycat', testInfo.project.name)
  const listName = `EmptyCat ${Date.now()}`
  const stocked = `Produce ${Date.now()}`
  const empty = `Bakery ${Date.now()}`
  const bananas = `Bananas ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, stocked)
  await addCategory(page, empty)
  await addItem(page, stocked, bananas)

  // BRANCH 1 — no filter, no term: the empty category is RENDERED, with its
  // "No items yet." row and its own add-item affordance. This is a management
  // screen; a category you cannot see is a category you cannot fill.
  const emptyCard = page.getByTestId(`category-row-${empty}`)
  await expect(emptyCard).toBeVisible()
  await expect(emptyCard).toContainText('No items yet.')
  await expect(emptyCard.getByTestId('add-item-in-category-button')).toBeVisible()

  // BRANCH 2a — a category filter is active: a card with zero matching items is
  // not rendered at all. (Selecting the stocked one, so the empty one is dropped
  // by the selection.)
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${stocked}`).click()
  })
  await expect(page.getByTestId(`category-row-${stocked}`)).toBeVisible()
  await expect(emptyCard).toHaveCount(0)

  // BRANCH 2b — the same, driven by a SEARCH TERM rather than a selection: the
  // empty category can match no term, so it goes. Both halves matter because
  // `isItemFilterActive` is one predicate over two independent controls.
  await withCategoryMenu(page, async () => {
    await page.getByTestId('filter-category-option-all').click()
  })
  await expect(emptyCard).toBeVisible()
  await page.getByTestId('filter-search').fill('ban')
  await expect(page.getByTestId(`category-row-${stocked}`)).toBeVisible()
  await expect(emptyCard).toHaveCount(0)

  // Back to idle → it returns. Without this the two branches above would also be
  // satisfied by a screen that simply never renders empty categories.
  await page.getByTestId('filter-search').fill('')
  await expect(emptyCard).toBeVisible()

  // WHITESPACE IS NOT A TERM. This is the only assertion in the suite that
  // exercises `isItemFilterActive`'s trim: the FR61 test above types '   ' only
  // while two categories are selected, so the selection alone already makes the
  // filter active. Drop the `.trim()` and a single stray space in this box hides
  // every empty category — and with it every per-category add-item button, on a
  // screen whose whole job is adding items.
  await page.getByTestId('filter-search').fill('   ')
  await expect(emptyCard).toBeVisible()
  await expect(emptyCard.getByTestId('add-item-in-category-button')).toBeVisible()
  await page.getByTestId('filter-search').fill('')

  // THE DELIBERATE ASYMMETRY. On the SHOPPING view the same empty category is
  // hidden with NO filter active at all — that behaviour is unchanged by this
  // story, and asserting it here is what stops a later "make the two screens
  // consistent" change from quietly removing one side or the other.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-group-${stocked}`)).toBeVisible()
  await expect(page.getByTestId('filter-category')).toContainText('All categories')
  await expect(page.getByTestId(`shopping-group-${empty}`)).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.5 (FR62) — the same list reads the same way on both screens.
//
// Both specs below read the SEQUENCE out of the DOM rather than trusting either
// component's source, and neither adds a testid: everything they need is
// already rendered. That is deliberate — a testid added for an ordering
// assertion would be a second place ordering is described.
// ─────────────────────────────────────────────────────────────────────────────

// The management screen names each group with `data-testid="category-name"`.
// The shopping view names its groups only through the group card's own testid,
// so the sequence there is read off the ATTRIBUTE.
async function shoppingGroupNames(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="shopping-group-"]')
    .evaluateAll(els => els.map(el => (el.getAttribute('data-testid') ?? '').slice('shopping-group-'.length)))
}

// Item names inside ONE shopping group. Story 8.3 (FR60) made the row itself the
// checkbox and its children presentational, so the accessible name
// (`Toggle <name>`) is where the item name is readable — not a text node.
async function shoppingItemNames(page: Page, groupName: string): Promise<string[]> {
  const labels = await page
    .getByTestId(`shopping-group-${groupName}`)
    .getByRole('checkbox')
    .evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? ''))
  return labels.map(label => label.replace(/^Toggle /, ''))
}

test('FR62 — categories and items read in the SAME by-name order on /lists/:id and /list/:id', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'order', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Order ${stamp}`
  // Prefixed so the EXPECTED sequence is legible in the assertion instead of
  // being a function of `Date.now()`. Created Z → M → A, i.e. deliberately
  // against the order both screens must render.
  const catA = `A Produce ${stamp}`
  const catM = `M Bakery ${stamp}`
  const catZ = `Z Dairy ${stamp}`
  // The three items that probe ITEM order all live in one category; the other
  // two categories get one item each only because the shopping view hides empty
  // groups always (the AC5 asymmetry), and a hidden group cannot be compared.
  const itemA = `A Anchovies ${stamp}`
  const itemM = `M Muffins ${stamp}`
  const itemZ = `Z Ziti ${stamp}`
  const soleProduce = `Sole produce ${stamp}`
  const soleDairy = `Sole dairy ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, catZ)
  await addCategory(page, catM)
  await addCategory(page, catA)
  await addItem(page, catM, itemZ)
  await addItem(page, catM, itemM)
  await addItem(page, catM, itemA)
  await addItem(page, catA, soleProduce)
  await addItem(page, catZ, soleDairy)

  // MANAGEMENT. Before this story it rendered raw query order — i.e. creation
  // order, Z → M → A — and the same list read two different ways.
  const managementCategories = await page.getByTestId('category-name').allTextContents()
  expect(managementCategories, 'categories on /lists/:id ascend by name').toEqual([catA, catM, catZ])
  const managementItems = await page
    .getByTestId(`category-row-${catM}`)
    .getByTestId('item-name')
    .allTextContents()
  expect(managementItems, 'items on /lists/:id ascend by name').toEqual([itemA, itemM, itemZ])

  // SHOPPING. Compared against the sequences just read, not against a second
  // copy of the expectation: "identical on both screens" is the requirement.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-group-${catA}`)).toBeVisible()
  expect(await shoppingGroupNames(page), 'both screens order categories alike').toEqual(managementCategories)
  expect(await shoppingItemNames(page, catM), 'both screens order items alike').toEqual(managementItems)
})

test('FR62 — an item orphaned by a category removal is reachable in an Uncategorized group on /lists/:id', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'orphan', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Orphan ${stamp}`
  const keep = `Keep ${stamp}`
  const doomed = `Doomed ${stamp}`
  const known = `Known ${stamp}`
  const strandedEdit = `Stranded edit ${stamp}`
  const strandedGone = `Stranded gone ${stamp}`
  // Added only AFTER the last real category is removed below, so the edit
  // recovery still has somewhere to move an orphan to.
  const rehome = `Rehome ${stamp}`
  // A real category whose name sorts AFTER "Uncategorized", kept NON-EMPTY so the
  // shopping view (which hides empty groups) renders it too. Without it the
  // "appended last" rule is asserted only where alphabetical placement happens to
  // agree, and re-sorting the whole array with the group comparator instead of
  // pushing the bucket would keep every assertion below green.
  const zLast = `Z Last ${stamp}`
  const zItem = `Zebra cakes ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, keep)
  await addCategory(page, doomed)
  await addCategory(page, zLast)
  await addItem(page, doomed, known)
  await addItem(page, zLast, zItem)

  // THE PRODUCER, and it has to be this one. Remove-category deletes the items
  // the removing CLIENT can see and then the category, so a single-tab "add a
  // category, add an item, remove the category" strands nothing at all and a
  // test written to that sequence would assert nothing. The real producer is the
  // stale-client-set race (AR-E8-7a): a second tab adds items this tab has never
  // seen, and — /lists/:id being refetch-driven with no subscription (AR-E8-6) —
  // the removal loop walks the stale set. One user, one context, two tabs.
  const other = await page.context().newPage()
  await other.goto(`/lists/${listId}`)
  await expect(other.getByTestId('list-detail-page')).toBeVisible()
  await addItem(other, doomed, strandedEdit)
  await addItem(other, doomed, strandedGone)
  await other.close()

  // THE FIXTURE'S PREMISE, asserted rather than assumed. If this tab had
  // refetched at any point since the second tab's writes it would now hold the
  // strays, the removal loop would take them too, and nothing would be orphaned —
  // and the spec would then fail somewhere below as a confusing false negative
  // about the `Uncategorized` group instead of here, about its own setup.
  await expect(page.getByTestId(`item-row-${strandedEdit}`)).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${strandedGone}`)).toHaveCount(0)

  await page.getByTestId(`category-row-${doomed}`).getByTestId('remove-category-button').click()
  await expect(page.getByTestId('remove-category-dialog')).toBeVisible()
  await page.getByTestId('remove-category-dialog-confirm').click()
  await expect(page.getByTestId('remove-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${doomed}`)).toHaveCount(0)
  // The one item this tab knew about went with the category; the two it did not
  // know about now point at an id that no longer exists.
  await expect(page.getByTestId(`item-row-${known}`)).toHaveCount(0)

  // AC4 — the orphans are VISIBLE on the only screen that can edit or delete
  // them, in a synthetic group, positioned LAST.
  const uncategorized = page.getByTestId('category-row-Uncategorized')
  await expect(uncategorized).toBeVisible()
  // APPENDED LAST, not sorted among the real categories — and asserted as the
  // FULL sequence, because `Uncategorized` falls between `Keep …` and `Z Last …`
  // alphabetically. A `.last()` check would pass either way.
  await expect(page.getByTestId('category-name')).toHaveText([keep, zLast, 'Uncategorized'])
  await expect(uncategorized.getByTestId(`item-row-${strandedEdit}`)).toBeVisible()
  await expect(uncategorized.getByTestId(`item-row-${strandedGone}`)).toBeVisible()
  // NO category-level controls: there is no category to add into or to remove.
  // Each ITEM keeps its own working pair, asserted by using them below.
  await expect(uncategorized.getByTestId('add-item-in-category-button')).toHaveCount(0)
  await expect(uncategorized.getByTestId('remove-category-button')).toHaveCount(0)

  // The shopping view has bucketed orphans since Story 5.6. Asserting it here is
  // what makes "the same list reads the same way" a COMPARISON rather than a
  // one-sided claim about the screen this story changed.
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  // `keep` is empty, so the shopping view drops it (the AC5 asymmetry) and the
  // sequence here is the `Z …` category followed by the bucket — again the full
  // sequence, again because 'Uncategorized' would sort BEFORE `Z Last …`.
  const shoppingGroups = await shoppingGroupNames(page)
  expect(shoppingGroups, 'Uncategorized is appended last on the shopping view too').toEqual([zLast, 'Uncategorized'])
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()

  // A search matching ONLY an orphan reaches it. Before this story the same
  // search rendered `list-detail-no-matches` over an item that exists.
  await page.getByTestId('filter-search').fill(strandedEdit)
  await expect(page.getByTestId('list-detail-no-matches')).toHaveCount(0)
  await expect(uncategorized.getByTestId(`item-row-${strandedEdit}`)).toBeVisible()
  await expect(page.getByTestId(`item-row-${strandedGone}`)).toHaveCount(0)
  await page.getByTestId('filter-search').fill('')

  // A REAL category selected, orphans present — and this is the TRIPWIRE for a
  // recorded decision, not just a behaviour check. There is deliberately no
  // `Uncategorized` OPTION in the filter (decided NO by this story; the
  // mechanism is in deferred-work.md — a synthetic id in
  // `ItemFilterValue.categoryIds` is deleted by `useItemFilter`'s prune on the
  // next render), so narrowing to any real category hides the orphans. If that
  // option is ever added, this assertion is what says a decision is being
  // reversed rather than a gap being filled.
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${keep}`).click()
  })
  await expect(uncategorized).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${strandedEdit}`)).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${strandedGone}`)).toHaveCount(0)
  // Cleared, they come back — without this the assertion above would also be
  // satisfied by a screen that had simply stopped rendering the bucket.
  await withCategoryMenu(page, async () => {
    await page.getByTestId('filter-category-option-all').click()
  })
  await expect(uncategorized).toBeVisible()
  await expect(uncategorized.getByTestId(`item-row-${strandedEdit}`)).toBeVisible()

  // ZERO categories, orphans still present. Removing the last real category
  // leaves a list holding items and no categories at all — and the pre-8.5 gate
  // (`categories.length === 0`) would have shown the "No categories yet"
  // onboarding card OVER two items that are right there. Branching on
  // `groups.length` is what makes this corner hold.
  for (const doomedName of [keep, zLast]) {
    await page.getByTestId(`category-row-${doomedName}`).getByTestId('remove-category-button').click()
    await expect(page.getByTestId('remove-category-dialog')).toBeVisible()
    await page.getByTestId('remove-category-dialog-confirm').click()
    await expect(page.getByTestId('remove-category-dialog')).toHaveCount(0)
    await expect(page.getByTestId(`category-row-${doomedName}`)).toHaveCount(0)
  }
  await expect(page.getByTestId('list-detail-empty')).toHaveCount(0)
  await expect(uncategorized).toBeVisible()
  await expect(uncategorized.getByTestId(`item-row-${strandedEdit}`)).toBeVisible()
  await expect(uncategorized.getByTestId(`item-row-${strandedGone}`)).toBeVisible()
  // The filter row survives a categoryless list. Its mount guard is
  // `categories.length > 0 || items.length > 0` for exactly this state; with the
  // second half missing, the ONLY control that reaches these items — the search
  // box used a few lines above — would not be rendered at all.
  await expect(page.getByTestId('list-detail-filters')).toBeVisible()
  await expect(page.getByTestId('filter-search')).toBeVisible()

  // Give the recovery somewhere to go.
  await addCategory(page, rehome)

  // RECOVERY, half one: re-home the orphan through the row's own edit control.
  // The dialog opens with a blank category (the stored id is out of range),
  // which is the right affordance — "pick a category" — and picking one is the
  // recovery this story exists to make possible.
  await uncategorized.getByTestId(`item-row-${strandedEdit}`).getByTestId('edit-item-button').click()
  await expect(page.getByTestId('edit-item-dialog')).toBeVisible()
  await page.getByTestId('edit-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`edit-item-category-option-${rehome}`).click()
  await page.getByTestId('edit-item-submit').click()
  await expect(page.getByTestId('edit-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${rehome}`).getByTestId(`item-row-${strandedEdit}`)).toBeVisible()
  await expect(uncategorized.getByTestId(`item-row-${strandedEdit}`)).toHaveCount(0)

  // RECOVERY, half two: delete the other one — and once no orphan remains the
  // synthetic group is ABSENT, not rendered empty.
  await uncategorized.getByTestId(`item-row-${strandedGone}`).getByTestId('remove-item-button').click()
  await expect(page.getByTestId('remove-item-dialog')).toBeVisible()
  await page.getByTestId('remove-item-dialog-confirm').click()
  await expect(page.getByTestId('remove-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${strandedGone}`)).toHaveCount(0)
  await expect(uncategorized).toHaveCount(0)
  await expect(page.getByTestId('category-name')).toHaveText([rehome])
})
