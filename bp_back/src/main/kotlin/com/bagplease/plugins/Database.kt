package com.bagplease.plugins

import io.ktor.server.application.Application
import io.ktor.server.config.ApplicationConfig
import io.ktor.util.logging.KtorSimpleLogger
import io.r2dbc.spi.ConnectionFactoryOptions
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
) {
    private fun String.enc() = URLEncoder.encode(this, Charsets.UTF_8)

    /** R2DBC URL without credentials (they are passed as options, never concatenated). */
    fun r2dbcUrl(): String = buildString {
        append("r2dbc:pool:postgresql://$host:$port/$name")
        append("?sslMode=").append(sslmode.enc())
        if (sslrootcert.isNotBlank()) append("&sslRootCert=").append(sslrootcert.enc())
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

/** Opens the pooled R2DBC database. The process-wide handle used by [tx] is [database]. */
fun connectR2dbc(config: PostgresConfig): R2dbcDatabase {
    return R2dbcDatabase.connect {
        setUrl(config.r2dbcUrl())
        connectionFactoryOptions {
            option(ConnectionFactoryOptions.USER, config.user)
            option(ConnectionFactoryOptions.PASSWORD, config.password)
        }
        useNestedTransactions = false // AD-17: no savepoints
        defaultMaxAttempts = 1 // AD-17: nothing is retried implicitly
    }
}

@Volatile
private var database: R2dbcDatabase? = null

/** Runs Flyway, then opens the R2DBC pool. Called from `module()` before `configureGql`. */
fun Application.configureDatabase() {
    val config = PostgresConfig.from(environment.config)
    logger.info("Connecting to postgres at ${config.host}:${config.port}/${config.name} as ${config.user} (sslmode=${config.sslmode})")
    migrate(config)
    connectDatabase(config)
}

/** Opens the pool and makes it the handle [tx] uses. Tests that need `tx` without booting the app call this directly. */
fun connectDatabase(config: PostgresConfig) {
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
