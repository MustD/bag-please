---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
documentsSelected:
  prd: '_bmad-output/planning-artifacts/prd.md'
  ux: '_bmad-output/planning-artifacts/ux-design-specification.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-08
**Project:** bag-please

---

## Document Inventory

| Type            | File                         | Size | Date  |
|-----------------|------------------------------|------|-------|
| PRD             | `prd.md`                     | 21K  | May 8 |
| UX Design       | `ux-design-specification.md` | 38K  | May 8 |
| Epics & Stories | `epics.md`                   | 34K  | May 8 |
| Architecture    | `architecture.md`            | 37K  | May 8 |

**Supplemental (not used for assessment):**

- `prd-validation.md` — PRD validation output
- `ux-design-directions.html` — earlier UX directions artifact

---

## PRD Analysis

### Functional Requirements

FR1: Unregistered user can create an account with a username and password
FR2: Registered user can authenticate with their username and password
FR3: Authenticated user can log out of the application
FR4: System automatically authenticates a user immediately after successful registration, without a separate login step
FR5: System displays a one-time welcome message the first time a user successfully logs in after registration
FR6: System issues a short-lived access token upon successful authentication
FR7: System issues a long-lived refresh token upon successful authentication
FR8: System silently renews the access token using a valid refresh token when the access token is expired, without user
interaction
FR9: System redirects the user to the login screen with a session-expiry message when the refresh token is no longer
valid
FR10: System invalidates the user's refresh token when they log out
FR11: Authenticated user can change their own password
FR12: System displays the authenticated user's name in the application navigation on all screens
FR13: Admin can view a list of all registered user accounts
FR14: Admin can create a new user account with a username and initial password
FR15: Admin can delete a user account
FR16: Admin can reset any user's password
FR17: System requires explicit admin confirmation before executing destructive user management actions (delete, reset
password)
FR18: Admin account credentials are supplied via environment variables and are not stored in the user database
FR19: Admin can change their own password only by updating environment variables
FR20: Admin can enable or disable public user self-registration at runtime
FR21: System hides the registration option from the login screen when public registration is disabled
FR22: Application configuration changes take effect immediately without requiring a service restart
FR23: Application configuration is persisted as a runtime entity in the database
FR24: System enforces role-based access control, distinguishing admin and regular user permissions on all protected
operations
FR25: System limits authentication and registration attempts from a single IP address within a time window
FR26: System prevents users from registering a username reserved by the admin account
FR27: System returns a consistent, non-distinguishing error message for all authentication failures
FR28: System includes the authenticated user's identity and role in the request context for all API operations
FR29: Unauthenticated users accessing protected routes are redirected to the login screen
FR30: Authenticated admin users can access the user management interface
FR31: Non-admin users accessing admin-only interfaces are denied access
FR32: System provides guidance on the login screen for users who cannot access their account (contact admin)
FR33: System displays a specific message when a user is redirected to login due to session expiry

**Total FRs: 33**

### Non-Functional Requirements

NFR1: User passwords are hashed using bcrypt with cost factor 12; plaintext passwords are never stored or logged
NFR2: Refresh tokens are stored in MongoDB with a TTL index matching their 30-day expiry; expired tokens are
automatically purged
NFR3: Refresh tokens are delivered exclusively via httpOnly, SameSite=Strict cookies; never accessible to JavaScript
NFR4: Access tokens are short-lived (15 minutes); refresh tokens are long-lived (30 days)
NFR5: All client-server communication uses HTTPS in production
NFR6: Authentication endpoints are rate-limited per IP address to prevent brute-force attacks
NFR7: No passwords, raw tokens, or credential material appear in application logs
NFR8: JWT payloads contain only username and role claims; no sensitive user data is embedded in tokens
NFR9: Authentication operations (login, register, token refresh) complete in under 1 second under normal load
NFR10: Auth UI screens (login, registration) render without perceptible layout shift or blocking on mobile devices
NFR11: System supports a small user base (tens of users) in v1; no horizontal scaling or distributed session management
required
NFR12: ApplicationConfig is loaded at startup and may be cached in memory; writes invalidate the cache immediately
NFR13: All input fields on auth forms have visible, associated labels
NFR14: Auth forms are fully keyboard-navigable (tab order, submit on Enter)
NFR15: Form error messages are associated with their corresponding input fields
NFR16: Text and interactive elements on auth screens meet minimum colour contrast for readability

