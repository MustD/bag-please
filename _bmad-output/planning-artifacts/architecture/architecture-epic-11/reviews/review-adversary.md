# Adversarial review: Epic 11 Architecture Spine

- **Lens:** attack the spine as an adversary. For each hole, build two Epic 11 stories, each by a different developer,
  that obey every AD to the letter and still build incompatible software.
- **Target:** `ARCHITECTURE-SPINE.md` (draft, 2026-10-21) and `.memlog.md`
- **Grounded in:** `bp_back/src/main/kotlin/com/bagplease/**` (services, `mongo/` models and repositories, `Scheduler.kt`,
  `GQL.kt`, `Application.kt`, `Routing.kt`, `Migration.kt`), `application.yaml`, `docker-compose.yaml`, `mise.toml`,
  `routing/Caddyfile`, `bp_back/src/test/.../utils/TestContainers.kt`, `/home/md/projects/personal/mal_ui/deploy/**` and
  `mal_ui/mise.toml`
- **Date:** 2026-10-21

## Verdict

**Not ready to build from. 5 Critical, 5 High, 5 Medium and 3 Low holes.**

The spine is the right shape. The paradigm, the ADs and the supersession table all hold. The problem is the joins
between ADs. AD-2 (one transaction per method, callees join) plus AD-3 (emit after `suspendTransaction` returns) is
wrong for every joined callee. AD-7 (every FK `ON DELETE CASCADE`) plus the inherited Epic 9 user-delete order lets a
single `DELETE FROM users` wipe a user's lists in the database, with no explicit service step. AD-9 (refuse a
non-empty DB) clashes with any seed row, the Flyway history table and the runtime's write-on-read `app_config`. AD-8
names config keys but no exact env vars and no defaults, so production can quietly fall back to `sslmode=disable`.
AD-15 + Deferred ("any order is safe") is false once FKs exist.

Most fixes tighten an existing AD. Three need new ADs: a transaction/event helper (AD-17), an import mapping table
(AD-18) and a fixed slice order (AD-19).

---

## Critical

### C1. Joined callee emits before the commit (AD-2 × AD-3)

- **Story A, item slice:** `ItemService.saveItem` / `deleteAllInCategory` / any method:
  `suspendTransaction { …; events += item }` followed by `events.forEach { itemUpdateChannel.emit(it) }`. This is
  exactly AD-3: "emit only after `suspendTransaction` returns successfully".
- **Story B, category slice:** `CategoryService.deleteCategory` runs `suspendTransaction { delete category;
  itemService.deleteAllInCategory(...) ; … }`. Per AD-2 the callee joins the caller's transaction. Exposed's default
  `useNestedTransactions = false` makes the inner `suspendTransaction` reuse the outer one and return normally.
- **Clash:** when a joined callee's `suspendTransaction` returns, nothing has been committed. If B later throws or
  raises, the outer transaction rolls back, but A's events have already gone out. Subscribers refetch or prune rows
  that are still there. The same thing happens in purges (`UserAdmin → ListService.purgeUser → cascade`) and in any
  future cross-slice call. AD-3's "a rolled-back transaction emits nothing" holds only for transactions nobody joins.
- **Also:** nothing pins `useNestedTransactions`. A developer who sets it to `true` (or uses
  `inTopLevelSuspendTransaction`) gets savepoints or independent commits. AD-2 is then broken in a way no test of a
  single slice would notice.
- **Fix: new AD-17, one transaction helper owns commits and events.**
  - `plugins/Database.kt` exports `suspend fun <T> tx(block: suspend TxScope.() -> T): T`. It is the only place
    `suspendTransaction` is called.
  - It joins an existing transaction if one is on the coroutine context. Otherwise it opens one.
  - `TxScope.afterCommit { … }` queues an action on the outermost transaction. The helper runs the queue only after
    the outermost transaction commits, and drops it on rollback.
  - Services never call `MutableSharedFlow.emit` inside a `tx` body. They call
    `afterCommit { channel.emit(x) }`.
  - `useNestedTransactions = false` is set once, in `Database.kt`.
  - A test in the foundation story proves that a rolled-back outer transaction drops a joined callee's events.

