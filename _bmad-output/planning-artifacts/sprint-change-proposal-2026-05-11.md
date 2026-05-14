# Sprint Change Proposal — Frontend E2E Testing Requirements

**Date:** 2026-05-11
**Workflow:** Correct Course
**Scope:** Minor — directly implementable by Developer agent
**Status:** Approved

---

## Section 1: Issue Summary

**Problem statement:** The project has no frontend e2e test requirements, framework, or stories. The
`project-context.md` testing rules for the frontend explicitly state *"No frontend test framework is settled
yet — configuration is TBD"* — a deliberate deferral that was never resolved. No epic or story in the plan
covers frontend test infrastructure or coverage.

**Discovery context:** Identified proactively before Story 1.4 (Login & Registration UI) begins, which is
the optimal moment — framework setup and first tests can be written alongside the remaining UI stories
rather than retrofitted after the fact.

**Evidence:**

- `project-context.md` → Testing Rules → Frontend: *"No frontend test framework is settled yet —
  configuration is TBD; do not assume any specific framework is in place"*
- `epics.md`: zero stories covering frontend testing across both epics
- `deferred-work.md`: frontend testing never appears as a deferred item to be picked up
- PRD NFRs 1–16: no NFR covers frontend e2e testing

---

## Section 2: Impact Analysis

### Epic Impact

| Epic   | Status      | Impact                                                                                            |
|--------|-------------|---------------------------------------------------------------------------------------------------|
| Epic 1 | in-progress | New Story 1.6 added: E2E Test Infrastructure & Auth Flow Coverage                                 |
| Epic 2 | backlog     | No new stories needed; each Epic 2 story's definition of done includes e2e coverage for its flows |

### Story Impact

**New story:** Story 1.6 — E2E Test Infrastructure & Auth Flow Coverage (Epic 1, backlog)

**Existing stories unaffected:** Stories 1.1–1.3 (done), 1.4–1.5 (backlog, no changes to scope or ACs).

Epic 2 stories (2.1–2.4) absorb e2e coverage of their own flows without requiring a separate story — the
framework and patterns established in Story 1.6 make this low-friction.

### Artifact Conflicts

| Artifact           | Change Type | Summary                                                        |
|--------------------|-------------|----------------------------------------------------------------|
| PRD                | Addition    | New NFR17, NFR18 for frontend e2e testing                      |
| Architecture       | Addition    | New frontend testing subsection (Playwright, config, patterns) |
| project-context.md | Update      | Frontend testing rules → Playwright, replaces TBD              |
| epics.md           | Addition    | New Story 1.6 appended to Epic 1                               |
| sprint-status.yaml | Addition    | `1-6-e2e-test-infrastructure-auth-flow-coverage: backlog`      |

### Technical Impact

- New dev dependency: `@playwright/test` added to `bp_front/`
- New config file: `bp_front/playwright.config.ts`
- New directory: `bp_front/e2e/`
- New npm script: `test:e2e`
- No backend changes. No schema regeneration needed. No infrastructure changes.

---

## Section 3: Recommended Approach

**Option 1 — Direct Adjustment.** Additive only: insert Story 1.6 into the existing plan, update three
artifact documents, and add a sprint-status entry. The existing story sequence (1.4 → 1.5 → 1.6) is
preserved. No rollback, no MVP scope change.

**Rationale:**

- Zero risk to completed work (1.1–1.3 done)
- Perfect timing — 1.4 and 1.5 are unstarted; 1.6 can follow immediately
- Playwright is the official Next.js e2e framework recommendation; setup cost is minimal
- Low effort (Low), Low risk (Low)

---

## Section 4: Detailed Change Proposals

### 4.1 New Story 1.6 — epics.md

Added to Epic 1, after Story 1.5:

