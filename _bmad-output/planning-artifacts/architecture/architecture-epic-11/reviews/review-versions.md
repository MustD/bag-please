# Review: versions and reality check, Epic 11 spine

- **Lens:** every committed decision must be web-researched or reality-checked, not asserted from training data
- **Target:** `ARCHITECTURE-SPINE.md` (Stack table, AD-2, AD-3, AD-8, AD-9, AD-11, AD-12, AD-14, AD-16, Structural Seed)
- **Date:** 2026-10-21
- **Method:** `repo1.maven.org` metadata and POMs, plus the published sources jars read directly (exposed-r2dbc,
  exposed-core, r2dbc-postgresql). `javap` on flyway-database-postgresql. The Terraform registry v2 API, including provider
  docs for 2.106.0. The Docker Hub tags API. DigitalOcean docs and release notes. mise docs. The repo's
  `gradle/libs.versions.toml`, and mal_ui's `mise.toml` and `versions.tf`.

## Verdict

**Pass with findings.** Every version in the Stack table is the current release on its registry as of today, and the
memlog's verification claims hold up. The named APIs exist and behave as AD-2, AD-8, AD-9 and AD-14 assume. The spine
never checked five things, and each one can bite during implementation:

1. **Exposed retries the transaction block.** By default `suspendTransaction` re-runs the whole block up to 3 times on
   an `R2dbcException`. AD-3's buffer for post-commit events must be created inside the block, or it must be reset
   on each attempt. Otherwise a retried transaction emits duplicate events.
2. **The Netty versions clash.** `r2dbc-postgresql` 1.1.3 brings `reactor-netty-core` 1.1.22, which is built against
   Netty 4.1.138. Ktor 3.6.0 requires Netty 4.2.17. Gradle resolves Netty 4.2.17, so reactor-netty 1.1.x runs on a Netty
   major line it was not built for. No source confirms this works. A spike is needed.
3. **The `postgres:18` image moved its data directory.** In the 18+ images, PGDATA is `/var/lib/postgresql/18/docker` and
   the volume is declared at `/var/lib/postgresql`. AD-16's named volume must mount at `/var/lib/postgresql`. Mounting at
   the old `/var/lib/postgresql/data` path loses the data.
4. **The Stack table lacks a date/time module.** AD-6 requires `timestamptz` for every instant. Exposed needs
   `exposed-java-time` or `exposed-kotlin-datetime` 1.6.0 for that, and the table lists neither.
5. **`verify-full` on the private hostname was never checked.** No DO doc says that the cluster certificate's names cover
   the `private-…` hostname. AD-14's runtime connection depends on that.

## Claim by claim

