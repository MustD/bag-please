// Shared API-only SETUP helpers for the E2E suite (Story 7.2 extraction).
//
// These are environment PREPARATION only — never a shortcut for behaviour under
// test (AR-E7-5). Every asserted behaviour is driven through the UI; see
// ./ui.ts.
//
// This module deliberately imports nothing from `@playwright/test`:
// `global-setup.ts` runs in Playwright's globalSetup phase, before the runner
// exists, and since Story 7.3 it imports BACKEND/loginApi/gql from here. A
// top-level runner import here would drag the test runner into that phase.

// Backend for API-only SETUP (membership seeding + token minting). Hit the Caddy
// entrypoint on :2080 directly — same rationale as global-setup.ts — independent
// of E2E_BASE_URL, which only controls the browser-facing origin under test.
export const BACKEND = 'http://localhost:2080'

export async function loginApi(username: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password}),
  })
  if (!res.ok) throw new Error(`API login failed for ${username}: ${res.status}`)
  const {accessToken} = (await res.json()) as {accessToken: string}
  return accessToken
}

export async function gql<T>(query: string, token: string): Promise<T> {
  const res = await fetch(`${BACKEND}/api/graphql`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify({query}),
  })
  const body = (await res.json()) as {data?: T; errors?: unknown}
  if (!res.ok || body.errors || !body.data) {
    throw new Error(`GraphQL setup call failed: ${res.status} ${JSON.stringify(body.errors)}`)
  }
  return body.data
}
