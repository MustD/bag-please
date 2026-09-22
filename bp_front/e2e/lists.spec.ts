import {randomUUID} from 'node:crypto'

import {expect, type Page, test} from '@playwright/test'

import {gql, loginApi} from './support/api'
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

  // BRANCH 2a-inverted (Story 9.8, AR-E9-14, F2) — filter to the EMPTY category
  // ITSELF instead. Before this story `keepEmpty: !filterActive` alone decided
  // retention, so an active filter dropped a card with nothing in it regardless
  // of WHY it was empty — including when the user explicitly asked to see just
  // that one. "Filter to the category I care about" must not also mean "hide it
  // because it currently has nothing in it": the card and its add-item
  // affordance stay, so the empty category can actually be filled. Deselecting
  // `stocked` and selecting `empty` in the same menu visit (rather than
  // resetting to "All categories" first) is deliberate — it proves the RETAINED
  // group is keyed off the current selection, not off some residual "recently
  // active" state left over from BRANCH 2a.
  await withCategoryMenu(page, async () => {
    await page.getByTestId(`filter-category-option-${stocked}`).click()
    await page.getByTestId(`filter-category-option-${empty}`).click()
  })
  await expect(emptyCard).toBeVisible()
  await expect(emptyCard).toContainText('No items yet.')
  await expect(emptyCard.getByTestId('add-item-in-category-button')).toBeVisible()
  await expect(page.getByTestId(`category-row-${stocked}`)).toHaveCount(0)

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

// Story 9.8, F5 — a REAL category named "Uncategorized" must never collide, by
// testid, with the SYNTHETIC orphan bucket of the same display name.
//
// The orphan half of the fixture is INTERCEPTED, not provoked for real — the
// same technique (and the same reason) as shopping.spec.ts's "rejected
// uncheck" spec: Story 9.3 closed every UI- and API-reachable path that can
// leave an item pointing at a category not on its list (`saveItem` rejects an
// out-of-list category on both branches, and `deferred-work.md` records that
// `CategoryService.saveCategory`'s own relocation window does not actually
// strand the old list's items — its in-memory storage layer ADDS the category
// to the new list without ever removing it from the old one, so the "orphan"
// it was thought to produce never materializes). Fixing that storage layer is
// a backend change this story does not make (frontend-only, NFR-E9-x). Instead
// the ONE `getItems` response is intercepted and given one extra item whose
// `category` matches no real category id — the exact shape `groupItemsByCategory`
// treats as an orphan — so the bucket this test exists to check the testid of
// is rendered from a real network response through real rendering code,
// everything downstream of that one interception UI-driven as usual.
test('F5 — a real category named "Uncategorized" and the synthetic orphan bucket render as two distinct rows', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'unclash', testInfo.project.name)
  const listName = `Unclash ${Date.now()}`
  const namedItem = `Flour ${Date.now()}`
  const orphanedItem = `Stray ${Date.now()}`
  // Matches no real category this fixture (or any other concurrent run) creates.
  const bogusCategoryId = randomUUID()
  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)

  // A REAL category, typed as the literal name the synthetic bucket also uses.
  await addCategory(page, 'Uncategorized')
  await addItem(page, 'Uncategorized', namedItem)

  // Every `getItems` response for this list gains one extra item pointing at
  // `bogusCategoryId` — a category id `groupItemsByCategory` will never find
  // among the real ones, which is precisely what puts an item in the synthetic
  // bucket. `route.fetch()` runs the request for real; only the JSON is edited.
  await page.route('**/api/graphql', async route => {
    const body = route.request().postDataJSON() as {operationName?: string} | undefined
    if (body?.operationName !== 'Items') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const json = (await response.json()) as {data: {getItems: unknown[]}}
    json.data.getItems.push({
      __typename: 'Item',
      id: randomUUID(),
      name: orphanedItem,
      checked: false,
      category: bogusCategoryId,
      listId,
      stores: [],
      addedBy: username,
      recurring: null,
      deleted: false,
    })
    await route.fulfill({response, json})
  })

  // Reload so the interception above is in place for the query that loads
  // this page's items.
  await page.reload()
  await expect(page.getByTestId('list-detail-page')).toBeVisible()

  // The REAL category keeps its name-based testid, unambiguously.
  const namedRow = page.getByTestId('category-row-Uncategorized')
  await expect(namedRow).toHaveCount(1)
  await expect(namedRow).toContainText(namedItem)

  // The SYNTHETIC bucket is reached by its sentinel key, not its display name —
  // the same literal `__uncategorized__` `order.ts` exports as `UNCATEGORIZED_KEY`.
  const orphanRow = page.getByTestId('category-row-__uncategorized__')
  await expect(orphanRow).toHaveCount(1)
  await expect(orphanRow).toContainText('Uncategorized')
  await expect(orphanRow).toContainText(orphanedItem)

  // Same collision, same fix, on the shopping surface (F5 applies to both).
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  const namedShoppingRow = page.getByTestId('shopping-group-Uncategorized')
  await expect(namedShoppingRow).toHaveCount(1)
  await expect(namedShoppingRow).toContainText(namedItem)
  const orphanShoppingRow = page.getByTestId('shopping-group-__uncategorized__')
  await expect(orphanShoppingRow).toHaveCount(1)
  await expect(orphanShoppingRow).toContainText(orphanedItem)
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

