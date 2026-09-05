import {CombinedGraphQLErrors} from '@apollo/client/errors'

// graphql-kotlin's default exception handler wraps every resolver error message
// as `Exception while fetching data (/field) : <real message>`. Strip that
// wrapper so the user sees the intended message ("Username already taken",
// "User not found") rather than the framework noise. Backend stays untouched.
const RESOLVER_WRAPPER = /^Exception while fetching data \([^)]*\)\s*:\s*/

// Extract a user-facing message from an Apollo error. Admin resolver failures
// arrive as CombinedGraphQLErrors (data null, errors[] populated) — surface the
// first error's `message` (the backend copy is user-facing, e.g. "Username
// already taken"). Everything else — network faults, transport errors — carries
// a low-level technical message ("Failed to fetch", "Load failed") that is not
// fit to show, so those fall through to the friendly generic line. The result
// is always non-empty, so a failure can never leave a dialog with no feedback.
// Errors are shown inline (dialog/panel alert) — never a toast.
export function graphqlErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (CombinedGraphQLErrors.is(error)) {
    const message = error.errors[0]?.message?.replace(RESOLVER_WRAPPER, '')
    if (message) return message
  }
  return fallback
}

// True when an Apollo error carries the backend's `FORBIDDEN` code — the only
// stable extensions.code on list resources (admin-blocked or non-member). The
// shopping view uses this to redirect a would-be viewer to /lists gracefully
// instead of rendering a broken/empty screen (Story 5.6).
export function isForbiddenError(error: unknown): boolean {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some(e => e.extensions?.code === 'FORBIDDEN')
  }
  return false
}

// The backend's rejections are developer copy carrying raw UUIDs (ItemService
// throws IllegalArgumentException, which graphql-kotlin surfaces verbatim with
// no extensions.code, so the message string is the only signal there is —
// project convention, not a shortcut). One of them is reachable through the
// normal UI and must not be shown as-is: when a co-member deletes a category,
// the item keeps the dead id, EditItemDialog pre-selects it, the Select renders
// blank, and saving fails with "Category 3f2a… does not belong to list 7c1b…".
// The user's actual next step is "pick a category", so say that. Matching on the
// message is unavoidable here and is pinned by the backend tests that assert
// this exact wording (ItemLifecycleTest AC4). Review finding, 2026-08-21.
const CATEGORY_NOT_ON_LIST = /^Category [0-9a-f-]+ does not belong to list [0-9a-f-]+$/i

export function itemSaveErrorMessage(error: unknown): string {
  const message = graphqlErrorMessage(error)
  if (CATEGORY_NOT_ON_LIST.test(message)) {
    return 'This item\u2019s category no longer exists. Choose a category and save again.'
  }
  return message
}
