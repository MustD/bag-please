import {expect, type Page, test} from '@playwright/test'

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

const PASSWORD = 'e2e-password-123'

function uniqueUsername(label: string, projectName: string): string {
  return `lists_e2e_${label}_${projectName}_${Date.now()}`
}

// Register a brand-new account through the UI and land authenticated on home
// (FR1/FR4). Registration is enabled by global-setup.
async function registerViaUi(page: Page, username: string, password: string): Promise<void> {
  // Registration is enabled by global-setup, but the admin-panel spec briefly
  // toggles the SHARED backend registration flag OFF and back ON while the two
  // projects run concurrently (documented shared-state hazard). AuthPage reads
  // the flag only on mount, so reload /auth until the Register link appears
  // rather than failing on that transient window — this preserves the assertion,
  // it just doesn't race the flag.
  await expect(async () => {
    await page.goto('/auth')
    await expect(page.getByTestId('to-register-link')).toBeVisible({timeout: 1500})
  }).toPass({timeout: 20000})
  await page.getByTestId('to-register-link').click()
  await page.getByTestId('register-username').fill(username)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-submit').click()
  // `/` is now a redirect (Story 5.6): a brand-new user lands on /lists, not a
  // home placeholder. Assert route-agnostic authentication (off /auth + the
  // shared app-bar visible) rather than a specific landing URL/testid.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
}

// Open the lists index via the AppShell user-menu affordance (not by navigating
// to /lists directly) — proves the nav entry routes there.
async function openListsViaMenu(page: Page): Promise<void> {
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-lists').click()
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
}

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
  const username = uniqueUsername('zero', testInfo.project.name)
  await registerViaUi(page, username, PASSWORD)

  await openListsViaMenu(page)

  // A fresh user owns no lists: the onboarding zero-state (not a spinner, not a
  // list) is shown with a first-list call to action.
  await expect(page.getByTestId('lists-empty')).toBeVisible()
  await expect(page.getByTestId('lists-empty-create')).toBeVisible()
  await expect(page.getByTestId('lists-loading')).toHaveCount(0)
})

test('FR34/FR46/FR51 — golden path: create list, add category + item, remove both, delete list', async ({page}, testInfo) => {
  const username = uniqueUsername('golden', testInfo.project.name)
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
  const username = uniqueUsername('cascade', testInfo.project.name)
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
  const owner = uniqueUsername('owner', testInfo.project.name)
  const other = uniqueUsername('other', testInfo.project.name)
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
  const owner = uniqueUsername('roleowner', testInfo.project.name)
  const member = uniqueUsername('rolemember', testInfo.project.name)
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