// RETIRED by Story 9.3 — "an item orphaned by a category removal is reachable in an Uncategorized
// group on /lists/:id".
//
// That spec's fixture was the stale-client-set race (AR-E8-7a): a second tab added items this tab had
// never seen, and the client-side removal loop walked the stale set, stranding them. Story 9.3 deleted
// that loop — the server cascades — and closed `saveItem`'s CREATE hole, so an out-of-list category is
// now rejected on both branches. No SUCCESSFUL call on the item surface can leave an item pointing at a
// category that is not on its list, so this fixture cannot be written and the spec cannot stand.
//
// Narrower than "no orphan is reachable at all", deliberately (review finding, 2026-09-17). Three
// windows remain and none of them is a fixture a UI-driven E2E can use: `saveCategory` can RELOCATE a
// category between lists (no `listId`-stability guard, unlike `saveItem`), `saveItem`'s category check
// is a TOCTOU read of a cache the cascade mutates, and the cascade is non-transactional so its failure
// residue is an orphan. All three are recorded in deferred-work.md; reaching any of them from a browser
// test would mean racing the server on purpose.
//
// What survives, and where:
//   * The synthetic `Uncategorized` bucket itself is NOT removed — items that predate this change keep
//     appearing in it with their per-item edit and remove controls (Story 9.3 AC3). Its ordering and
//     placement rules stay covered, without a browser, by `e2e/order.spec.ts`, which calls
//     `groupItemsByCategory` directly with items whose category id matches nothing.
//   * "Removing a category removes its items" is covered by the FR46 spec above and, across two
//     members, by the FR46 cascade spec at the end of this file.
// The one thing now uncovered end-to-end is the RENDERING of a legacy orphan on /lists/:id, because no
// test can create one; see deferred-work.md.

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.6 (FR63) — rename a category instead of destroying it.
//
// Before this story the only way to fix a mistyped category name was the remove
// control, whose own confirm reads "Items in this category are removed with it.
// This cannot be undone." — so correcting "Diary" to "Dairy" cost the aisle.
// The rename saves through the SAME `saveCategory` upsert the add dialog uses,
// so the whole story is frontend: no backend change, no schema change.
//
// THE LOCATOR RULE FOR EVERY SPEC BELOW (AC7). Both surfaces key their rows by
// NAME (`category-row-${name}`, `shopping-group-${name}`), so a locator built
// from the OLD name is dead the instant the mutation lands. Re-query with the
// NEW name after each save and assert the old testid is gone; never hold one
// across a save.
// ─────────────────────────────────────────────────────────────────────────────

// Capture the CategoryInput of every saveCategory this page sends. Not a
// substitute for the behaviour under test — the rename is driven entirely
// through the dialog; this only reads the payload the app chose to send, which
// is the one thing AC3 is about and the DOM cannot show. `"SaveCategory"`
// (quoted) matches Apollo's operationName field, not the query text. Attach it
// AFTER setup, so `addCategory`'s own upserts are not collected.
type CategoryInput = {id: string; name: string; listId: string}

function captureCategorySaves(page: Page): () => CategoryInput[] {
  const sent: CategoryInput[] = []
  page.on('request', req => {
    if (req.method() !== 'POST' || !req.url().includes('/api/graphql')) return
    const body = req.postData() ?? ''
    if (!body.includes('"SaveCategory"')) return
    const parsed = JSON.parse(body) as {variables?: {category?: CategoryInput}}
    if (parsed.variables?.category) sent.push(parsed.variables.category)
  })
  return () => sent
}