**Total NFRs: 16**

### Additional Requirements / Constraints

- **Brownfield:** All existing item and category functionality must continue to work without regressions
- **Principal threading:** The authenticated user's identity must be threaded through the GraphQL context, but the data
  layer ignores it until the data isolation feature is built
- **Mobile-first:** All auth and admin UI must be designed mobile-first with MUI sx breakpoints
- **Registration off by default:** Public registration is disabled by default; admin manually onboards users
- **Admin env-var account:** The admin account is pre-created from environment variables at startup, not stored in the
  user database
- **No self-service password recovery:** Only admin can reset passwords; no email-based recovery in Phase 1
- **Shared data remains shared:** All items and categories remain globally shared across all users in this release

### PRD Completeness Assessment

The PRD is well-structured and thorough. Requirements are clearly numbered (FR1–FR33, NFR1–NFR16), grouped by domain,
and traceable to user journeys. The Journey Requirements Summary table is an excellent cross-reference. Phase boundaries
are clearly defined. The constraint on not persisting the one-time welcome flag to DB (React component flag only) is
clearly stated in journey text but not captured as an explicit FR — this is a notable gap worth flagging for epic
coverage review.

---

## Epic Coverage Validation

### Coverage Matrix

| FR   | Requirement (summary)                                         | Epic / Story                               | Status    |
|------|---------------------------------------------------------------|--------------------------------------------|-----------|
| FR1  | User can register with username + password                    | Epic 1 → Story 1.1                         | ✓ Covered |
| FR2  | User can authenticate with username + password                | Epic 1 → Story 1.2                         | ✓ Covered |
| FR3  | Authenticated user can log out                                | Epic 1 → Story 1.2, 1.3                    | ✓ Covered |
| FR4  | System auto-authenticates after registration                  | Epic 1 → Story 1.4                         | ✓ Covered |
| FR5  | One-time welcome message after first login                    | Epic 1 → Story 1.4                         | ✓ Covered |
| FR6  | System issues short-lived access token                        | Epic 1 → Story 1.2                         | ✓ Covered |
| FR7  | System issues long-lived refresh token                        | Epic 1 → Story 1.2                         | ✓ Covered |
| FR8  | Silent access token renewal on expiry                         | Epic 1 → Story 1.3                         | ✓ Covered |
| FR9  | Redirect to login with expiry message on refresh token expiry | Epic 1 → Story 1.3                         | ✓ Covered |
| FR10 | Logout invalidates refresh token                              | Epic 1 → Story 1.2                         | ✓ Covered |
| FR11 | User can change own password                                  | Epic 1 → Story 1.5                         | ✓ Covered |
| FR12 | Authenticated user's name in app bar                          | Epic 1 → Story 1.5                         | ✓ Covered |
| FR13 | Admin can view all user accounts                              | Epic 2 → Story 2.2, 2.3                    | ✓ Covered |
| FR14 | Admin can create a user account                               | Epic 2 → Story 2.2, 2.3                    | ✓ Covered |
| FR15 | Admin can delete a user account                               | Epic 2 → Story 2.2, 2.3                    | ✓ Covered |
| FR16 | Admin can reset any user's password                           | Epic 2 → Story 2.2, 2.3                    | ✓ Covered |
| FR17 | Explicit admin confirmation on destructive actions            | Epic 2 → Story 2.3                         | ✓ Covered |
| FR18 | Admin credentials from env vars, not DB                       | Epic 1 → Story 1.2                         | ✓ Covered |
| FR19 | Admin password change via env vars only                       | Epic 2 → Story 2.2 (documented constraint) | ✓ Covered |
| FR20 | Admin can toggle public registration at runtime               | Epic 2 → Story 2.1, 2.4                    | ✓ Covered |
| FR21 | Registration link hidden when registration is off             | Epic 2 → Story 2.4                         | ✓ Covered |
| FR22 | Config changes take effect without restart                    | Epic 2 → Story 2.1                         | ✓ Covered |
| FR23 | Config persisted as MongoDB entity                            | Epic 2 → Story 2.1                         | ✓ Covered |
| FR24 | RBAC enforced on all protected operations                     | Epic 1 → Story 1.2                         | ✓ Covered |
| FR25 | Rate limiting per IP on login + register                      | Epic 1 → Story 1.2                         | ✓ Covered |
| FR26 | Reserved admin username blocked on register                   | Epic 1 → Story 1.1                         | ✓ Covered |
| FR27 | Uniform non-distinguishing auth error message                 | Epic 1 → Story 1.1, 1.2                    | ✓ Covered |
| FR28 | Principal threaded through GraphQL context                    | Epic 1 → Story 1.2                         | ✓ Covered |
| FR29 | Unauthenticated users redirected to login                     | Epic 1 → Story 1.3                         | ✓ Covered |
| FR30 | Admin can access user management interface                    | Epic 2 → Story 2.3                         | ✓ Covered |
| FR31 | Non-admin denied access to admin interfaces                   | Epic 2 → Story 2.3                         | ✓ Covered |
| FR32 | "Contact admin" guidance on login when registration is off    | Epic 2 → Story 2.4                         | ✓ Covered |
| FR33 | Specific message shown on session-expiry redirect             | Epic 1 → Story 1.4                         | ✓ Covered |

