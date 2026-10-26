# Epic 11 Context: Same App, New Home — PostgreSQL and a DigitalOcean Deployment

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Move bag-please from MongoDB to PostgreSQL in every environment, and from the current host to a Terraform-declared DigitalOcean droplet backed by a shared managed PostgreSQL cluster. Both production users keep every list, item, share and password and see no change. md gains real transactions and foreign keys, declared infrastructure, and a one-command release with a status check, in a public repo that holds no secret.

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

- No user-visible change: the GraphQL schema and response shapes stay identical (`npm run generate` output byte-identical); every other active FR is the regression surface.
- All persisted data (users, refresh tokens, config, lists, memberships, invites, items, categories, feedback) lives in PostgreSQL; MongoDB is absent from dev, E2E and production.
- Schema changes only via versioned migrations applied at startup; each applies once and a restart changes nothing.
- The one-time import is operator-run, loads a Mongo JSON export atomically into an empty database, keeps password hashes, drops refresh tokens (users sign in once), refuses a non-empty target, and prints export / loaded / dropped counts per record type.
- Expired refresh tokens are rejected on read and purged.
- Production is Terraform-declared (droplet reachable only from the edge proxy; database private to the droplet). Infra changes are applied by hand; a deploy never applies them.
- Release is one operator command (build, push, roll the droplet, check the public URL) plus a status command reporting the running version.
- No secret is committed; Terraform state is remote; the database is not publicly reachable; cost stays at the smallest droplet plus the cheapest database tier.
- The Mongo export holds hashes and list content: keep it out of the repo, and md keeps an off-repo copy as the only fallback. There is no restore drill; provider daily backups are the only automated protection.
- The per-story E2E gate is relaxed on the epic branch only; the full E2E suite must pass before the single merge to `main`.
- Retires FR47, FR69 and the TTL-index NFR. FR42/FR43 stay deferred.

## Technical Decisions

