---
name: project-epic2-arch-decisions
description: Architectural decisions locked in Epic 1 retrospective for Epic 2 implementation
metadata:
  type: project
---

Decisions made during Epic 1 retrospective (2026-05-14) that govern Epic 2 design.

**Decision 1 — Remove UserStorage:** `UserStorage.kt` is deleted in Story 2.0. `UserService` calls `UserRepository`
directly. `UserRepository.findByUsername` (previously dead code) is the primary lookup. MongoDB unique index on
`username` is the sole duplicate prevention mechanism. No in-memory user cache.
**Why:** Login is ~once per 30 days; refresh path never touches UserStorage. Cache added TOCTOU race and dual-map
complexity with no benefit.
**How to apply:** Never reference or recreate `UserStorage`. All user reads go to `UserRepository`.

**Decision 2 — GraphQL for admin, REST only for auth:** Admin CRUD (`users` query, `createUser`, `deleteUser`,
`resetUserPassword` mutations, `applicationConfig` query, `setRegistrationEnabled` mutation) are GraphQL. Auth
endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`) stay REST.
**Why:** httpOnly cookie `Set-Cookie` mechanics are incompatible with Apollo Client response handling. Admin ops have no
cookie concerns and benefit from codegen types and Apollo caching.
**How to apply:** Any new admin operation → GraphQL. Never add admin REST endpoints.

**Decision 3 — ApplicationConfig direct to MongoDB, no cache:** `ApplicationConfigRepository` reads and writes MongoDB
directly. No in-memory cache or cache invalidation logic.
**Why:** Registration toggle is infrequent; cache complexity is not justified at this scale (NFR11: tens of users).
**How to apply:** `ApplicationConfigRepository` is a simple repository like `RefreshTokenRepository`. No service-layer
cache.

**Epic 2 story order:** 2.0 (UserStorage removal) → 2.1 (ApplicationConfig backend) → 2.2 (Admin user mgmt backend) →
2.3 (Admin UI) → 2.4 (Registration toggle UI).