### C2. Where a transaction starts is undefined (AD-2: "public", GQL orchestration, `Left`)

Four pairs, one root cause:

1. **`internal` methods.** `ItemService.deleteAllInCategory` and `runSchedulerCycle` are `internal`.
   - Story A reads AD-2 literally ("public service method") and gives them no transaction.
   - The scheduler calls `runSchedulerCycle` with no transaction around it.
   - Under AD-2, "repositories only run inside one", so this fails at runtime with no transaction in context. The
     other way out is that Story B wraps the scheduler loop in a transaction. That puts a GQL-layer-style boundary in
     a plugin.
2. **GQL resolvers that orchestrate several services.** `UserAdminMutations.deleteUser` calls
   `listService.countOwnedLists`, then `userService.adminDeleteUser`, then `listService.purgeUser`, then
   `authService.invalidateUserSessions`.
   - Each call is its own public method, so under AD-2 each is its own transaction: four transactions.
   - The Inherited table says "the purge is now one transaction".
   - Story A (user slice) keeps the resolver as it is and complies with AD-2. Story B (list slice) relies on the
     purge being atomic with the user delete. Both are compliant, and the purge can still be half done.
   - `AuthRoutes` change-password (change, then invalidate) has the same problem.
3. **GQL code that reads repositories directly.** `ListQueries` and `ListMutations` call
   `listMemberRepository.findActiveByListId` and `itemStorage.getByListId(...).count{!checked}` straight from the
   resolver (`ListApi.kt:30,60,72,92,104,124`).
   - Story A moves this into `ListService`. Story B (item slice) deletes `ItemStorage` and exposes
     `ItemService.getItems`, which checks membership per list.
   - A then has to pick between a cross-slice repository read and N membership checks plus N transactions. B has no
     way to know A needs an unread count.
4. **`Left` vs. rollback.** Arrow's `raise` is a `CancellationException`.
   - Story A puts `either { tx { … raise(…) } }`, so the raise throws through the transaction and it rolls back.
   - Story B puts `tx { either { … } }`, so a `Left` is a normal return and the transaction commits whatever was
     written before the `raise`. Under C1's helper, that also fires the `afterCommit` events.
   - Two slices written to the same AD give opposite semantics.
- **Fix: tighten AD-2.**
  - *Every* service method that touches the database, of any visibility, runs its body in `tx {}` (AD-17).
  - GQL resolvers, routes, the scheduler and subscriptions never touch a repository and never open `tx`.
  - A workflow that spans services is **one** service method (for example `UserAdminService.deleteUser` or
    `UserService.deleteUser`). It calls `ListService.purgeUser` and `AuthService.invalidateUserSessions` inside its
    own `tx`.
  - A `Left` result rolls the transaction back: `tx` takes an `Either`-returning block and rolls back on `Left`.
  - Name the cross-slice read `ItemService.countUncheckedByList(listIds)`. It has no membership check, so the
    caller has already proven membership; this is documented like `purgeUser`'s NFR-L2 exception.

### C3. `ON DELETE CASCADE` on user-parent FKs vs. the inherited user-delete order (AD-7 × Epic 9 AD-8)

- **Story A, schema/V1:** AD-7 says "every FK to a parent row is declared `ON DELETE CASCADE`", so
  `lists.owner_id → users(id) ON DELETE CASCADE` and `list_members.user_id → users(id) ON DELETE CASCADE`.
- **Story B, user slice:** it keeps Epic 9's load-bearing order (`UserAdminApi.kt:72-90`). The user row is deleted
  first, so a racing `createList` gets `CallerNotFound`, and the purge runs after.
- **Clash:**
  - B's first statement makes PostgreSQL delete every list the user owned, and through cascades every item,
    category and member row. None of the explicit, ordered, counted, event-emitting service steps that AD-7
    requires take part.
  - `purgeUser` then finds nothing. The rule "the service still deletes children explicitly" is broken by the
    database, not by any developer. It happens silently, so tests that check only end state pass.
  - The race guard B kept also no longer works the way the comment says. Under READ COMMITTED, a `createList` that
    read the user before the delete fails on its FK check with SQLSTATE 23503. That surfaces as a 500, not as
    `CallerNotFound`.
