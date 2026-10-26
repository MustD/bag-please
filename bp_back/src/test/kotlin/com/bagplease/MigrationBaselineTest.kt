package com.bagplease

import com.bagplease.plugins.migrate
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appConfig
import com.bagplease.utils.createDatabase
import com.bagplease.utils.postgresContainer
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException

// Story 11.1 (AD-5, AD-6, AD-7): V1__baseline.sql creates the whole Epic 11 schema, DDL only, and a second
// startup applies nothing.
class MigrationBaselineTest : FunSpec({

    val pg = postgresContainer()
    val dbName = "baseline_test"

    fun connect(): Connection = DriverManager.getConnection(
        "jdbc:postgresql://${pg.host}:${pg.firstMappedPort}/$dbName",
        SharedPostgres.APP_USER,
        SharedPostgres.APP_PASSWORD,
    )

    fun <T> Connection.query(sql: String, read: (java.sql.ResultSet) -> T): List<T> =
        createStatement().use { st -> st.executeQuery(sql).use { rs -> generateSequence { if (rs.next()) read(rs) else null }.toList() } }

    val tables = listOf("users", "lists", "list_members", "categories", "items", "feedback", "refresh_tokens", "app_config")

    beforeSpec {
        pg.createDatabase(dbName)
        migrate(pg.appConfig(dbName))
    }

    test("exactly the eight application tables exist, plus Flyway's history table") {
        connect().use { c ->
            val names = c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'") { it.getString(1) }
            names shouldContainExactlyInAnyOrder tables + "flyway_schema_history"
        }
    }

    test("the application tables hold no rows") {
        connect().use { c ->
            tables.forEach { t -> c.query("SELECT count(*) FROM $t") { it.getInt(1) } shouldBe listOf(0) }
        }
    }

    test("exactly the AR-E11-15 secondary indexes exist") {
        connect().use { c ->
            // Primary-key and unique-constraint indexes are excluded: they back constraints, not AR-E11-15 indexes.
            val indexes = c.query(
                """
                SELECT i.indexname, i.indexdef FROM pg_indexes i
                WHERE i.schemaname = 'public' AND i.tablename <> 'flyway_schema_history'
                  AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = (quote_ident(i.schemaname) || '.' || quote_ident(i.indexname))::regclass)
                """.trimIndent()
            ) { it.getString(1) to it.getString(2).substringAfter(" USING btree ") }
            indexes.toMap() shouldBe mapOf(
                "items_list_id_idx" to "(list_id)",
                "items_list_recurring_checked_at_idx" to "(list_id, recurring, checked_at)",
                "items_deleted_deleted_at_idx" to "(deleted, deleted_at)",
                "list_members_user_status_idx" to "(user_id, status)",
                "refresh_tokens_expires_at_idx" to "(expires_at)",
                "refresh_tokens_username_idx" to "(username)",
            )
        }
    }

    test("users.username is unique with binary collation, and items.stores is text[]") {
        connect().use { c ->
            c.query("SELECT collation_name FROM information_schema.columns WHERE table_name='users' AND column_name='username'") { it.getString(1) } shouldBe listOf("C")
            c.query("SELECT count(*) FROM pg_constraint WHERE conrelid='users'::regclass AND contype='u'") { it.getInt(1) } shouldBe listOf(1)
            c.query("SELECT data_type FROM information_schema.columns WHERE table_name='items' AND column_name='stores'") { it.getString(1) } shouldBe listOf("ARRAY")
        }
    }

    test("foreign keys: list children cascade, user references restrict, items reference their own list's category") {
        connect().use { c ->
            val fks = c.query(
                """
                SELECT conrelid::regclass::text || '->' || confrelid::regclass::text || ':' || pg_get_constraintdef(oid)
                FROM pg_constraint WHERE contype = 'f'
                """.trimIndent()
            ) { it.getString(1) }
            fks.any { it.startsWith("items->categories:") && "FOREIGN KEY (list_id, category_id) REFERENCES categories(list_id, id) ON DELETE CASCADE" in it } shouldBe true
            fks.filter { it.startsWith("lists->users") || it.startsWith("list_members->users") }.all { "ON DELETE RESTRICT" in it } shouldBe true
            fks.filter { it.contains("->lists:") }.all { "ON DELETE CASCADE" in it } shouldBe true
            fks.count { it.contains("->lists:") } shouldBe 3
        }
    }

    test("an item cannot reference a category of another list") {
        connect().use { c ->
            c.autoCommit = false
            try {
                val u = "00000000-0000-0000-0000-0000000000a1"
                val l1 = "00000000-0000-0000-0000-0000000000b1"
                val l2 = "00000000-0000-0000-0000-0000000000b2"
                val cat = "00000000-0000-0000-0000-0000000000c1"
                c.createStatement().use { st ->
                    st.execute("INSERT INTO users VALUES ('$u','u','h','user')")
                    st.execute("INSERT INTO lists VALUES ('$l1','a',null,'$u','USER_CREATED',now()), ('$l2','b',null,'$u','USER_CREATED',now())")
                    st.execute("INSERT INTO categories VALUES ('$cat','c','$l1')")
                    shouldThrow<SQLException> {
                        st.execute("INSERT INTO items (id,name,checked,category_id,list_id) VALUES ('00000000-0000-0000-0000-0000000000d1','i',false,'$cat','$l2')")
                    }
                }
            } finally {
                c.rollback()
            }
        }
    }

    test("a second startup applies nothing, and the app role is not a superuser") {
        migrate(pg.appConfig(dbName))
        val flyway = Flyway.configure().dataSource(pg.appConfig(dbName).jdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD).load()
        flyway.migrate().migrationsExecuted shouldBe 0
        flyway.info().applied().map { it.version.toString() } shouldBe listOf("1")
        connect().use { c ->
            c.query("SELECT rolsuper FROM pg_roles WHERE rolname = current_user") { it.getBoolean(1) } shouldBe listOf(false)
        }
    }
})
