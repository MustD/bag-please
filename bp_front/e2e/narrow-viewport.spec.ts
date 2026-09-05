import {expect, test, type Locator, type Page} from '@playwright/test'
import {expectNoHorizontalOverflow, expectNotClipped, NARROW_FLOOR_PX} from './support/layout'
import {addCategory, addItem, createListAndOpen, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Story 8.1 — Move the Mobile Gate to the Width People Actually Use.
//
// ═══ RED PHASE (ATDD). Every test here is `test.skip()` on purpose. ═══
//
// These are not "tests that will pass once someone writes the feature". They are
// the story's own proof obligations, and three of them are expected to FAIL the
// moment they are un-skipped, against the layout as shipped today:
//
//   [P0] mobile project renders at the 320px floor   → fails: viewport is 412
//   [P0] item name is not clipped at the floor       → fails: noWrap + maxWidth xs:150
//   [P0] list title is not clipped at the floor      → fails: noWrap + maxWidth xs:200
//
// That failure IS Story 8.1's AC4: `expectNotClipped` must be OBSERVED failing
// against /lists/:id's item name and list title at 320px before it is accepted.
// A helper nobody has seen fail is not a gate, it is a decoration.
//
// Two tests here are declared CONTROLS and pass today. They are labelled so
// nobody mistakes a control for evidence that the fix worked (test-quality.md:
// an assertion already true before the action is a hollow green).
//
// Activation order for the developer:
//   1. Un-skip the viewport tests, retarget playwright.config.ts, watch them go green.
//   2. Un-skip the clipping tests. Watch them go RED. Record that. (AC4)
//   3. Story 8.2 fixes the layout; they go green there, not here.

// ─────────────────────────────────────────────────────────────────────────────
// Locators for the three text elements under measurement.
//
// ⚠️ OPEN DECISION — these three testids DO NOT EXIST YET (see the ATDD
// checklist, Step 3 § "Three missing selectors"). `expectNotClipped` must
// target the TEXT element, because measuring the row would measure the wrong
// box. None of the three Typography elements in ListDetailPage.tsx carries a
// testid today:
//
//   list title    ListDetailPage.tsx:101   → proposed data-testid="list-detail-title"
//   category name ListDetailPage.tsx:158   → proposed data-testid="category-name"
//   item name     ListDetailPage.tsx:224   → proposed data-testid="item-name"
//
// Reaching them structurally instead — getByTestId('item-row-X').locator('p') —
// is what selector-resilience warns against, and Story 8.2 rewrites these very
// elements, so a structural path breaks in the next story. Adding the three
// attributes is a change under bp_front/src/, which Story 8.1's Files list does
// not name (AC5 restricts only bp_back/). Awaiting md's call.
//
// Kept in one place so the decision costs one edit.
// ─────────────────────────────────────────────────────────────────────────────
const listTitle = (page: Page): Locator => page.getByTestId('list-detail-title')
const categoryName = (page: Page, name: string): Locator =>
  page.getByTestId(`category-row-${name}`).getByTestId('category-name')
const itemName = (page: Page, name: string): Locator =>
  page.getByTestId(`item-row-${name}`).getByTestId('item-name')

// Long enough to overflow at 320px, short enough to stay under the 100-char
// limit AddCategoryDialog enforces. Named, not inlined, per data-factories.md.
const LONG_LIST_NAME = 'Weekly big shop for the whole household'
const LONG_CATEGORY_NAME = 'Refrigerated dairy and chilled desserts'
const LONG_ITEM_NAME = 'Semi-skimmed organic milk two litre bottle'

// Every scenario registers a FRESH unique user and asserts only on data it
// created — the suite-wide rule in support/ui.ts. Namespace prefix: `narrow`.
async function openListAtFloor(page: Page, projectName: string): Promise<void> {
  await registerViaUi(page, uniqueUsername('narrow', 'floor', projectName), PASSWORD)
  await createListAndOpen(page, LONG_LIST_NAME)
  await addCategory(page, LONG_CATEGORY_NAME)
  await addItem(page, LONG_CATEGORY_NAME, LONG_ITEM_NAME)
}

test.describe('Story 8.1: the narrow viewport gate (ATDD red phase)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // AC2 — the mobile project renders at the NFR-E8-1 floor.
  // ───────────────────────────────────────────────────────────────────────────

  test.skip('[P0] the mobile project renders at the 320px floor', async ({page}, testInfo) => {
    // RED: fails today. playwright.config.ts:103 is `{...devices['Pixel 7']}`,
    // whose width is 412 — a value never chosen for a reason and unexamined
    // since Story 5.1 (AR-E8-1).
    test.skip(testInfo.project.name !== 'mobile', 'asserts the mobile project descriptor')

    const viewport = page.viewportSize()
    expect(viewport, 'the mobile project must emulate a device, not inherit a window size').not.toBeNull()
    expect(viewport?.width, 'NFR-E8-1 floor').toBe(NARROW_FLOOR_PX)
  })

  test.skip('[P1] CONTROL — retargeting keeps Chrome-on-Android UA and touch emulation', async ({page}, testInfo) => {
    // PASSES TODAY and must keep passing. AC2 requires the devices['Pixel 7']
    // descriptor be RETAINED and only its viewport width overridden. This is the
    // guard against "fix" meaning "replace the descriptor", which would silently
    // drop the touch emulation Story 8.3's scroll-guard depends on.
    test.skip(testInfo.project.name !== 'mobile', 'asserts the mobile project descriptor')

    await page.goto('/auth')
    const ua = await page.evaluate(() => navigator.userAgent)
    expect(ua, 'Pixel 7 descriptor UA').toContain('Android')
    expect(ua, 'Pixel 7 descriptor UA').toContain('Chrome')

    const touch = await page.evaluate(() => navigator.maxTouchPoints > 0)
    expect(touch, 'touch emulation from the Pixel 7 descriptor').toBe(true)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // AC4 — expectNotClipped is the load-bearing half, and it is proven by being
  // seen to fail. These two ARE the red phase.
  // ───────────────────────────────────────────────────────────────────────────

  test.skip('[P0] RED — a long item name is not clipped at the floor (report #2)', async ({page}, testInfo) => {
    // EXPECTED TO FAIL against the shipped layout. ListDetailPage.tsx:224 renders
    // the item name `noWrap` under `maxWidth: {xs: 150}`, so at 320px the user
    // sees an ellipsis where the item is. Do NOT "fix" this test when it goes
    // red — record the failure. Story 8.2 makes it green.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo.project.name)
    await expectNotClipped(itemName(page, LONG_ITEM_NAME))
  })

  test.skip('[P0] RED — a long list title is not clipped at the floor (report #3)', async ({page}, testInfo) => {
    // EXPECTED TO FAIL. ListDetailPage.tsx:101 renders the title `noWrap` under
    // `maxWidth: {xs: 200}` beside two buttons. Report #3 is a SQUEEZE, not an
    // overflow (AR-E8-3 corrected): `noWrap`'s `overflow: hidden` already
    // resolves the title's min-width to zero, so it shrinks to an ellipsis while
    // the buttons take the width. `minWidth: 0` is a no-op here and is not the
    // fix.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo.project.name)
    await expectNotClipped(listTitle(page))
  })

  test.skip('[P0] the helper PASSES on text that fits (falsifiability control)', async ({page}, testInfo) => {
    // The mirror of the two above. An assertion that fails on everything is as
    // useless as one that passes on everything, and this is the only run in
    // which anyone will look. A short name at the floor must be reported as NOT
    // clipped — otherwise the two reds above prove nothing about the layout and
    // everything about a broken helper.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await registerViaUi(page, uniqueUsername('narrow', 'fits', testInfo.project.name), PASSWORD)
    await createListAndOpen(page, 'Shop')
    await addCategory(page, 'Veg')
    await addItem(page, 'Veg', 'Peas')

    await expectNotClipped(listTitle(page))
    await expectNotClipped(categoryName(page, 'Veg'))
    await expectNotClipped(itemName(page, 'Peas'))
  })

  // ───────────────────────────────────────────────────────────────────────────
  // AC4 — expectNoHorizontalOverflow, the other half, and its own falsifiability.
  // ───────────────────────────────────────────────────────────────────────────

  test.skip('[P1] CONTROL — the page does not scroll horizontally at the floor', async ({page}, testInfo) => {
    // PASSES TODAY, and AR-E8-3a is exactly that point: this check is green
    // while reports #2 and #3 are on screen, because a clipped element does not
    // expand its ancestors. Kept for the class of defect it DOES catch — Story
    // 8.6 adds a third control to the category row, which is where a genuine
    // page-widening becomes likely.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo.project.name)
    await expectNoHorizontalOverflow(page)
  })

  test.skip('[P1] expectNoHorizontalOverflow is capable of failing', async ({page}, testInfo) => {
    // BEYOND AC4 — flagged as an addition in the ATDD checklist, not smuggled in.
    // A document-level check that is green on every screen is indistinguishable
    // from one that is wired wrong, and this story is the only place it will
    // ever be examined. Force a real overflow and require the helper to report
    // it. The DOM injection is confined to this control and touches no
    // application code.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo.project.name)
    await page.evaluate(width => {
      const bar = document.createElement('div')
      bar.id = 'atdd-overflow-probe'
      bar.style.cssText = `width:${width * 3}px;height:1px;`
      document.body.appendChild(bar)
    }, NARROW_FLOOR_PX)

    await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(/scrolls horizontally/)

    await page.evaluate(() => document.getElementById('atdd-overflow-probe')?.remove())
    await expectNoHorizontalOverflow(page)
  })
})