- **Fix: tighten AD-7.**
  - FKs whose parent is `users` (`lists.owner_id`, `list_members.user_id`) are `ON DELETE RESTRICT`.
  - Only list-scoped children cascade: `items`, `categories`, `list_members.list_id`.
  - The user delete is one `tx`:
    1. `SELECT … FROM users WHERE id = ? FOR UPDATE`. This replaces "row first" as the race guard: `createList` and
       `acceptInvite` take `FOR KEY SHARE` through their FK checks, so they serialize behind it.
    2. Purge owned lists explicitly.
    3. Delete the user's `list_members` rows.
    4. Delete the user's refresh tokens.
    5. Delete the `users` row last.
  - Record that the Epic 9 AR-E9-8 order is superseded.

### C4. The importer's "refuse if non-empty" clashes with seed rows, Flyway's table and a running backend (AD-5 × AD-9 × AD-13)

- **Pair 1:**
  - Story A (foundation) puts the singleton `app_config` row in `V1__baseline.sql`. Today
    `ApplicationConfigRepository.load()` creates it lazily, and a singleton is the textbook case for seeding.
  - Story B (importer) implements "refuses if any application table holds a row".
  - Result: the importer always refuses.
- **Pair 2:**
  - Story B implements "any table" as "any table in the schema".
  - `flyway_schema_history` always has rows after B's own "runs Flyway first".
  - Result: the importer always refuses.
- **Pair 3:**
  - Story A keeps `load()`'s write-on-read: `?: ApplicationConfig().also { save(it) }`.
  - Story C (deploy) deploys before the import, which is a legal reading because the cutover runbook is Deferred.
  - Any `/api/auth/registration-status` hit inserts the default row, with `registrationEnabled = false`. The import
    then refuses.
  - If the hit lands *during* the import, after B's emptiness check, B's `app_config` insert hits a unique conflict
    and the whole import rolls back.
  - The same goes for a login that writes `refresh_tokens`, or a scheduler cycle.
- **Pair 4:**
  - The importer is built from the operator's checkout. The droplet runs tag N with `V2__…`.
  - Flyway in the importer validates against the applied history, sees a migration it does not know and refuses.
  - The reverse case: the importer applies a `V2` that the running image does not know.
- **Fix: tighten AD-5 and AD-9.**
  - Migrations hold DDL only, never data.
  - `app_config`: a missing row means defaults. Reads never write, and only `update` upserts.
  - The table's shape is fixed in V1: `id smallint PRIMARY KEY CHECK (id = 1)`, or the existing UUID constant kept,
    but one of the two, named.
  - The importer's emptiness check is an explicit list of the 8 application tables. `flyway_schema_history` is
    excluded.
  - `db:import` refuses unless `bp_back` on the droplet is stopped, or has not been deployed yet. It is checked over
    SSH.
  - The importer runs from the git tag that is (or will be) deployed. `db:import` refuses a dirty tree, or a
    `version` that differs from the droplet's `.env` version when one is deployed.
  - The cutover order is architecture, not runbook wording: infra → import → deploy → verify → repoint edge.

### C5. Importer and runtime map ids and relations differently (AD-4 × AD-6 × AD-9)

The export does not have one shape:

- **`users._id` is BSON Binary subtype 4.** `UserRepository.save` filters with a raw `UUID` under
  `UuidRepresentation.STANDARD`, so the upsert stores the binary form. Relaxed Extended JSON prints it as
  `{"$binary":{"base64":…,"subType":"04"}}`. `lists.ownerId`, `items.*`, `categories.*` and
  `list_members.userId/listId` are UUID **strings**. `app_config._id` and `feedback._id` are strings.
  - Story A (importer) writes one `uuidOf(json)` helper for strings.
  - Story B (user slice) never touches the export.
  - Result: every user fails to parse, or someone "fixes" it per collection.
