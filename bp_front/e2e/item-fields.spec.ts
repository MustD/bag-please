import {expect, test} from '@playwright/test'

import {isKnownCategoryId} from '../src/lib/lists/categoryChoice'
import {normalizeStores, storeKey} from '../src/lib/lists/storeValue'

// Story 9.6 — the two item-dialog rules no browser can observe, asserted where
// they live. Same construct as `order.spec.ts`: no `page` fixture, no browser
// cost, and it still runs on `chromium` and `mobile` like every other spec
// because it is untagged.
//
// Why these two are NOT page tests:
//
//   1. THE NORMALIZER MIRROR. What a browser can see is the RESULT — the chips
//      the server sent back — and `item-editing.spec.ts` asserts exactly that.
//      What it cannot see is the client's own answer BEFORE the round trip,
//      which is what stops a duplicate being offered to the server at all. A DOM
//      test of it would be a test of the server's reply wearing the client's
//      clothes.
//   2. THE ORPHAN GUARD'S PREDICATE. Since Story 9.3 no API path can create an
//      item whose category is not on its list, so the fixture cannot be built
//      through the app. The predicate is pure and is proven here; the DIALOG
//      wiring (guard fires, dialog stays open, no SaveItem) is a page test in
//      `item-editing.spec.ts` that builds the orphan by rewriting the
//      `Categories` response at the wire.
//
// Both modules are imported by RELATIVE path: `tsconfig.e2e.json` defines no
// `@/` alias, which is also why both modules are import-free themselves.

test('9.6 — normalizeStores trims, drops blanks, and dedupes by case-insensitive key', () => {
  // The matrix's mixed-input row, mirrored from the server's StoreNames.normalize.
  expect(normalizeStores([' Lidl ', 'lidl', '', 'Aldi Nord'])).toEqual(['Lidl', 'Aldi Nord'])

  // FIRST occurrence wins — its casing AND its position.
  expect(normalizeStores(['lidl', 'LIDL', 'Lidl'])).toEqual(['lidl'])
  expect(normalizeStores(['Rewe', 'Aldi'])).toEqual(['Rewe', 'Aldi'])

  // Blank-only input is the empty list, never ['']: an empty name would render
  // an empty chip on the shopping row and pollute the suggestions.
  expect(normalizeStores([])).toEqual([])
  expect(normalizeStores(['', '   ', '\t'])).toEqual([])

  // Internal whitespace is part of the name, not padding.
  expect(normalizeStores(['  Aldi   Nord  '])).toEqual(['Aldi   Nord'])
})

test('9.6 — storeKey is trim + lowercase, and nothing locale-dependent', () => {
  expect(storeKey(' Lidl ')).toBe('lidl')
  expect(storeKey('LIDL')).toBe(storeKey('lidl'))
  // The identity is the KEY; the casing is display data. Two names that differ
  // only in case are ONE store, which is why a casing-only edit is still a
  // change the dialog sends (exact string equality decides "changed").
  expect(storeKey('Aldi Nord')).toBe('aldi nord')
  // `toLowerCase`, never `toLocaleLowerCase`: under a Turkish locale the latter
  // maps 'I' to a dotless 'ı' and would stop agreeing with the server's
  // `lowercase(Locale.ROOT)`. This is the assertion that would fail if someone
  // swapped it.
  expect(storeKey('LIDL')).toBe('lidl')
})

test('9.6 — isKnownCategoryId rejects an id that is not on the list (the orphan guard)', () => {
  const categories = [{id: 'cat-a'}, {id: 'cat-b'}]

  expect(isKnownCategoryId('cat-a', categories)).toBe(true)
  // The orphan: a stored category id that no longer exists. `validate()` used to
  // accept it, `nothingChanged` then fired, and the dialog closed silently with
  // the item still orphaned.
  expect(isKnownCategoryId('cat-gone', categories)).toBe(false)
  // The blank the Select shows for an orphan, and the empty-list case.
  expect(isKnownCategoryId('', categories)).toBe(false)
  expect(isKnownCategoryId('cat-a', [])).toBe(false)
})
