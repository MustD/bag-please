import {useState} from 'react'

// THE one definition of the list item filter — its value, its predicate, and the
// two render-phase adjustments that keep the value honest (Story 8.4, FR61,
// NFR-E8-5). Both list surfaces read it: the shopping view (/list/:id) and the
// management view (/lists/:id).
//
// It exists because the previous instance of this defect class already cost the
// project a story: Story 5.6 shipped a category filter on the shopping view
// only, and by Epic 8 the two screens had drifted so far apart that /lists/:id
// had no filter at all while /list/:id could only ever select ONE category. A
// second copy of anything in this file is a review failure.
//
// Plain `.ts` on purpose: `react-refresh/only-export-components` is on for
// `src/`, so a module exporting non-components must not also be a `.tsx`
// component module. The UI half lives in `@/components/ListFilters`.

export interface ItemFilterValue {
  // EMPTY MEANS ALL. Not "none" — an empty selection is the unfiltered default
  // and is what the "All categories" affordance restores. Every consumer and
  // every branch below depends on that reading.
  categoryIds: readonly string[]
  search: string
}

export const EMPTY_ITEM_FILTER: ItemFilterValue = {categoryIds: [], search: ''}

// The shopping view's checked-status choice. It is NOT part of `ItemFilterValue`
// — the management screen has no such control — but it belongs to the filter's
// vocabulary, so it lives here with the rest of it rather than in the component
// module. `ListFilters.tsx` is a component module; a non-component export there
// slips past `react-refresh/only-export-components` only because type-only
// exports are exempt, which is a lint technicality, not a reason.
export type CheckedFilter = 'all' | 'unchecked' | 'checked'

// Category selection AND name search, combined with AND. The checked-status
// toggle is deliberately NOT here: it exists on the shopping view only, so it is
// AND-ed in by that page rather than pushed into the shared predicate (a shared
// predicate carrying a field one of its two callers can never set is how the
// next drift starts).
//
// Search is trimmed and case-insensitive, so a whitespace-only term is no term
// at all — the same reading `isItemFilterActive` uses.
export function matchesItemFilter(
  item: {name: string; category: string},
  value: ItemFilterValue,
): boolean {
  if (value.categoryIds.length > 0 && !value.categoryIds.includes(item.category)) return false
  const term = value.search.trim().toLowerCase()
  if (term !== '' && !item.name.toLowerCase().includes(term)) return false
  return true
}

// "Is the user narrowing the view right now?" — what the management screen
// branches on to decide whether an EMPTY category is still worth rendering.
// Trimmed, so `'   '` is not a filter-active state.
export function isItemFilterActive(value: ItemFilterValue): boolean {
  return value.categoryIds.length > 0 || value.search.trim() !== ''
}

// The filter value plus both adjustments that have to happen while it is held.
//
// `onListChange` is invoked when the active list changes, for state the CALLER
// owns and this hook cannot (the shopping view's checked-status toggle). It runs
// inside the render-phase adjustment below, i.e. during the render of the
// component that called this hook — so a `setState` in it is the same legal
// render-phase update as the ones here, not a cross-component render mutation.
//
// BOTH adjustments are render-phase, never a `useEffect`: the project's lint
// (`eslint-plugin-react-hooks` 7.x flat recommended) forbids set-state-in-effect,
// and an effect would also render one frame of the wrong list's filter first.
export function useItemFilter(
  listId: string,
  categories: ReadonlyArray<{id: string}>,
  onListChange?: () => void,
): [ItemFilterValue, (next: ItemFilterValue) => void] {
  const [value, setValue] = useState<ItemFilterValue>(EMPTY_ITEM_FILTER)

  // 1. LIST SWITCH. The switcher chip re-renders the same route element in place
  //    (no unmount), so the filter would otherwise carry over — and a category id
  //    from the previous list matches nothing here, leaving the view stuck on
  //    "no matches". The `prevListId` sentinel is what keeps this from looping.
  const [prevListId, setPrevListId] = useState(listId)
  if (listId !== prevListId) {
    setPrevListId(listId)
    setValue(EMPTY_ITEM_FILTER)
    onListChange?.()
  }

  // 2. STALE SELECTION. A selected category can vanish under us (a second member
  //    deletes it; a CategoryUpdates event arrives). Prune EVERY id that no
  //    longer exists and KEEP the rest — dropping the whole selection would throw
  //    away the user's other, still-valid choices, which is the difference
  //    between this and the single-id reset it replaces.
  //
  //    The `some(...)` guard is load-bearing: an unconditional `setValue` on
  //    every render re-renders forever.
  if (value.categoryIds.some(id => !categories.some(c => c.id === id))) {
    setValue(v => ({
      ...v,
      categoryIds: v.categoryIds.filter(id => categories.some(c => c.id === id)),
    }))
  }

  return [value, setValue]
}