- **`list_members._id` is the composite string `"<listId>_<userId>"`.**
  - Story A carries it into an `id` column.
  - Story B (list slice) follows the spine's PK `(list_id, user_id)` with no `id`.
  - Result: the importer's `Table` object (the `db/` Table that AD-9 says it reuses) has no such column. Either A
    adds one, and two slices disagree on the table, or A drops it and the counts no longer match.
- **Owner and member rows collide.**
  - Today's owner has **no** `list_members` doc. Membership comes from `lists.memberUsernames`, which is what
    `isMember` and `verifyMembership` read. `lists.members` (ids) is what the Share dialog uses.
  - Story A builds the owner's and members' rows from `members` (ids) plus the `list_members` docs. The two sources
    collide on the PK when a doc exists for an ACCEPTED member, which is the normal case after `acceptInvite`.
  - Story A has to pick a winner, and AD-9 doesn't say which.
  - If `members` and `memberUsernames` drift, which `purgeUser`'s comment admits can happen, the import silently
    changes who can see a list.
  - Ids in `members` for users deleted before Story 9.4 fail the FK, and the whole one-transaction import aborts.
- **Items point at missing categories.**
  - `MongoItem.category` defaults to the nil UUID `00000000-…`.
  - `ItemService` documents three windows that still produce orphan items, including soft-deleted ones.
  - Story B (item slice) declares `items.category_id uuid NOT NULL REFERENCES categories ON DELETE CASCADE`, the
    natural reading of AD-6 and AD-7 and the ER diagram.
  - Story A inserts the real production data. The first orphan fails the FK, and the import cannot complete. It is
    re-runnable, but it never succeeds.
  - A cross-list category (the category relocation window) passes a single-column FK and keeps the corruption.
- **Fix: new AD-18, import mapping table, owned by the spine.**
  - Per collection, list source field → column, the UUID decoding rule (accept string **and** `$binary` subtype
    04/03), and the drop/merge rule.
  - **Membership precedence:** the `memberUsernames` set, resolved through `users.username`, is authoritative for
    `ACCEPTED`. A `list_members` doc adds `PENDING` or `DECLINED` only for users not in that set.
  - Members that do not resolve are dropped and **counted as dropped** in the report.
  - **Orphan items:** decide one rule. Either drop them and report them, or make `category_id` nullable. Write the
    choice down.
  - Make the item → category relation `FOREIGN KEY (list_id, category_id) REFERENCES categories (list_id, id)`, with
    a `UNIQUE (list_id, id)` on categories, so a cross-list category is impossible in the schema.
  - The count report is "export / loaded / dropped(reason)" per type, so FR71's equality check stays meaningful.

---

## High

### H1. Env var names and fail-open defaults (AD-8 × AD-12 × AD-14, Consistency "Config keys")

- **Story A, `Database.kt` + `application.yaml`:**
  - It maps `sslmode: "$KTOR_DB_SSLMODE:disable"` and `sslrootcert: "$KTOR_DB_SSLROOTCERT:"`.
  - Local dev, E2E and Testcontainers "run without TLS" (AD-14), so a default of `disable` is the natural choice.
  - It follows today's pattern: every key has a dev default (`application.yaml:12-34`).
- **Story B, deploy:**
  - It writes `.env` with `KTOR_DB_SSL_MODE=verify-full` and `KTOR_DB_SSL_ROOT_CERT=…`, reading "env `KTOR_DB_*`"
    as `KTOR_DB_` + upper-snake key.
  - `KTOR_DB_POSTGRES_HOST` vs. `KTOR_DB_HOST` is just as open.
  - Result: production quietly connects with `sslmode=disable`, which is plaintext inside the VPC. NFR-D3 and AD-14
    are broken, and no error appears anywhere.
  - A mistyped host or password variable falls back to `localhost` / `user` / `pass` and fails loudly. TLS is the
    one setting that fails open.