// The other half of AC2, and the reason it is not enough to compare the sent
// `listId` against the id parsed out of the URL: those two agree today, so an
// implementation that took `listId` from `useParams` — the exact mistake AC2
// exists to prevent — would satisfy a URL comparison unchanged. The value the
// payload must carry is the one the QUERY returned for this row, so that is
// what gets captured. Response bodies arrive asynchronously, hence the promise
// list rather than a plain array.
function captureLoadedCategories(page: Page): () => Promise<CategoryInput[]> {
  const pending: Promise<CategoryInput[]>[] = []
  page.on('response', res => {
    const req = res.request()
    if (req.method() !== 'POST' || !req.url().includes('/api/graphql')) return
    if (!(req.postData() ?? '').includes('"Categories"')) return
    pending.push(
      res
        .json()
        .then(body => (body as {data?: {getCategories?: CategoryInput[]}}).data?.getCategories ?? [])
        .catch(() => []),
    )
  })
  return async () => (await Promise.all(pending)).flat()
}

// `submit` drives the dialog's TWO submission paths. The default clicks the
// button; 'enter' presses Enter from the name field, which only works because
// the dialog's content is a native <form> with a `type="submit"` button — an
// explicit convention of this dialog (AC3) that moving submission onto the
// button's `onClick` would silently break while every click-driven rename here
// stayed green.
async function renameCategory(
  page: Page,
  from: string,
  to: string,
  submit: 'button' | 'enter' = 'button',
): Promise<void> {
  await page.getByTestId(`category-row-${from}`).getByTestId('edit-category-button').click()
  await expect(page.getByTestId('edit-category-dialog')).toBeVisible()
  // Pre-filled with the CURRENT name (AC1): a rename starts from what is there,
  // not from an empty box the user has to retype.
  await expect(page.getByTestId('edit-category-name')).toHaveValue(from)
  await page.getByTestId('edit-category-name').fill(to)
  if (submit === 'enter') {
    await page.getByTestId('edit-category-name').press('Enter')
  } else {
    await page.getByTestId('edit-category-submit').click()
  }
  await expect(page.getByTestId('edit-category-dialog')).toHaveCount(0)
}

