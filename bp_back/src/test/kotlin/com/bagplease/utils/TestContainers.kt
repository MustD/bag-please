package com.bagplease.utils

import io.kotest.core.extensions.install
import io.kotest.core.spec.style.FunSpec
import io.kotest.extensions.testcontainers.TestContainerProjectExtension
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.testing.ApplicationTestBuilder
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.mongodb.MongoDBContainer
import org.testcontainers.postgresql.PostgreSQLContainer

fun FunSpec.mongoContainer(): MongoDBContainer {
    val container = install(
        TestContainerProjectExtension(
            MongoDBContainer("mongo:8")
        )
    ) {
        withEnv("MONGO_INITDB_ROOT_USERNAME", "test_user")
        withEnv("MONGO_INITDB_ROOT_PASSWORD", "test_pass")
        waitingFor(Wait.forListeningPort())
    }
    // Users and sessions live in the shared PostgreSQL (Story 11.2): start every spec from empty tables.
    beforeSpec { SharedPostgres.reset() }
    return container
}

// One PostgreSQL 18 per test JVM, started on first use and reaped by Testcontainers' Ryuk at exit.
// `module()` runs Flyway at startup (Story 11.1), so every app-booting test needs a reachable PostgreSQL,
// even though no slice reads or writes it yet. The role setup mirrors `postgres/init/01-app-role.sh`:
// the app connects as the non-superuser `bag_please_app`, which owns `public` in `bag_please`.
object SharedPostgres {
    const val APP_USER = "bag_please_app"
    const val APP_PASSWORD = "bag_please_app"
    const val DB_NAME = "bag_please"

    val container: PostgreSQLContainer by lazy {
        PostgreSQLContainer("postgres:18")
            .withUsername("postgres")
            .withPassword("postgres")
            .withDatabaseName("postgres")
            .apply {
                start()
                runSql("postgres", "CREATE ROLE $APP_USER LOGIN PASSWORD '$APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE")
                runSql("postgres", "CREATE DATABASE $DB_NAME OWNER $APP_USER")
                runSql(DB_NAME, "ALTER SCHEMA public OWNER TO $APP_USER")
            }
    }

    /**
     * The container is shared by every spec in the JVM, so `users` / `refresh_tokens` rows outlive a spec (Story 11.2).
     * Migrates (idempotent) so the tables exist even if no app has booted yet, then empties every table.
     */
    fun reset() {
        com.bagplease.plugins.migrate(container.appConfig())
        container.runSql(
            DB_NAME,
            "TRUNCATE users, lists, list_members, categories, items, feedback, refresh_tokens, app_config CASCADE",
        )
    }

    private fun PostgreSQLContainer.runSql(db: String, sql: String) {
        val r = execInContainer("psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db, "-c", sql)
        check(r.exitCode == 0) { "psql failed: ${r.stderr}" }
    }
}

fun FunSpec.postgresContainer(): PostgreSQLContainer = SharedPostgres.container

/** JDBC url of the app database on the shared container, as the non-superuser app role. */
fun PostgreSQLContainer.appJdbcUrl(): String =
    "jdbc:postgresql://$host:$firstMappedPort/${SharedPostgres.DB_NAME}"

fun ApplicationTestBuilder.setUpPostgres(container: PostgreSQLContainer = SharedPostgres.container) = environment {
    config = config.mergeWith(
        MapApplicationConfig(
            "db.postgres.host" to container.host,
            "db.postgres.port" to container.firstMappedPort.toString(),
            "db.postgres.name" to SharedPostgres.DB_NAME,
            "db.postgres.user" to SharedPostgres.APP_USER,
            "db.postgres.password" to SharedPostgres.APP_PASSWORD,
            "db.postgres.sslmode" to "disable",
            "db.postgres.sslrootcert" to "",
        )
    )
}

fun ApplicationTestBuilder.setUpMongo(container: MongoDBContainer) {
    setUpPostgres() // module() migrates PostgreSQL at startup; see SharedPostgres
    environment {
        config = config.mergeWith(
            MapApplicationConfig(
                "db.mongo.host" to "localhost",
                "db.mongo.port" to container.firstMappedPort.toString(),
                "db.mongo.db_name" to "test",
                "db.mongo.user" to "test_user",
                "db.mongo.pass" to "test_pass",
            )
        )
    }
}

// Writes the app_config row directly to PostgreSQL before the application starts. Config is never cached, so
// this only needs to precede the request that reads it. Does not consume any HTTP rate-limit slots.
fun setUpRegistration(enabled: Boolean) {
    java.sql.DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    ).use { c ->
        c.prepareStatement(
            "INSERT INTO app_config (id, registration_enabled) VALUES ('00000000-0000-0000-0000-000000000001', ?) " +
                "ON CONFLICT (id) DO UPDATE SET registration_enabled = EXCLUDED.registration_enabled"
        ).use { it.setBoolean(1, enabled); it.executeUpdate() }
    }
}