- **Story C, importer:**
  - It is not a Ktor app and has no `ApplicationConfig`.
  - AD-8 says both URLs are built "in one place from one `db.postgres` config block", but it doesn't say how a plain
    `main` gets that block.
  - C writes `--host/--port` CLI args and builds its own URL. That is a second URL builder, which is exactly what
    AD-8 forbids.
- **Story D, secrets:**
  - It names the JWT secret and admin credentials in `.secure.deploy.env` exactly as the container reads them
    (`KTOR_JWT_SECRET`, `KTOR_ADMIN_PASS`).
  - mal_ui's `lib.sh` strip list (copied by the deploy story) strips only `DIGITALOCEAN_TOKEN`, `AWS_*`,
    `EDGE_SSH` and `TF_VAR_*`.
  - `deploy` runs `back:test` (AD-13), so production's JWT secret and admin password reach Gradle and the test JVM.
    `application.yaml` substitutes them. This breaks AD-12's "never to Gradle".
- **Fix: tighten AD-8, AD-12 and AD-14.**
  - Add an exact table: config key → env var → default.
  - Make `sslmode` and `sslrootcert` **required, with no default** in `application.yaml`. Root
    `docker-compose.yaml`, `back:run`, and `FunSpec.postgresContainer()` set `disable` explicitly.
  - Committed `deploy/docker-compose.yml` hard-codes `KTOR_DB_SSLMODE: verify-full` and the container CA path.
    `.env` carries only host, port, user, password and the app secrets.
  - `Database.kt` exposes `PostgresSettings` (a data class) with `fromKtor(config)` and `fromEnv()`, both reading the
    same names. URL building takes only `PostgresSettings`.
  - Operator-side secret names use a prefix that the container never reads (`BP_PROD_JWT_SECRET`, …). `deploy.sh`
    renames them when it writes `.env`, and `lib.sh` strips `BP_PROD_*`.

### H2. CA certificate path and permissions (AD-14 × AD-12 × Remote layout)

- **Story A, deploy:** it delivers `bag-please/ca-certificate.crt` "next to `.env`" and copies `.env`'s treatment:
  mode `600`, owned by `deploy`.
- **Story B, hardened compose:**
  - It follows mal_ui: `read_only`, `cap_drop: [ALL]`.
  - The `eclipse-temurin` image runs as root. Root without `CAP_DAC_OVERRIDE` cannot read a `600` file owned by
    uid 1000.
- **Clash:** the TLS handshake fails at startup. Flyway exits, `restart: unless-stopped` loops, and `deploy` times
  out on health.
- **Separately:**
  - A sets `KTOR_DB_SSLROOTCERT=/home/deploy/bag-please/ca-certificate.crt`, a host path.
  - B mounts it at `/app/ca.crt`.
  - The spine names neither path.
  - The importer's CA, read from `terraform output`, has no location at all. Writing it into the repo would be
    harmless but untidy. Writing it to `/tmp` is not covered by AD-12 either way.
- **Fix: tighten AD-14.**
  - The CA is public, mode `644`.
  - Compose mounts `./ca-certificate.crt:/etc/bag-please/db-ca.crt:ro`, and the env value is that container path,
    hard-coded in the committed compose file.
  - `db:import` writes the CA to a `mktemp` file and removes it on exit.

### H3. Who owns the schema on managed PostgreSQL 18 (AD-11 × AD-5 × AD-16)

- **Story A, Terraform:** it creates `digitalocean_database_db.bag_please` and
  `digitalocean_database_user.bag_please_app` and reads AD-11's "that user owns the schema" as satisfied. The DO
  provider has no grant or ownership resource.
- **Story B, Flyway:** it runs as `bag_please_app` against `public`.
- **Clash:**
  - Since PostgreSQL 15, `public` grants no `CREATE` to `PUBLIC`.
  - The database is owned by `doadmin`, so `bag_please_app` can neither create tables in `public` nor create its
    own schema.
  - The first `flyway migrate` in production fails with permission denied.
  - Dev, E2E and Testcontainers all connect as the image's superuser (`POSTGRES_USER`), so nothing before production
    catches it.
