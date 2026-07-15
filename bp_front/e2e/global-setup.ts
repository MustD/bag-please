// One-time suite setup: enable public registration so the real register flow
// (Scenario 1) can succeed. This is environment prep — the registration and
// login endpoints themselves stay real in every test; we only flip a shared
// backend flag once, up front. The ./db/data volume persists across runs, so
// this is written idempotently (set to true; never assume a starting value).
//
// Note: this talks to the same :2080 stack the tests use. We poll for backend
// readiness first so setup is robust regardless of the webServer/globalSetup
// ordering.

const BASE_URL = 'http://localhost:2080'

async function waitForBackend(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/config`)
      if (res.ok) return
    } catch {
      // backend not up yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('Backend at :2080 never became ready for global setup')
}

async function globalSetup(): Promise<void> {
  await waitForBackend()

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: 'admin', password: 'admin'}),
  })
  if (!loginRes.ok) throw new Error(`Admin login failed in global setup: ${loginRes.status}`)
  const {accessToken} = (await loginRes.json()) as { accessToken: string }

  const gqlRes = await fetch(`${BASE_URL}/api/graphql`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`},
    body: JSON.stringify({
      query: 'mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }',
    }),
  })
  if (!gqlRes.ok) throw new Error(`Enable-registration request failed: ${gqlRes.status}`)
  const body = (await gqlRes.json()) as { errors?: unknown }
  if (body.errors) throw new Error(`Enable-registration returned errors: ${JSON.stringify(body.errors)}`)
}

export default globalSetup
