import {expect, test, type Locator, type Page, type TestInfo} from '@playwright/test'
import {
  expectInsideViewport,
  expectNoHorizontalOverflow,
  expectNotClipped,
  NARROW_FLOOR_PX,
} from './support/layout'
import {
  addCategory,
  addItem,
  createListAndOpen,
  openListsViaMenu,
  PASSWORD,
  registerViaUi,
  uniqueUsername,
} from './support/ui'

// Story 8.1 — Move the Mobile Gate to the Width People Actually Use.
//
// ═══ HOW THE DEFECTS WERE RECORDED, AND WHAT THEY ARE NOW (Story 8.2) ═══
//
// Reports #2 and #3 were live defects in the shipped layout, and while they were
// live this spec asserted them as INVERTED EXPECTATIONS —
//
//     await expect(expectNotClipped(loc)).rejects.toThrow(/clipped horizontally/)
//
// — rather than with `test.fail()`, which reports a test as PASSING when it fails
// for ANY reason, so a broken `registerViaUi`, a backend 500 or a locator timeout
// would have been indistinguishable from the clipping the tests existed to
// document.
//
// Story 8.2 fixed the layout, and the three assertions duly failed with "expected
// promise to reject" — the handoff signal Story 8.1 wrote them to produce. Each
// is now a plain `await expectNotClipped(...)`: SAME test, SAME report number,
// SAME element, opposite expectation. They are no longer evidence of a defect;
// they are the regression gate that keeps the fix from being undone. Note the
// third one specifically: its 68px title box was a flex-distribution result of
// the two header buttons taking the row, which is why 8.2 gave the buttons their
// own row below `sm` instead of retuning a `maxWidth`.
//
// The CONTROLS below pass today and must keep passing. They are labelled so
// nobody mistakes a control for evidence that the fix worked (test-quality.md:
// an assertion already true before the action is a hollow green). Both helpers,
// and BOTH AXES of `expectNotClipped`, have a falsifiability control that does
// not depend on the shipped layout — which is what keeps them honest now that
// Story 8.2 has taken the layout reds away.

// ─────────────────────────────────────────────────────────────────────────────
// Locators for the three text elements under measurement.
//
// The three testids were ADDED to ListDetailPage.tsx in Story 8.1, and Story 8.2
// rewrote all three elements around them — which is exactly why they are reached
// by testid. `expectNotClipped` must target the TEXT element, because measuring
// the row would measure the wrong box, and because the two-line clamp Story 8.2
// applies is only meaningful on the box the text lives in. Reaching them
// structurally instead — getByTestId('item-row-X').locator('p') — is what
// selector-resilience warns against and would have broken in 8.2's rewrite.
//
// Cited by testid, not by line number: the numbers have moved in both stories.
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

// ONE UNBREAKABLE WORD — the only name in this file with no space to wrap on.
// Every other name here is multi-word, so the `overflowWrap: 'anywhere'` Story
// 8.2 put on the three names is exercised by NOTHING else: those wrap on their
// spaces with or without it. Measured at the floor (2026-09-05): as shipped the
// title reports `288 === 288` and the page `320 === 320`; with `overflowWrap`
// back at `normal` the title is `scrollWidth 760 > clientWidth 288` and the page
// `776 > 320` — a real NFR-E8-1 violation that would otherwise ship green.
const UNBREAKABLE_LIST_NAME = 'Supercalifragilisticexpialidociousaurusrexinatorium'

// MUI's default `sm`, which is the breakpoint ListDetailPage's header stacks
// below (the theme declares no custom `breakpoints`, verified 2026-09-05). Named
// because the boundary test asserts AT it and just below it, and two bare 600s
// would read as coincidence rather than as the breakpoint under test.
const SM_BREAKPOINT_PX = 600

// Every scenario registers a FRESH unique user and asserts only on data it
// created — the suite-wide rule in support/ui.ts. Namespace prefix: `narrow`.
//
// `label` is PER TEST, not per helper. Four tests sharing one label under
// `fullyParallel: true` is a collision waiting to happen: `uniqueUsername`
// leans on `Date.now()`, and two workers entering the same helper in the same
// millisecond produce the same username, which makes `registerViaUi` fail for a
// reason that has nothing to do with layout.
//
// `openListsViaMenu` is called explicitly rather than relying on where
// registration happens to land: `createListAndOpen` needs the index overlay, and
// a change to the FR38 post-register landing would otherwise break every
// scenario in this file.
async function openListAtFloor(page: Page, testInfo: TestInfo, label: string): Promise<string> {
  await registerViaUi(page, uniqueUsername('narrow', label, testInfo.project.name), PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, LONG_LIST_NAME)
  await addCategory(page, LONG_CATEGORY_NAME)
  await addItem(page, LONG_CATEGORY_NAME, LONG_ITEM_NAME)
  return listId
}

