// KEEP THIS MODULE IMPORT-FREE. `e2e/order.spec.ts` imports it by relative path,
// which pulls it into the e2e TypeScript project, and `tsconfig.e2e.json`
// defines no `paths` — so the first `@/…` import added here (or to anything
// this file imports) breaks `tsc -b` in a project nobody thinks to look at.
// It compiles today only because there is nothing above this line.

// THE one definition of how a list is ORDERED and GROUPED (Story 8.5, FR62,
// NFR-E8-5). Both list surfaces read it: the shopping view (/list/:id) and the
// management view (/lists/:id).
//
// It exists because those two screens had drifted into reading the same list two
// different ways: /list/:id sorted categories and items by name and bucketed
// items whose category id had no local match into a synthetic "Uncategorized"
// group; /lists/:id sorted NOTHING (raw query order, and the backend's map order
// is not stable — three consecutive pre-fix runs of the FR62 ordering spec
// produced three different sequences) and had no such bucket at all, so an item
// orphaned by a category removal was visible while shopping and invisible on the
// only screen that can edit or delete it.
//
// The grouping is LIFTED here rather than reimplemented per screen. Two screens
// deciding independently what "an item with no category" means is the exact
// drift FR62 exists to close; `keepEmpty` is the ONE deliberate difference
// between them (see `groupItemsByCategory`).
//
// Plain `.ts` on purpose: `react-refresh/only-export-components` is on for
// `src/`, so a module exporting non-components must not also be a `.tsx`
// component module. The same reason `itemFilter.ts` is not `ListFilters.tsx`.

// Numeric createdAt ordering. `Instant.toString()` drops the fractional part
// entirely at zero nanos, so a whole-second value like `…:05Z` sorts AFTER a
// sub-second `…:05.100Z` under localeCompare ('Z' 0x5A > '.' 0x2E) even though
// it is genuinely 100ms older — which is how `/` occasionally opened the wrong
// list (FR38). Parsing to epoch milliseconds removes the precision dependency
// without touching the wire format (AR-E7-7 rejects a backend change here).
// The comparator must stay TOTAL (review patch, 2026-08-11). Two ways it would
// not be, both introduced by moving from string to numeric compare:
//   1. `createdAt` is `String` on the wire, so nothing in the type system
//      guarantees `Instant.toString()`. An unparseable value makes `Date.parse`
//      return NaN, and a comparator that returns NaN yields an
//      implementation-defined ordering — the whole array, not just the bad row.
//      Unparseable values are pushed to the end instead.
//   2. `Date.parse` truncates to milliseconds, where the lexicographic compare
//      it replaces saw nanoseconds. Two lists created inside the same
//      millisecond therefore tie; `id` breaks the tie so `/` resolves to the
//      same list on every load rather than following the backend's map order.
//
// It lives HERE, not in `homePath.ts`, since Story 8.5: a pure comparator has no
// business dragging `useQuery` + `useAuth` behind it into every module that only
// wants to sort (deferred-work.md, Story 7.5 review). `useHomePath` imports it
// from here like everyone else.
export function byCreatedAtAsc(a: {id: string, createdAt: string}, b: {id: string, createdAt: string}): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id)
    return Number.isNaN(ta) ? 1 : -1
  }
  return ta - tb || a.id.localeCompare(b.id)
}

// THE name comparator (AC3). Every by-name sort of a named list entity goes
// through this — categories, items, and the category filter's menu — so
// `grep -rn "localeCompare" src/` finds it defined once. Deliberately narrow:
// it takes `{name}` and nothing else, which is why `StoreField.tsx` (a sort of a
// bare `string[]` of store names) is NOT a caller and must not be forced into
// one — widening this to accept strings too would make the shared definition
// vaguer than the three call sites it actually serves.
//
// NO id tiebreak here, deliberately, and it is not an oversight: this is the
// NAME comparator, and one of its three callers — `ListFilters`'s menu — sorts
// a `{id, name}` projection whose only requirement is alphabetical. The
// tiebreak that makes an ordering TOTAL belongs to the place that owns the
// rendered sequence, which is `groupItemsByCategory` below; see the note there
// for why stability alone is not enough.
export function byName(a: {name: string}, b: {name: string}): number {
  return a.name.localeCompare(b.name)
}

