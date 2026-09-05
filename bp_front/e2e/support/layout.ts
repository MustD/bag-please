import {expect, type Locator, type Page} from '@playwright/test'

// Layout-geometry assertions for the NFR-E8-1 narrow floor (Story 8.1, AC4).
//
// TWO helpers with DIFFERENT jobs. Neither substitutes for the other, and the
// distinction is the whole point of AR-E8-3a:
//
//   * `expectNotClipped` measures ONE TEXT ELEMENT. It is the load-bearing half.
//     MUI's `noWrap` compiles to `overflow: hidden` (Typography.js:88-90), and a
//     clipped element does NOT expand its ancestors — so the document-level check
//     below stays GREEN while reports #2 and #3 are on screen. The first draft of
//     Story 8.1 proposed only the document-level check; it would have gated
//     nothing.
//
//   * `expectNoHorizontalOverflow` measures THE PAGE. It catches the different
//     class of defect: something that genuinely widens the document, which a
//     third control on a row (Story 8.6) or an over-wide dialog will produce.
//
// One definition each, here, per NFR-E8-5. A second copy of either is a review
// failure — the rule Story 7.5 applied to `byCreatedAtAsc`.

// The NFR-E8-1 floor. Exported so a spec asserts against the requirement rather
// than a literal repeated per call site.
export const NARROW_FLOOR_PX = 320

type Clipping = {
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
  text: string
}

// Assert that a text element is not truncated in EITHER axis.
//
// Why both axes, when Story 8.1's AC4 names only `scrollWidth <= clientWidth`:
// that width-only form holds "precisely when the text is not truncated" for
// `noWrap`, which truncates HORIZONTALLY. Story 8.2 replaces `noWrap` with a
// two-line clamp, which truncates VERTICALLY — `scrollHeight > clientHeight`
// while `scrollWidth <= clientWidth`. A width-only helper therefore detects
// today's defect and goes blind to the fix's own failure mode, on the very
// screen it was written for. Asserting both keeps AC4's red phase intact (the
// shipped `noWrap` still fails on width) and survives Story 8.2.
export async function expectNotClipped(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const box: Clipping = await locator.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    text: (el.textContent ?? '').trim(),
  }))
  expect(
    box.scrollWidth,
    `text is clipped horizontally: "${box.text}" (scrollWidth ${box.scrollWidth} > clientWidth ${box.clientWidth})`,
  ).toBeLessThanOrEqual(box.clientWidth)
  expect(
    box.scrollHeight,
    `text is clipped vertically: "${box.text}" (scrollHeight ${box.scrollHeight} > clientHeight ${box.clientHeight})`,
  ).toBeLessThanOrEqual(box.clientHeight)
}

// Assert the document does not scroll horizontally.
//
// Deliberately NOT a substitute for `expectNotClipped` — see the header. Kept
// because it does catch what it catches: an element that widens the page.
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const doc = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    doc.scrollWidth,
    `page scrolls horizontally (documentElement scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth})`,
  ).toBeLessThanOrEqual(doc.clientWidth)
}
