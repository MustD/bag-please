package com.bagplease.plugins

import io.ktor.server.application.Application
import io.ktor.server.config.ApplicationConfig
import io.ktor.util.logging.KtorSimpleLogger
import io.r2dbc.spi.ConnectionFactories
import io.r2dbc.spi.ConnectionFactory
import io.r2dbc.spi.ConnectionFactoryOptions
import io.ktor.server.application.ApplicationStopped
import reactor.core.Disposable
import org.jetbrains.exposed.v1.r2dbc.R2dbcDatabaseConfig
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.withContext
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.r2dbc.R2dbcDatabase
import org.jetbrains.exposed.v1.r2dbc.R2dbcTransaction
import org.jetbrains.exposed.v1.r2dbc.transactions.suspendTransaction
import java.net.URLEncoder
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext

private val logger = KtorSimpleLogger("Database")

/**
 * The `db.postgres` block (AD-8), read from `KTOR_DB_*` in `application.yaml`. One block builds BOTH the
 * runtime R2DBC URL and Flyway's JDBC URL so the two can never point at different hosts or TLS modes.
 */
data class PostgresConfig(
    val host: String,
    val port: Int,
    val name: String,
    val user: String,
    val password: String,
    val sslmode: String,
    val sslrootcert: String,
    /** r2dbc-pool `maxSize`: the shared cluster allows about 22 connections for ALL projects. */
    val poolMaxSize: Int = 5,
) {
    private fun String.enc() = URLEncoder.encode(this, Charsets.UTF_8)

    /** R2DBC URL without credentials (they are passed as options, never concatenated). */
    fun r2dbcUrl(): String = buildString {
        append("r2dbc:pool:postgresql://$host:$port/$name")
        append("?sslMode=").append(sslmode.enc())
        if (sslrootcert.isNotBlank()) append("&sslRootCert=").append(sslrootcert.enc())
        append("&maxSize=").append(poolMaxSize)
    }

    /** JDBC URL without credentials, for Flyway only. */
    fun jdbcUrl(): String = buildString {
        append("jdbc:postgresql://$host:$port/$name")
        append("?sslmode=").append(sslmode.enc())
        if (sslrootcert.isNotBlank()) append("&sslrootcert=").append(sslrootcert.enc())
    }

    companion object {
        fun from(config: ApplicationConfig): PostgresConfig {
            val c = config.config("db.postgres")
            return PostgresConfig(
                host = c.property("host").getString(),
                port = c.property("port").getString().toInt(),
                name = c.property("name").getString(),
                user = c.property("user").getString(),
                password = c.property("password").getString(),
                sslmode = c.property("sslmode").getString(),
                sslrootcert = c.propertyOrNull("sslrootcert")?.getString() ?: "",
                poolMaxSize = c.propertyOrNull("poolMaxSize")?.getString()?.toInt() ?: 5,
            )
        }
    }
}

/** Applies the Flyway migrations over blocking JDBC. DDL only; never `clean`. */
fun migrate(config: PostgresConfig) {
    val flyway = Flyway.configure()
        .dataSource(config.jdbcUrl(), config.user, config.password)
        .locations("classpath:db/migration")
        .cleanDisabled(true)
        .load()
    val result = flyway.migrate()
    logger.info("Flyway applied ${result.migrationsExecuted} migration(s); schema at version ${result.targetSchemaVersion}")
}

/** The pooled factory behind [database]; kept so a replaced or stopped application can release its connections. */
@Volatile
private var pool: ConnectionFactory? = null

/** Opens the pooled R2DBC database. The process-wide handle used by [tx] is [database]. */
fun connectR2dbc(config: PostgresConfig): R2dbcDatabase {
    val options = ConnectionFactoryOptions.parse(config.r2dbcUrl()).mutate()
        .option(ConnectionFactoryOptions.USER, config.user)
        .option(ConnectionFactoryOptions.PASSWORD, config.password)
        .build()
    val factory = ConnectionFactories.get(options)
    pool = factory
    return R2dbcDatabase.connect(
        factory,
        R2dbcDatabaseConfig {
            connectionFactoryOptions { from(options) }
            useNestedTransactions = false // AD-17: no savepoints
            defaultMaxAttempts = 1 // AD-17: nothing is retried implicitly
        },
    )
}

@Volatile
private var database: R2dbcDatabase? = null

/** Disposes the current pool so its connections are returned to PostgreSQL (server `max_connections` is finite). */
private fun closePool() {
    (pool as? Disposable)?.dispose()
    pool = null
}

/** Runs Flyway, then opens the R2DBC pool. Called from `module()` before `configureGql`. */
fun Application.configureDatabase() {
    val config = PostgresConfig.from(environment.config)
    logger.info("Connecting to postgres at ${config.host}:${config.port}/${config.name} as ${config.user} (sslmode=${config.sslmode})")
    migrate(config)
    connectDatabase(config)
    val mine = pool
    // Only release the pool if a later application has not already replaced it.
    monitor.subscribe(ApplicationStopped) { if (pool === mine) closePool() }
}

/** Opens the pool and makes it the handle [tx] uses. Tests that need `tx` without booting the app call this directly. */
fun connectDatabase(config: PostgresConfig) {
    closePool() // a second connect (tests boot many applications per JVM) must not leak the first pool
    database = connectR2dbc(config)
}

internal class TxQueue : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<TxQueue>

    val actions = mutableListOf<suspend () -> Unit>()
}

class TxScope internal constructor(val transaction: R2dbcTransaction, private val queue: TxQueue) {
    /** Queues [action] on the OUTERMOST transaction: runs after it commits, in registration order; dropped on rollback. */
    fun afterCommit(action: suspend () -> Unit) {
        queue.actions += action
    }
}

/**
 * The only caller of `suspendTransaction` (AD-17). Joins the transaction already open on the coroutine context,
 * or opens one. No savepoints, no implicit retries. An exception (including Arrow `raise`) leaves the block,
 * rolls the outermost transaction back and drops its [TxScope.afterCommit] queue.
 */
suspend fun <T> tx(block: suspend TxScope.() -> T): T {
    val open = currentCoroutineContext()[TxQueue]
    if (open != null) {
        val current = org.jetbrains.exposed.v1.r2dbc.transactions.TransactionManager.currentOrNull()
            ?: error("tx joined a queue but no transaction is open")
        return TxScope(current as R2dbcTransaction, open).block()
    }
    val queue = TxQueue()
    val result = suspendTransaction(db = checkNotNull(database) { "configureDatabase() has not run" }) {
        withContext(queue) { TxScope(this@suspendTransaction, queue).block() }
    }
    // Committed. Actions run once, in order, outside the transaction.
    queue.actions.forEach { it() }
    return result
}

/** Health probe: one `SELECT 1`. */
suspend fun pingPostgres() {
    val answer = tx {
        transaction.exec("SELECT 1") { row -> row.get(0, java.lang.Integer::class.java) }?.toList()
    }
    check(answer?.singleOrNull()?.toInt() == 1) { "SELECT 1 returned $answer" }
}

/** True when this exception, or anything in its cause chain, is a PostgreSQL unique violation (SQLSTATE 23505). */
fun Throwable.isUniqueViolation(): Boolean =
    generateSequence(this) { it.cause?.takeIf { c -> c !== it } }
        .take(10)
        .any { (it as? io.r2dbc.spi.R2dbcException)?.sqlState == "23505" }
