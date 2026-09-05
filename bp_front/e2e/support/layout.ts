import {expect, type Locator, type Page} from '@playwright/test'

// Layout-geometry assertions for the NFR-E8-1 narrow floor (Story 8.1, AC4).
//
// THREE helpers with DIFFERENT jobs. None substitutes for another, and the
// distinction between the first two is the whole point of AR-E8-3a:
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
//   * `expectInsideViewport` measures ONE CONTROL'S BOX. It exists because
//     NFR-E8-1 has a third clause — "no interactive element is pushed
//     off-screen" — that NEITHER of the other two can see: a button clipped
//     inside an `overflow: hidden` ancestor widens nothing and is not a text
//     element, so both of the above stay green while it is unreachable. That is
//     the failure shape Story 8.6 is expected to create by adding a third
//     control to the category row.
//
// One definition each, here, per NFR-E8-5. A second copy of any of them is a
// review failure — the rule Story 7.5 applied to `byCreatedAtAsc`.

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
//
// THE AXES HAND OVER — do not read this as two durable checks. Today only the
// WIDTH assertion can fail: every target is `noWrap`, which truncates
// horizontally, so the height branch has never been observed doing anything.
// After Story 8.2 the reverse holds: for a wrapping element `scrollWidth ===
// clientWidth` by construction, so the width assertion can no longer fail and
// the HEIGHT one carries the whole gate. Each axis is therefore unexercised in
// exactly the story where the other is load-bearing, which is why both have a
// dedicated falsifiability control in narrow-viewport.spec.ts rather than
// relying on the layout reds — those disappear when Story 8.2 fixes the layout.
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

// Assert an interactive control lies fully inside the viewport.
//
// NFR-E8-1's third clause, and the one neither helper above can discharge — see
// the header. Measured against the real `clientWidth` rather than
// `NARROW_FLOOR_PX`, because a classic scrollbar narrows the content box and a
// hardcoded bound would be looser than intended; the same reasoning
// navigation.spec.ts already applies to the app-bar chip.
export async function expectInsideViewport(locator: Locator, label: string): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} has no bounding box`).not.toBeNull()
  const clientWidth = await locator.page().evaluate(() => document.documentElement.clientWidth)
  expect(box!.x, `${label} is pushed off the left edge (x ${box!.x})`).toBeGreaterThanOrEqual(0)
  expect(
    box!.x + box!.width,
    `${label} is pushed off the right edge (right ${box!.x + box!.width} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth)
}