test('FR63 — renaming a category keeps its items and its list, and survives a reload', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'rename', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Rename ${stamp}`
  const otherListName = `Untouched ${stamp}`
  const typo = `Diary ${stamp}`
  const fixed = `Dairy ${stamp}`
  const fixedAgain = `Dairy aisle ${stamp}`
  const otherCategory = `Other list category ${stamp}`
  const milk = `Milk ${stamp}`
  const cheese = `Cheese ${stamp}`
  // A NEIGHBOUR that the rename sorts THROUGH: `Dairy … < Deli … < Diary …`, so
  // the corrected name moves from second place to first. Without it every
  // fixture here holds one category and a regression that stopped re-sorting
  // after a rename — breaking Story 8.5's "the same list reads the same way on
  // both screens" contract — would have nothing to sort against. It carries an
  // item because the shopping view hides empty groups always, and a hidden
  // group cannot appear in a sequence comparison.
  const neighbour = `Deli ${stamp}`
  const salami = `Salami ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, typo)
  await addItem(page, typo, milk)
  await addItem(page, typo, cheese)
  await addCategory(page, neighbour)
  await addItem(page, neighbour, salami)

  // A SECOND list on the same account, with its own category. `saveCategory`
  // `$set`s `listId` unconditionally server-side, so a payload carrying the
  // wrong list would move the category and strand its items behind a dangling
  // id — a failure that is invisible on the screen doing the rename. This list
  // is what makes it visible.
  await openListsViaMenu(page)
  const otherListId = await createListAndOpen(page, otherListName)
  await addCategory(page, otherCategory)
  await page.goto(`/lists/${listId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()

  const saves = captureCategorySaves(page)
  const loaded = captureLoadedCategories(page)

  // AC1 — the control sits BETWEEN add-item and remove-category, so the
  // destructive one stays last. Filtered to the category-level controls: the
  // item rows below carry their own edit/remove pair.
  const controlOrder = await page
    .getByTestId(`category-row-${typo}`)
    .locator('button[data-testid]')
    .evaluateAll(els =>
      els
        .map(el => el.getAttribute('data-testid') ?? '')
        .filter(id =>
          id === 'add-item-in-category-button' ||
          id === 'edit-category-button' ||
          id === 'remove-category-button',
        ),
    )
  expect(controlOrder, 'rename sits between add-item and remove-category').toEqual([
    'add-item-in-category-button',
    'edit-category-button',
    'remove-category-button',
  ])

  // AC2 — the rename itself. The row re-renders under the new name with both
  // items still attached, and the old row is gone rather than duplicated (a
  // fresh UUID would leave TWO rows here, which is the cheap half of AC3).
  // The pre-rename order, read rather than assumed: `Deli …` sorts before
  // `Diary …`.
  await expect(page.getByTestId('category-name')).toHaveText([neighbour, typo])

  await renameCategory(page, typo, fixed)
  const renamed = page.getByTestId(`category-row-${fixed}`)
  await expect(renamed).toBeVisible()
  await expect(page.getByTestId(`category-row-${typo}`)).toHaveCount(0)
  await expect(renamed.getByTestId(`item-row-${milk}`)).toBeVisible()
  await expect(renamed.getByTestId(`item-row-${cheese}`)).toBeVisible()
  // …and the renamed row has MOVED: the list re-sorts on the new name instead of
  // keeping the row where the old one put it.
  await expect(page.getByTestId('category-name')).toHaveText([fixed, neighbour])

  // A SECOND rename, because "the id is the loaded category's own" is a claim
  // about STABILITY: one payload cannot distinguish a preserved id from a
  // freshly minted one, two identical ids can.
  await renameCategory(page, fixed, fixedAgain)
  await expect(page.getByTestId(`category-row-${fixedAgain}`)).toBeVisible()
  await expect(page.getByTestId(`category-row-${fixed}`)).toHaveCount(0)
  await expect(page.getByTestId('category-name')).toHaveText([fixedAgain, neighbour])

  // AC3 — the payload shape. A complete CategoryInput each time: the SAME id
  // (never a fresh UUID), the trimmed new name, and the list the category was
  // loaded from.
  const sent = saves()
  expect(sent.map(c => c.name), 'each save carries the trimmed new name').toEqual([fixed, fixedAgain])
  expect(sent[0].id, 'the second rename reuses the first\'s id — no fresh UUID').toBe(sent[1].id)
  // The `listId` is compared against the one the CATEGORIES QUERY returned for
  // this row, not against the id in the URL. The two agree today, which is
  // exactly why the URL is the wrong reference: a dialog that read `listId` off
  // `useParams` would pass a URL comparison while carrying a value that has
  // nothing to do with the entity it is saving.
  const loadedRows = await loaded()
  const queried = loadedRows.filter(c => c.id === sent[0].id)
  expect(queried.length, 'the renamed row was actually loaded by the Categories query').toBeGreaterThan(0)
  expect(
    sent.map(c => c.listId),
    'each save carries the listId the query returned for this category',
  ).toEqual([queried[0].listId, queried[0].listId])

  // It is a real write, not a cache illusion.
  await page.reload()
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  const afterReload = page.getByTestId(`category-row-${fixedAgain}`)
  await expect(afterReload).toBeVisible()
  await expect(afterReload.getByTestId(`item-row-${milk}`)).toBeVisible()
  await expect(afterReload.getByTestId(`item-row-${cheese}`)).toBeVisible()

  // BOTH SCREENS still read the same way after a rename (Story 8.5's FR62
  // contract). Compared against the sequence just read off the management
  // screen rather than against a second copy of the expectation.
  const managementOrder = await page.getByTestId('category-name').allTextContents()
  expect(managementOrder, 'the rename re-sorted the management screen').toEqual([fixedAgain, neighbour])
  await page.goto(`/list/${listId}`)
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-group-${fixedAgain}`)).toBeVisible()
  expect(await shoppingGroupNames(page), 'both screens order the renamed category alike').toEqual(managementOrder)

  // AC3's other half — the second list is exactly as it was.
  await page.goto(`/lists/${otherListId}`)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  await expect(page.getByTestId('category-name')).toHaveText([otherCategory])
  await expect(page.getByTestId(`category-row-${fixedAgain}`)).toHaveCount(0)
})

