// Store-field value rules, shared by StoreField and both item dialogs (Story
// 6.1, made multi-value in Story 9.6). Lives in lib/ rather than alongside the
// component because react-refresh/only-export-components forbids a component
// file from also exporting a plain function.
//
// IMPORT-FREE on purpose. `e2e/item-fields.spec.ts` imports this module by
// relative path and `tsconfig.e2e.json` defines no `@/` paths, so a single
// aliased import here would break the browserless spec — the same constraint
// `src/lib/lists/order.ts` lives under for `e2e/order.spec.ts`.

export const STORE_MAX = 100

// The identity of a store name. `trim()` + `toLowerCase()`, and deliberately
// NEVER `toLocaleLowerCase()`: the server keys on `lowercase(Locale.ROOT)`, and
// a browser in a Turkish locale would key "LIDL" to "lıdl" and stop agreeing
// with it. Two names with the same key are ONE store.
export function storeKey(name: string): string {
  return name.trim().toLowerCase()
}

// The client MIRROR of the server's normalizer (`StoreNames.normalize`): trim
// every name, drop the blanks, and collapse duplicate keys keeping the FIRST
// occurrence — its casing and its position.
//
// The mirror exists for immediate feedback while the dialog is open (a duplicate
// is refused as it is typed, not after a round trip). It is NOT authority: the
// server normalizes again on every create and update, and what it stores is what
// renders. Where the two could disagree, the server wins by construction.
export function normalizeStores(raw: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const name of raw) {
    const trimmed = name.trim()
    if (trimmed.length === 0) continue
    if (!seen.has(storeKey(trimmed))) seen.set(storeKey(trimmed), trimmed)
  }
  return [...seen.values()]
}
