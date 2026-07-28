# Sprint Change Proposal — Frontend Reframe (Vite + MUI + Caddy)

**Author:** md
**Date:** 2026-06-23
**Workflow:** bmad-correct-course (Incremental mode)
**Scope classification:** Major (strategic pivot — frontend stack replacement + epic redefinition)

---

## Section 1 — Issue Summary

**Problem statement.** The Epic 4 frontend (Next.js 16 + React 19 + Apollo, with the elaborate
BPSheet / Today-loop / BPBottomNav UX) was delivered in an unverifiable state: mobile login was broken,
no smoke test could be completed, and there were zero E2E tests. This was the reason the original
**Epic 5 "Stabilization & Delivery"** was created in the Epic 4 retrospective (2026-05-26).

Rather than stabilize the existing frontend, the decision is to **re-implement the frontend from scratch**
on a simpler, cleaner stack, captured in `lists-feature-reframe/`:

- New **Vite + Material UI** single-page app (replacing Next.js App Router).
- **Caddy** web server (replacing the nginx reverse proxy) routing `/*` → frontend, `/api/*` → backend HTTP,
  `/api/subscriptions` → backend WebSocket.
- The existing **Ktor / GraphQL backend is unchanged** and remains the system of record.
- A hard rule: **every feature ships a real-browser Playwright E2E test, manually validated first.**

**Discovery / context.** This is a deliberate strategic pivot, not a defect. Trigger: `md` chose a
ground-up frontend rebuild over stabilizing the Epic 4 frontend. Evidence: the Epic 4 retrospective
(2026-05-26), the broken golden-path fixes (`spec-fix-list-golden-path.md`,
`spec-fix-new-list-sheet-crash.md`), and the reframe spec in `lists-feature-reframe/description.md` +
`diagram.drawio.html`.

---

## Section 2 — Impact Analysis

### Epic impact

- **Old Epic 5 "Stabilization & Delivery" — REMOVED.** It existed only as a `backlog` entry in
  `sprint-status.yaml` plus a memory note; no stories were ever written and no story files exist. Removal
  is clean. Its intent (working, verified, E2E-covered app) is absorbed into the reframe, which mandates
  E2E per feature.
- **Epics 1–4 — DONE, untouched.** All *backend* FRs are delivered there and remain valid. The *frontend*
  portions (Epic 1 auth UI, Epic 2 admin UI, Epic 4 lists UI) are functionally superseded by the new build
  but stay as historical record.
- **New Epic 5 "Frontend Reframe" — ADDED.** Re-delivers every frontend FR on the new stack.

### Story impact

No existing story files are edited. The new Epic 5 adds 7 stories (Section 4). Backend story files
(1.x, 2.x, 4.1–4.4) are untouched.

### Artifact conflicts

