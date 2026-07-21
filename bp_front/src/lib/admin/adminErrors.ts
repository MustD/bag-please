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