test('FR63 — the rename dialog validates like the add dialog, trims, clears its errors on reopen, and no-ops an unchanged submit', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'renamevalid', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Validate ${stamp}`
  const original = `Bakery ${stamp}`
  const trimmed = `Bakery aisle ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, original)

  const saves = captureCategorySaves(page)

  // EMPTY — validate-on-submit, inline field error, dialog stays open, and no
  // request goes out at all.
  await page.getByTestId(`category-row-${original}`).getByTestId('edit-category-button').click()
  await expect(page.getByTestId('edit-category-dialog')).toBeVisible()
  await page.getByTestId('edit-category-name').fill('')
  await page.getByTestId('edit-category-submit').click()
  await expect(page.getByTestId('edit-category-dialog')).toBeVisible()
  await expect(page.getByTestId('edit-category-dialog').getByText('Name is required')).toBeVisible()
  expect(saves(), 'an invalid name sends no mutation').toHaveLength(0)

  // OVER-LONG, in TWO layers, because they fail differently.
  //
  // Layer one is the cap: the field carries `maxLength=100`, which the browser
  // enforces on typing AND on paste — and Playwright's `fill` honours it too —
  // so 101 characters in leaves 100 characters held.
  await expect(page.getByTestId('edit-category-name')).toHaveAttribute('maxlength', '100')
  await page.getByTestId('edit-category-name').fill('x'.repeat(101))
  await expect(page.getByTestId('edit-category-name')).toHaveValue('x'.repeat(100))
  expect(saves(), 'nothing is sent while the dialog is still open').toHaveLength(0)

  // Layer two is the submit-time length check BEHIND that cap, which mirrors
  // AddCategoryDialog's. `fill` can never reach it, so the value is written
  // through React's own input plumbing instead — the native value setter plus a
  // real `input` event, which is what a controlled MUI TextField listens to.
  // That is not a user gesture and is not pretending to be one: it is the only
  // way to drive a branch whose whole job is to hold when the attribute does
  // not (an autofill, an extension, a future field that drops `maxLength`). The
  // ASSERTED behaviour is still the component's own — inline error, dialog open,
  // no mutation.
  await page.getByTestId('edit-category-name').evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, value)
    el.dispatchEvent(new Event('input', {bubbles: true}))
  }, 'y'.repeat(101))
  await expect(page.getByTestId('edit-category-name')).toHaveValue('y'.repeat(101))
  await page.getByTestId('edit-category-submit').click()
  await expect(page.getByTestId('edit-category-dialog')).toBeVisible()
  await expect(
    page.getByTestId('edit-category-dialog').getByText('Name must be 100 characters or fewer'),
  ).toBeVisible()
  expect(saves(), 'an over-long name sends no mutation either').toHaveLength(0)

  // Cancel closes without saving, and the row is untouched.
  await page.getByTestId('edit-category-cancel').click()
  await expect(page.getByTestId('edit-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${original}`)).toBeVisible()
  expect(saves(), 'cancel sends no mutation').toHaveLength(0)

  // REOPENED, and asserted WHILE IT IS OPEN. The seeding block re-seeds the
  // name and clears both error slots on every closed→open transition; without
  // that clearing, this dialog would come back carrying the length error left
  // over from the abandoned attempt above. Asserting it after a close instead
  // would prove nothing at all — MUI unmounts the dialog's children, so no
  // error element can exist once it is shut, whatever the component does.
  await page.getByTestId(`category-row-${original}`).getByTestId('edit-category-button').click()
  await expect(page.getByTestId('edit-category-dialog')).toBeVisible()
  await expect(page.getByTestId('edit-category-name')).toHaveValue(original)
  await expect(page.getByTestId('edit-category-dialog').getByText('Name is required')).toHaveCount(0)
  await expect(
    page.getByTestId('edit-category-dialog').getByText('Name must be 100 characters or fewer'),
  ).toHaveCount(0)
  await expect(page.getByTestId('edit-category-error')).toHaveCount(0)
  await page.getByTestId('edit-category-cancel').click()
  await expect(page.getByTestId('edit-category-dialog')).toHaveCount(0)

  // WHITESPACE — padded input, trimmed row. The stored name is what the row
  // testid is keyed on, so a surviving space would fail this locator. Submitted
  // with ENTER from the name field, which is the convention the dialog's native
  // <form> exists for: every other rename in this file clicks the button, so
  // moving submission onto the button's `onClick` would leave the whole suite
  // green with the keyboard path broken.
  await renameCategory(page, original, `   ${trimmed}   `, 'enter')
  await expect(page.getByTestId(`category-row-${trimmed}`)).toBeVisible()
  await expect(page.getByTestId(`category-row-${original}`)).toHaveCount(0)
  expect(saves().map(c => c.name), 'the padded name is trimmed before it is sent').toEqual([trimmed])

  // UNCHANGED — permitted, and it sends NOTHING. `saveCategory` is a
  // full-document upsert, so resending the open-time name is not inert under
  // concurrency: it would write this dialog's stale name back over a co-member's
  // rename that landed while it sat open. The same `nothingChanged`
  // short-circuit EditItemDialog carries, for the same reason, and the dialog
  // still closes exactly as a successful save does.
  await renameCategory(page, trimmed, trimmed)
  await expect(page.getByTestId(`category-row-${trimmed}`)).toBeVisible()
  expect(saves().map(c => c.name), 'an unchanged submit sends no mutation').toEqual([trimmed])
})

