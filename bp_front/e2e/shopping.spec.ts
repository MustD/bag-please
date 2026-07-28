import {expect, type Page, test} from '@playwright/test'

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

const PASSWORD = 'e2e-password-123'

// Backend for API-only SETUP (membership seeding + token minting). Hit the Caddy
// entrypoint on :2080 directly — same rationale as global-setup.ts — independent
// of E2E_BASE_URL, which only controls the browser-facing origin under test.
const BACKEND = 'http://localhost:2080'

function uniqueUsername(label: string, projectName: string): string {
  return `shopping_e2e_${label}_${projectName}_${Date.now()}`
}

// Register a brand-new account through the UI and land authenticated. Hardened
// against the documented shared registration-flag race (admin.spec briefly flips
// the flag OFF while projects run concurrently; AuthPage reads it only on mount)
// by reloading /auth until the Register link appears — mirrors lists.spec.
async function registerViaUi(page: Page, username: string, password: string): Promise<void> {
  await expect(async () => {
    await page.goto('/auth')
    await expect(page.getByTestId('to-register-link')).toBeVisible({timeout: 1500})
  }).toPass({timeout: 20000})
  await page.getByTestId('to-register-link').click()
  await page.getByTestId('register-username').fill(username)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-submit').click()
  // `/` is a redirect (Story 5.6); a new user lands on /lists. Assert auth
  // route-agnostically.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
}

async function openListsViaMenu(page: Page): Promise<void> {
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-lists').click()
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
}

// Create a list via the index overlay and open its management detail; returns
// the list id (parsed from the /lists/:id URL) so the shopping view /list/:id
// can be reached directly.
async function createListAndOpen(page: Page, name: string): Promise<string> {
  await page.getByTestId('create-list-button').click()
  await expect(page.getByTestId('create-list-dialog')).toBeVisible()
  await page.getByTestId('create-list-name').fill(name)
  await page.getByTestId('create-list-submit').click()
  await expect(page.getByTestId('create-list-dialog')).toHaveCount(0)
  await page.getByTestId(`list-open-${name}`).click()
  await expect(page).toHaveURL(/\/lists\/[^/]+$/)
  await expect(page.getByTestId('list-detail-page')).toBeVisible()
  return page.url().split('/lists/')[1]
}

async function addCategory(page: Page, name: string): Promise<void> {
  await page.getByTestId('add-category-button').click()
  await expect(page.getByTestId('add-category-dialog')).toBeVisible()
  await page.getByTestId('add-category-name').fill(name)
  await page.getByTestId('add-category-submit').click()
  await expect(page.getByTestId('add-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${name}`)).toBeVisible()
}

async function addItem(page: Page, categoryName: string, itemName: string): Promise<void> {
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await page.getByTestId('add-item-name').fill(itemName)
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${categoryName}`).click()
  await page.getByTestId('add-item-submit').click()
  await expect(page.getByTestId('add-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
}

// --- API-only setup helpers (membership seeding) ---

async function loginApi(username: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password}),
  })
  if (!res.ok) throw new Error(`API login failed for ${username}: ${res.status}`)
  const {accessToken} = (await res.json()) as {accessToken: string}
  return accessToken
}

async function gql(query: string, token: string): Promise<void> {
  const res = await fetch(`${BACKEND}/api/graphql`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify({query}),
  })
  const body = (await res.json()) as {errors?: unknown}
  if (!res.ok || body.errors) {
    throw new Error(`GraphQL setup call failed: ${res.status} ${JSON.stringify(body.errors)}`)
  }
}

test('FR40 — checking an item persists across a reload, and it can be unchecked', async ({page}, testInfo) => {
  const username = uniqueUsername('check', testInfo.project.name)
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
  const checkbox = page.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox')
  await expect(checkbox).not.toBeChecked()

  // The checkbox is controlled by server state (no optimistic flip), so click
  // once and let the assertion poll for the mutation's normalized-cache update
  // rather than using check()/uncheck() (which re-click on a state mismatch).
  await checkbox.click()
  await expect(checkbox).toBeChecked()

  // Persists across a full reload (server truth, not just local UI state).
  await page.reload()
  await expect(page.getByTestId('list-shopping-page')).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox')).toBeChecked()

  // Uncheck it back.
  await page.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox').click()
  await expect(page.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox')).not.toBeChecked()
})

test('reframe 7.1 — category, checked-status and search filters each narrow the visible items', async ({page}, testInfo) => {
  const username = uniqueUsername('filters', testInfo.project.name)
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

  // Category filter: pick Produce → only Bananas remains.
  await page.getByTestId('filter-category').click()
  await page.getByTestId(`filter-category-option-${produce}`).click()
  await expect(page.getByTestId(`shopping-item-${bananas}`)).toBeVisible()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toHaveCount(0)
  // Reset to all categories.
  await page.getByTestId('filter-category').click()
  await page.getByTestId('filter-category-option-all').click()
  await expect(page.getByTestId(`shopping-item-${bread}`)).toBeVisible()

  // Checked-status filter: check Bananas, then "To buy" hides it (Bread remains),
  // and "Done" shows only it. Wait for the checked state to settle (async cache)
  // before filtering.
  const bananasCheckbox = page.getByTestId(`shopping-item-${bananas}`).getByRole('checkbox')
  await bananasCheckbox.click()
  await expect(bananasCheckbox).toBeChecked()
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
  const username = uniqueUsername('redirect', testInfo.project.name)
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
  const username = uniqueUsername('switch', testInfo.project.name)
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
  await page.getByTestId('filter-category').click()
  await page.getByTestId(`filter-category-option-${catA}`).click()
  await expect(page.getByTestId(`shopping-item-${itemA}`)).toBeVisible()

  // Switch to list B via the switcher chip: URL + header follow the active list,
  // and the category filter (A's category id) is reset so B's items are NOT
  // hidden as "no matches".
  await page.getByTestId(`switcher-chip-${listB}`).click()
  await expect(page).toHaveURL(/\/list\/[^/]+$/)
  await expect(page.getByTestId('shopping-header')).toContainText(listB)
  await expect(page.getByTestId(`shopping-item-${itemB}`)).toBeVisible()
  await expect(page.getByTestId('shopping-no-matches')).toHaveCount(0)
})

test('FR52 — a check by one member appears live in another member\'s view without a refresh', async ({browser, page, baseURL}, testInfo) => {
  const owner = uniqueUsername('owner', testInfo.project.name)
  const member = uniqueUsername('member', testInfo.project.name)
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
    const ownerCheckbox = page.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox')
    await expect(ownerCheckbox).not.toBeChecked()

    // Member opens the same list and checks the item via the UI.
    await memberPage.goto(`/list/${listId}`)
    await expect(memberPage.getByTestId('list-shopping-page')).toBeVisible()
    const memberCheckbox = memberPage.getByTestId(`shopping-item-${itemName}`).getByRole('checkbox')
    await memberCheckbox.click()
    await expect(memberCheckbox).toBeChecked()

    // The owner's view reflects the check LIVE — no reload (FR52 realtime).
    await expect(ownerCheckbox).toBeChecked()
  } finally {
    await ctx.close()
  }
})