fun ApplicationTestBuilder.setUpJwt() = environment {
    config = config.mergeWith(
        MapApplicationConfig(
            "jwt.secret" to "secret",
            "jwt.issuer" to "localhost",
            "jwt.audience" to "localhost",
            "jwt.realm" to "localhost",
            "jwt.admin_login" to "admin",
            "jwt.admin_pass" to "admin",
            "jwt.accessExpiryMinutes" to "15",
            "jwt.refreshExpiryDays" to "30",
        )
    )
}

/** The shared container's app database as a [com.bagplease.plugins.PostgresConfig]; [dbName] overrides the database. */
fun PostgreSQLContainer.appConfig(dbName: String = SharedPostgres.DB_NAME) = com.bagplease.plugins.PostgresConfig(
    host = host,
    port = firstMappedPort,
    name = dbName,
    user = SharedPostgres.APP_USER,
    password = SharedPostgres.APP_PASSWORD,
    sslmode = "disable",
    sslrootcert = "",
)

/** Creates an empty database owned by the app role, so a test can migrate from scratch. */
fun PostgreSQLContainer.createDatabase(name: String) {
    val r = execInContainer(
        "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
        "-c", "CREATE DATABASE $name OWNER ${SharedPostgres.APP_USER}",
    )
    check(r.exitCode == 0) { "psql failed: ${r.stderr}" }
    val s = execInContainer(
        "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", name,
        "-c", "ALTER SCHEMA public OWNER TO ${SharedPostgres.APP_USER}",
    )
    check(s.exitCode == 0) { "psql failed: ${s.stderr}" }
}

/** Runs [sql] on the shared app database over JDBC and returns every row as strings (null stays null). */
fun pgRows(sql: String): List<List<String?>> =
    java.sql.DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    ).use { c ->
        c.createStatement().use { st ->
            st.executeQuery(sql).use { rs ->
                val n = rs.metaData.columnCount
                buildList { while (rs.next()) add((1..n).map { rs.getString(it) }) }
            }
        }
    }

/** Runs a statement that returns no rows (DELETE, UPDATE …) on the shared app database. */
fun pgExec(sql: String) {
    java.sql.DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    ).use { c -> c.createStatement().use { it.execute(sql) } }
}

/** `SELECT count(*) …` on the shared app database. */
fun pgCount(sql: String): Long = pgRows(sql).single().single()!!.toLong()

/** The services that Application.kt wires together, built over [db] for tests that call them directly. */
class TestServices(
    val listService: com.bagplease.entity.list.ListService,
    val itemService: com.bagplease.entity.item.ItemService,
    val categoryService: com.bagplease.entity.category.CategoryService,
)

fun buildTestServices(db: com.mongodb.kotlin.client.coroutine.MongoDatabase): TestServices {
    val itemRepository = com.bagplease.entity.item.mongo.ItemRepository(db)
    val itemStorage = com.bagplease.entity.item.ItemStorage(itemRepository)
    lateinit var itemService: com.bagplease.entity.item.ItemService
    lateinit var categoryService: com.bagplease.entity.category.CategoryService
    val listService = com.bagplease.entity.list.ListService(
        repository = com.bagplease.entity.list.db.ListRepository(),
        userLookup = com.bagplease.entity.user.UserLookup(com.bagplease.entity.user.db.UserRepository()),
        itemService = lazy { itemService },
        itemRepository = itemRepository,
        categoryService = lazy { categoryService },
        itemStorage = itemStorage,
        adminLogin = "admin",
    )
    itemService = com.bagplease.entity.item.ItemService(itemStorage, listService, itemRepository, lazy { categoryService })
    categoryService = com.bagplease.entity.category.CategoryService(
        com.bagplease.entity.category.db.CategoryRepository(), listService, itemService,
    )
    return TestServices(listService, itemService, categoryService)
}