test('FR63 — a rename lands live on another member\'s shopping view, with no subscription on /lists/:id', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('lists', 'renameowner', testInfo.project.name)
  const member = uniqueUsername('lists', 'renamemember', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Shared rename ${stamp}`
  const typo = `Diary ${stamp}`
  const fixed = `Dairy ${stamp}`
  const milk = `Milk ${stamp}`

  // The OBSERVER sits on the `page` fixture, whose /list/:id rendering is what
  // the mandatory mobile gate must cover: browser.newContext() does NOT inherit
  // the project's `use` block, so a hand-built context would silently observe at
  // a desktop viewport on the mobile project. The co-member renames in the
  // hand-built context — which also makes the renamer a NON-owner, since editing
  // a category is a member right.
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, typo)
  await addItem(page, typo, milk)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // SETUP ONLY (the sharing UI is Story 5.7's subject, not this story's): make
    // `member` an accepted member through the backend shareList + acceptInvite
    // mutations with each user's own API token. Not the asserted behaviour.
    const ownerToken = await loginApi(owner, PASSWORD)
    const memberToken = await loginApi(member, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)

    // The owner parks on the shopping view and never reloads from here.
    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    await expect(page.getByTestId(`shopping-group-${typo}`)).toBeVisible()

    // AC4's other half, asserted rather than assumed: the MANAGEMENT screen
    // opens no WebSocket. The live update below is delivered by the shopping
    // view's existing per-list category subscription — this story adds no
    // `subscribeToMore` to /lists/:id, which stays refetch-driven (AR-E8-6).
    const sockets = countWebSockets(memberPage)
    await memberPage.goto(`/lists/${listId}`)
    await expect(memberPage.getByTestId('list-detail-page')).toBeVisible()
    await renameCategory(memberPage, typo, fixed)
    await expect(memberPage.getByTestId(`category-row-${fixed}`)).toBeVisible()
    expect(sockets(), '/lists/:id opens no WebSocket — it gains no subscription').toBe(0)

    // The owner sees the new group name WITHOUT reloading, item intact.
    await expect(page.getByTestId(`shopping-group-${fixed}`)).toBeVisible()
    await expect(page.getByTestId(`shopping-group-${typo}`)).toHaveCount(0)
    await expect(page.getByTestId(`shopping-group-${fixed}`).getByTestId(`shopping-item-${milk}`)).toBeVisible()
  } finally {
    await ctx.close()
  }
})

test('FR63 — a stale rename RECREATES a category another tab removed, empty and not an error', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'renamestale', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Stale ${stamp}`
  const doomed = `Doomed ${stamp}`
  const resurrected = `Resurrected ${stamp}`
  const item = `Yoghurt ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, doomed)
  await addItem(page, doomed, item)

  // `saveCategory` is an UPSERT with a client-supplied id, so a rename saved
  // against a category someone else has already removed RECREATES it — empty,
  // because its items went with the original removal. That is the documented
  // outcome, not a bug to guard: there is deliberately no client-side existence
  // check, and nothing here asserts the save fails.
  //
  // The stale saver is produced UI-only, one user, two tabs in one context.
  // Tab A (this one) is refetch-driven with no subscription, so it stays stale
  // until it acts.
  const other = await page.context().newPage()
  await other.goto(`/lists/${listId}`)
  await expect(other.getByTestId('list-detail-page')).toBeVisible()
  await other.getByTestId(`category-row-${doomed}`).getByTestId('remove-category-button').click()
  await expect(other.getByTestId('remove-category-dialog')).toBeVisible()
  await other.getByTestId('remove-category-dialog-confirm').click()
  await expect(other.getByTestId('remove-category-dialog')).toHaveCount(0)
  await expect(other.getByTestId(`category-row-${doomed}`)).toHaveCount(0)

  // Tab B parks on the SHOPPING view, where the resurrection arrives over the
  // existing category subscription with no reload.
  await other.goto(`/list/${listId}`)
  await expect(other.getByTestId('list-shopping-page')).toBeVisible()
  await expect(other.getByTestId(`shopping-group-${doomed}`)).toHaveCount(0)

  // THE FIXTURE'S PREMISE, asserted rather than assumed: tab A still shows the
  // removed category. If /lists/:id ever gains a subscription this fails HERE,
  // at its own setup, instead of misreporting further down.
  await expect(page.getByTestId(`category-row-${doomed}`)).toBeVisible()

  // The stale save. It succeeds: the dialog closes (renameCategory awaits that)
  // rather than holding an inline error, and the row below is the proof.
  await renameCategory(page, doomed, resurrected)

  // On the SAVER's management screen the recreation is a plain row with the
  // empty-category line: the item is gone, it went with the removal.
  const recreated = page.getByTestId(`category-row-${resurrected}`)
  await expect(recreated).toBeVisible()
  await expect(recreated.getByText('No items yet.')).toBeVisible()
  await expect(page.getByTestId(`item-row-${item}`)).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${doomed}`)).toHaveCount(0)

  // On the OBSERVER's shopping surface it is NOT a group — that view hides
  // empty groups always (Story 8.5 AC5), and an empty resurrection has nothing
  // to show. Its observable surface there is the category FILTER, whose options
  // come from the array the subscription just upserted. Do not "fix" the missing
  // group; the hiding is by design.
  await expect(other.getByTestId(`shopping-group-${resurrected}`)).toHaveCount(0)
  await withCategoryMenu(other, async () => {
    await expect(other.getByTestId(`filter-category-option-${resurrected}`)).toBeVisible()
    await expect(other.getByTestId(`filter-category-option-${doomed}`)).toHaveCount(0)
  })
  await other.close()
})