- **Fix: tighten AD-11 and AD-16.**
  - Name the schema. Use `public`, or a dedicated `bag_please` schema plus `currentSchema`/`search_path` set in
    `Database.kt` for both drivers.
  - Name the one privileged step: `infra:apply` follow-up `infra:db-bootstrap` runs once through the tunnel as
    `doadmin` with `ALTER SCHEMA … OWNER TO bag_please_app`, or the `cyrilgdn/postgresql` provider does the same over
    the tunnel. Spell out "doadmin is used only by this step".
  - Local compose and Testcontainers create and use a **non-superuser** app role through an init script, so dev
    matches production privileges.

### H4. "Any slice order is safe" is false once FKs exist (AD-15 × AD-6/AD-7 × Deferred)

- **Story A, list and membership slice, lands first:**
  - `lists.owner_id` and `list_members.user_id REFERENCES users(id)`.
  - The users slice is still on Mongo, so `users` in PostgreSQL is empty. Every `createList` fails its FK.
- **Story B, item slice, lands before categories:**
  - `items.category_id REFERENCES categories`, but categories are still in Mongo. Same failure.
- **The other way round:**
  - Story C (category slice) moves to PostgreSQL first. `CategoryService.deleteCategory` → `ItemService` (still
    Mongo) can't be in AD-2's single transaction, and AD-7's "inside its one transaction" can't hold.
  - AD-15 forbids only dual *writes*, not cross-store transactions.
- **Shared test harness:**
  - `TestContainers.kt` is one file.
  - Every slice story edits it, and `GQL.kt` and `Application.kt`, to add a PostgreSQL container next to Mongo. Each
    may make a different choice: a separate spec extension, a reused container, or a per-spec schema.
- **Fix: new AD-19, a fixed slice order on the branch, with a foundation story first.**
  - The foundation story ships `Database.kt` + AD-17 `tx`, the **whole** `V1__baseline.sql`,
    `postgresContainer()`, and postgres in Compose next to mongo.
  - Then, in FK order: users + auth + app_config + feedback, then lists + membership, then categories, then items +
    scheduler, then the importer, then Mongo removal.
  - A slice lands only when every FK parent and every service it calls inside a transaction is already on
    PostgreSQL.
  - Remove "AD-15 makes any order safe" from Deferred.

### H5. Scheduler steps: who owns them, how they are isolated, and the transaction grain (AD-10 × AD-2 × AD-3)

- **What exists today:** `configureScheduler(itemService)` runs `runSchedulerCycle()` under a single `try`. Restore
  and hard-delete are two loops in one function, **not** isolated.
- **Story A, item slice:** it wraps `runSchedulerCycle` in one `tx` (C2), so the whole cycle is one transaction. A
  single bad row rolls back every restore and hard-delete in that hour.
- **Story B, auth:** it implements AD-10, "isolated like the existing steps", with one of two options:
  - add `authService.purgeExpired()` **inside** the same `try`, after `runSchedulerCycle`, so an item failure skips
    the purge; or
  - put a purge into `ItemService.runSchedulerCycle`, which gives the item slice a dependency on refresh tokens.
- **Clash:** both match the AD text, both differ from each other, and neither delivers the isolation AD-10 promises.
- **Fix: tighten AD-10.**
  - `Scheduler.kt` takes a list of named steps `(name, suspend () -> Unit)`, each run in its own `try`.
  - Each step is one service method and therefore one `tx` (AD-17): `ItemService.restoreRecurring()`,
    `ItemService.hardDeleteExpiredOneTimers()`, `AuthService.purgeExpiredRefreshTokens()`.
  - Events go out through `afterCommit`.
  - Step order is fixed and logged per step.

---

## Medium

### M1. Constraint violations caught inside a transaction (Consistency "Errors" × AD-2)

- **Story A, user slice:** it ports `register` / `adminCreateUser`. Today these catch `MongoWriteException` 11000.
  A ports that to catching the R2DBC integrity exception (23505) and returning `InvalidCredentials`. The Errors row
  forbids catching SQLSTATE only "in GQL", so this complies.
