---
review-of: _bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md
lens: good-spine checklist (rubric)
reviewed: 2026-10-21
inputs: spine + .memlog.md, Epic 9 spine, prd.md (Epic 11, FR70-74, NFR2, NFR17, NFR-D1-D6), addendum.md, bp_back/CLAUDE.md, root CLAUDE.md, bp_back/src (main + test), docker-compose.yaml, mise.toml, .gitignore, bp_back/Dockerfile, <reference project>/deploy
verdict: not ready to finalize. The spine is sound and covers every dimension it owns, but it gets one GraphQL contract fact wrong, several of its rules are not airtight, and it misses some real divergence points.
counts: critical 1, high 12, medium 11, low 11
---

# Rubric review: Epic 11 architecture spine

## Verdict

The spine is well built. It is short, every AD names what it prevents, the deliberate supersessions are listed, the
the reference project deploy pattern is ratified correctly (I checked it against <reference project>/deploy`), and every dimension has an owner:
persistence, infra, deployment, secrets, TLS, tests and branch strategy. The problems are in where it meets the
existing code. It describes the GraphQL `List.members` contract wrongly (C1). It claims user deletion becomes one
transaction, which the current orchestration cannot do (H1). It does not mention that the GQL layer calls repositories
and caches directly (H2). It leaves the transaction semantics of Arrow `raise`, unique violations and collation
undecided (H3, H6, H7). On the operations side, it leaves migration rollback, DB privileges, cutover ordering and story
ordering open in ways that would let stories diverge (H5, H8, H9, H10, H11). Fix C1 and the highs before `status: final`.

## Critical

### C1. AD-4 misstates how GQL `List.members` is derived, and following it changes the contract (FR70)

- **Code reality:** `ListQueries`/`ListMutations` (`entity/list/gql/ListApi.kt:30,60,72,92,104,124`) build `members`
  from `listMemberRepository.findActiveByListId` (rows with **PENDING + ACCEPTED** status). `GqlListMapper` then
  drops `DECLINED`. The owner has **no** `list_members` row today: `createList` writes only `lists.members` /
  `memberUsernames`. So the GQL `members` field currently means "invitees and accepted members, without the owner",
  and each entry carries a `status`. The domain `List.memberUsernames` (owner included, accepted only) is a different
  set, and it is the one `verifyMembership`/`isMember` read.
- **Spine says:** "The domain `List.members` / `memberUsernames` **and the GQL fields** are derived from `ACCEPTED`
  rows joined to `users`", and the owner gets an `ACCEPTED` row.
- **Consequence if built as written:** the Share dialog's member list gains the owner, possibly with a remove
  affordance, and loses every PENDING invite. That is a visible behaviour change, which FR70 forbids. A literal
  reader building the list slice would also break `removeMember`'s owner guard semantics.
- **Fix:** in AD-4, separate the two derivations. (a) Domain membership (`List.members`/`memberUsernames`, `isMember`,
  `verifyMembership`) is `ACCEPTED` rows, owner included. (b) GQL `List.members` is `PENDING + ACCEPTED` rows
  **excluding the owner's row**, joined to `users` for `username`, with `status`, so the output is byte-identical to
  today. Add an E2E or backend assertion that pins the current `members` payload before the slice moves.

## High

### H1. "The purge is now one transaction (AD-2)" is false for the current user-delete orchestration, and FK cascades from `users` become the real cascade

- **Code:** `UserAdminMutations.deleteUser` (`entity/user/gql/UserAdminApi.kt:68-90`) calls three public methods on
  three services in sequence: `UserService.adminDeleteUser`, then `ListService.purgeUser`, then
  `AuthService.invalidateUserSessions` (in a `finally`). Under AD-2 that is three transactions. With AD-7
  ("every FK to a parent row is `ON DELETE CASCADE`") and `lists.owner_id`/`list_members.user_id → users.id`, step 1
  already deletes every owned list, its items and categories, and every membership row at the database level.
  `purgeUser`'s explicit cascade then finds nothing. AD-7's "explicit in the service, FK underneath as backstop" is
  inverted on exactly the path Epic 9 AD-8 governs.
- **Fix:** decide one of the following and write it into AD-2/AD-7. (a) Move the whole sequence into one service
  method, e.g. `UserService.deleteUser` calling `ListService.purgeUser` and `AuthService.invalidateUserSessions`, so
  it is one transaction with the explicit cascade running **before** the `users` delete. Then the
  CallerNotFound-race argument of Epic 9 AD-8 is replaced by transactional isolation, and the supersession table must
  record that. (b) Keep three transactions and declare the FKs that point at `users` `ON DELETE RESTRICT`, so the
  ordering has to stay explicit. Either way, correct the inherited-invariants row.

### H2. The GQL layer reads repositories and caches directly; the spine's one-way layering is not true today, and AD-2 makes those reads illegal

- **Code:** `ListQueries`/`ListMutations` are constructed with `ListMemberRepository` and `ItemStorage`
  (`plugins/GQL.kt:113,121`; `ListApi.kt:20-21,51-52`). They call `findActiveByListId` and
  `itemStorage.getByListId(...).count { !it.checked }` for every list they return.
- **Spine:** the design paradigm says "Calls still go one way only: GQL → Service → Repository". AD-1 deletes
  `ItemStorage`. AD-2 says repositories "only run inside" a transaction. None of these mentions the existing
  bypass. The list-slice and item-slice stories will patch it differently: GQL opening its own transaction, GQL
  calling `ItemRepository`, or a service method.
- **Fix:** add a rule, in AD-1 or AD-2: GQL classes depend on services only, never on a repository or `db/` type.
  `ListService.getLists`/mutations return the members and `uncheckedItemCount` they need, computed in the same
  transaction (one query per page, not N+1). List it as a correction of current code in the supersession table.

### H3. How Arrow `either`/`raise` interacts with `suspendTransaction` is undecided

- Every service method is `= either { ... }`, and many `raise` after a write or between writes. Examples:
  `adminDeleteUser` raises `NotFound` after `deleteById`; `acceptInvite` raises after reads. Arrow's `raise` unwinds
  with a `CancellationException` subtype. Whether a Left commits or rolls back depends on whether `either` wraps
  `suspendTransaction` or the other way round, and on how Exposed's R2DBC transaction treats cancellation. Each slice
  story will pick its own nesting.
- **Fix:** state it in AD-2. Pick one order, for example `either { suspendTransaction { ... } }`, and decide whether
  a raised Left always rolls back. Ship one helper (e.g. `txEither { }`) in `plugins/Database.kt` that every service
  uses. Add a test proving that a Left after a write leaves no row.

### H4. Importing legacy orphans into the V1 FKs will abort the whole import, and the spine does not decide what happens to them

- **Code evidence that orphans exist in production data:** `MongoItem.category` defaults to `UUID(0,0)`.
  `ItemService.saveItem` and `uncheckItem` comments document "pre-existing orphan" items and three remaining orphan
  windows. `MongoCategory.listId`/`MongoItem.listId` are nullable. Lists' legacy `members` arrays predate the Story
  9.4 purge and can name deleted users.
- **Spine:** AD-7 puts FKs on every parent reference, and AD-9 runs the import as one all-or-nothing transaction. A
  single orphan rolls the import back on cutover day. The fix then needs a schema change to V1, which by then is
  merged, or ad hoc data edits on the production Mongo.
- Also, the `items.category_id → categories.id` FK does not enforce that the category is on the **same list**. That
  is the invariant Epic 9 AD-7 cares about. A composite FK `(list_id, category_id) → categories(list_id, id)` would.
- **Fix:** add to AD-9 the import rule for each orphan class: drop and report, or repair, e.g. a soft-deleted orphan
  item is dropped, a live one goes to a per-list "Uncategorized"… Make the importer print the dropped counts next to
  the per-type counts (FR71). Have the cutover story run the importer against a local PostgreSQL first, a dry run
  on the real export. Decide whether V1 uses the composite FK.

### H5. Rollback by `deploy <previous>` is unsafe once a Flyway migration has shipped, and the backup that made rollback safe is superseded with nothing in its place

- AD-5 makes migrations forward-only. AD-13 says "`deploy <version>` redeploys a pushed tag, which is the rollback".
  The superseded root `CLAUDE.md` section existed precisely because "rolling the image back alone leaves migrated data
  the old code cannot read". The spine replaces it with "AD-5, Deferred (backups)", and Deferred skips the restore
  drill entirely. Flyway on the old image will ignore the future migration and start against a schema it may not
  read.
- **Fix:** decide in AD-5/AD-13 either (a) expand/contract: every migration must be readable by the previous release,
  and a destructive change ships one release later, or (b) a `pg_dump` through the tunnel before any release that
  adds a migration, with "restore, then previous image" as the documented rollback. Then update the supersession row
  so it names what replaces the dump procedure.

### H6. `users.username` UNIQUE and duplicate-registration handling are missing

- **Code:** `UserRepository` creates a unique index on `username`. Its comment says this is the DB-level guard
  against a TOCTOU race. `UserService.register` and `adminCreateUser` catch `MongoWriteException` code 11000 to map a
  duplicate to `RegistrationError.InvalidCredentials` (`UserService.kt:47,122`).
- **Spine:** the Indexes convention carries over item, list_members and refresh_token indexes, but **not**
  `users(username) UNIQUE`. The ER shows `username text` without a constraint. The Errors convention says only "never
  by catching SQL state codes in GQL", so whether a service may catch SQLSTATE 23505 is left open. In PostgreSQL a
  failed statement also aborts the surrounding transaction, so the Mongo try/catch shape cannot be copied inside
  `suspendTransaction`.
- **Fix:** add `users.username UNIQUE` to the index/ER list. In the Errors convention, decide how an expected
  conflict is detected. Either use `INSERT … ON CONFLICT DO NOTHING` and check the affected row count (preferred,
  since it keeps the transaction alive), or catch 23505 at the transaction boundary in the service. Apply the same
  rule to `list_members` PK conflicts.

### H7. The username sort order (Epic 9 AD-6) silently changes under PostgreSQL collation

- Epic 9 AD-6 fixes the order: users are sorted by `username` ascending "with Mongo's default binary collation".
  `findPage` and `countUsernamesBefore` (`lt`) both rely on it, and the `@serial-users` E2E arranges page
  boundaries. The DigitalOcean default database collation (typically `en_US.UTF-8`) orders case and punctuation
  differently. That is a user-visible change under FR70, and dev/Testcontainers may even use a different default
  collation than production.
- AD-6 is not in the inherited-invariants table and not in the superseded table.
- **Fix:** add the row to the inherited table and add to AD-6: `users.username text COLLATE "C"` (byte order, which
  matches Mongo's binary order), so `ORDER BY` and `<` agree in every environment.

### H8. AD-13 silently weakens Epic 9 AD-9's rule on the readiness probe

- Epic 9 AD-9: "A compose healthcheck, if added, runs on `bp_front` with busybox `wget -qO- http://localhost/api/health`.
  **No probe tool is added to the `bp_back` image.**" `bp_back` runs on `eclipse-temurin:25`, and
  `bp_front` on `caddy:2-alpine`.
- Spine: the inherited row says `/api/health` "is also the compose healthcheck". AD-13 waits for "both containers to
  be healthy (`bp_back` through `/api/health`)". A `bp_back` healthcheck needs a probe tool in that image, or a
  JVM-based probe. Nothing marks this as superseded.
- **Fix:** either keep Epic 9 AD-9 as written (the `bp_front` healthcheck probes `/api/health` through Caddy, the
  deploy waits on `bp_front` healthy and then the smoke test) or list AD-9's probe rule as deliberately superseded,
  saying which tool goes into the `bp_back` image.

### H9. Terraform cannot make `bag_please_app` the schema owner; Flyway may fail on first deploy (verify)

- AD-11: "Terraform creates database `bag_please` and user `bag_please_app`. That user owns the schema… `doadmin` is
  never used by the app." The `digitalocean` provider creates the database (owned by `doadmin`) and the user, but it
  issues no `ALTER … OWNER`/`GRANT`. Since PostgreSQL 15, `public` no longer grants `CREATE` to `PUBLIC`, so Flyway
  running as `bag_please_app` would hit "permission denied for schema public" on `V1`.
- **Fix:** verify against a DO cluster on PG 18. If it is confirmed, add the one-time privileged step to AD-11, e.g.
  `ALTER DATABASE bag_please OWNER TO bag_please_app` or `CREATE SCHEMA app AUTHORIZATION bag_please_app` run once as
  `doadmin` through the AD-9 tunnel, as an `infra:` task. Narrow "doadmin is never used" to "never used by the
  running app or the importer". Alternatively, use the `cyrilgdn/postgresql` provider through the tunnel.

### H10. The Deferred item "AD-15 makes any order safe" is false; slice order is constrained, and a mixed state forces writes to both stores

- `V1__baseline.sql` "holds the whole Epic 11 schema", FKs included. If items move to PostgreSQL before lists, every
  item insert violates `items.list_id → lists.id`. Cross-slice paths such as `ListService.cascadeDeleteList` (items,
  categories, members, list), `CategoryService.deleteCategory → ItemService.deleteAllInCategory`, and
  `ItemService → ListService.verifyMembership` mean that in any mixed state one public method touches both stores.
  That contradicts AD-15's "no code writes to both stores" and makes AD-2's one-transaction rule unattainable.
- This is exactly what the checklist means by a Deferred item that could let two stories diverge.
- **Fix:** take the item out of Deferred. Either fix the order (foundation: `Database.kt` + Flyway + V1 + test
  helper; then all repositories in FK order users → lists/list_members → categories → items → feedback/config/auth;
  then cache removal), or let the foundation story land V1 without FKs and add them in a later `V2` once every slice
  is on PostgreSQL. Allow dual-store cross-calls on the branch explicitly, stating which side may be non-transactional
  until then.

### H11. Cutover ordering and the importer's emptiness check collide with lazy writes and the config cache

- `ApplicationConfigRepository.load()` **inserts** the default `app_config` row on first read
  (`ApplicationConfig().also { save(it) }`), and `/api/auth/config` reads it. If the backend has been deployed and
  touched (smoke test, operator check) before the import, the importer refuses ("any application table holds a
  row"). `flyway_schema_history` is also a table in the schema.
- `ApplicationConfigService` keeps an `AtomicReference` cache that AD-1 does not mention ("no replacement cache is
  added anywhere" says nothing about this existing cache). A backend running during the import keeps serving the
  default `registrationEnabled = false` until restart. That is the synced-once trap AD-1 claims to remove.
- AD-13's smoke test targets `https://bag-please.io-workshop.net/`. During cutover that URL still points at the
  **old** deployment, so the first deploy can report success without touching the new droplet.
- **Fix:** in AD-9, define "application tables" (exclude `flyway_schema_history`). Fix the cutover order: infra, then
  import (the importer runs Flyway itself), then first deploy, then repoint the edge. The current Deferred wording
  leaves "deploy before import" possible. Decide the config cache's fate in AD-1: delete it, or keep it and require
  a restart after import. Make the smoke test also hit the droplet directly (`/api/health` and the served version)
  through the jump host, not only the public URL.

### H12. NFR-D5 versus the Deferred "manual restore from the Mongo backup" fallback is an unresolved open question

- The memlog's last entry is an open `(question)`: keeping a Mongo backup as md's fallback conflicts with NFR-D5
  (the export, which holds password hashes, is deleted once the import is verified). The spine's Deferred section
  resolves it silently, against the PRD. The cutover story and the secrets story will act differently: one deletes,
  one keeps.
- **Fix:** add an Open Questions section, or decide now. Say which artifact is kept (Mongo `db_data` volume on the old
  droplet, an archive, or nothing), where, for how long and when it is destroyed. Raise the matching NFR-D5/NFR-D4
  PRD amendment together with the restore-drill one.

## Medium

### M1. AD-3 "emit after `suspendTransaction` returns" is unsound with AD-2's join semantics, and internal and scheduler methods are not covered

When a public method is called from another service, its `suspendTransaction` joins the caller's transaction, so
"returns" is not "commits", and its emit would fire before the outer commit. No emitting nested call exists today
(`deleteAllInCategory` is internal and silent), but nothing prevents one. AD-2 covers "public" methods only, so
`runSchedulerCycle` (internal) and `deleteAllInCategory` have no stated transaction scope: one transaction per cycle
or per item? **Fix:** emit through a transaction-scoped buffer that the outermost transaction flushes on commit, or
rule that only methods called directly by GQL or the scheduler may emit. State the granularity of the scheduler
transactions: per item is recommended, so one bad row does not roll back the cycle.

### M2. AD-10 misstates the scheduler's current structure

"It is isolated like the existing steps, so a failure in one step does not skip the others." In fact
`plugins/Scheduler.kt` has one `try/catch` around `itemService.runSchedulerCycle()`, and inside it the recurring
restore and the hard-delete steps are not isolated: a throw in the restore skips the hard-delete. **Fix:** reword to
"each step, existing and new, gets its own try/catch (and its own transaction)", and make that part of the story.

### M3. The supersession list is incomplete

These inherited rules change and are not listed:

- **Epic 9 AD-7 / `CategoryService.deleteCategory`:** emits the `DELETED` event in a `finally`, even on failure, by
  design. AD-3 ("a rolled-back transaction emits nothing") reverses that, and AD-3 itself says the emitted events
  "stay as they are today".
- **Epic 9 AD-1:** feedback `_id` is a string. AD-6 makes it a `uuid`; the domain `Feedback.id: String` stays.
- **Epic 9 AD-8:** "writes only through `ListStorage.save`…"
- **Epic 9 AD-9:** "Mongo `ping`".
- **The users `TOCTOU` comment and unique index.**
- **`bp_back/CLAUDE.md` "Tests: real MongoDB from `mongoContainer()`".**

**Fix:** add rows for each.

### M4. The `Stack` table omits the Exposed date/time module and the mapping from `Instant` to `timestamptz`

`timestamptz` needs `exposed-java-time` (`timestampWithTimeZone` / `timestamp`) or `exposed-kotlin-datetime`, and the
domain uses `java.time.Instant`. Two slices can pick different modules or column functions, and some Exposed
`timestamp()` mappings target `timestamp without time zone`. PostgreSQL also truncates to microseconds, while
`Instant.now()` on Linux carries nanoseconds, so equality-based tests and the "keep the stored clock" logic in
`applyCheckState` compare across a lossy round trip. **Fix:** pin `exposed-java-time` 1.6.0 in Stack. Name the one
column function used for every instant. Decide where truncation happens: truncate `now` to micros in services, or
accept it in tests.

### M5. The importer's UUID shapes are unspecified

`UUIDSerializer` writes strings, but `UserRepository.save` upserts with `Filters.eq("_id", user.id)` under
`UuidRepresentation.STANDARD`, so `users._id` values are BSON binary subtype 4 while other collections hold strings.
Legacy rows may mix both, which is why `UUIDSerializer.deserialize` accepts both. In relaxed Extended JSON these
appear as `{"$binary":{…,"subType":"04"}}` versus plain strings, and `list_members._id` is a composite string
`"<list>_<user>"`. **Fix:** in AD-9, state that the importer accepts both UUID encodings for every id and reference
field, ignores `list_members._id`, and counts unparseable ids as rejected rows.

### M6. Transaction isolation and the write primitive are undecided

Today every repository `save` is an upsert by `_id`. `ItemService.saveItem`'s create/update split, `shareList`'s
"existing and not DECLINED, then save", and `acceptInvite` are check-then-write sequences. Under PostgreSQL's
default `READ COMMITTED`, AD-2's "membership check in the same transaction" does not stop a concurrent
`removeMember` from interleaving. **Fix:** state the isolation level (`READ COMMITTED`, accepted, or
`SELECT … FOR UPDATE` on the list row for membership-guarded writes). State the write primitive (`insert` for creates,
`upsert` via `ON CONFLICT` only where today's semantics need it).

### M7. Prod secrets may reach Gradle and the test JVM through the `deploy` task

AD-12 puts the JWT secret and admin credentials in `.secure.deploy.env`, and AD-13's `deploy` runs the backend
tests. the reference project's `lib.sh task()` strips only `DIGITALOCEAN_TOKEN`, `AWS_*`, `EDGE_SSH` and `TF_VAR_*`. If the JWT and
admin entries are named `KTOR_JWT_SECRET`/`KTOR_ADMIN_PASS`, they are not stripped. `application.yaml` would also
substitute them into any test that does not override `jwt.*`. **Fix:** require a stripped prefix for every
deploy-only secret, e.g. `TF_VAR_` or `PROD_`, mapped to `KTOR_*` only when `.env` is written, and say so in AD-12.

### M8. The docs dimension has no owner

AD-15 says only that at merge Mongo "is gone from … docs". Nothing assigns the documentation updates:

- **Root `CLAUDE.md`:** project overview "MongoDB 8 … `db_data`", Docker Compose commands, `project.env` /
  `images:build-push`, and the dump/restore section that has to be replaced, not just deleted.
- **`bp_back/CLAUDE.md`:** the layers diagram, Storage, the Mongo layer, the Tests section, and Security's "Mongo
  `refresh_tokens` with a TTL index".
- **`routing/edge-proxy.md`:** the new production domain and the edge contract for `bag-please.io-workshop.net`.
- **A `deploy/` operator doc:** infra, deploy, rollback and the cutover runbook.
- **Playwright comments that name Mongo.**

**Fix:** add a docs row to the Consistency Conventions or the capability map. Name which story owns each file. Make
the `CLAUDE.md` updates part of the stories that change the behaviour, not a merge-time sweep.

### M9. Local dev is under-specified

The spine fixes `postgres:18` and fixed credentials, but not the following:

- the published loopback port (Mongo deliberately used 27217 to avoid a local install; 5432 will collide the same way);
- the `application.yaml` defaults for `KTOR_DB_*` that `gradle :bp_back:run` uses against `docker compose up`;
- the renaming of `docker:back`/`docker:up` descriptions (they name mongo);
- removing `MIGRATION_TARGET_USER` and `KTOR_MONGO_*` from compose;
- how a developer resets the dev DB (drop the volume, or `flyway clean` disabled?).

**Fix:** add a "Local dev" convention row covering these.

### M10. The PRD amendments the spine depends on are not done, and there is no Open Questions section

AD-15 relaxes NFR17's per-story gate, and Deferred skips NFR-D4's restore drill ("Needs a PRD NFR-D4 amendment").
Both still read as binding in `prd.md` (lines 884, 925, 595). The memlog recorded "offer md a PRD note" for both.
**Fix:** either amend the PRD before `status: final`, or list both under an explicit Open Questions section, together
with H12.

### M11. AD-7 "explicit, in today's order" makes the FK the real cascade for category delete

`deleteCategory` today deletes the **category first** and then its items. With `items.category_id … ON DELETE CASCADE`,
the FK removes the items and the explicit `deleteAllInCategory` deletes zero rows. That is harmless, but it is the
opposite of "FK as backstop". The same pattern appears in H1. **Fix:** say "children before parent" explicitly in
AD-7 (and reorder `deleteCategory`), or accept that the FK is the mechanism wherever no counts or events depend on
the children.

## Low

- **L1. Branch name.** AD-15 names `epic-11`, but the work is already on `feature/pg-migration`. Pick one so the stories
  target the same branch.
- **L2. Primary keys.** AD-6 says "Primary keys are `uuid`", but the ER has `refresh_tokens.token text PK`, and
  `app_config` is a fixed-id singleton. Note both exceptions, or make `token` a `uuid` (it is a `UUID.randomUUID()`
  string).
- **L3. FK indexes.** PostgreSQL does not index FK columns. The cascade and lookup paths (`lists(owner_id)`,
  `categories(list_id)`, `items(category_id)`, `list_members(list_id)`, covered by the PK prefix) are not in the
  Indexes row. Under "others only with a reason", each story will argue them separately. List them.
- **L4. Leftover Mongo-era pieces.** Name these for deletion: the `com.bagplease.mongo` package (`MongoConnection`,
  serializers), the Ktor DI `provide { MongoConnection }` (also used by `Routing.kt`'s health route), the
  `migration.targetUser` config key and the `MIGRATION_TARGET_USER` compose env, the `mongodb` entries in
  `libs.versions.toml`, and `MigrationTest`/`ItemCategoryStorageTest`. Also state what replaces DI for
  `R2dbcDatabase`.
- **L5. Droplet compose hardening.** `read_only: true` on the JVM container needs `tmpfs: [/tmp]`, as the reference project does.
  Also set Docker log rotation (`max-size`), since `docker compose logs` is the whole observability story and an
  unbounded json-file log can fill the smallest droplet's disk.
- **L6. `verify-full` over the private hostname.** Confirm that DO's server certificate covers the cluster's
  **private** hostname that the droplet connects to. Otherwise AD-14's `verify-full` fails at first deploy, and the
  "named exception" would have to grow.
- **L7. Importer build commit.** The importer runs Flyway itself, so it must be built from the same commit as the
  release that will first run against the database. Otherwise the history diverges, or a later image sees "future"
  migrations. Say so in AD-9.
- **L8. Enforcing AD-2's join rule.** AD-2's join rule depends on Exposed's nested-transaction setting. Pin
  `useNestedTransactions = false`, the default, in `plugins/Database.kt` and say so, so that no slice turns on
  savepoints.
- **L9. Terraform state key.** Name the backend `key` (e.g. `bag-please/prod.tfstate`). Ensure the `.gitignore`
  patterns from AD-12 land in the first infra commit. the reference project's working tree has local `terraform.tfstate` files under
  `deploy/terraform/`, which shows how easily they appear.
- **L10. The health route.** The health route is neither a service nor a repository. Say how it pings: one
  `SELECT 1` in its own `suspendTransaction` inside `withTimeout(2.seconds)`. Say also that pool-acquisition timeouts
  count as 503, so the Epic 9 AD-9 2-second contract survives an exhausted R2DBC pool.
- **L11. Bcrypt and connections.** `UserService.login`/`register` run bcrypt (cost 12, about 250 ms) on
  `Dispatchers.IO`. Inside a method-wide `suspendTransaction` (AD-2), that holds a pool connection for the whole
  hash, and the cheapest managed tier has a low connection limit. Consider hashing outside the transaction or
  exempting it, and record the decision next to the deferred pool size.

## Checklist summary

| Checklist item | Result |
|---|---|
| Fixes the real divergence points for the stories, misses none | Partly. It misses GQL-to-repository access (H2), Either/transaction nesting (H3), orphan handling (H4), unique/collation (H6, H7), cutover order (H11), isolation (M6) |
| Every AD Rule enforceable and prevents its divergence | Mostly. AD-3 has a hole with nested calls (M1), AD-4 has a wrong derivation (C1), AD-2's join rule needs pinning (L8) |
| Nothing under Deferred could let two stories diverge | No. "Order of slice stories" (H10) and "Backups" versus NFR-D5 (H12) |
| Ratifies rather than contradicts the codebase | Factual errors: GQL members derivation (C1), the purge as one transaction (H1), one-way layering (H2), scheduler step isolation (M2), the config cache not mentioned (H11) |
| No new AD silently weakens an inherited one; superseded list complete | No. Epic 9 AD-9 probe (H8), AD-6 collation (H7), AD-7 finally-emit, AD-1 id type and others (M3) |
| Every owned dimension decided, deferred or open | Deployment, infra, secrets, TLS and tests are decided. Operations is partly decided (rollback H5, privileges H9, logs L5). Local dev is thin (M9). Docs/CLAUDE.md have no owner (M8). There is no Open Questions section (M10) |
