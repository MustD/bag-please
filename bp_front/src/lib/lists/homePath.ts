import {useQuery} from '@apollo/client/react'
import {ListsQuery} from '@/lib/lists/listsQueries'
import {useAuth} from '@/lib/auth/AuthContext'

// Where `/` resolves to, in ONE place (Story 7.5, FR38/FR57). Both consumers —
// HomeRedirect, which performs the redirect, and AppShell's title link, which
// only decorates the answer — read it from here. AppShell must never re-derive
// it (AR-E6-7 / AR-E7-8): two implementations of "which list is home" is the
// defect class this hook exists to close.

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
export function byCreatedAtAsc(a: {id: string, createdAt: string}, b: {id: string, createdAt: string}): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id)
    return Number.isNaN(ta) ? 1 : -1
  }
  return ta - tb || a.id.localeCompare(b.id)
}

// `mode` decides whether this consumer may ISSUE the membership-gated lists
// request:
//   'resolve' — HomeRedirect, which owns the redirect: default cache-first, so
//               it fetches and shows its spinner while the answer is unknown.
//   'observe' — AppShell's title link, which only decorates an answer that
//               already exists: cache-only, so the app bar never fires its own
//               membership-gated request (the same reason ListDetailPage.tsx:52
//               uses cache-only). A cold cache yields null ⇒ a LIVE link, which
//               is the safe direction: fail toward navigating, never toward a
//               dead control (UX-DR-E7-4).
//
// Branch order is load-bearing: `!data` MUST precede the empty-list check.
// Without it a cold cache in observe mode reads as `[]` → `/lists`, and the link
// would go inert on `/lists` for a user who actually owns lists. `null` is the
// only honest answer for "not known yet", and it maps to the two correct
// behaviours — a spinner in HomeRedirect, a live link in AppShell.
export function useHomePath(mode: 'resolve' | 'observe'): string | null {
  const {role} = useAuth()
  const isAdmin = role === 'admin'
  // Hooks run unconditionally; the query is skipped for admin (the backend
  // FORBIDs admin from every list resource, so it would only ever error).
  const {data, error} = useQuery(ListsQuery, {
    skip: isAdmin,
    fetchPolicy: mode === 'observe' ? 'cache-only' : 'cache-first',
  })

  if (isAdmin) return '/admin'
  // Graceful: a transient lists-query failure resolves to the index, which
  // surfaces its own notice. Without a URL bar this branch is the only recovery
  // (UX-DR-E7-6b) — never narrow it.
  if (error) return '/lists'
  if (!data) return null
  const lists = data.lists?.lists ?? []
  if (lists.length === 0) return '/lists'
  return `/list/${[...lists].sort(byCreatedAtAsc)[0].id}`
}
