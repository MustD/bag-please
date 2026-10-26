package com.bagplease

import arrow.core.raise.either
import com.bagplease.plugins.connectDatabase
import com.bagplease.plugins.migrate
import com.bagplease.plugins.tx
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appConfig
import com.bagplease.utils.createDatabase
import com.bagplease.utils.postgresContainer
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.sql.DriverManager

// Story 11.1 (AD-17): `tx` joins an open transaction, queues `afterCommit` actions on the OUTERMOST one,
// runs them only after it commits and drops them on rollback; an Arrow `raise` rolls back.
class TxTest : FunSpec({

    val pg = postgresContainer()
    val dbName = "tx_test"

    fun jdbc() = DriverManager.getConnection(
        "jdbc:postgresql://${pg.host}:${pg.firstMappedPort}/$dbName",
        SharedPostgres.APP_USER,
        SharedPostgres.APP_PASSWORD,
    )

    fun rows(): Int = jdbc().use { c ->
        c.createStatement().use { st ->
            st.executeQuery("SELECT count(*) FROM tx_probe").use { it.next(); it.getInt(1) }
        }
    }

    beforeSpec {
        pg.createDatabase(dbName)
        val config = pg.appConfig(dbName)
        migrate(config)
        jdbc().use { it.createStatement().use { st -> st.execute("CREATE TABLE tx_probe (id text PRIMARY KEY)") } }
        connectDatabase(config)
    }

    beforeEach {
        jdbc().use { it.createStatement().use { st -> st.execute("DELETE FROM tx_probe") } }
    }

    test("a failing outer tx drops the afterCommit actions a joined inner tx registered, and the exception propagates") {
        val ran = mutableListOf<String>()
        val thrown = shouldThrow<IllegalStateException> {
            tx {
                transaction.exec("INSERT INTO tx_probe (id) VALUES ('outer')")
                tx { afterCommit { ran += "inner" } }
                afterCommit { ran += "outer" }
                error("outer fails")
            }
        }
        thrown.message shouldBe "outer fails"
        ran shouldBe emptyList()
        rows() shouldBe 0
    }

    test("an Arrow raise inside tx leaves no row and surfaces as Left from the caller's either") {
        val ran = mutableListOf<String>()
        val result = either {
            tx {
                transaction.exec("INSERT INTO tx_probe (id) VALUES ('raised')")
                afterCommit { ran += "never" }
                raise("nope")
            }
        }
        result.leftOrNull() shouldBe "nope"
        rows() shouldBe 0
        ran shouldBe emptyList()
    }

    test("a successful outer tx runs the queued actions once, in registration order, after the commit") {
        val ran = mutableListOf<String>()
        val rowsSeenFromActions = mutableListOf<Int>()
        val value = tx {
            transaction.exec("INSERT INTO tx_probe (id) VALUES ('ok')")
            afterCommit { ran += "first"; rowsSeenFromActions += rows() }
            tx { afterCommit { ran += "second"; rowsSeenFromActions += rows() } }
            afterCommit { ran += "third" }
            ran shouldBe emptyList() // nothing runs before the commit
            42
        }
        value shouldBe 42
        ran shouldBe listOf("first", "second", "third")
        rowsSeenFromActions shouldBe listOf(1, 1) // another connection sees the committed row
        rows() shouldBe 1
    }

    test("a tx with no outer transaction does not leak its queue into the next one") {
        val ran = mutableListOf<String>()
        tx { afterCommit { ran += "a" } }
        tx { afterCommit { ran += "b" } }
        ran shouldBe listOf("a", "b")
    }
})