```
### Story 1.6: E2E Test Infrastructure & Auth Flow Coverage

As a developer maintaining bag-please,
I want a Playwright e2e test suite covering the core auth flows,
So that regressions in login, registration, session handling, and route
guards are caught before they reach production.

Acceptance Criteria:

Given the Playwright suite is configured in bp_front/
When `npx playwright test` is run against a locally running app (nginx on
:2080, backend on :4000, MongoDB running)
Then all tests pass and an HTML report is produced

Given an unauthenticated user visits any protected route (e.g. /)
When the route guard evaluates
Then the browser is redirected to /auth

Given the login form is submitted with valid credentials
When the server responds with a token and username
Then the user lands on / and the UserChip shows the correct username in
the AppBar

Given the login form is submitted with invalid credentials
When the server returns an error
Then an inline FormHelperText error appears below the password field
And no redirect occurs

Given a new username not already in the database
When the registration form is submitted
Then the user is auto-logged-in and redirected to /
And the WelcomeBanner is visible on the home page

Given the registration form is submitted with a username already taken
When the server returns an error
Then an inline FormHelperText error appears below the username field

Given a logged-in user clicks Logout
When the logout action fires
Then the browser is redirected to /auth
And a subsequent navigation to / redirects back to /auth

Given the user was redirected to /auth due to session expiry
When the login page renders
Then an Alert with session-expiry text is visible above the form heading

Technical Notes:
- Playwright config lives at bp_front/playwright.config.ts
- Tests live at bp_front/e2e/
- Base URL: http://localhost:2080
- Use Playwright's built-in browser isolation; no shared auth state between
  test files
- Tests requiring an authenticated user must perform login via the UI or
  via a setup fixture that calls POST /api/auth/login directly
- `npm run test:e2e` added to bp_front/package.json scripts
- CI: tests run in headed=false mode; HTML report artifact retained
```

### 4.2 PRD NFR Additions

Added after NFR16:

```
NFR17: The frontend has a Playwright e2e test suite covering all auth and
session flows; the suite runs against the full stack (nginx + backend +
MongoDB) and must pass with zero failures before any Epic 1 or Epic 2
story is marked done.

NFR18: E2E tests use browser-level isolation (no shared auth state across
test files); tests that require an authenticated session establish it via
a Playwright setup fixture calling POST /api/auth/login directly rather
than driving the UI login form each time.
```

### 4.3 Architecture — Frontend Testing Subsection

Replaces the TBD note; added to "New Dependencies Required":

```
Frontend (`bp_front/package.json`):
- No new runtime packages required. MUI v9, Apollo Client 4, Next.js 16
  cover all auth and admin UI needs.
- Dev dependency added: `@playwright/test` for e2e testing.
  Config: bp_front/playwright.config.ts
  Tests: bp_front/e2e/
  Script: npm run test:e2e
  Base URL: http://localhost:2080 (full stack must be running)
```

### 4.4 project-context.md — Testing Rules → Frontend

Replaces the TBD placeholder:

```
#### Frontend (Playwright e2e)
- Framework: Playwright — config at bp_front/playwright.config.ts,
  tests at bp_front/e2e/, run via npm run test:e2e
- Base URL: http://localhost:2080 — full stack (nginx + backend + MongoDB)
  must be running before tests execute
- Auth isolation: each test file is browser-isolated; authenticated
  scenarios use a Playwright setup fixture calling POST /api/auth/login
  and saving storageState — never drive the UI login form in every test
- No component/unit test framework settled yet — TBD for future scope
```

### 4.5 sprint-status.yaml

```yaml
1-6-e2e-test-infrastructure-auth-flow-coverage: backlog
```

Added after `1-5-user-identity-account-management-ui: backlog`.

---

## Section 5: Implementation Handoff

**Scope classification:** Minor — Developer agent can implement directly.

**Handoff:** Developer agent (Story 1.6 after 1.5 completes).

**Responsibilities:**

- Install Playwright: `npm install --save-dev @playwright/test && npx playwright install`
- Create `playwright.config.ts` with baseURL, reporter, and project configuration
- Implement auth setup fixture for authenticated test state
- Write e2e tests covering all Story 1.6 ACs
- Add `test:e2e` script to `package.json`

**Success criteria:**

- `npm run test:e2e` passes with zero failures against a running local stack
- HTML report produced
- All 8 ACs from Story 1.6 have at least one corresponding test
- Epic 2 stories include e2e coverage of their own flows as part of their definition of done

**Epic 2 guidance:** Each Epic 2 story (2.1–2.4) is responsible for its own e2e coverage. The framework and
auth fixture from Story 1.6 are available; no separate Epic 2 e2e story is needed.
