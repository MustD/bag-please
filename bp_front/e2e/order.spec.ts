import {expect, test} from '@playwright/test'

import {groupItemsByCategory} from '../src/lib/lists/order'

// Story 8.5 (FR62) — the ordering module's ONE guarantee that no browser can
// observe: two entities with the SAME name must still come out in the same
// sequence every time.
//
// Why this file is not a page test. The duplicate-name case is unreachable
// through the UI's own assertions — `category-row-<name>` and `item-row-<name>`
// are name-keyed, so two same-named rows trip Playwright strict mode before any
// ordering could be read, and re-keying those testids is an OPEN ledger item the
// epic rules out of scope. The behaviour is still a requirement, so it is
// asserted where it actually lives: against the exported function, with no
// `page` fixture at all. It runs inside the existing gate on `chromium` and
// `mobile` like every other spec (it is untagged, so both viewport projects
// collect it) and costs no browser.
//
// What it pins is NOT "sorted by name" — the browser specs already pin that on
// both surfaces. It is that the output is a function of the SET, not of the
// order the backend happened to return: `Array.prototype.sort` is stable, so
// ties preserve INPUT order, and the backend's map order is not stable (three
// consecutive pre-fix runs of the FR62 ordering spec produced three different
// sequences). Stability over an unstable input is no stability at all; the id
// tiebreak inside `groupItemsByCategory` is what makes the sequence total.

// Same NAME, different ids — the only thing that can break the tie.
const DUPLICATE_CATEGORIES = [
  {id: 'cat-c', name: 'Dairy'},
  {id: 'cat-a', name: 'Dairy'},
  {id: 'cat-b', name: 'Bakery'},
]

const DUPLICATE_ITEMS = [
  {id: 'item-c', name: 'Milk', category: 'cat-a'},
  {id: 'item-a', name: 'Milk', category: 'cat-a'},
  {id: 'item-b', name: 'Butter', category: 'cat-a'},
]

// A different arrival order for the same SET. Reversal is enough: under a
// name-only comparator the two tied `Dairy` categories come out `cat-c, cat-a`
// from one input and `cat-a, cat-c` from the other, which is exactly the drift
// being ruled out.
const shuffled = <T,>(rows: readonly T[]): T[] => [...rows].reverse()

const keysOf = (categories: typeof DUPLICATE_CATEGORIES, items: typeof DUPLICATE_ITEMS): string[] =>
  groupItemsByCategory(categories, items, {keepEmpty: true}).map(group => group.key)

const itemIdsOf = (categories: typeof DUPLICATE_CATEGORIES, items: typeof DUPLICATE_ITEMS): string[] =>
  groupItemsByCategory(categories, items, {keepEmpty: true}).flatMap(group => group.items.map(item => item.id))

test('FR62 — two categories with the SAME name come out in the same sequence whatever order they arrive in', () => {
  const fromOneOrder = keysOf(DUPLICATE_CATEGORIES, DUPLICATE_ITEMS)
  const fromAnother = keysOf(shuffled(DUPLICATE_CATEGORIES), DUPLICATE_ITEMS)

  expect(fromOneOrder, 'the sequence is a function of the SET, not of arrival order').toEqual(fromAnother)
  // And it is the by-name order with the tie broken by id — stated explicitly so
  // a comparator that merely became deterministic in some other way (sorting by
  // id alone, say) cannot satisfy the equality above.
  expect(fromOneOrder).toEqual(['cat-b', 'cat-a', 'cat-c'])
})

test('FR62 — two items with the SAME name in one category come out in the same sequence whatever order they arrive in', () => {
  const fromOneOrder = itemIdsOf(DUPLICATE_CATEGORIES, DUPLICATE_ITEMS)
  const fromAnother = itemIdsOf(DUPLICATE_CATEGORIES, shuffled(DUPLICATE_ITEMS))

  expect(fromOneOrder, 'items tie-break the same way categories do').toEqual(fromAnother)
  expect(fromOneOrder).toEqual(['item-b', 'item-a', 'item-c'])
})

test('FR62 — orphans with the SAME name are ordered by the same rule as the rest', () => {
  // Every item points at a category that is not present, so all three land in
  // the synthetic bucket — the one group built on a path of its own, and
  // therefore the one that could quietly miss the tiebreak.
  const orphaned = DUPLICATE_ITEMS.map(item => ({...item, category: 'gone'}))

  const fromOneOrder = groupItemsByCategory([], orphaned, {keepEmpty: false})
  const fromAnother = groupItemsByCategory([], shuffled(orphaned), {keepEmpty: false})

  expect(fromOneOrder.map(g => g.key)).toEqual(['__uncategorized__'])
  expect(fromOneOrder[0].items.map(i => i.id)).toEqual(fromAnother[0].items.map(i => i.id))
  expect(fromOneOrder[0].items.map(i => i.id)).toEqual(['item-b', 'item-a', 'item-c'])
})