### Missing Requirements

None. All 33 PRD functional requirements are mapped to an epic and a story.

### Coverage Statistics

- Total PRD FRs: 33
- FRs covered in epics: 33
- **Coverage: 100%**

### Notes

- **FR19** (admin password change via env vars only) is correctly handled as a documented constraint in Story 2.2 rather
  than an actionable endpoint — this is the right approach.
- The one-time welcome banner's "React state only, not persisted" constraint is addressed in Story 1.4 acceptance
  criteria (`WelcomeBanner` visibility controlled by `useState` flag) and UX-DR5, even though it lacks its own explicit
  FR in the PRD. No gap in coverage; the implementation intent is clearly conveyed.

---

## UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-specification.md` (38K, May 8) — comprehensive specification covering visual design, component
strategy, user journey flows, responsive design, and accessibility.

### UX ↔ PRD Alignment

| PRD Requirement                                | UX Coverage                                                                            | Status    |
|------------------------------------------------|----------------------------------------------------------------------------------------|-----------|
| Login/register forms (FR1, FR2)                | LoginPage + RegisterPage with edge-to-edge layout, visible labels, inline errors       | ✓ Aligned |
| Session expiry message on redirect (FR9, FR33) | `Alert severity="warning"` above form heading with specific copy                       | ✓ Aligned |
| One-time welcome banner (FR5)                  | `WelcomeBanner` component with `useState` flag, teal-tinted, dismissible               | ✓ Aligned |
| Username in app bar (FR12)                     | `UserChip` with avatar initial + username, styled via theme                            | ✓ Aligned |
| Registration link hidden when off (FR21)       | Conditional render of Register link + "Contact your admin" footer                      | ✓ Aligned |
| Admin confirmation dialogs (FR17)              | `ConfirmDialog` reusable component, Cancel focused by default, Escape closes           | ✓ Aligned |
| Admin user management page (FR13–FR16, FR30)   | `AdminUsersPage` with Paper-wrapped Table, row-level IconButtons, empty state          | ✓ Aligned |
| Admin registration toggle (FR20)               | `Switch` + `FormControlLabel` in AdminUsersPage with immediate state reflection        | ✓ Aligned |
| User self-service password change (FR11)       | `ChangePasswordPage` at `/account/password`                                            | ✓ Aligned |
| Admin guard redirect (FR31)                    | Admin guard: non-admin redirected from `/admin/*` to `/`                               | ✓ Aligned |
| Auth guard redirect (FR29)                     | Auth guard: unauthenticated redirected to `/auth`                                      | ✓ Aligned |
| Mobile-first responsive (PRD platform req.)    | Edge-to-edge auth screens, `maxWidth: 360, mx: "auto"`, MUI breakpoints                | ✓ Aligned |
| Accessibility (NFR13–NFR16)                    | WCAG AA compliance documented; all TextField labels, IconButton titles, FormHelperText | ✓ Aligned |

