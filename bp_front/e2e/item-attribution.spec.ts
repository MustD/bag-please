import {expect, test} from '@playwright/test'

import {gql, loginApi} from './support/api'
import {addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Item Attribution E2E (Story 7.4, FR45 + FR58). Every asserted behaviour is
// UI-driven. There is exactly one non-UI use, named and justified:
//   1. membership seeding for the two-actor scenario (the sharing UI is Story
//      5.7's subject) — environment prep only, same rationale as
//      item-editing.spec.ts / global-setup.ts.
//
// Runs on chromium + mobile (Pixel 7); the mobile gate is mandatory. The scenario
// registers FRESH unique users through the register UI (`admin` is blocked from
// all list resources) and asserts only on data it created — the ./db/data volume
// persists across runs and both projects run concurrently.
//
// What this guards: `saveItem` used to reconstruct the item from `ItemInput`,
// which carries neither `addedBy` nor `checkedAt`, so any edit re-stamped
// authorship with whoever last saved (BUG-E6-1). The shopping view at
// /list/:id is the only surface that renders `addedBy`, and it had zero E2E
// coverage before this spec.

test('FR45/FR58 — a co-member editing an item does not steal the original author\'s attribution', async ({browser, page, baseURL}, testInfo) => {
  const author = uniqueUsername('attrib', 'author', testInfo.project.name)
  const editor = uniqueUsername('attrib', 'editor', testInfo.project.name)
  const listName = `Attributed ${Date.now()}`
  const categoryName = `Pantry ${Date.now()}`
  const before = `Olive oil ${Date.now()}`
  const after = `Extra virgin olive oil ${Date.now()}`

  // The AUTHOR — whose /list/:id rendering is the thing asserted, and therefore
  // the thing the mandatory mobile gate must actually cover — sits on the `page`
  // fixture, because browser.newContext() does NOT inherit the project's `use`
  // block and a hand-built context would silently run at a desktop viewport on
  // the `mobile` project. So the EDITOR is the one in the hand-built context;
  // that also makes the editor a co-member rather than the owner, which is the
  // case the bug was reported against.
  await registerViaUi(page, author, PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, listName)
  await addCategory(page, categoryName)
  await addItem(page, categoryName, before)

  const ctx = await browser.newContext({baseURL, ignoreHTTPSErrors: true})
  try {
    const editorPage = await ctx.newPage()
    await registerViaUi(editorPage, editor, PASSWORD)

    // SETUP ONLY (sharing UI is Story 5.7): make `editor` an accepted member of
    // the list via the backend shareList (author) + acceptInvite (editor)
    // mutations, each with its own API login token. Not the asserted behaviour.
    const authorToken = await loginApi(author, PASSWORD)
    const editorToken = await loginApi(editor, PASSWORD)
    await gql(`mutation { shareList(listId: "${listId}", username: "${editor}") { id } }`, authorToken)
    await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, editorToken)

    // The author parks on the shopping view and stays there until the reload at
    // the end of the test.
    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    // toContainText, not toHaveText: this Stack holds the avatar initial AND the
    // username, so toHaveText would compare against "Aattrib_e2e_author_…".
    await expect(page.getByTestId(`shopping-item-addedby-${before}`)).toContainText(author)

    // The co-member renames the item from the management screen. The new name must
    // genuinely differ from the old one: EditItemDialog short-circuits and sends
    // no mutation at all when nothing changed, and this test would then assert
    // nothing while passing.
    await editorPage.goto(`/lists/${listId}`)
    await expect(editorPage.getByTestId('list-detail-page')).toBeVisible()
    // edit-item-button is NOT unique — one lives inside every item-row — so scope
    // it to the row under test.
    await editorPage.getByTestId(`item-row-${before}`).getByTestId('edit-item-button').click()
    await expect(editorPage.getByTestId('edit-item-dialog')).toBeVisible()
    await editorPage.getByTestId('edit-item-name').fill(after)
    await editorPage.getByTestId('edit-item-submit').click()
    await expect(editorPage.getByTestId('edit-item-dialog')).toHaveCount(0)
    await expect(editorPage.getByTestId('edit-item-error')).toHaveCount(0)
    await expect(editorPage.getByTestId(`item-row-${after}`)).toBeVisible()

    // Live on the author's parked page, through the existing per-list
    // subscription (which selects addedBy). The testid interpolates the ITEM
    // name, so it changes with the rename — and the attribution behind it must
    // still be the author.
    await expect(page.getByTestId(`shopping-item-addedby-${after}`)).toContainText(author)
    await expect(page.getByTestId(`shopping-item-addedby-${after}`)).not.toContainText(editor)

    // Again after a reload, so the assertion is about what the server stored and
    // not about the cache the subscription merged into.
    await page.reload()
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    await expect(page.getByTestId(`shopping-item-addedby-${after}`)).toContainText(author)
    await expect(page.getByTestId(`shopping-item-addedby-${after}`)).not.toContainText(editor)
  } finally {
    await ctx.close()
  }
})
