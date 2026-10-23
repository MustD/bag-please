package com.bagplease

import com.bagplease.utils.postgresContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.setUpPostgres
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.longs.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.time.measureTimedValue

// Story 9.1 (AD-9): GET /api/health is the backend readiness probe Playwright's
// webServer.url waits on. It must be reachable without credentials, must never
// be rate limited, and must answer 503 within ~2 s when PostgreSQL cannot be reached.
//
// Every test sets `rootPath = "api"` explicitly: the test host does not read
// ktor.deployment.rootPath (only EngineMain does), so without it the route would
// be exercised at /health and a `get("/api/health")` mistake — which production
// would serve at /api/api/health — would go unnoticed.
class HealthApiTest : FunSpec({

    postgresContainer()

    // A DEDICATED PostgreSQL for the down cases: the shared one serves every other spec.
    val dedicatedPg = PostgreSQLContainer("postgres:18")
        .withUsername("postgres").withPassword("postgres").withDatabaseName("postgres")

    afterSpec {
        if (dedicatedPg.isRunning) dedicatedPg.stop()
    }

    fun startDedicatedPg() {
        if (dedicatedPg.isRunning) return
        dedicatedPg.start()
        fun sql(db: String, q: String) = check(dedicatedPg.execInContainer("psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db, "-c", q).exitCode == 0)
        sql("postgres", "CREATE ROLE ${SharedPostgres.APP_USER} LOGIN PASSWORD '${SharedPostgres.APP_PASSWORD}'")
        sql("postgres", "CREATE DATABASE ${SharedPostgres.DB_NAME} OWNER ${SharedPostgres.APP_USER}")
        sql(SharedPostgres.DB_NAME, "ALTER SCHEMA public OWNER TO ${SharedPostgres.APP_USER}")
    }

    fun ApplicationTestBuilder.healthApp(pg: PostgreSQLContainer = SharedPostgres.container) {
        serverConfig { rootPath = "api" }
        setUpPostgres(pg)
        setUpJwt()
        application { module() }
    }

    test("GET /api/health without credentials returns 200 OK when PostgreSQL is up") {
        testApplication {
            healthApp()
            client.get("/api/health").apply {
                shouldHaveStatus(HttpStatusCode.OK)
                bodyAsText() shouldBe "OK"
            }
        }
    }

    test("GET /api/health is not rate limited (20 rapid requests, all 200)") {
        testApplication {
            healthApp()
            repeat(20) {
                client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)
            }
        }
    }

    test("GET /api/health returns 503 within 3.5 s while PostgreSQL is paused (SELECT 1 never answers)") {
        startDedicatedPg()
        testApplication {
            healthApp(dedicatedPg)
            client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)

            val docker = dedicatedPg.dockerClient
            docker.pauseContainerCmd(dedicatedPg.containerId).exec()
            try {
                val (response, elapsed) = measureTimedValue { client.get("/api/health") }
                response.shouldHaveStatus(HttpStatusCode.ServiceUnavailable)
                response.bodyAsText() shouldBe "UNAVAILABLE"
                elapsed.inWholeMilliseconds shouldBeLessThan 3_500L
            } finally {
                docker.unpauseContainerCmd(dedicatedPg.containerId).exec()
            }
        }
    }

    test("GET /api/health returns 503 within 3.5 s when PostgreSQL is stopped (unreachable)") {
        startDedicatedPg()
        testApplication {
            healthApp(dedicatedPg)
            client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)

            dedicatedPg.stop()
            val (response, elapsed) = measureTimedValue { client.get("/api/health") }
            response.shouldHaveStatus(HttpStatusCode.ServiceUnavailable)
            response.bodyAsText() shouldBe "UNAVAILABLE"
            elapsed.inWholeMilliseconds shouldBeLessThan 3_500L
        }
    }
})