All PRD user journeys are fully mapped to screen-level mechanics in the UX specification.

### UX ↔ Architecture Alignment

| UX Requirement                                 | Architecture Coverage                                          | Status    |
|------------------------------------------------|----------------------------------------------------------------|-----------|
| Access token in memory (not localStorage)      | AR11: localStorage → React state migration; AR12: auth context | ✓ Aligned |
| Auth context for username/role across tree     | AR12: new React auth context                                   | ✓ Aligned |
| Silent 401 → refresh → retry                   | AR13: Apollo `onAuthError` enhanced                            | ✓ Aligned |
| New page routes                                | AR14: App Router page files enumerated                         | ✓ Aligned |
| Theme applied globally via root layout         | Story 1.3 AC: ThemeProvider in root layout                     | ✓ Aligned |
| Config state in app context (no extra request) | Story 2.4 AC: `GET /admin/config` fetched once on load         | ✓ Aligned |

### Alignment Issues

**Minor — Internal UX Document Inconsistency:**
The "Transferable UX Patterns" section in the UX spec references "Centered card layout (`Paper` + `Stack`)" as a pattern
to adopt from the inspiration analysis. The actual **chosen direction** is Edge-to-Edge (no `Paper` card on auth
screens). This is residual text from the direction-exploration phase and does not reflect the final decision. The rest
of the document is internally consistent about the chosen direction. No functional impact — the implementation follows
the chosen direction correctly.

**Minor — Change-Password Navigation Item Not in UX-DR:**
Story 1.5 AC specifies: "a link to the change-password page is visible in the navigation menu." The UX Design
Requirements (UX-DR9, UX-DR10) only document the admin "User Management" nav item. The change-password navigation link
is implied but not explicitly captured as a UX-DR. Low risk — the story AC is clear, but the UX spec has a small gap.

### Warnings

None critical. The UX document is complete and substantially aligned with both PRD and Architecture. The two issues
noted above are cosmetic or minor spec gaps, not functional misalignments.

---

## Epic Quality Review

### Epic Structure Validation

#### Epic 1: User Authentication, Session Management & Identity

| Check                      | Result                                                                                 |
|----------------------------|----------------------------------------------------------------------------------------|
| User-centric title?        | ✓ — describes what users can *do* (create accounts, log in, see name, change password) |
| User outcome goal?         | ✓ — full personal auth infrastructure for the household member                         |
| User value without Epic 2? | ✓ — users can register, log in, manage sessions, and see identity independently        |
| Stands alone completely?   | ✓ — no dependency on Epic 2                                                            |

#### Epic 2: Admin User Management & Application Configuration

| Check                            | Result                                                               |
|----------------------------------|----------------------------------------------------------------------|
| User-centric title?              | ✓ — describes admin actions (view, create, reset, delete, toggle)    |
| User outcome goal?               | ✓ — admin persona has full user base visibility and control          |
| User value without future epics? | ✓ — fully functional after Epic 1                                    |
| Depends only on Epic 1?          | ✓ — RBAC, JWT, and user entity from Epic 1 are the only dependencies |

**Epic structure: ✓ Passes all checks.**

---

### Story Quality Assessment

#### Story 1.1: User Entity & Registration Backend

- **User value:** Backend-only — no UI. Delivers no user-visible feature independently. Acceptable for brownfield (
  backend-first increments), but the story delivers dev value, not user value.
- **ACs:** 5 Given/When/Then blocks; covers success, username collision, reserved username, no plaintext logs, and lazy
  sync. Complete and testable.
- **Dependencies:** None. Standalone. ✓

#### Story 1.2: Login, Token System & Session Security Backend

- **User value:** Backend-only — again no UI. Acceptable.
- **ACs:** 9 Given/When/Then blocks. Covers login success, uniform error, rate limiting, refresh token success/fail,
  logout, admin env-var auth, RBAC enforcement, Principal in GQL, and change-password (both happy path and error).
  Complete and testable.
