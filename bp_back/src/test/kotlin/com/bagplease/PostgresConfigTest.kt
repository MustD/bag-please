package com.bagplease

import com.bagplease.plugins.PostgresConfig
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// The TLS spellings differ per driver (AR-E11-11): R2DBC `sslMode`/`sslRootCert`, pgJDBC `sslmode`/`sslrootcert`.
// Every container test runs with sslmode=disable, so nothing else would notice a misspelt option.
class PostgresConfigTest : FunSpec({
    val tls = PostgresConfig("db.internal", 25060, "bag_please", "bag_please_app", "pw", "verify-full", "/certs/ca.crt")

    test("verify-full URLs spell the CA option per driver") {
        tls.r2dbcUrl() shouldBe "r2dbc:pool:postgresql://db.internal:25060/bag_please?sslMode=verify-full&sslRootCert=%2Fcerts%2Fca.crt"
        tls.jdbcUrl() shouldBe "jdbc:postgresql://db.internal:25060/bag_please?sslmode=verify-full&sslrootcert=%2Fcerts%2Fca.crt"
    }

    test("a blank CA path adds no CA option") {
        val plain = tls.copy(sslmode = "disable", sslrootcert = "")
        plain.r2dbcUrl() shouldBe "r2dbc:pool:postgresql://db.internal:25060/bag_please?sslMode=disable"
        plain.jdbcUrl() shouldBe "jdbc:postgresql://db.internal:25060/bag_please?sslmode=disable"
    }
})