// `byName`, made TOTAL by an id tiebreak. `Array.prototype.sort` is stable per
// spec, so a name-only comparator preserves INPUT order for equal names — and
// the input here is the backend's map order, which is not stable (three
// consecutive pre-fix runs of the FR62 ordering spec returned three different
// sequences). Stability over an unstable input is no stability at all: two
// same-named categories on one list would swap places between renders. The id
// is the only field both sorted shapes carry that is guaranteed distinct, so it
// is what settles the tie — the same construction `byCreatedAtAsc` uses, and
// for the same reason.
//
// Not exported: nothing outside this module sorts a rendered list, and the two
// screens reach it through `groupItemsByCategory`.
function byNameThenId(a: {id: string; name: string}, b: {id: string; name: string}): number {
  return byName(a, b) || a.id.localeCompare(b.id)
}

// The synthetic bucket's identity, in one place because two screens render it
// and the E2E addresses it by the visible name on both.
export const UNCATEGORIZED_KEY = '__uncategorized__'
export const UNCATEGORIZED_NAME = 'Uncategorized'

// A displayable group: a real category, or the synthetic "Uncategorized" bucket
// for items whose category id has no local match (a category deleted under a
// stale client, or a realtime item arriving in a not-yet-known category) so
// items never vanish.
//
// `category` is `null` for the synthetic bucket, and that null is the WHOLE
// interface for "render no category-level controls here": there is nothing to
// add into and nothing to remove. Each screen reads it rather than re-deriving
// the bucket from the key.
export interface ItemGroup<C, I> {
  key: string
  name: string
  category: C | null
  items: readonly I[]
}

// Group items under their categories, by name, with orphans in a trailing
// synthetic bucket. Generic over both shapes so the two routes can pass their
// own GraphQL types without a cast.
//
// `keepEmpty` is the ONLY difference between the two surfaces, and it is a
// deliberate product difference, not an accident (AC5):
//   * `/list/:id` passes `false` — always. A category with nothing to buy is
//     noise while shopping.
//   * `/lists/:id` passes `!filterActive`. With no filter an empty category
//     still renders, with its "No items yet." row and its add-item affordance:
//     this is a management screen, and a category you cannot see is a category
//     you cannot fill. While a filter or search IS active, a card with zero
//     matching items is dropped (Story 8.4 AC4).
// The synthetic bucket is never subject to `keepEmpty` — it is only created when
// it has members, so "no orphans ⇒ no group" holds on both screens by
// construction.
export function groupItemsByCategory<
  C extends {id: string; name: string},
  I extends {id: string; name: string; category: string},
>(
  categories: readonly C[],
  items: readonly I[],
  {keepEmpty}: {keepEmpty: boolean},
): ItemGroup<C, I>[] {
  // A Set, not a Map: only membership is asked, and this runs on every
  // `/lists/:id` render (that screen memoises nothing, deliberately).
  const known = new Set(categories.map(category => category.id))
  const byCategory = new Map<string, I[]>()
  const orphans: I[] = []
  for (const item of items) {
    if (known.has(item.category)) {
      const bucket = byCategory.get(item.category) ?? []
      bucket.push(item)
      byCategory.set(item.category, bucket)
    } else {
      orphans.push(item)
    }
  }
  const groups: ItemGroup<C, I>[] = [...categories]
    .sort(byNameThenId)
    .map(category => ({
      key: category.id,
      name: category.name,
      category,
      items: [...(byCategory.get(category.id) ?? [])].sort(byNameThenId),
    }))
    .filter(group => keepEmpty || group.items.length > 0)
  // LAST, always — an orphan is an exception state, not a peer of the real
  // categories, and burying it alphabetically among them would read as one.
  if (orphans.length > 0) {
    groups.push({
      key: UNCATEGORIZED_KEY,
      name: UNCATEGORIZED_NAME,
      category: null,
      items: [...orphans].sort(byNameThenId),
    })
  }
  return groups
}
