// One-time suite setup: enable public registration so the real register flow
// (Scenario 1) can succeed. This is environment prep — the registration and
// login endpoints themselves stay real in every test; we only flip a shared
// backend flag once, up front. The ./db/data volume persists across runs, so
// this is written idempotently (set to true; never assume a starting value) —
// which is also what recovers a flag stranded OFF by a crashed prior run.
//
// Note: this is backend environment prep, so it always talks to the local Caddy
// entrypoint on :2080 directly — the same backend the edge proxies to. It does
// NOT follow E2E_BASE_URL (which only controls the browser-facing origin under
// test): docker compose guarantees :2080 is up, and hitting it directly avoids
// depending on the edge/TLS for one-time setup calls. That is exactly what
// `BACKEND` in ./support/api means, so this file consumes it rather than
// re-declaring the literal, and uses the shared `loginApi`/`gql` instead of its
// own inlined copies of both (Story 7.3; the convergence Story 7.2 deferred).
//
// This import is only safe because ./support/api imports nothing from
// `@playwright/test`: globalSetup runs before the runner exists. Do not add a
// runner import there — and note this file needs no credential from
// ./support/ui: it authenticates as `admin`/`admin`, not with the suite's
// registered-user PASSWORD, so it does not drag the runner-importing module in
// either.

import {BACKEND, gql, loginApi} from './support/api'

// Readiness poll first, so setup is robust regardless of the
// webServer/globalSetup ordering. /api/auth/config is the cheapest unauthed
// endpoint that proves Ktor itself is warm, not just Caddy (there is still no
// /health endpoint — tracked debt).
async function waitForBackend(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/api/auth/config`)
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
  const token = await loginApi('admin', 'admin')
  // `gql` throws with the GraphQL errors attached if the mutation is rejected,
  // so a failure to enable registration fails the whole run loudly rather than
  // leaving every register-based spec to fail one by one. The returned flag is
  // then asserted rather than discarded: a 200 with `registrationEnabled: false`
  // (a backend regression, or the mutation silently no-op'ing) would otherwise
  // sail through here and take the entire suite down one spec at a time — and
  // since Story 7.3 there is no retry wrapper left to blunt it.
  const data = await gql<{setRegistrationEnabled: {registrationEnabled: boolean}}>(
    'mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }',
    token,
  )
  if (data.setRegistrationEnabled.registrationEnabled !== true) {
    throw new Error('Enable-registration returned 200 but registrationEnabled is not true')
  }
}

export default globalSetup
