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
// ═══ HOW THE DEFECTS ARE RECORDED (revised at review) ═══
//
// Reports #2 and #3 are live defects in the shipped layout, and this spec is
// their proof. They are asserted as INVERTED EXPECTATIONS —
//
//     await expect(expectNotClipped(loc)).rejects.toThrow(/clipped horizontally/)
//
// — not with `test.fail()`, which was the first draft and is wrong for this job:
// `test.fail()` reports a test as PASSING when it fails for ANY reason, so a
// broken `registerViaUi`, a backend 500 or a locator timeout is indistinguishable
// from the clipping the test exists to document. The inverted form pins the
// defect AND its cause, and still exits zero — which the run needs, because a
// permanently-red `mobile` project would (a) make every future regression
// indistinguishable from the planned reds and (b) strand the
// `registration-toggle-*` projects at "did not run" (they declare
// `dependencies: ['chromium','mobile']`), leaving FR20/FR21 unverified on every
// single run.
//
// FOR STORY 8.2: when the layout is fixed these three assertions fail loudly —
// "expected promise to reject" — naming the exact helper and element that has
// started passing. That is the handoff signal; convert each back to a plain
// `await expectNotClipped(...)` as it goes green. Note the third one
// specifically: the 68px is a flex-distribution result of the two header buttons
// taking the row, so relaxing the `maxWidth` caps will not discharge it.
//
// The CONTROLS below pass today and must keep passing. They are labelled so
// nobody mistakes a control for evidence that the fix worked (test-quality.md:
// an assertion already true before the action is a hollow green). Both helpers,
// and BOTH AXES of `expectNotClipped`, have a falsifiability control that does
// not depend on the shipped layout — so none of them dies when Story 8.2 fixes
// the layout out from under it.

// ─────────────────────────────────────────────────────────────────────────────
// Locators for the three text elements under measurement.
//
// The three testids were ADDED to ListDetailPage.tsx in Story 8.1.
// `expectNotClipped` must target the TEXT element, because measuring the row
// would measure the wrong box. Reaching them structurally instead —
// getByTestId('item-row-X').locator('p') — is what selector-resilience warns
// against, and Story 8.2 rewrites these very elements, so a structural path
// would break in the next story. Only the attributes were added: the `noWrap`
// and the `maxWidth` caps stay, because they are AC4's evidence.
//
// Cited by testid, not by line number: the numbers moved once inside this story
// already, and Story 8.2 will move them again.
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
  // AC4 — expectNotClipped is the load-bearing half. These three record the
  // live defects, each pinned to the specific failure it is evidence of.
  // ───────────────────────────────────────────────────────────────────────────

  test('[P0] DEFECT — a long item name is clipped at the floor (report #2)', async ({page}, testInfo) => {
    // ListDetailPage.tsx renders the item name `noWrap` under `maxWidth: {xs:
    // 150}`, so at 320px the user sees an ellipsis where the item's name should
    // be. Do NOT "fix" this test — the clipping IS AC4's proof. Story 8.2 fixes
    // the layout, at which point this assertion fails with "expected promise to
    // reject" and must be converted to a plain `await expectNotClipped(...)`.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'longitem')
    await expect(expectNotClipped(itemName(page, LONG_ITEM_NAME))).rejects.toThrow(
      /text is clipped horizontally/,
    )
  })

  test('[P0] DEFECT — a long list title is clipped at the floor (report #3)', async ({page}, testInfo) => {
    // ListDetailPage.tsx renders the title `noWrap` under `maxWidth: {xs: 200}`
    // beside two buttons. Report #3 is a SQUEEZE, not an overflow (AR-E8-3a):
    // `noWrap`'s `overflow: hidden` already resolves the title's min-width to
    // zero, so it shrinks to an ellipsis while the buttons take the width.
    // `minWidth: 0` is a no-op here and is not the fix.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await openListAtFloor(page, testInfo, 'longtitle')
    await expect(expectNotClipped(listTitle(page))).rejects.toThrow(/text is clipped horizontally/)
  })

  test('[P0] DEFECT — even a SHORT list title is clipped at the floor (report #3, severity)', async ({
    page,
  }, testInfo) => {
    // This story's own finding rather than something it inherited: at 320px the
    // title box measures 68px while "Shop" needs 79, so report #3 is not "long
    // titles truncate", it is EVERY title truncating. The squeeze is a
    // flex-distribution result — the two header buttons take the row — so Story
    // 8.2 cannot discharge it by relaxing the `maxWidth` caps, and this test is
    // what tells it so.
    test.skip(testInfo.project.name !== 'mobile', 'the floor is emulated by the mobile project')

    await shortListAtFloor(page, testInfo, 'shorttitle')
    await expect(expectNotClipped(listTitle(page))).rejects.toThrow(/text is clipped horizontally/)
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
    // Measurement (2026-09-05) showed the title is clipped at 320px even for a
    // FOUR-character name, so it cannot join this control — a single test
    // asserting title-then-category-then-item would abort on its first line and
    // leave no committed proof that `expectNotClipped` can pass at all.
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
  })
})