test('FR63 — a rejected rename keeps the dialog open and shows the backend message inline', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('lists', 'renamerevoker', testInfo.project.name)
  const member = uniqueUsername('lists', 'renamerevoked', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Revoked rename ${stamp}`
  const original = `Frozen ${stamp}`
  const attempted = `Freezer ${stamp}`

  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, original)

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
    await memberPage.getByTestId(`category-row-${original}`).getByTestId('edit-category-button').click()
    await expect(memberPage.getByTestId('edit-category-dialog')).toBeVisible()
    await memberPage.getByTestId('edit-category-name').fill(attempted)

    // Membership is revoked while the dialog sits open, so the save is rejected
    // server-side. The same mechanism item-editing.spec.ts uses, and the only
    // realistic way to reach the mutation's catch branch — the branch every form
    // convention this dialog inherits exists to protect.
    await gql(`mutation { removeMember(listId: "${listId}", username: "${member}") { id } }`, ownerToken)

    await memberPage.getByTestId('edit-category-submit').click()

    // The dialog stays OPEN with the backend's own message inline — never a
    // toast, and never a silent close that would read as success.
    const alert = memberPage.getByTestId('edit-category-error')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveAttribute('role', 'alert')
    await expect(alert).not.toBeEmpty()
    await expect(memberPage.getByTestId('edit-category-dialog')).toBeVisible()

    // The owner's copy still carries the ORIGINAL name — the rejected rename
    // changed nothing.
    await page.goto(`/lists/${listId}`)
    await expect(page.getByTestId('list-detail-page')).toBeVisible()
    await expect(page.getByTestId(`category-row-${original}`)).toBeVisible()
    await expect(page.getByTestId(`category-row-${attempted}`)).toHaveCount(0)
  } finally {
    await ctx.close()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 9.3 (FR46) — deleting a category deletes its items, for everyone.
//
// The removal is now ONE server-side cascade behind a single `deleteCategory`
// mutation, and the single category DELETED event it emits is authoritative for
// the category's children: the watching client fans it out locally. Both halves
// of that are asserted below, because either one alone is satisfiable by the
// pre-story behaviour.
// ─────────────────────────────────────────────────────────────────────────────

test('FR46 — a category removal takes every one of its items with it on another member\'s shopping view, in ONE request', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('lists', 'cascowner', testInfo.project.name)
  const member = uniqueUsername('lists', 'cascmember', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Shared cascade ${stamp}`
  const doomed = `Doomed ${stamp}`
  const kept = `Kept ${stamp}`
  const doomedItems = [1, 2, 3, 4, 5].map(n => `Doomed ${n} ${stamp}`)
  const keptItem = `Kept item ${stamp}`

  // The WATCHER sits on the `page` fixture, whose /list/:id rendering is what the
  // mandatory mobile gate must cover: browser.newContext() does NOT inherit the
  // project's `use` block, so a hand-built context would silently watch at a
  // desktop viewport on the mobile project. The co-member does the removing from
  // the hand-built context.
  await registerViaUi(page, owner, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, doomed)
  await addCategory(page, kept)
  for (const name of doomedItems) await addItem(page, doomed, name)
  await addItem(page, kept, keptItem)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const memberPage = await ctx.newPage()
    await registerViaUi(memberPage, member, PASSWORD)

    // SETUP ONLY (sharing is Story 5.7's subject): make `member` an accepted
    // member through shareList + acceptInvite with each user's own API token.
    const ownerToken = await loginApi(owner, PASSWORD)
    const memberToken = await loginApi(member, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)

    // The owner parks on the shopping view and never reloads from here.
    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    await expect(page.getByTestId(`shopping-group-${doomed}`)).toBeVisible()
    for (const name of doomedItems) {
      await expect(page.getByTestId(`shopping-item-${name}`)).toBeVisible()
    }

    // The member opens the management screen and removes the category there.
    await memberPage.goto(`/lists/${listId}`)
    await expect(memberPage.getByTestId('list-detail-page')).toBeVisible()
    for (const name of doomedItems) {
      await expect(memberPage.getByTestId(`item-row-${name}`)).toBeVisible()
    }

    // Attached AFTER the setup so the page's own load is not counted. `"DeleteItem"`
    // / `"DeleteCategory"` (quoted) match Apollo's operationName field, not the
    // query text — the same idiom as captureCategorySaves above. This is the half
    // that fails on the pre-story build: the client used to send one DeleteItem
    // per item it happened to hold.
    const deleteOps: string[] = []
    memberPage.on('request', req => {
      if (req.method() !== 'POST' || !req.url().includes('/api/graphql')) return
      const body = req.postData() ?? ''
      if (body.includes('"DeleteCategory"')) deleteOps.push('DeleteCategory')
      if (body.includes('"DeleteItem"')) deleteOps.push('DeleteItem')
    })

    await memberPage.getByTestId(`category-row-${doomed}`).getByTestId('remove-category-button').click()
    await expect(memberPage.getByTestId('remove-category-dialog')).toBeVisible()
    await memberPage.getByTestId('remove-category-dialog-confirm').click()
    await expect(memberPage.getByTestId('remove-category-dialog')).toHaveCount(0)
    await expect(memberPage.getByTestId(`category-row-${doomed}`)).toHaveCount(0)
    for (const name of doomedItems) {
      await expect(memberPage.getByTestId(`item-row-${name}`)).toHaveCount(0)
    }

    // THE WATCHER, with no reload: the group goes, and so does every row under
    // it. Asserting the group alone would pass on the shipped build, where the
    // DELETED event pruned `getCategories` and left the items in the cache.
    await expect(page.getByTestId(`shopping-group-${doomed}`)).toHaveCount(0)
    for (const name of doomedItems) {
      await expect(page.getByTestId(`shopping-item-${name}`)).toHaveCount(0)
    }
    // The CONTROL: a sibling category and its item survive on both screens, so
    // "everything vanished" does not satisfy the assertions above.
    await expect(page.getByTestId(`shopping-group-${kept}`)).toBeVisible()
    await expect(page.getByTestId(`shopping-item-${keptItem}`)).toBeVisible()
    await expect(memberPage.getByTestId(`item-row-${keptItem}`)).toBeVisible()

    // Exactly one request, and it is the category one. Read after the DOM has
    // settled above, so a late DeleteItem cannot land behind the read.
    expect(deleteOps, 'the cascade is the server\'s job: one deleteCategory, no deleteItem').toEqual([
      'DeleteCategory',
    ])
  } finally {
    await ctx.close()
  }
})

