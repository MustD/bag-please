package com.bagplease

import com.bagplease.plugins.PostgresConfig
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// The TLS spellings differ per driver (AR-E11-11): R2DBC `sslMode`/`sslRootCert`, pgJDBC `sslmode`/`sslrootcert`.
// Every container test runs with sslmode=disable, so nothing else would notice a misspelt option.
class PostgresConfigTest : FunSpec({
    val tls = PostgresConfig("db.internal", 25060, "bag_please", "bag_please_app", "pw", "verify-full", "/certs/ca.crt")

    test("verify-full URLs spell the CA option per driver") {
        tls.r2dbcUrl() shouldBe "r2dbc:pool:postgresql://db.internal:25060/bag_please?sslMode=verify-full&sslRootCert=%2Fcerts%2Fca.crt&maxSize=5"
        tls.jdbcUrl() shouldBe "jdbc:postgresql://db.internal:25060/bag_please?sslmode=verify-full&sslrootcert=%2Fcerts%2Fca.crt"
    }

    test("a blank CA path adds no CA option") {
        val plain = tls.copy(sslmode = "disable", sslrootcert = "")
        plain.r2dbcUrl() shouldBe "r2dbc:pool:postgresql://db.internal:25060/bag_please?sslMode=disable&maxSize=5"
        plain.jdbcUrl() shouldBe "jdbc:postgresql://db.internal:25060/bag_please?sslmode=disable"
    }

    test("the pool maximum is 5 by default (the shared cluster allows about 22 connections) and configurable") {
        tls.r2dbcUrl().contains("maxSize=5") shouldBe true
        tls.copy(poolMaxSize = 3).r2dbcUrl().endsWith("&maxSize=3") shouldBe true
        tls.jdbcUrl().contains("maxSize") shouldBe false
    }

    test("a remote host needs verify-full; only local hosts may connect without it") {
        tls.requireVerifiedTlsForRemoteHost()
        listOf("disable", "prefer", "require", "verify-ca").forEach { mode ->
            shouldThrow<IllegalArgumentException> { tls.copy(sslmode = mode).requireVerifiedTlsForRemoteHost() }
        }
        PostgresConfig.LOCAL_HOSTS.forEach { tls.copy(host = it, sslmode = "disable").requireVerifiedTlsForRemoteHost() }
    }
})