// The short-name counterpart, used by both halves of the falsifiability control.
async function shortListAtFloor(page: Page, testInfo: TestInfo, label: string): Promise<string> {
  await registerViaUi(page, uniqueUsername('narrow', label, testInfo.project.name), PASSWORD)
  await openListsViaMenu(page)
  const listId = await createListAndOpen(page, 'Shop')
  await addCategory(page, 'Veg')
  await addItem(page, 'Veg', 'Peas')
  return listId
}

// Inject a throwaway element, hand it to an assertion, and always remove it.
// Confined to the falsifiability controls; touches no application code.
async function withProbe(
  page: Page,
  css: string,
  html: string,
  body: (probe: Locator) => Promise<void>,
): Promise<void> {
  await page.evaluate(
    ({css, html}) => {
      const el = document.createElement('div')
      el.id = 'atdd-probe'
      el.setAttribute('data-testid', 'atdd-probe')
      el.style.cssText = css
      el.innerHTML = html
      document.body.appendChild(el)
    },
    {css, html},
  )
  try {
    await body(page.getByTestId('atdd-probe'))
  } finally {
    await page.evaluate(() => document.getElementById('atdd-probe')?.remove())
  }
}

test.describe('Story 8.1: the narrow viewport gate', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // AC2 — the mobile projects render at the NFR-E8-1 floor.
  // ───────────────────────────────────────────────────────────────────────────

  // Playwright requires the first argument to be a destructuring pattern; this
  // test needs no fixture at all, because it reads the config rather than
  // driving a browser.
  // eslint-disable-next-line no-empty-pattern
  test('[P0] every mobile project in the config is configured at the 320px floor', async ({}, testInfo) => {
    // Deliberately NOT project-skipped, and asserted against the CONFIG rather
    // than the running page. Every other test in this file skips unless it is in
    // the project named `mobile`, so renaming or dropping that project would make
    // the entire gate vanish into a green run. This test is what makes that
    // impossible: it runs everywhere and fails if no mobile project is left.
    //
    // It also covers `registration-toggle-mobile`, which the first draft of this
    // story left on the bare 412px descriptor while claiming the mobile gate had
    // moved — NFR-E8-2 says the suite renders at the floor in a normal run, and
    // that has to mean every project that emulates a phone.
    const mobileProjects = testInfo.config.projects.filter(p => p.name.includes('mobile'))
    expect(mobileProjects.map(p => p.name), 'the config must define mobile projects').not.toHaveLength(0)
    for (const project of mobileProjects) {
      expect(project.use.viewport, `${project.name} must emulate a device`).toBeTruthy()
      expect(project.use.viewport?.width, `${project.name} @ NFR-E8-1 floor`).toBe(NARROW_FLOOR_PX)
    }
  })

  test('[P0] the mobile project renders at the 320px floor', async ({page}, testInfo) => {
    // The runtime counterpart of the config assertion above: the width the
    // browser actually reports. Was RED before the retarget — the `mobile`
    // project was a bare `{...devices['Pixel 7']}`, whose width is 412, a value
    // never deliberately chosen and unexamined since Story 5.1 (AR-E8-1).
    test.skip(testInfo.project.name !== 'mobile', 'asserts the mobile project descriptor')

    const viewport = page.viewportSize()
    expect(viewport, 'the mobile project must emulate a device, not inherit a window size').not.toBeNull()
    expect(viewport?.width, 'NFR-E8-1 floor').toBe(NARROW_FLOOR_PX)

    // `screen` is overridden alongside `viewport`. Without it `window.screen.width`
    // and every `max-device-width` query keep reporting the descriptor's 412 while
    // `innerWidth` is 320 — a split the app could branch on.
    const screenWidth = await page.evaluate(() => window.screen.width)
    expect(screenWidth, 'screen.width must follow the viewport override').toBe(NARROW_FLOOR_PX)
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
  // AC4 — expectNotClipped is the load-bearing half. These three were the record
  // of the live defects; since Story 8.2 fixed the layout they are the gate that
  // keeps each of those three failures from coming back.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P0] a long item name is fully readable at the floor (report #2)', async ({page}, testInfo) => {
    // Report #2: ListDetailPage.tsx used to render the item name `noWrap` under
    // `maxWidth: {xs: 150}`, so at 320px the user saw an ellipsis where the item's
    // name should be. Story 8.2 removed the cap and wraps the name to at most two
    // lines, so the HEIGHT branch of `expectNotClipped` is what carries this
    // assertion now — a name needing a third line clips vertically.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'longitem')
    await expectNotClipped(itemName(page, LONG_ITEM_NAME))

    // NFR-E8-1's other two clauses, on the element this story widened. With the
    // `maxWidth` cap gone the NAME is the box most able to escape the row, and
    // neither `expectNotClipped` (which measures clipping, not position) nor the
    // control checks elsewhere in this file can see that.
    await expectInsideViewport(itemName(page, LONG_ITEM_NAME), 'the item name')
    await expectNoHorizontalOverflow(page)
  })

  test('[P0] a long list title is fully readable at the floor (report #3)', async ({page}, testInfo) => {
    // Report #3: the title was `noWrap` under `maxWidth: {xs: 200}` beside two
    // buttons — a SQUEEZE, not an overflow (AR-E8-3a): `noWrap`'s `overflow:
    // hidden` already resolved the title's min-width to zero, so it shrank to an
    // ellipsis while the buttons took the width. `minWidth: 0` was therefore a
    // no-op and was never the fix; below `sm` the buttons now take their own row.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'longtitle')
    await expectNotClipped(listTitle(page))

    // GUARDS, not evidence: all four held BEFORE Story 8.2 too — the pre-fix
    // defect was the title being squeezed, not the buttons being harmed. They
    // are here because AC2 names them as part of the fixed state, and because
    // the rejected alternatives to the row wrap were icon-only buttons (loses
    // the labels) and a guaranteed title floor (compresses the buttons until
    // their own labels wrap). Each of those would turn one of these red.
    const addCategory = page.getByTestId('add-category-button')
    const addItem = page.getByTestId('add-item-button')
    await expect(addCategory, 'the buttons keep their text labels').toHaveText('Category')
    await expect(addItem, 'the buttons keep their text labels').toHaveText('Item')
    await expectInsideViewport(addCategory, 'the add-category control')
    await expectInsideViewport(addItem, 'the add-item control')
    await expectNoHorizontalOverflow(page)

    // THE ASSERTION THAT ACTUALLY GATES THE FIX. Everything above is satisfied
    // by the DEFECT: restore the pre-fix single-row header and merely leave
    // `noWrap` off, and the title collapses back to report #3's 68px column —
    // measured 2026-09-05 at 68px wide × 504px tall, so `scrollWidth 68 ===
    // clientWidth 68`, `scrollHeight 504 === clientHeight 504`, page `320 ===
    // 320`, both buttons inside with their labels. Every line above stays GREEN
    // while the squeeze is on screen; without the geometry below these two tests
    // gate the re-introduction of `noWrap` and nothing else.
    const titleBox = (await listTitle(page).boundingBox())!
    const addCategoryBox = (await addCategory.boundingBox())!
    const addItemBox = (await addItem.boundingBox())!
    expect(
      addCategoryBox.y,
      `the buttons must take their OWN ROW below the title (title bottom ${titleBox.y + titleBox.height}, button top ${addCategoryBox.y})`,
    ).toBeGreaterThanOrEqual(titleBox.y + titleBox.height)
    expect(addItemBox.y, 'both buttons share that row').toBeCloseTo(addCategoryBox.y, 0)

    // …and the title takes the whole row it was given. Compared against its own
    // container, so the Container's padding is not mistaken for a squeeze.
    const spans = await listTitle(page).evaluate(el => ({
      width: el.getBoundingClientRect().width,
      container: el.parentElement!.getBoundingClientRect().width,
    }))
    expect(
      spans.width,
      `the title must span its row (width ${spans.width} of container ${spans.container})`,
    ).toBeGreaterThanOrEqual(spans.container - 1)
  })

  test('[P0] an unbreakable list name neither escapes the floor nor scrolls the page', async ({
    page,
  }, testInfo) => {
    // The case removing the caps CREATED. A capped, `noWrap` title could not
    // widen anything; an uncapped one can, and a single word with no break
    // opportunity is the shape that does it — which is exactly why the user's
    // ruling was to wrap the header at `xs` rather than on a natural flex wrap.
    // Nothing else in this suite exercises `overflowWrap: 'anywhere'`: every
    // other name is multi-word (see UNBREAKABLE_LIST_NAME for the measurement).
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await registerViaUi(page, uniqueUsername('narrow', 'unbreakable', testInfo.project.name), PASSWORD)
    await openListsViaMenu(page)
    await createListAndOpen(page, UNBREAKABLE_LIST_NAME)

    await expectNotClipped(listTitle(page))
    await expectInsideViewport(listTitle(page), 'the list title')
    await expectNoHorizontalOverflow(page)
  })

  test('[P0] a long category name is fully readable at the floor (AR-E8-3, third instance)', async ({
    page,
  }, testInfo) => {
    // The third `noWrap` + `maxWidth` construct on this screen, and the only one
    // nobody reported — `category-name` was capped at `{xs: 160}` beside two
    // IconButtons, so it clipped at the floor exactly as the item name did.
    // Story 8.2 removed all three caps in one pass rather than leaving this one
    // to be re-found later, and this is the assertion that says so. Observed RED
    // against the pre-fix layout: scrollWidth 341 > clientWidth 160.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'longcat')
    await expectNotClipped(categoryName(page, LONG_CATEGORY_NAME))

    // The row's own controls, which the removed cap used to reserve space for.
    const row = page.getByTestId(`category-row-${LONG_CATEGORY_NAME}`)
    await expectInsideViewport(row.getByTestId('add-item-in-category-button'), 'the add-item-in-category control')
    await expectInsideViewport(row.getByTestId('remove-category-button'), 'the remove-category control')

    // …and the name's own box, plus the page. Same reasoning as the item name:
    // the widened element is the one that can now escape, and clipping checks
    // cannot see position.
    await expectInsideViewport(categoryName(page, LONG_CATEGORY_NAME), 'the category name')
    await expectNoHorizontalOverflow(page)
  })

  test('[P0] even a SHORT list title is fully readable at the floor (report #3, severity)', async ({
    page,
  }, testInfo) => {
    // Story 8.1's own finding rather than something it inherited: at 320px the
    // title box measured 68px while "Shop" needs 79, so report #3 was not "long
    // titles truncate", it was EVERY title truncating. The squeeze was a
    // flex-distribution result — the two header buttons taking the row — which is
    // why relaxing a `maxWidth` could not have discharged it, and why this case
    // is kept separate from the long-title one above: it is the assertion that
    // fails if the header ever goes back to sharing one row at `xs`.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await shortListAtFloor(page, testInfo, 'shorttitle')
    await expectNotClipped(listTitle(page))
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Falsifiability. A helper that only ever fails is exactly as hollow as one
  // that only ever passes — and neither of these controls depends on the shipped
  // layout, so Story 8.2 cannot take them away.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P0] the helper PASSES on short category and item names (falsifiability control)', async ({page}, testInfo) => {
    // GREEN TODAY and the mirror of the three defects above: without this, those
    // prove nothing about the layout and everything about a broken helper.
    //
    // Story 8.1's measurement (2026-09-05) showed the title clipped at 320px even
    // for a FOUR-character name, so it could not join this control then. Story 8.2
    // fixed that, and the short-title case above now asserts it directly — this
    // control deliberately keeps to the category and item names so it stays a
    // control for the HELPER rather than a second copy of that assertion.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await shortListAtFloor(page, testInfo, 'fits')

    // The title testid is resolved by a PASSING assertion here even though its
    // clipping is asserted elsewhere. Without this line, `list-detail-title` is
    // observed only by tests that expect a throw — so deleting the attribute
    // (Story 8.2 rewrites these very elements) would leave the suite green while
    // silently disarming the two title defects above.
    await expect(listTitle(page)).toHaveText('Shop')

    await expectNotClipped(categoryName(page, 'Veg'))
    await expectNotClipped(itemName(page, 'Peas'))
  })

  test('[P1] expectNotClipped is capable of failing on WIDTH', async ({page}, testInfo) => {
    // The layout defects above are the width axis's only other proof, and Story
    // 8.2 removes them by fixing the layout. This control does not touch the
    // application layout, so it survives that and keeps the axis honest.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await page.goto('/auth')
    await withProbe(
      page,
      'width:40px;white-space:nowrap;overflow:hidden;',
      'text far wider than forty pixels',
      async probe => {
        // Non-vacuity: the probe must actually be clipped, or the assertion below
        // would be satisfied by a helper that throws for any reason at all.
        const overflowing = await probe.evaluate(el => el.scrollWidth > el.clientWidth)
        expect(overflowing, 'the width probe must actually overflow').toBe(true)
        await expect(expectNotClipped(probe)).rejects.toThrow(/text is clipped horizontally/)
      },
    )
  })

  test('[P1] expectNotClipped is capable of failing on HEIGHT', async ({page}, testInfo) => {
    // The height axis has NEVER been observed doing anything: every element this
    // spec measures is `noWrap`, which truncates horizontally only. It exists for
    // Story 8.2, which replaces `noWrap` with a two-line clamp whose failure mode
    // is vertical — and at that point it becomes the whole gate. A branch that is
    // wired wrong today would fail open there, on the exact screen it was written
    // for, so it is proven capable of failing here instead.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await page.goto('/auth')
    await withProbe(
      page,
      'width:200px;height:20px;line-height:20px;overflow:hidden;',
      'line one<br>line two<br>line three',
      async probe => {
        const clipped = await probe.evaluate(el => ({
          vertically: el.scrollHeight > el.clientHeight,
          horizontally: el.scrollWidth > el.clientWidth,
        }))
        // The probe must be clipped VERTICALLY and not horizontally, or the
        // assertion could be satisfied by the width branch it is meant to isolate.
        expect(clipped.vertically, 'the height probe must overflow vertically').toBe(true)
        expect(clipped.horizontally, 'the height probe must NOT overflow horizontally').toBe(false)
        await expect(expectNotClipped(probe)).rejects.toThrow(/text is clipped vertically/)
      },
    )
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

    await openListAtFloor(page, testInfo, 'overflow')
    await expectNoHorizontalOverflow(page)
  })

  test('[P1] expectNoHorizontalOverflow is capable of failing', async ({page}, testInfo) => {
    // A document-level check that is green on every screen is indistinguishable
    // from one that is wired wrong. Force a real overflow and require the helper
    // to report it.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'probe')
    await withProbe(page, `width:${NARROW_FLOOR_PX * 3}px;height:1px;`, '', async () => {
      // Non-vacuity: a future `overflow-x: hidden` on body would swallow the probe
      // and make this control fail for a reason that has nothing to do with the
      // helper. Assert the document really did widen before demanding the throw.
      const widened = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(widened, 'the probe must actually widen the document').toBe(true)
      await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(/scrolls horizontally/)
    })

    await expectNoHorizontalOverflow(page)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // NFR-E8-1 is a requirement about the APP, not about one screen. The two
  // helpers above are exercised on /lists/:id only; these cover the rest of the
  // floor's surface — the routes a user actually reaches, and the third clause
  // ("no interactive element is pushed off-screen") that neither helper can see.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P1] no route scrolls horizontally at the floor', async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await page.goto('/auth')
    await expectNoHorizontalOverflow(page)

    const listId = await openListAtFloor(page, testInfo, 'routes')
    await expectNoHorizontalOverflow(page)

    await page.goto('/lists')
    await expect(page.getByTestId('lists-page')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goto(`/list/${listId}`)
    await expect(page.getByTestId('list-shopping-page')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // The app-bar chip at the FLOOR. navigation.spec.ts asserts NFR-E6-2 at a
    // width it sets itself (360), so before this line the chip had never been
    // measured at 320 — and epic-8-context.md already flags it as "in the audit
    // but not automatically in scope".
    await expectInsideViewport(page.getByTestId('user-chip'), 'the app-bar username chip')
    await expectInsideViewport(page.getByTestId('app-bar-home'), 'the app-bar home link')
  })

  test('[P1] an open dialog does not overflow the floor', async ({page}, testInfo) => {
    // Dialogs are the other classic fixed-width offender and are invisible to a
    // route sweep, because they only exist while open.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'dialog')

    await page.getByTestId('add-category-button').click()
    await expect(page.getByTestId('add-category-dialog')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectInsideViewport(page.getByTestId('add-category-dialog'), 'the add-category dialog')
  })

  test('[P1] the item row controls stay inside the floor', async ({page}, testInfo) => {
    // NFR-E8-1's third clause, which NEITHER of the other helpers can see: a
    // control clipped inside an `overflow: hidden` ancestor widens nothing and is
    // not a text element. Story 8.6 adds a THIRD control to the category row, so
    // this is the assertion that will catch it.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'controls')
    const row = page.getByTestId(`item-row-${LONG_ITEM_NAME}`)

    await expectInsideViewport(row.getByTestId('edit-item-button'), 'the item edit control')
    await expectInsideViewport(row.getByTestId('remove-item-button'), 'the item remove control')
    await expectInsideViewport(page.getByTestId('add-category-button'), 'the add-category control')

    // The name must not run UNDER the controls either. Story 8.2 removed the
    // `maxWidth` that used to keep it clear of them and made name and controls
    // flex siblings instead, so this is the assertion that the flex row really
    // does the job the hardcoded cap was doing. A guard, not evidence: it held
    // pre-fix as well — by the cap.
    const nameBox = (await itemName(page, LONG_ITEM_NAME).boundingBox())!
    const editBox = (await row.getByTestId('edit-item-button').boundingBox())!
    expect(
      nameBox.x + nameBox.width,
      'the item name must not run under its controls',
    ).toBeLessThanOrEqual(editBox.x)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // The other side of Story 8.2's AC: the floor fix must not become a redesign
  // of the screen. This is the only test in the file that asserts ABOVE the
  // breakpoint, so it skips on `mobile` rather than on everything else.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P1] above the breakpoint the header keeps title and buttons on one row', async ({
    page,
  }, testInfo) => {
    // `md`'s ruling was that the buttons take their own row BELOW `sm`. The cost
    // accepted was one row of vertical space on phones — not on every screen, and
    // the GEOMETRY half of this test is what holds the fix to that. It catches a
    // `flexDirection: 'column'` written without a breakpoint, which is the
    // cheapest wrong way to satisfy AC2 and is invisible to every other test in
    // this file (they all run at the floor). That half is a control: it held
    // before Story 8.2 too.
    //
    // The `expectNotClipped` line is NOT a control, and this was measured rather
    // than assumed: against the pre-fix layout it failed at 1280px with
    // `scrollWidth 619 > clientWidth 460` — the title's `sm: 460` cap clipped a
    // long list name on a DESKTOP screen, with ~800px of empty row beside it.
    // Report #3 was filed from a phone, but the same cap was truncating titles
    // everywhere; removing it rather than retuning it is what fixes both, and
    // this line is the only assertion in the suite that would notice a
    // narrow-only fix that left the desktop cap in place.
    //
    // `openListAtFloor` is reused for its fixture, not its name: in the chromium
    // project the same steps run at the Desktop Chrome viewport.
    test.skip(testInfo.project.name === 'mobile', 'asserts the header ABOVE the sm breakpoint')

    await openListAtFloor(page, testInfo, 'desktop')

    // The width this test runs at, asserted rather than assumed. Without it the
    // test claims "above the breakpoint" while only ever knowing the project's
    // default viewport — and a project retarget (which is precisely what Story
    // 8.1 did to `mobile`) could put it below `sm` with nothing to say so.
    const viewport = page.viewportSize()
    expect(viewport, 'this test needs an emulated viewport to reason about').not.toBeNull()
    expect(viewport!.width, 'runs ABOVE the sm breakpoint').toBeGreaterThanOrEqual(SM_BREAKPOINT_PX)

    // Shares one row: beside, and vertically overlapping.
    const oneRow = async (label: string) => {
      const title = (await listTitle(page).boundingBox())!
      const addCategory = (await page.getByTestId('add-category-button').boundingBox())!
      expect(addCategory.x, `${label}: the buttons sit beside the title, not beneath it`).toBeGreaterThanOrEqual(
        title.x + title.width,
      )
      expect(addCategory.y, `${label}: title and buttons share one row`).toBeLessThan(title.y + title.height)
      expect(title.y, `${label}: title and buttons share one row`).toBeLessThan(addCategory.y + addCategory.height)
    }
    await oneRow(`the project viewport (${viewport!.width}px)`)
    await expectNotClipped(listTitle(page))

    // THE BOUNDARY ITSELF, which neither the floor tests nor the line above can
    // see: they measure 320px and ~1280px, and moving the header's
    // `flexDirection` from `sm` to `md` leaves BOTH green while putting the
    // two-row header on every tablet. Asserted from both sides of the one
    // breakpoint the fix names.
    await page.setViewportSize({width: SM_BREAKPOINT_PX - 1, height: 900})
    const belowTitle = (await listTitle(page).boundingBox())!
    const belowButton = (await page.getByTestId('add-category-button').boundingBox())!
    expect(
      belowButton.y,
      `just below sm (${SM_BREAKPOINT_PX - 1}px) the buttons take their own row`,
    ).toBeGreaterThanOrEqual(belowTitle.y + belowTitle.height)

    await page.setViewportSize({width: SM_BREAKPOINT_PX, height: 900})
    await oneRow(`at sm (${SM_BREAKPOINT_PX}px)`)
  })
})