| # | Claim (spine location) | Status | Evidence / source |
|---|---|---|---|
| 1 | `exposed-core` / `exposed-r2dbc` **1.6.0** (Stack) | **Confirmed**, latest | Both list `<release>1.6.0</release>`, lastUpdated 2026-10-16. https://repo1.maven.org/maven2/org/jetbrains/exposed/exposed-r2dbc/maven-metadata.xml |
| 2 | `exposed-r2dbc` deps: r2dbc-spi 1.0.0, coroutines-reactive 1.11.0 (memlog) | **Confirmed** | The POM lists r2dbc-spi 1.0.0.RELEASE, kotlinx-coroutines-reactive 1.11.0 and kotlin-stdlib 2.3.20. https://repo1.maven.org/maven2/org/jetbrains/exposed/exposed-r2dbc/1.6.0/exposed-r2dbc-1.6.0.pom |
| 3 | `suspendTransaction` exists for `R2dbcDatabase` (AD-2) | **Confirmed** | `org.jetbrains.exposed.v1.r2dbc.transactions.suspendTransaction(db: R2dbcDatabase? = null, transactionIsolation, readOnly, statement: suspend R2dbcTransaction.() -> T)` appears in `Transactions.kt` of exposed-r2dbc-1.6.0-sources.jar. Docs: https://www.jetbrains.com/help/exposed/transactions.html |
| 4 | A nested `suspendTransaction` joins the outer one (AD-2: "a service calling another service joins the caller's transaction") | **Confirmed** (default config) | `R2dbcTransactionManager.newTransaction` returns `outerTransaction.takeIf { !db.useNestedTransactions }`. `DatabaseConfig.useNestedTransactions` defaults to `false`, and the nested call runs with `shouldCommit = false`. The docs agree: "a nested transaction block shares the transaction resources of its parent". **Condition:** `R2dbcDatabase.connect` must not set `useNestedTransactions = true`, and the spine should say so. Also: `inTopLevelSuspendTransaction` **always commits**, even when nested, so it must never be used in services. |
| 5 | (unstated) The retry behaviour of the top-level `suspendTransaction` | **Gap: affects AD-3** | `inTopLevelSuspendTransaction` loops on `R2dbcException` up to `transaction.maxAttempts`, and `DatabaseConfig.defaultMaxAttempts = 3`. The whole `statement` block re-runs. An event buffer created outside the block, or any other side effect inside it, repeats on each attempt. The fix is either `defaultMaxAttempts = 1`, or AD-3 stating that the buffer is local to the block. The importer (AD-9) is safe, because a retry starts from a rolled-back, empty database. Source: `Transactions.kt` and `core/DatabaseConfig.kt` in the 1.6.0 sources jars. |
| 6 | "R2DBC still evolving, parity with JDBC not guaranteed" (memlog) | **Unverified now** | The current transactions page no longer carries that caveat. The memlog may have quoted another page. The point does not change any decision. |
| 7 | `org.postgresql:r2dbc-postgresql` **1.1.3.RELEASE** (Stack) | **Confirmed**, latest (2026-09-21) | https://repo1.maven.org/maven2/org/postgresql/r2dbc-postgresql/maven-metadata.xml |
| 8 | r2dbc-postgresql supports `sslMode` verify-full / verify-ca, plus a root CA (AD-14, AD-9) | **Confirmed** | `SSLMode.VERIFY_CA("verify-ca")` and `VERIFY_FULL("verify-full")`. Options `sslMode`, alias `sslmode`, and `sslRootCert` (a PEM file path that must exist, `requireExistingFilePath`). `AbstractPostgresSSLHandlerAdapter` checks the hostname only when the mode is `VERIFY_FULL`, so `verify-ca` over a localhost tunnel works as AD-9 intends. Source: r2dbc-postgresql-1.1.3.RELEASE-sources.jar. **Note:** the option is spelled `sslRootCert` for R2DBC and `sslrootcert` for pgJDBC. `plugins/Database.kt` must map the one config key to both spellings (AD-8). |
| 9 | Driver dependency compatibility with Ktor 3.6.0 | **Risk, unverified** | The r2dbc-postgresql 1.1.3 POM lists reactor-core 3.5.20, reactor-netty-core 1.1.22 and netty-* 4.1.138.Final. The ktor-server-netty-jvm 3.6.0 POM lists netty-* 4.2.17.Final. Gradle picks 4.2.17, and reactor-netty 1.1.x was built for Netty 4.1 (4.2 support arrived in reactor-netty 1.3). No source confirms that this combination works. Run a TLS connection spike early, and check `gradle :bp_back:dependencyInsight --dependency netty` once the dependencies are added. https://repo1.maven.org/maven2/org/postgresql/r2dbc-postgresql/1.1.3.RELEASE/r2dbc-postgresql-1.1.3.RELEASE.pom, https://repo1.maven.org/maven2/io/ktor/ktor-server-netty-jvm/3.6.0/ktor-server-netty-jvm-3.6.0.pom, https://mvnrepository.com/artifact/io.projectreactor.netty/reactor-netty-http/1.3.0 |
| 10 | `io.r2dbc:r2dbc-pool` **1.0.2.RELEASE** (Stack) | **Confirmed**, latest | Released 2024-10-17, with nothing newer. It depends on r2dbc-spi 1.0.0 and reactor-pool 1.0.8. It is stable but has had no release in 2 years, so there is some maintenance risk. https://repo1.maven.org/maven2/io/r2dbc/r2dbc-pool/maven-metadata.xml |
| 11 | `flyway-core` / `flyway-database-postgresql` **13.11.1** (Stack) | **Confirmed**, latest | Published today (lastUpdated 2026-10-21 16:23). https://repo1.maven.org/maven2/org/flywaydb/flyway-database-postgresql/maven-metadata.xml |
| 12 | Flyway 13 needs `flyway-database-postgresql` and JDBC (AD-8) | **Confirmed** | The PostgreSQL support classes (`PostgreSQLDatabase`, `PostgreSQLParser`, the advisory lock) live only in the separate module, which registers through `META-INF/services/org.flywaydb.core.extensibility.Plugin`. Flyway is JDBC-based, so it needs `org.postgresql:postgresql`. Source: flyway-database-postgresql-13.11.1.jar. |
| 13 | Flyway 13 works with PostgreSQL 18 | **Confirmed** | `javap` of `PostgreSQLDatabase.ensureSupported` shows that OSS requires at least `10`, and `recommendFlywayUpgradeIfNecessaryForMajorVersion("18")`. 18 is the newest version this build was verified against, so there is no warning. |
| 14 | `org.postgresql:postgresql` **42.7.14** (Stack) | **Confirmed**, latest (2026-10-07) | https://repo1.maven.org/maven2/org/postgresql/postgresql/maven-metadata.xml |
| 15 | `org.testcontainers:testcontainers-postgresql` **2.0.5** (Stack) | **Confirmed**, artifact name and version | The 2.x artifact is `testcontainers-postgresql`. The old `org.testcontainers:postgresql` stops at 1.21.4. 2.0.5 matches the repo's `testcontainers = "2.0.5"`. In 2.x the class to use is `org.testcontainers.postgresql.PostgreSQLContainer`; the `org.testcontainers.containers` one is a legacy shim. https://repo1.maven.org/maven2/org/testcontainers/testcontainers-postgresql/maven-metadata.xml |
| 16 | `postgres:18` Docker image (AD-16) | **Confirmed, with a gotcha** | Tags `18`, `18.6` and `18-trixie` were updated 2026-10-21. https://hub.docker.com/v2/repositories/library/postgres/tags/?name=18. **The 18+ images changed PGDATA to `/var/lib/postgresql/18/docker` and the volume to `/var/lib/postgresql`. "Mounts and volumes should be targeted at the updated location."** https://github.com/docker-library/docs/blob/master/postgres/README.md. AD-16 should name the mount path. |
| 17 | DO managed PostgreSQL offers 18 (AD-11, AD-16) | **Confirmed** | "5 November 2025: PostgreSQL 18 is now available for database clusters." https://docs.digitalocean.com/release-notes/postgresql/ |
| 18 | Cheapest tier (AD-11, NFR-D6) | **Confirmed** (price), **unverified** (slug for PG 18) | The pricing page lists a single node with 1 GiB at $15.00/mo and recommends it for dev and test only. https://docs.digitalocean.com/products/databases/postgresql/details/pricing/. The provider docs give the slug `db-s-1vcpu-1gb` as an example. The spine leaves the slug to the deploy story, which is correct. Confirm it with `doctl databases options slugs --engine pg` before apply. |
| 19 | `digitalocean_database_cluster`, `_db`, `_user`, `_firewall` resources; `digitalocean_database_ca` data source (AD-11, AD-14) | **Confirmed** in provider 2.106.0 | The registry docs list resources `database_cluster`, `database_db`, `database_user` and `database_firewall`, and data source `database_ca`, which exposes `certificate`. `database_firewall` accepts `type = "droplet"` with `value = digitalocean_droplet.x.id`. The cluster takes `version` ("18"), `size` and `private_network_uuid`. https://registry.terraform.io/providers/digitalocean/digitalocean/2.106.0/docs/resources/database_cluster, …/resources/database_firewall, …/data-sources/database_ca |
| 20 | `private_host` output (AD-9) | **Confirmed** | "`private_host` - Same as `host`, but only accessible from resources within the account and in the same region." Same docs as row 19. |
| 21 | `verify-full` works against the private hostname (AD-14) | **Unverified** | The DO connect docs show `verify-full` with "your cluster hostname" and never say whether the certificate covers the `private-…` name. https://docs.digitalocean.com/products/databases/postgresql/how-to/connect/. Check it once on the droplet (`psql "sslmode=verify-full sslrootcert=ca.crt host=<private_host>"`) before AD-14 is final. If it fails, AD-14's single exception (AD-9) no longer holds. |
| 22 | Port **25060** (Structural Seed) | **Confirmed** (community and DO docs search), but read it from Terraform | DO docs describe managed clusters as requiring port 25060. https://docs.digitalocean.com/products/databases/postgresql/how-to/connect/ (the page itself shows a placeholder and says to use the cluster's connection details). Use `digitalocean_database_cluster.port` as the source rather than hard-coding the number. AD-12 already reads the port from `terraform output`. |
| 23 | Provider `~> 2.106` (Stack) | **Confirmed**, latest (2026-10-12) | https://registry.terraform.io/v1/providers/digitalocean/digitalocean/versions. mal_ui pins `~> 2.104`, so the higher floor here is deliberate. |
| 24 | Terraform `~> 1.15` (Stack) | **Confirmed**, compatible | The current CLI is 1.16.6 (https://checkpoint-api.hashicorp.com/v1/check/terraform). `~> 1.15` allows any 1.x ≥ 1.15. It matches mal_ui's `versions.tf`. |
| 25 | mise loads env files per task (AD-12) | **Confirmed** | Task `env` accepts the same forms as top-level `[env]`, including `_.file`. https://mise.jdx.dev/tasks/task-configuration.html. mal_ui already uses `env = { _ = { file = ".secure.deploy.env" } }`. **Caveat:** task `env` does not pass to `depends` tasks, but a nested `mise run` inherits it. That is why AD-12's `lib.sh` stripping step is needed, so keep it. |
| 26 | Kotlin 2.4.21 / Ktor 3.6.0 / temurin-25 "unchanged" (Stack) | **Confirmed** fits | The repo pins kotlin 2.4.21 and ktor 3.6.0. Exposed 1.6.0 is compiled with Kotlin 2.3.20, which a 2.4.21 compiler can consume. The latest Kotlin stable is 2.4.21; 2.5.0-Beta2 is a pre-release. https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/maven-metadata.xml |
| 27 | Coroutines alignment | **Confirmed** | exposed-core 1.6.0 and ktor-server-core 3.6.0 both declare kotlinx-coroutines 1.11.0, which is the latest. exposed-r2dbc brings coroutines-reactive 1.11.0. The mongodb coroutine driver's BOM (1.6.4) gets resolved upward, and it is removed later in the epic. No conflict. |
| 28 | Exposed module list in Stack | **Gap** | AD-6 requires `timestamptz`. `timestampWithTimeZone` lives in `exposed-java-time` or `exposed-kotlin-datetime`, both published at 1.6.0 (HTTP 200 on the POMs). Pick one and add it to the Stack table. `text[]` (`array<String>`) is in core, and exposed-r2dbc maps it for PostgreSQL. |

## Recommended spine edits (not applied)

1. AD-2: add "`R2dbcDatabase` is configured with `useNestedTransactions = false`, the default; services never call
   `inTopLevelSuspendTransaction`".
2. AD-3: add "the event buffer is created inside the transaction block, so a retried attempt starts empty". Or set
   `defaultMaxAttempts = 1` and say so.
3. AD-16: add "the Compose volume mounts at `/var/lib/postgresql`, as the postgres 18+ images require".
4. Stack: add `exposed-java-time` (or `exposed-kotlin-datetime`) 1.6.0.
5. Add a spike to the first slice story: start Ktor 3.6.0 (Netty 4.2.17) with r2dbc-postgresql 1.1.3 (reactor-netty 1.1.22) and
   connect over TLS. Before the first deploy, run a `verify-full` check against `private_host`.