- **Dependencies:** Depends on Story 1.1 (user entity must exist). ✓ Backward only.
- **⚠️ MAJOR — Story 1.2 is oversized.** It bundles 8 distinct technical concerns: (1) login endpoint, (2) JWT
  issuance, (3) httpOnly cookie + MongoDB refresh token, (4) rate limiting, (5) logout + token invalidation, (6) admin
  env-var auth, (7) RBAC enforcement on all endpoints, and (8) change-password endpoint. This is 2–3 weeks of backend
  work in a single story. It cannot be demonstrated incrementally; a reviewer must wait for the entire story before a
  testable unit exists. This is a risk for a solo developer — a blocking bug in any one concern stalls the entire story.

#### Story 1.3: Frontend Theme & Auth Infrastructure

- **User value:** Low in isolation — sets up the theme and Apollo auth layer; no visible feature until stories 1.4/1.5.
- **ACs:** Covers theme rendering (colours, fonts, button style), 401 → silent refresh → retry, refresh failure → auth
  clear + redirect, logout → redirect, unauthenticated guard, and ThemeProvider global scope. Testable.
- **Dependencies:** Depends on Story 1.2 (endpoints must exist for auth flows). ✓ Backward only.
- **⚠️ MAJOR — Story 1.3 bundles orthogonal concerns.** "Theme setup" (`theme.ts`, `ThemeProvider`) and "Apollo auth
  infrastructure" (401 intercept, token refresh, auth context, route guards) are technically independent. Theme is a
  visual foundation; auth infrastructure is session lifecycle. Bundling them means no other UI story can begin until
  both theme AND auth infrastructure are complete. If the auth infrastructure work is complex (which it is — Apollo link
  chain, error handling, token rotation), it may delay the theme, which in turn blocks stories 1.4 and 1.5
  unnecessarily. The theme could have been its own micro-story.

#### Story 1.4: Login & Registration UI

- **User value:** ✓ Highly visible — user can now actually register and log in.
- **ACs:** Covers login form layout, inline errors, session expiry alert, register page layout, welcome banner (shown +
  dismissed), registration failure error, loading state, and error-clearing on change. Well-structured. Testable.
- **Dependencies:** Depends on 1.1 (register endpoint), 1.2 (login endpoint), 1.3 (theme + auth context). ✓ Backward
  only.
- **Note:** The "Register link is visible" AC in Story 1.4 implies registration is **enabled** — the conditional (
  registration disabled) behavior is deferred to Story 2.4. This split is correct and cleanly sequenced.

#### Story 1.5: User Identity & Account Management UI

- **User value:** ✓ UserChip in app bar; self-service password change page.
- **ACs:** Covers UserChip render (authenticated vs. not), change-password page fields/labels, success state, error
  state, loading state, and navigation menu link. Complete and testable.
- **Dependencies:** Depends on 1.2 (change-password endpoint), 1.3 (auth context). ✓ Backward only.

#### Story 2.1: ApplicationConfig Entity & Registration Toggle Backend

- **User value:** Backend-only. Admin can toggle registration via API.
- **ACs:** Covers cold-start init (registrationEnabled: false), cache-hit GET, PUT update + cache invalidation,
  non-admin 403, unauthenticated 401. Complete. Testable.
- **Dependencies:** Depends on Epic 1 (JWT auth, RBAC). ✓

#### Story 2.2: Admin User Management Backend

- **User value:** Backend-only. Admin can manage users via API.
- **ACs:** Covers GET list (admin excluded), POST create (201, bcrypt-12, list inclusion), DELETE (200, removed from
  list), reset-password (200, hash updated, refresh tokens deleted, re-login works), non-admin 403, 404 on missing ID.
  Complete. Testable.
- **Dependencies:** Depends on Epic 1 user entity (Story 1.1) and Story 2.1 for admin route pattern. ✓

#### Story 2.3: Admin User Management UI

- **User value:** ✓ Admin can manage users through the web UI.
- **ACs:** Covers table render, loading state, empty state, create user dialog (flow + result), delete dialog (colors,
  focus, result), reset-password dialog (new-password field, warning, result), non-admin redirect, admin nav item
  visibility. Complete. Testable.