test('FR46 — submitting an add into a category removed meanwhile keeps the dialog open with mapped copy', async ({page}, testInfo) => {
  const username = uniqueUsername('lists', 'staleadd', testInfo.project.name)
  const stamp = Date.now()
  const listName = `Stale add ${stamp}`
  const doomed = `Doomed ${stamp}`
  const itemName = `Never saved ${stamp}`

  await registerViaUi(page, username, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, doomed)

  // The dialog is opened and the category PICKED before it goes away — the stale
  // option the dialog is still holding is the whole fixture, so this cannot use
  // the addItem helper (which submits).
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await page.getByTestId('add-item-name').fill(itemName)
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${doomed}`).click()

  // Removed OUT OF BAND while the dialog holds it. /lists/:id is refetch-driven
  // with no subscription (AR-E8-6) and the dialog snapshots its options on open,
  // so a co-member's removal is indistinguishable from this one from the open
  // dialog's point of view; the extra member would only slow the run down.
  const token = await loginApi(username, PASSWORD)
  const {getCategories} = await gql<{getCategories: {id: string; name: string}[]}>(
    `{ getCategories(listId: "${listId}") { id name } }`,
    token,
  )
  const doomedId = getCategories.find(c => c.name === doomed)?.id
  expect(doomedId, 'the fixture category was found before it is removed').toBeTruthy()
  await gql(`mutation { deleteCategory(id: "${doomedId}", listId: "${listId}") { id } }`, token)

  await page.getByTestId('add-item-submit').click()

  // Story 9.3 closed the CREATE hole, so this is now REJECTED rather than saved
  // as a fresh orphan — and the message is mapped, not the raw
  // "Category <uuid> does not belong to list <uuid>" the backend throws.
  const error = page.getByTestId('add-item-error')
  await expect(error).toBeVisible()
  await expect(error).toHaveText(/category no longer exists/i)
  // The dialog STAYS OPEN with the typed name intact: the user's next step is to
  // pick another category, which is impossible if the work is thrown away.
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await expect(page.getByTestId('add-item-name')).toHaveValue(itemName)
  await expect(page.getByTestId(`item-row-${itemName}`)).toHaveCount(0)
})
