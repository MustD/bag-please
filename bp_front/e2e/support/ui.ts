import {expect, type Page} from '@playwright/test'

import {ADMIN} from './api'

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
//      keeps its own namespace (`acct`, `admin`, `attrib`, `lists`, `nav`,
//      `sharing`, `shopping`, `item_editing`).

export const PASSWORD = 'e2e-password-123'

// The guaranteed first-boot admin — one definition for the whole suite
// (NFR-E8-5), declared in ./api.ts so the runner-free setup/teardown phases can
// share it, and re-exported here for the specs.
export {ADMIN}

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

// Sign in through the login form. Any account — the admin included.
export async function loginViaUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/auth')
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

// Sign in as the admin and open the panel through the role-gated menu
// affordance (FR30) — never by navigating to /admin directly.
//
// Moved here from admin.spec.ts by Story 9.2: narrow-viewport.spec.ts needs the
// same entry to assert the /admin floor, and a second copy in a spec is the
// duplication NFR-E8-5 forbids.
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginViaUi(page, ADMIN.username, ADMIN.password)
  // Admin lands on /admin via the `/` redirect (Story 5.6); assert authenticated
  // route-agnostically, then reach the panel through the role-gated menu.
  await expect(page).not.toHaveURL(/\/auth$/)
  await expect(page.getByTestId('app-bar')).toBeVisible()
  await page.getByTestId('user-menu-button').click()
  await page.getByTestId('menu-admin').click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('admin-page')).toBeVisible()
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

// Owner-side sharing through the Share & Members dialog (UI, never the
// shareList/acceptInvite API). Lives here rather than in a spec because two
// specs drive it since Story 9.4 — sharing.spec.ts and admin.spec.ts — and a
// second copy in a spec is the duplication NFR-E8-5 forbids.
//
// `openShareDialog` leaves the dialog OPEN so the caller can assert on the
// members list or on an error.
export async function openShareDialog(page: Page, listName: string): Promise<void> {
  await page.getByTestId(`manage-members-${listName}`).click()
  await expect(page.getByTestId('share-members-dialog')).toBeVisible()
}

export async function shareWith(page: Page, listName: string, username: string): Promise<void> {
  await openShareDialog(page, listName)
  await page.getByTestId('share-username-input').fill(username)
  await page.getByTestId('share-submit').click()
}

export async function addCategory(page: Page, name: string): Promise<void> {
  await page.getByTestId('add-category-button').click()
  await expect(page.getByTestId('add-category-dialog')).toBeVisible()
  await page.getByTestId('add-category-name').fill(name)
  await page.getByTestId('add-category-submit').click()
  await expect(page.getByTestId('add-category-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`category-row-${name}`)).toBeVisible()
}

// Add an item through the overlay. `stores` exercises the store field on the ADD
// dialog (Story 6.1, multi-value since Story 9.6); omit it to leave the item
// store-less.
export async function addItem(
  page: Page,
  categoryName: string,
  itemName: string,
  stores?: readonly string[],
): Promise<void> {
  await page.getByTestId('add-item-button').click()
  await expect(page.getByTestId('add-item-dialog')).toBeVisible()
  await page.getByTestId('add-item-name').fill(itemName)
  // Scoped role=combobox: the category Select must stay the ONLY combobox in
  // this dialog, which is why the store field is a plain input with Chip
  // suggestions rather than an Autocomplete. Story 9.6 KEPT that constraint when
  // the field went multi-value, and this line is what enforces it.
  await page.getByTestId('add-item-dialog').getByRole('combobox').click()
  await page.getByTestId(`add-item-category-option-${categoryName}`).click()
  // Each name is committed with Enter — the store field's commit key, which
  // preventDefaults so it adds a chip instead of submitting the form.
  for (const store of stores ?? []) {
    await page.getByTestId('add-item-store').fill(store)
    await page.getByTestId('add-item-store').press('Enter')
    await expect(page.getByTestId(`add-item-store-chip-${store.trim()}`)).toBeVisible()
  }
  await page.getByTestId('add-item-submit').click()
  await expect(page.getByTestId('add-item-dialog')).toHaveCount(0)
  await expect(page.getByTestId(`item-row-${itemName}`)).toBeVisible()
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 8.4 (FR61) — the shared category filter, and the ONE fact every spec
// that drives it has to know.
//
// THE MENU NO LONGER SELF-CLOSES. A single MUI Select closes on selection; the
// `multiple` one this story ships deliberately does not, so several categories
// can be picked without reopening it. Every interaction therefore needs an
// explicit dismissal, and without it the NEXT click silently lands on the menu
// backdrop instead of the control it names — a failure that reads as "the app
// ignored my click".
//
// That fact lives here once. Three specs drive this menu (shopping, lists,
// narrow-viewport); three copies of the dismissal would mean the next change to
// how the menu closes has to be made in three places, which is the duplication
// NFR-E8-5 is about — the same rule that put the filter itself in one module.
// ─────────────────────────────────────────────────────────────────────────────

// Open the category menu, run `body` against it, and dismiss it. The
// post-condition is asserted, so a body that closes the menu itself (or a future
// Select that goes back to self-closing) cannot leave this passing by accident.
export async function withCategoryMenu(page: Page, body: () => Promise<void>): Promise<void> {
  await page.getByTestId('filter-category').click()
  await expect(page.getByTestId('filter-category-option-all')).toBeVisible()
  await body()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('filter-category-option-all')).toHaveCount(0)
}

// Count GraphQL round trips (AC6). EVERY POST to the endpoint, not a named
// operation, so a `refetch` introduced under any name is caught. Attach it only
// AFTER the page's own load has settled, or it measures the load rather than the
// filtering; read it after a settle, so a late request cannot land behind the
// read. Mirrors `countToggleRequests` in shopping.spec.ts, which stays there
// because it is specific to the FR60 check/uncheck mutations.
export function countGraphqlRequests(page: Page): () => number {
  let calls = 0
  page.on('request', r => {
    if (r.method() === 'POST' && r.url().includes('/api/graphql')) calls++
  })
  return () => calls
}

// Count WebSockets opened from here on (AC6's other half). A GraphQL
// SUBSCRIPTION rides `graphql-ws` and registers ZERO POSTs, so the request
// counter above is blind to one — and "the management screen gains no
// `subscribeToMore`" (AR-E8-6) would otherwise be discharged by construction
// rather than asserted. `/lists/:id` stays refetch-driven by Story 6.1's design.
export function countWebSockets(page: Page): () => number {
  let sockets = 0
  page.on('websocket', () => {
    sockets++
  })
  return () => sockets
}
