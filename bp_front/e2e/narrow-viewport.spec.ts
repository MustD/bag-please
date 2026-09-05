import {expect, test, type Locator, type Page} from '@playwright/test'
import {expectNoHorizontalOverflow, expectNotClipped, NARROW_FLOOR_PX} from './support/layout'
import {addCategory, addItem, createListAndOpen, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Story 8.1 — Move the Mobile Gate to the Width People Actually Use.
//
// ═══ RED PHASE (ATDD). Activated 2026-09-05 — THREE tests are EXPECTED RED. ═══
//
// These are not "tests that will pass once someone writes the feature". They are
// the story's own proof obligations. Against the layout as shipped today:
//
//   [P0] mobile project renders at the 320px floor    → GREEN once the config is
//        retargeted (was 412 before Story 8.1)
//   [P0] long item name is not clipped                → RED: noWrap + maxWidth xs:150
//   [P0] long list title is not clipped               → RED: noWrap + maxWidth xs:200
//   [P0] SHORT list title is not clipped              → RED: the header box is 68px
//        at 320px and "Shop" needs 79 — report #3 is worse than it was reported
//
// All three reds carry `test.fail()`. That is not a way of hiding them: the
// assertion still runs and is still observed failing, which is AC4's evidence.
// It keeps the RUN green, and the run has to be green because a permanently-red
// `mobile` project would (a) make every future regression indistinguishable from
// these planned reds and (b) strand the `registration-toggle-*` projects at "did
// not run" — they declare `dependencies: ['chromium','mobile']` — leaving
// FR20/FR21 unverified on every single run.
//
// FOR STORY 8.2: when the layout is fixed, these three report "expected to fail,
// but passed" and turn the run red until the `test.fail()` lines are removed.
// That unexpected pass is the handoff signal. Note the third one specifically:
// the 68px is a flex-distribution result of the two header buttons taking the
// row, so relaxing the `maxWidth` caps will not discharge it.
//
// Three tests here are declared CONTROLS and pass today. They are labelled so
// nobody mistakes a control for evidence that the fix worked (test-quality.md:
// an assertion already true before the action is a hollow green).
//
// Activation record:
//   1. playwright.config.ts retargeted to 320px; the two viewport tests went green.
//   2. The remaining five were un-skipped; the clipping tests went RED. (AC4)
//   3. The falsifiability control was found to abort on its first assertion (the
//      title), leaving no committed proof the helper can PASS — so it was split:
//      the category/item half is green today, the title half is a third red.
//   4. Story 8.2 fixes the layout; all three go green there, not here.

// ─────────────────────────────────────────────────────────────────────────────
// Locators for the three text elements under measurement.
//
// DECIDED 2026-09-05 (md): the three testids were ADDED to ListDetailPage.tsx in
// Story 8.1. `expectNotClipped` must target the TEXT element, because measuring
// the row would measure the wrong box:
//
//   list title    ListDetailPage.tsx:101   data-testid="list-detail-title"
//   category name ListDetailPage.tsx:158   data-testid="category-name"
//   item name     ListDetailPage.tsx:224   data-testid="item-name"
//
// Reaching them structurally instead — getByTestId('item-row-X').locator('p') —
// is what selector-resilience warns against, and Story 8.2 rewrites these very
// elements, so a structural path would break in the next story. Only the
// attributes were added: the `noWrap` and the `maxWidth` caps stay, because they
// are AC4's red phase.
//
// Kept in one place so a later change costs one edit.
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

// The short-name counterpart, used by both halves of the falsifiability control.
async function shortListAtFloor(page: Page, projectName: string): Promise<void> {
  await registerViaUi(page, uniqueUsername('narrow', 'fits', projectName), PASSWORD)
  await createListAndOpen(page, 'Shop')
  await addCategory(page, 'Veg')
  await addItem(page, 'Veg', 'Peas')
}

test.describe('Story 8.1: the narrow viewport gate (ATDD red phase)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // AC2 — the mobile project renders at the NFR-E8-1 floor.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P0] the mobile project renders at the 320px floor', async ({page}, testInfo) => {
    // Was RED before the retarget: the `mobile` project was a bare
    // `{...devices['Pixel 7']}`, whose width is 412 — a value never chosen for a
    // reason and unexamined since Story 5.1 (AR-E8-1). Green since the config
    // overrides `viewport.width` to NFR-E8-1's floor.
    test.skip(testInfo.project.name !== 'mobile', 'asserts the mobile project descriptor')

    const viewport = page.viewportSize()
    expect(viewport, 'the mobile project must emulate a device, not inherit a window size').not.toBeNull()
    expect(viewport?.width, 'NFR-E8-1 floor').toBe(NARROW_FLOOR_PX)
  })

  test('[P1] CONTROL — retargeting keeps Chrome-on-Android UA and touch emulation', async ({page}, testInfo) => {
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

  test('[P0] RED — a long item name is not clipped at the floor (report #2)', async ({page}, testInfo) => {
    // EXPECTED TO FAIL against the shipped layout. ListDetailPage.tsx:224 renders
    // the item name `noWrap` under `maxWidth: {xs: 150}`, so at 320px the user
    // sees an ellipsis where the item is. Do NOT "fix" this test — the failure IS
    // AC4's proof. Story 8.2 makes it green.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')
    // `test.fail()`, not `test.skip()`: the assertion still RUNS and is still
    // observed failing, so AC4 keeps its evidence, but the suite exits zero —
    // which matters beyond tidiness, because a permanently-red `mobile` project
    // makes every real regression indistinguishable from this planned red AND
    // strands the `registration-toggle-*` projects at "did not run" (they list
    // `dependencies: ['chromium','mobile']`), leaving FR20/FR21 unverified on
    // every run. It also gives Story 8.2 a hard signal: when the layout is
    // fixed this reports "expected to fail, but passed" and must be un-marked.
    test.fail()

    await openListAtFloor(page, testInfo.project.name)
    await expectNotClipped(itemName(page, LONG_ITEM_NAME))
  })

  test('[P0] RED — a long list title is not clipped at the floor (report #3)', async ({page}, testInfo) => {
    // EXPECTED TO FAIL. ListDetailPage.tsx:101 renders the title `noWrap` under
    // `maxWidth: {xs: 200}` beside two buttons. Report #3 is a SQUEEZE, not an
    // overflow (AR-E8-3 corrected): `noWrap`'s `overflow: hidden` already
    // resolves the title's min-width to zero, so it shrinks to an ellipsis while
    // the buttons take the width. `minWidth: 0` is a no-op here and is not the
    // fix.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')
    test.fail() // see the note on report #2 above — observed, asserted, non-blocking

    await openListAtFloor(page, testInfo.project.name)
    await expectNotClipped(listTitle(page))
  })

  // Split in two, deliberately. Measurement (2026-09-05) showed the title is
  // clipped at 320px even for a FOUR-character name — the header box is 68px
  // wide and "Shop" needs 79 — so a single test asserting title-then-category-
  // then-item aborts on its first line and the tree ends up containing NO
  // committed proof that `expectNotClipped` can pass at all (and no exercise of
  // `data-testid="category-name"`). A helper that only ever fails is exactly as
  // hollow as one that only ever passes, so the passing half has to be a test
  // that is green today, on its own.

  test('[P0] the helper PASSES on short category and item names (falsifiability control)', async ({page}, testInfo) => {
    // GREEN TODAY and the mirror of the two reds above: without this, those reds
    // prove nothing about the layout and everything about a broken helper.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await shortListAtFloor(page, testInfo.project.name)

    await expectNotClipped(categoryName(page, 'Veg'))
    await expectNotClipped(itemName(page, 'Peas'))
  })

  test('[P0] RED — even a short list title is not clipped at the floor (report #3, severity)', async ({page}, testInfo) => {
    // EXPECTED TO FAIL, and this is the story's own finding rather than something
    // it inherited: at 320px the title box measures 68px while "Shop" needs 79,
    // so report #3 is not "long titles truncate", it is EVERY title truncating.
    // The squeeze is a flex-distribution result — the two header buttons take the
    // row — so Story 8.2 cannot discharge it by relaxing the `maxWidth` caps, and
    // this test is what tells it so.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')
    test.fail() // see the note on report #2 above — observed, asserted, non-blocking

    await shortListAtFloor(page, testInfo.project.name)

    await expectNotClipped(listTitle(page))
  })

  // ───────────────────────────────────────────────────────────────────────────
  // AC4 — expectNoHorizontalOverflow, the other half, and its own falsifiability.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P1] CONTROL — the page does not scroll horizontally at the floor', async ({page}, testInfo) => {
    // PASSES TODAY, and AR-E8-3a is exactly that point: this check is green
    // while reports #2 and #3 are on screen, because a clipped element does not
    // expand its ancestors. Kept for the class of defect it DOES catch — Story
    // 8.6 adds a third control to the category row, which is where a genuine
    // page-widening becomes likely.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo.project.name)
    await expectNoHorizontalOverflow(page)
  })

  test('[P1] expectNoHorizontalOverflow is capable of failing', async ({page}, testInfo) => {
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

    // `finally`: if the rejects-assertion itself fails, the probe must still come
    // out, or the page and its trace are left with an injected overflow that has
    // nothing to do with the application.
    try {
      await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(/scrolls horizontally/)
    } finally {
      await page.evaluate(() => document.getElementById('atdd-overflow-probe')?.remove())
    }

    await expectNoHorizontalOverflow(page)
  })
})
