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

// The guaranteed first-boot admin. Declared HERE rather than in ./ui.ts so the
// globalSetup/globalTeardown phases can use it: this module imports nothing from
// `@playwright/test`, and ./ui.ts does. ./ui.ts re-exports it, so specs keep
// importing their UI credentials from one place.
export const ADMIN = {username: 'admin', password: 'admin'}

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

// ─────────────────────────────────────────────────────────────────────────────
// Story 9.2 — admin user SETUP and TEARDOWN.
//
// Setup only, like everything else here: these seed a table the UI then drives,
// and they back the per-run sweep in ../global-teardown.ts. No asserted
// behaviour goes through them.
// ─────────────────────────────────────────────────────────────────────────────

export interface E2eUser {
  id: string
  username: string
}

// The marker every generated E2E username carries (see `uniqueUsername` in
// ./ui.ts). It is the SWEEP KEY: the teardown deletes exactly the rows whose
// username contains it, so a human-created account is never touched.
export const E2E_USERNAME_MARKER = '_e2e_'

export async function createUserApi(token: string, username: string, password: string): Promise<E2eUser> {
  const data = await gql<{createUser: E2eUser}>(
    `mutation { createUser(username: "${username}", password: "${password}") { id username } }`,
    token,
  )
  return data.createUser
}

export async function deleteUserApi(token: string, id: string): Promise<void> {
  await gql<{deleteUser: {id: string}}>(`mutation { deleteUser(id: "${id}") { id } }`, token)
}

// The table's total, read with the smallest possible page. Used to measure the
// before/after DELTA a test created, never to assert an absolute size.
export async function countUsersApi(token: string): Promise<number> {
  const data = await gql<{users: {totalCount: number}}>(`{ users(limit: 1) { totalCount } }`, token)
  return data.users.totalCount
}

// Every `_e2e_` row in the table, paged at the server's maximum until exhausted.
//
// The loop terminates on the SERVED offset plus the page length reaching the
// total — never on an empty page, because an offset past the end is clamped back
// to the last page rather than answered with nothing, which would spin forever.
export async function listE2eUsers(token: string): Promise<E2eUser[]> {
  const found: E2eUser[] = []
  let offset = 0
  for (;;) {
    const data = await gql<{users: {users: E2eUser[]; totalCount: number; offset: number}}>(
      `{ users(limit: 100, offset: ${offset}) { users { id username } totalCount offset } }`,
      token,
    )
    const page = data.users
    found.push(...page.users.filter(u => u.username.includes(E2E_USERNAME_MARKER)))
    if (page.users.length === 0) break
    const next = page.offset + page.users.length
    if (next >= page.totalCount) break
    offset = next
  }
  return found
}
