// Story 9.6 — the ORPHAN GUARD for EditItemDialog, extracted so it can be
// asserted without a browser.
//
// An item whose category is no longer on the list (legacy data — since Story 9.3
// no API path can make a fresh one) opens the edit dialog with a BLANK category
// `Select`: the stored id is out of range. `categoryId` is still that stale id,
// so `validate()` used to pass, `nothingChanged` then fired, and the dialog
// closed silently leaving the orphan orphaned with no feedback (the OPEN
// deferred-work entry carried from Story 8.5 through 8.6).
//
// Guarding in `validate()` — not in `nothingChanged` — is what fixes it for
// every path: the short-circuit is never reached, and a real save with a stale
// id is rejected client-side before the server has to.
//
// Its own IMPORT-FREE module so the predicate can be asserted without a browser
// (`e2e/item-fields.spec.ts`, exactly as `e2e/order.spec.ts` does for the
// duplicate-name ordering). The dialog-level behaviour — the guard actually
// stopping the silent close — is asserted in `e2e/item-editing.spec.ts`, which
// builds the orphan by rewriting the `Categories` response on the wire.
export function isKnownCategoryId(
  categoryId: string,
  categories: readonly {id: string}[],
): boolean {
  return categories.some(category => category.id === categoryId)
}