- **Story B:** it calls `userService.adminCreateUser` from inside a larger `tx`. The import tooling or a future admin
  bulk operation both join.
- **Clash:** PostgreSQL has aborted the transaction. A's caught `Left` returns normally, and B's next statement fails
  with "current transaction is aborted". Or, under C2's Left-means-rollback, the whole outer workflow rolls back
  because of a duplicate name.
- **Fix: tighten Errors.**
  - Expected conflicts are detected without an exception: `insertIgnore` / `ON CONFLICT DO NOTHING` plus the
    affected-row count, or a `SELECT … FOR UPDATE` pre-check.
  - No code catches a SQL exception inside a `tx`.
  - An unexpected 23xxx propagates and rolls back.

### M2. Username sort order depends on the database's collation (AD-6 × AD-16)

- **What exists today:** `UserService.getUserPage` relies on Mongo's binary order for both `sort(username)` and
  `countUsernamesBefore` (`$lt`). The `around` page lookup requires both to agree.
- **Story A (users):** it writes `ORDER BY username` and `username < ?`.
- **What changes it:** the collation comes from the cluster or image locale. DO's managed default and
  `postgres:18`'s `en_US.utf8` give linguistic, case-folded order. That differs from today and can differ between
  environments if either default changes, so E2E and production page differently.
- **Fix: tighten AD-6.** Usernames, and any text column used for ordering or range comparison, are declared
  `COLLATE "C"` in V1. Uniqueness stays case-sensitive, as today.

### M3. Health check and deploy wait (Epic 9 AD-9 × AD-13 × compose hardening)

- **Story A, compose:** following mal_ui, `bp_front.depends_on.bp_back: service_healthy`.
- **Story B, health:** `/api/health` returns 503 whenever `SELECT 1` fails within 2 s.
- **Clash:** a DO maintenance failover or slow first connect during `up -d` keeps Caddy from starting at all. That
  turns a degraded API into a dead site, including the SPA shell, which could have shown its own offline handling.
- **Unanswered:**
  - Does `/health` open an AD-17 `tx`? It is not a service.
  - Does it use the runtime R2DBC pool, which is the right check, or a JDBC connection?
- **AD-13's smoke test is unreliable before cutover.** It hits `https://bag-please.io-workshop.net/`. Before the edge
  is repointed (cutover order, C4), that URL is served by the **old** deployment, so the first deploy "passes"
  without touching the new droplet.
- **Fix: tighten AD-13.**
  - `/api/health` = Flyway done + `SELECT 1` on the runtime pool within 2 s, with no `tx`.
  - The compose healthcheck uses it with a `start_period` long enough for Flyway.
  - `bp_front` depends on `bp_back: service_started`.
  - The deploy wait polls bp_back's health.
  - The smoke test checks the **version**: the backend reports `gradle.properties` `version`, through a header or
    `/api/health` body, and must equal the deployed tag.
  - Before cutover, smoke-test the droplet's private IP through the tunnel.

### M4. Feedback id type: domain `String` vs. `uuid` column (AD-1 × AD-6)

- **Story A, feedback slice:** AD-1 says "domain models keep their shape", so `Feedback.id: String` stays and A
  makes the column `text`.
- **Story B, V1 / ER diagram:** "feedback id uuid PK", "PKs are uuid".
- **Clash:**
  - If B wins, `deleteFeedback(id: "garbage")`, which today returns `NotFound`, now throws a parse error or an SQL
    cast failure. That is a 500, a visible behavior change that FR70 forbids.
  - If A wins, AD-6 is broken.
- **Fix:** keep the column `uuid`. The mapper converts. `FeedbackService.delete` treats an unparseable id as
  `NotFound`. Say so in AD-6.

### M5. Cutover and import credentials leave the deploy task's secret boundary open (AD-9 × AD-12)

- **Story A, `db:import`:** it loads `.secure.deploy.env` (it needs `EDGE_SSH` and the Spaces key for
  `terraform output`) and runs `task back:build` (or `installDist`) "without secrets".
