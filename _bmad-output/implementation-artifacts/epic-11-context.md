# Epic 11 Context: Same App, New Home — PostgreSQL and a DigitalOcean Deployment

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Move bag-please from MongoDB to PostgreSQL (every environment) and from the current host to a Terraform-declared DigitalOcean droplet plus managed PostgreSQL, so both production users keep every list, item, share and password and see no change. md gains real transactions and foreign keys, declared infrastructure, and a one-command release with a status check, in a public repo that holds no secret.

## Stories

- Story 11.1: The backend can reach PostgreSQL safely
- Story 11.2: Accounts and sessions live in PostgreSQL
- Story 11.3: Settings and feedback live in PostgreSQL
- Story 11.4: Lists, shares and invites live in PostgreSQL
- Story 11.5: Categories live in PostgreSQL
- Story 11.6: Items and the hourly jobs live in PostgreSQL
- Story 11.7: MongoDB leaves the stack
- Story 11.8: Production data can be imported in one go
- Story 11.9: The new home exists in Terraform
- Story 11.10: One command releases a version
- Story 11.11: Both users move to the new home

## Requirements & Constraints

- No user-visible change: GraphQL schema and response shapes stay identical (`npm run generate` output byte-identical); all other active FRs are the regression surface.
- Schema is versioned and applied by the backend at startup; a second start changes nothing.
- A one-time operator-run import loads the Mongo export atomically, refuses a non-empty target, and reports export/loaded/dropped counts per record type.
- Refresh tokens: expired ones are rejected on read and purged.
- Infrastructure is Terraform (one droplet, one cheapest-tier managed PostgreSQL); release is an operator-run command, no CI deploy.
- No secret in the repo (gitignore patterns and blank `.example` files are the only control); the managed DB is unreachable from the public internet; running cost stays minimal.
- The Mongo export holds password hashes and list content; keep it out of the repo. md keeps an off-repo copy as the only fallback; no restore drill; provider daily backups are the only automated protection.
- E2E per-story gate is relaxed on the epic branch only; the full E2E suite must pass before the single merge to `main`.
- FR42/FR43 stay deferred. Retires FR47, FR69 and the TTL-index NFR.

## Technical Decisions

Binding rules for every story (AR-E11-0, -1, -2, -8, -26, -26a):
- Work lands on `feature/pg-migration` in story order; each story keeps `gradle :bp_back:test` green for what it touches; E2E may be red until Story 11.7. No code writes one entity to both stores. A slice is on Mongo or PostgreSQL, never both. `main` never runs two stores (AD-15, AD-19).
- Every new/changed test is observed failing before acceptance; test totals come from JUnit XML, never quoted.
- A shipped migration is never edited (the epic allows edits only before Story 11.11's merge). Docs describing changed behaviour change in the same story. Re-sync Zed tasks when `mise.toml` tasks change; reconcile `sprint-status.yaml` at story close. Versions are a 2026-10-21 snapshot (AR-E11-16): re-measure before pinning.
- Transactions stay `READ COMMITTED`; creates are `insert`; `ON CONFLICT` only where current semantics need it; the only explicit lock is user deletion's `SELECT … FOR UPDATE`.

Architecture (spine ids):
- AD-1: no caches or `Storage` classes anywhere; each slice's `mongo/` becomes `db/` (Exposed `Table`, row mapper, repository). Domain models unchanged.
- AD-2/AD-17: services own transactions. Every DB-touching service method runs in `tx {}` (from `plugins/Database.kt`, the only caller of `suspendTransaction`; joins an open tx, no nested/savepoints, max attempts 1). GQL, routes, subscriptions and the scheduler call services only, never repositories. Cross-slice workflows are one service method. Arrow `either {}` goes outside `tx {}`.
- AD-3: services never `emit` inside `tx`; use `afterCommit {}`, run after the outermost commit, dropped on rollback.
- AD-4: `list_members(list_id, user_id, status, created_at)` is the sole membership/invite record; owner holds an ACCEPTED row but is excluded from GQL `List.members`. Membership check (NFR-L2) runs in the same tx as guarded work; `isMember` is suspend.
- AD-5/AD-6: Flyway (JDBC, DDL only, additive, backward-compatible with the previous image) owns the schema; `V1__baseline.sql` has all eight tables. No `SchemaUtils`/`MigrationUtils`. `Migration.kt`/`app_migrations` deleted. Conventions: uuid app-generated PKs, `timestamptz`↔`Instant`, enums as `text`+`CHECK`, snake_case, `users.username` `COLLATE "C" UNIQUE`, `items.stores text[]`, `app_config` fixed id with no row written on read, SQLSTATE `23505` translated in the repository.
- AD-7: list-child FKs cascade; user FKs restrict; services still delete explicitly in today's order; user deletion locks the row, purges, deletes `users` last.
- AD-8/AR-E11-11/12: Exposed DSL over R2DBC at runtime, JDBC only for Flyway; one `db.postgres` block (`KTOR_DB_*`) builds both URLs. Foundation spike must prove Ktor Netty + r2dbc-postgresql TLS work together before any slice moves.
- AD-10: expired-token purge is a scheduler step; each step in its own tx, a failing step is logged and the rest run.
- AD-16: `postgres:18` everywhere (Compose volume at `/var/lib/postgresql`, Testcontainers, managed); app connects as non-superuser `bag_please_app`.
- AD-9/AD-18: importer is `com.bagplease.tools.MongoImport` in its own source set, runs from the operator laptop through an SSH tunnel as one tx; id/membership mapping and dropped-row rules are in AD-18.
- AD-11/AD-12/AD-13/AD-14: Terraform follows mal_ui (data-source VPC/SSH key, `ignore_changes`, firewall from edge private IP only, Spaces state, committed lock file); DB firewall trusts only the droplet; secrets only in gitignored `.secure.build.env`/`.secure.deploy.env` loaded per mise task, `.gitignore` patterns land before any secret file; releases are immutable exact tags (never `latest`), deploy waits on `bp_front` healthcheck then smoke-tests via the edge jump host; runtime DB TLS is `verify-full` (importer tunnel alone may use `verify-ca`).
- AD-20: cutover order is fixed: infra apply, db bootstrap, Mongo export, import, count check by md, deploy, md verifies, repoint edge, status, retire old deployment.
- `/api/health` returns 503 unless PostgreSQL (and Mongo until 11.7) answers.
- Docs touched: root `CLAUDE.md`, `bp_back/CLAUDE.md`, new `deploy/README.md` runbook.

## Cross-Story Dependencies

- 11.1 is the foundation (spike, `tx`, Flyway, full baseline schema, Compose/Testcontainers) and blocks everything; its spike failure stops the epic pending md's decision.
- Slices follow FK order: 11.2 (user, auth, then 11.3 config/feedback) before 11.4 lists, then 11.5 categories, then 11.6 items; cross-slice calls to unmoved slices are non-atomic on the branch only.
- 11.7 removes Mongo only after all slices move; 11.8 importer needs the `db/` tables and an empty-DB guarantee from 11.3 (reads never write `app_config`).
- 11.9 Terraform precedes 11.10 deploy tasks; 11.11 cutover needs 11.8-11.10 and ends with the merge to `main`.