- Stories land on `feature/pg-migration` in story order; each keeps `gradle :bp_back:test` green for what it touches, while E2E may be red until Story 11.7. A slice is on Mongo or PostgreSQL, never both, and no code writes one entity to both stores. The merge to `main` is a merge commit, not a squash.
- Every new or changed test is observed failing before acceptance. Test totals come from JUnit XML, never quoted. Docs for a changed behaviour change in the same story. Re-sync Zed tasks when `mise.toml` tasks change. Reconcile `sprint-status.yaml` at story close. Versions are a 2026-10-21 snapshot, so re-measure before pinning.
- Persistence: Exposed DSL (no DAO) on R2DBC at runtime (`r2dbc-postgresql` + `r2dbc-pool`). Blocking JDBC is used only for Flyway. One `db.postgres` config block (`KTOR_DB_*` env) feeds both. The pool is 5 or fewer because the shared cluster allows about 22 connections.
- No caching: `ItemStorage`, `CategoryStorage`, `ListStorage` and the config `AtomicReference` are deleted. Each slice's `mongo/` package becomes `db/` (Table object, row-to-domain mapper, repository).
- Services own transactions: every DB-touching service method runs in the single `tx {}` helper. GQL, routes and the scheduler never touch repositories. Subscription events fire only after the outermost commit and are dropped on rollback. Isolation stays `READ COMMITTED`. Creates are `insert`s; `ON CONFLICT` only where current semantics need it. Expected outcomes (not found, `23505` conflict) become the slice's existing `Either` errors outside `tx`.
- Flyway owns the schema (`db/migration/V<n>__name.sql`): DDL only, additive, backward-compatible with the previous image, never edited once shipped (before 11.11's merge it may be edited). The full schema ships in `V1__baseline.sql` in Story 11.1. Exposed never issues DDL. `Migration.kt`, `app_migrations` and `AppMigrationsRepository` are deleted.
- Membership is one `list_members(list_id, user_id, status, created_at)` table with status PENDING / ACCEPTED / DECLINED. The owner holds an ACCEPTED row written when the list is created. Access means an ACCEPTED row exists. GQL `List.members` still lists PENDING and ACCEPTED rows excluding the owner. `ListService.isMember` is `suspend`.
- Column conventions: `users.username` is `COLLATE "C"` and unique (binary sort order); `items.stores` holds the normalized list as is. Deletes are ordered explicitly in the service: list children cascade, users restrict, and category delete and user purge each run in one `tx`.
- The health route pings PostgreSQL. The compose healthcheck stays on `bp_front` with busybox `wget`.
- PostgreSQL 18 everywhere (Compose `postgres:18`, Testcontainers). Local dev, E2E and Testcontainers use no TLS. Before any slice moves, Story 11.1 proves Ktor's Netty and r2dbc-postgresql's reactor-netty coexist and connect over TLS.
- Importer (`bp_back/src/import`, never packaged): runs from the operator's machine as one transaction, uses `verify-full`, and applies the import mapping from the architecture spine.
- Terraform (`deploy/terraform/`, modeled on md's mal_ui layout): VPC and SSH key are data sources; the droplet sets `ignore_changes = [user_data, image]`; the firewall allows 80 and 22 only from the edge's private IP; state lives in the Spaces bucket `io-workshop-tfstate`; `.terraform.lock.hcl` is committed. The PostgreSQL cluster is shared and managed outside this repo: look it up by name, never create it or its firewall. The droplet carries the client tag the cluster firewall trusts. Terraform creates DB `bag_please` and user `bag_please_app`, the only identity used by Flyway, the runtime and the importer. `doadmin` is used only by `db:bootstrap`.
- Secrets: gitignored `.secure.build.env` and `.secure.deploy.env`, each with a committed blank `.example`. mise loads them per task, and `lib.sh` strips deploy variables before nested Gradle or mise tasks. Runtime secrets reach the droplet only in a deploy-written `.env` (mode 600). The deploy refuses empty DB values. `.gitignore` covers `.secure.*.env`, `migration-export/`, `*.tfstate*`, `*.tfvars`, `.terraform/`, `crash.log` and `*.archive` before such files exist.
- Release: the version is `gradle.properties`' `version`. The push refuses an existing tag and never pushes `latest`. `deploy` refuses a dirty tree, runs `back:test`, builds and pushes, writes `.env`, pulls and ups, waits on the `bp_front` healthcheck, then smoke-tests via the edge jump host. `deploy:status` checks the public URL and prints the version. `deploy <version>` is the rollback. On failure the deploy prints the rollback command and never rolls back itself.
- Database TLS is `verify-full` in production (committed in the droplet compose, CA mounted read-only); no connection uses a weaker mode.
- Docs: the epic updates root `CLAUDE.md` (stack, commands, backup section), `bp_back/CLAUDE.md` and adds `deploy/README.md` (operator runbook).

## Cross-Story Dependencies

- Story 11.1 (foundation: `tx`, Flyway, full baseline schema, Compose/Testcontainers Postgres, TLS spike) gates everything. Slices 11.2 to 11.6 follow foreign-key order, each depending on the previous. Story 11.7 removes Mongo only after all slices have moved.
- 11.8 (importer) needs the baseline schema and the final mapping. 11.9 (Terraform) and 11.10 (deploy tasks and droplet compose) precede 11.11.
- Cutover order in 11.11: `infra:apply`, `db:bootstrap`, md takes the Mongo export, `db:import` (backend not yet deployed), md checks counts, `deploy`, md verifies both users through the edge jump host, repoint the edge, `deploy:status`, retire the old deployment. `migration-export/` leaves the working tree once the import is verified. Never run `infra:apply` without md.
- Epic 9 invariants carry over unchanged (admin GQL gate, server-normalized store names, category cascade, membership written only by `ListService`, one check-state transition, `/api/health` readiness).