- **The gap:** mal_ui's `task()` strips only the four known names (H1). Whether "without secrets" holds depends on
  H1's prefix rule, not on AD-9 itself.
- **How the password reaches the importer is unnamed.** AD-9 rules out Gradle, a file and the shell, which leaves an
  env var on one `exec`. A developer using `KTOR_DB_PASSWORD=… java -cp …` puts the password into the process table,
  which `ps` shows.
- **Fix:** AD-9 names the channel: stdin, or an env var set only on the `exec`, with `ps` exposure accepted
  explicitly. Make H1's prefix rule apply to `db:import`.

---

## Low

### L1. `ApplicationConfigService`'s `AtomicReference` cache is not named in AD-1

AD-1 deletes three named Storage classes and forbids "replacement" caches. The config cache is neither, so one
developer keeps it and another removes it. Tests (`setUpRegistration`) already depend on "cache starts cold".
**Fix:** AD-1 lists `ApplicationConfigService.cache` as deleted, or explicitly kept.

### L2. Derived `List.ownerUsername` and `ListMember.username`

AD-4 derives `members` and `memberUsernames` but says nothing about `ownerUsername`, `PendingInvite.ownerUsername` or
`ListMember.username`, which today are stored copies. One developer adds `lists.owner_username`, matching the
`added_by` precedent; another joins `users`. **Fix:** AD-4 says that every username on a list or membership is
joined from `users`.

### L3. One DB read per subscription event vs. pool size

AD-4's per-event `isMember` read (subscribers × events) and the Deferred pool size are owned by different stories.
"No two stories set them" is true. What's missing is that the size has to cover the subscription fan-out, and only
the subscription story knows that. **Fix:** the Deferred entry names the subscription fan-out as an input to the
sizing.

---

## Summary of proposed spine changes

| #  | Change                                                                                                    | Kind      |
|----|-----------------------------------------------------------------------------------------------------------|-----------|
| C1 | AD-17: one `tx {}` helper, outermost-commit `afterCommit` events, `useNestedTransactions=false` pinned    | new AD    |
| C2 | AD-2: every DB-touching service method of any visibility; GQL/routes/scheduler never open `tx` or touch repositories; cross-service workflows are one service method; `Left` rolls back | tighten   |
| C3 | AD-7: user-parent FKs `RESTRICT`; user delete is one `tx` with `FOR UPDATE` and the user row deleted last; supersede AR-E9-8 order | tighten   |
| C4 | AD-5/AD-9: migrations are DDL only; `app_config` never written on read; enumerated emptiness check; import only with bp_back stopped and from the deployed tag; cutover order fixed | tighten   |
| C5 | AD-18: import mapping table (UUID decoding, membership precedence, orphan rule, dropped counts); composite `(list_id, category_id)` FK | new AD    |
| H1 | AD-8/AD-12: exact key→env→default table; TLS settings required and hard-coded in deploy compose; `PostgresSettings`; `BP_PROD_` operator prefix | tighten   |
| H2 | AD-14: CA mode 644, fixed container path in committed compose, importer CA in `mktemp`                    | tighten   |
| H3 | AD-11/AD-16: named schema plus one-time privileged bootstrap; non-superuser app role locally              | tighten   |
| H4 | AD-19: fixed slice order on the branch, with the foundation story first                                   | new AD    |
| H5 | AD-10: named, individually isolated scheduler steps, each one `tx`                                        | tighten   |
| M1 | Errors: no SQL exception caught inside a `tx`; conflicts detected by `ON CONFLICT` / row count            | tighten   |
| M2 | AD-6: `COLLATE "C"` on sorted text                                                                        | tighten   |
| M3 | AD-13: health semantics, `service_started`, version-checking smoke test                                   | tighten   |
| M4 | AD-6: feedback `uuid` column, bad id → `NotFound`                                                         | tighten   |
| M5 | AD-9: name the importer credential channel                                                                | tighten   |
| L1–L3 | AD-1, AD-4, Deferred wording                                                                           | clarify   |