| Artifact                        | Impact                                                                                                                                                           | Action                                                                                                         |
|---------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| **PRD**                         | No FR changes — same requirements, new delivery vehicle.                                                                                                         | Add a reframe note; remap the *frontend* side of the FR Coverage Map to Epic 5.                                |
| **Architecture**                | Real conflict: frontend section (Next.js App Router, nginx, localStorage→context, AR11–15, AR-E4-9/10/11) is replaced by Vite SPA + Caddy + client-side routing. | Add a "Frontend Reframe" architecture delta section; mark superseded frontend ARs. Backend sections unchanged. |
| **UX**                          | Epic 4's heavy spec (BPSheet 3-state, BPBottomNav, ProgressStrip, one-timer/recurring affordances) is superseded by the simpler reframe.                         | Treat `lists-feature-reframe/description.md` as the new UX source of truth for Epic 5.                         |
| **docker-compose / routing/**   | nginx → Caddy; `bp_front` (Next.js) deleted, new Vite app added.                                                                                                 | Done within Epic 5 stories (5.1).                                                                              |
| **codegen.yml / __generated__** | GraphQL codegen must target the new Vite app's source tree.                                                                                                      | Reconfigured in story 5.1.                                                                                     |

### Technical impact

- New frontend project replaces `bp_front/` immediately (per decision — no parity-gated cutover; no
  fallback to the old frontend once removed).
- Caddy replaces nginx in `routing/` and `docker-compose.yml`.
- **Backend is off-limits** (reframe rule 2): the backend GraphQL schema and REST auth endpoints are
  consumed as-is. Any backend change must be confirmed with `md` first.

---

## Section 3 — Recommended Approach

**Selected path: Hybrid — Remove old Epic 5 + Add redefined Epic 5 (Direct Adjustment within the epic plan).**

- **Effort:** High (full frontend rebuild). **Risk:** Medium.
- **Rationale:** Stabilizing the Epic 4 frontend (the rollback-ish alternative) was judged lower-value than
  a clean rebuild on a simpler stack the team controls end-to-end. The backend is solid and stays, so risk
  is contained to the frontend tier. Replacing immediately (vs. parity-gated cutover) accepts a temporary
  no-frontend window in exchange for not maintaining two frontends in parallel.
- **MVP impact:** MVP scope is preserved at the FR level, with two deliberate **deferrals**: one-timer
  items (FR42) and recurring items (FR43) are not surfaced in the reframe frontend (backend support
  remains). Real-time collaboration (FR52/FR53) is **kept** as core to a shared-list product.

**Alternatives considered:** (1) Stabilize existing Next.js frontend — rejected (lower long-term value,
keeps complex UX the team found hard to verify). (2) Parity-gated dual-frontend cutover — rejected by `md`
in favor of immediate replacement.

---

## Section 4 — Detailed Change Proposals

### 4.1 Remove old Epic 5 (sprint-status.yaml)

```
OLD:
  # Epic 5: Stabilization & Delivery
  epic-5: backlog

NEW:
  # Epic 5: Frontend Reframe — Vite + MUI + Caddy rebuild (backend untouched)
  epic-5: backlog
  5-1-foundation-vite-mui-caddy-apollo-shell: backlog
  5-2-authentication: backlog
  5-3-user-account: backlog
  5-4-admin-user-management: backlog
  5-5-lists-management: backlog
  5-6-list-view-shopping-realtime: backlog
  5-7-sharing-and-membership: backlog
```

### 4.2 Add Epic 5 to epics.md

New `## Epic 5: Frontend Reframe` section with overview + 7 stories (full text written into `epics.md`).
Story summary:

| #       | Story                                                                                                                                                                                                                                             | Frontend FRs                                   |
|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------|
| **5.1** | Foundation — Vite+MUI scaffold, MUI dark theme, Apollo client (HTTP `/api` + WS `/api/subscriptions`), in-memory auth context + refresh, route shell + auth/admin guards, Playwright harness. **Delete `bp_front` (Next.js) + nginx; add Caddy.** | infra, FR29                                    |
| **5.2** | Authentication — login, register, auto-login, logout, silent token refresh, session-expiry redirect, uniform/rate-limit error display, conditional Register link                                                                                  | FR1–FR10, FR21, FR27, FR32, FR33               |
| **5.3** | User Account — username in nav, change password, one-time welcome message                                                                                                                                                                         | FR5, FR11, FR12                                |
| **5.4** | Admin User Management — users table, create/delete/reset-password w/ confirm dialog, registration toggle, admin guard                                                                                                                             | FR13–FR17, FR20, FR30, FR31                    |
| **5.5** | Lists Management — list CRUD (owner-only delete), list index + zero state, per-list category CRUD, per-list item CRUD                                                                                                                             | FR34, FR35, FR37, FR46, FR50, FR51             |
| **5.6** | List View, Shopping & Real-Time — `/list/[id]` + `/` redirect, list switcher, items by category, check/uncheck, filters (category / checked / search), store + addedBy display, per-list GraphQL subscriptions w/ WS JWT auth                     | FR36, FR38, FR40, FR44, FR45, FR49, FR52, FR53 |
| **5.7** | Sharing & Membership — share by username (pending invite), accept/decline, member management/removal, leave list, admin-block surfacing                                                                                                           | FR39, FR41, FR48, FR55, FR56                   |

**Deferred (not in Epic 5):** FR42 (one-timer), FR43 (recurring). Backend support (incl. FR54 scheduler)
remains; frontend affordances are postponed.

**Backend-only FRs already done (Epics 1–4), no Epic 5 work:** FR18, FR19, FR22–FR28, FR46 (server side),
FR47, FR54, FR56 (service enforcement), NFR-L1–L5.

### 4.3 PRD delta

Add a dated edit-history entry + a short "Frontend Reframe (Epic 5)" note under the executive summary
documenting the stack change and the FR42/FR43 deferral. Remap frontend FR coverage to Epic 5.

### 4.4 Architecture delta

Add a "Frontend Reframe (Epic 5)" section: Vite + MUI SPA, Caddy routing (`/*`, `/api/*`, `/api/subscriptions`),
client-side routing + guards, Apollo split-link over `/api/graphql` and `/api/subscriptions`, token in memory + httpOnly
refresh cookie. Mark superseded frontend requirements (AR11–AR15, AR-E4-9/10/11) as "superseded by Epic 5
reframe." Backend ARs unchanged. The MUI theme draws its visual style from `design/Bag Please.html` (+ `design/`
assets) — a **style reference only, not a functional prototype**; behavior follows the FRs and story ACs.

---

## Section 5 — Implementation Handoff

**Scope: Major** → routed to PM/Architect for the artifact updates above, then to the Developer agent for
story execution.

- **PM/Architect (this workflow):** apply PRD + Architecture + UX deltas; write Epic 5 into `epics.md`;
  update `sprint-status.yaml`.
- **Developer agent (next):** create + implement Epic 5 stories in order 5.1 → 5.7, each with manually
  validated Playwright E2E before merge. Backend changes require `md`'s explicit confirmation.

**Success criteria:** new Vite+MUI app served by Caddy reaches functional coverage of all in-scope frontend
FRs; every story has a green real-browser E2E; old `bp_front` + nginx removed; backend untouched.
