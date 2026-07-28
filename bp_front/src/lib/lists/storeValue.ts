// Store-field value rules, shared by StoreField and both item dialogs (Story
// 6.1). Lives in lib/ rather than alongside the component because
// react-refresh/only-export-components forbids a component file from also
// exporting a plain function.

export const STORE_MAX = 100

// Normalize a typed store into what the backend should hold: a trimmed value, or
// null when the user left it blank / whitespace-only. NEVER '' — there is no trim
// anywhere in the backend store path, so an empty string would persist, render an
// empty chip on the shopping view, and pollute `itemStoreSuggestions`. One
// definition so a later validation change cannot land in the add dialog and miss
// the edit dialog.
export function normalizeStore(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