- **Dependencies:** Depends on 2.2 (endpoints), Epic 1 theme + auth context. ✓
- **Note:** The registration `Switch` for the toggle is NOT in Story 2.3 ACs — it appears in Story 2.4. This means the
  `/admin/users` page is partially complete after Story 2.3; the toggle is added in Story 2.4. This is correct
  sequencing but means the page has two delivery moments.

#### Story 2.4: Registration Toggle UI & Adaptive Login Screen

- **User value:** ✓ Admin can toggle registration; login screen is context-aware.
- **ACs:** Covers Switch visibility + current state, toggle on → Register link appears on /auth, toggle off → Register
  link disappears, "Contact your admin" copy when off, Register link visible when on, GET /admin/config fetched once on
  load. Complete. Testable.
- **Dependencies:** Depends on 2.1 (PUT /admin/config endpoint), 2.3 (admin page exists). ✓ Backward only.

---

### Dependency Analysis

#### Within-Epic 1 Chain

```
Story 1.1 (User entity + register endpoint)
  → Story 1.2 (Login/tokens/RBAC/change-password endpoints)
    → Story 1.3 (Theme + Apollo auth infrastructure)
      → Story 1.4 (Login + register UI)
      → Story 1.5 (UserChip + ChangePasswordPage)
```

All dependencies are backward-only. No forward references. ✓

#### Within-Epic 2 Chain

```
[Requires Epic 1 complete]
Story 2.1 (ApplicationConfig backend)
  → Story 2.2 (Admin user management backend)
    → Story 2.3 (Admin user management UI)
      → Story 2.4 (Registration toggle UI + adaptive login)
```

All dependencies are backward-only. No forward references. ✓

#### Brownfield Integration Check

The PRD explicitly requires "no regressions in existing item and category functionality." **There is no story dedicated
to regression-testing or brownfield integration validation.** The assumption is that the developer will naturally avoid
regressions, but there is no AC anywhere that validates existing features (items, categories) continue to work after the
auth layer is introduced. This is a structural gap for a brownfield feature.

---

### Best Practices Compliance Summary

| Check                                 | Epic 1                           | Epic 2          |
|---------------------------------------|----------------------------------|-----------------|
| Delivers user value                   | ✓ (as a set)                     | ✓               |
| Can function independently            | ✓                                | ✓ (with Epic 1) |
| Stories appropriately sized           | ⚠️ Story 1.2 oversized           | ✓               |
| No forward dependencies               | ✓                                | ✓               |
| Database entities created when needed | ✓                                | ✓               |
| Clear acceptance criteria             | ⚠️ 1.3 has one non-behavioral AC | ✓               |
| Brownfield regression coverage        | ❌ Missing                        | ❌ Missing       |

---

### Quality Findings by Severity

#### 🟠 Major Issues

**Issue QR-1: Story 1.2 is oversized**
Story 1.2 bundles login, JWT issuance, httpOnly refresh token + MongoDB persistence, rate limiting, logout, admin
env-var auth, RBAC enforcement across all endpoints, Principal threading, and change-password endpoint. This is 2–3
weeks of backend work that cannot be demonstrated until the entire story is complete.
**Recommendation:** Accept as-is if the developer prefers a monolithic backend sprint, but acknowledge the risk. If
splitting, natural seams are: (a) login + tokens + logout, (b) rate limiting + uniform error + reserved username, (c)
RBAC + Principal + change-password.

