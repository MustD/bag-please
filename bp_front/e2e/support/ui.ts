import {expect, type Page} from '@playwright/test'

// Shared UI-driven E2E helpers (Story 7.2 extraction). Three facts every spec
// header used to repeat, stated once here:
//
//   1. UI-driven only — these helpers drive the rendered affordances and never
//      an API shortcut. The only non-UI use anywhere is environment SETUP, which
//      lives in ./api.ts (plus the one-time registration-enable in
//      global-setup.ts).
//   2. Every spec runs on both the chromium and mobile (Pixel 7) projects (see
//      playwright.config.ts); the mobile gate is mandatory.
//   3. Every scenario registers a FRESH unique user per run/project — `admin` is
//      blocked from all list resources and there is no seeded regular account,
//      while the ./db/data volume persists across runs and the two projects run
//      concurrently — so tests only ever assert on data they created, never on
//      totals. `uniqueUsername` therefore takes the CALLER's prefix: each spec
//      keeps its own namespace (`acct`, `admin`, `lists`, `nav`, `sharing`,
//      `shopping`, `item_editing`).

export const PASSWORD = 'e2e-password-123'

export function uniqueUsername(prefix: string, label: string, projectName: string): string {
  return `${prefix}_e2e_${label}_${projectName}_${Date.now()}`
}

// Register a brand-new account through the UI and land authenticated on home
// (FR1/FR4). Registration is enabled by global-setup.
export async function registerViaUi(page: Page, username: string, password: string): Promise<void> {
  // A plain goto, deliberately: registration is ON for the entire time any spec
  // in `chromium`/`mobile` runs. The one test that flips it OFF is tagged
  // `@registration-toggle` and routed into projects chained behind both viewport
  // projects (Story 7.3), so there is no window to retry through. The
  // `expect(async () => …)` reload-until-visible wrapper that used to guard these
  // two lines was deleted with the race — keeping it "just in case" would make
  // the next flake here invisible. If this goto ever fails again, that is a real
  // regression and it must be allowed to say so.
  await page.goto('/auth')
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
export async function openListsViaMenu(page: Page): Promise<void> {
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-lists').click()
  await expect(page).toHaveURL(/\/lists$/)
  await expect(page.getByTestId('lists-page')).toBeVisible()
}

// Create a list via the index overlay and open its management detail; returns the
// list id (parsed from the /lists/:id URL) so both /lists/:id and the shopping
// view /list/:id can be reached directly.
export async function createListAndOpen(page: Page, name: string): Promise<string> {
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

export async function addCategory(page: Page, name: string): Promise<void> {
  await page.getByTestId('add-category-button').click()
  await expect(page.getByTestId('add-category-dialog')).toBeVisible()
  await page.getByTestId('add-category-name').fill(name)
  await page.getByTestId('add-category-submit').click()
  await expect(page.getByTestId('add-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${name}`)).toBeVisible()
}

// Add an item through the overlay. `store` exercises the Story 6.1 store field
// on the ADD dialog; omit it to leave the item store-less.
export async function addItem(page: Page, categoryName: string, itemName: string, store?: string): Promise<void> {
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await page.getByTestId('add-item-name').fill(itemName)
  // Scoped role=combobox: the category Select must stay the ONLY combobox in
  // this dialog, which is why the store field is a plain input with Chip
  // suggestions rather than an Autocomplete.
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${categoryName}`).click()
  if (store !== undefined) await page.getByTestId('add-item-store').fill(store)
  await page.getByTestId('add-item-submit').click()
  await expect(page.getByTestId('add-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
}