**Issue QR-2: Story 1.3 bundles theme and Apollo auth infrastructure**
Theme setup and Apollo 401/refresh/context are orthogonal. Bundling delays theme availability to all UI stories until
complex Apollo auth work is also done.
**Recommendation:** Accept as-is if story sequencing is strictly linear. Low risk if the developer completes theme.ts as
the first task within the story (which the story's intent implies). The real risk is if Apollo auth infrastructure is
unexpectedly complex.

#### 🟡 Minor Concerns

**Issue QR-3: Story 1.3 AC is a code-quality rule, not a behavioral criterion**
"No visual styling applied via inline sx in component files" is a code review rule, not a testable behavioral AC. It
cannot be verified by running the app.
**Recommendation:** Move this rule to the Definition of Done or project coding standards (project-context.md). Remove
from Story 1.3 ACs.

**Issue QR-4: No brownfield regression story**
No story or AC validates that existing items and categories functionality continues to work after the auth layer is
introduced. The PRD lists this as a technical success criterion.
**Recommendation:** Add an AC to Story 1.4 or Story 1.2: "Given an authenticated user, when they access the items list,
the existing shopping list features work without regressions." Alternatively, add a dedicated regression-testing note to
Epic 1's definition of done.

**Issue QR-5: /admin/users page has two delivery moments**
Story 2.3 creates the admin page (table + CRUD dialogs). Story 2.4 adds the registration Switch to the same page. The
page is functionally incomplete after Story 2.3.
**Recommendation:** This is acceptable sequencing but should be noted in Story 2.3 as "page will gain the registration
toggle in Story 2.4." No change required — just a documentation note.

---

## Summary and Recommendations

**Assessor:** Winston (System Architect, BMad Method)
**Date:** 2026-05-08

### Overall Readiness Status

## ✅ READY — with minor items to address

The planning artifacts are substantially complete and well-aligned. There are no critical blockers, no missing FRs, no
architectural contradictions, and no forward dependencies that would prevent sequenced implementation.

### Issue Summary

| ID   | Severity | Area             | Description                                                                                   |
|------|----------|------------------|-----------------------------------------------------------------------------------------------|
| QR-1 | 🟠 Major | Story sizing     | Story 1.2 bundles 8 distinct backend concerns — 2–3 weeks work, no intermediate demo          |
| QR-2 | 🟠 Major | Story structure  | Story 1.3 bundles orthogonal concerns (theme + Apollo auth); theme delay risks all UI stories |
| UX-1 | 🟡 Minor | UX doc           | "Centered card" pattern referenced in UX spec contradicts the chosen Edge-to-Edge direction   |
| UX-2 | 🟡 Minor | UX spec gap      | Change-password navigation item missing from UX-DR9/DR10 (present in story AC)                |
| QR-3 | 🟡 Minor | AC quality       | Story 1.3 AC includes a non-behavioral code-quality rule                                      |
| QR-4 | 🟡 Minor | Brownfield gap   | No story or AC explicitly validates existing items/categories survive the auth integration    |
| QR-5 | 🟡 Minor | Story sequencing | `/admin/users` page delivered in two partial moments (Story 2.3 and Story 2.4)                |

**Total issues:** 7 — 0 Critical, 2 Major, 5 Minor

### Recommended Next Steps

1. **Decide on Story 1.2 (required decision):** Choose whether to accept the large backend story as-is (risk: no
   demo-able unit for weeks) or split it into two — (a) login/logout/tokens and (b) RBAC/rate-limiting/change-password.
   Update the epics document accordingly. The FR coverage map has all FRs assigned to Epic 1 without story-level
   breakdown, so splitting is low-friction.

2. **Add a brownfield regression AC (recommended):** Add one AC to Story 1.2 or 1.4: *"Given an authenticated user, when
   they navigate to the shopping list, existing item and category operations work without modification."* This ensures
   the auth integration is validated against existing functionality explicitly.

3. **Move Story 1.3's code-quality rule to project-context.md (optional):** The "no inline sx for visual style" rule is
   already documented in project-context.md. Remove the duplicate from Story 1.3's ACs to keep acceptance criteria
   behavioral only.

4. **Proceed to implementation with confidence.** All planning artifacts are internally consistent, FR coverage is 100%,
   dependencies are correctly sequenced, and UX is architecturally supported. The two major issues are story-scoping
   concerns, not gaps in the product or technical design.

### Final Note

This assessment identified **7 issues across 4 categories** (story sizing, story structure, UX spec gaps, brownfield
coverage). None are blockers. The planning is thorough, well-referenced, and ready for a solo developer to execute.
Address items 1 and 2 above before beginning implementation to reduce mid-sprint risk.
