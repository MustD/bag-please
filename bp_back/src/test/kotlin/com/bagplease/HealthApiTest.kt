package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.setUpMongo
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
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.mongodb.MongoDBContainer
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.time.measureTimedValue

// Story 9.1 (AD-9): GET /api/health is the backend readiness probe Playwright's
// webServer.url waits on. It must be reachable without credentials, must never
// be rate limited, and must answer 503 within ~2 s when Mongo cannot be pinged.
//
// Every test sets `rootPath = "api"` explicitly: the test host does not read
// ktor.deployment.rootPath (only EngineMain does), so without it the route would
// be exercised at /health and a `get("/api/health")` mistake — which production
// would serve at /api/api/health — would go unnoticed.
class HealthApiTest : FunSpec({

    val container = mongoContainer()

    // A DEDICATED Mongo for the down cases: the project-scoped shared container is
    // used by every other spec, so pausing or stopping it would break them.
    val dedicated = MongoDBContainer("mongo:8").apply {
        withEnv("MONGO_INITDB_ROOT_USERNAME", "test_user")
        withEnv("MONGO_INITDB_ROOT_PASSWORD", "test_pass")
        waitingFor(Wait.forListeningPort())
    }

    // A DEDICATED PostgreSQL for the same reason (Story 11.1): the shared one serves every other spec.
    val dedicatedPg = PostgreSQLContainer("postgres:18")
        .withUsername("postgres").withPassword("postgres").withDatabaseName("postgres")

    afterSpec {
        if (dedicated.isRunning) dedicated.stop()
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

    fun ApplicationTestBuilder.healthApp(mongo: MongoDBContainer, pg: PostgreSQLContainer = SharedPostgres.container) {
        serverConfig { rootPath = "api" }
        setUpMongo(mongo)
        setUpPostgres(pg)
        setUpJwt()
        application { module() }
    }

    test("GET /api/health without credentials returns 200 OK when PostgreSQL and Mongo are up") {
        testApplication {
            healthApp(container)
            client.get("/api/health").apply {
                shouldHaveStatus(HttpStatusCode.OK)
                bodyAsText() shouldBe "OK"
            }
        }
    }

    test("GET /api/health is not rate limited (20 rapid requests, all 200)") {
        testApplication {
            healthApp(container)
            repeat(20) {
                client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)
            }
        }
    }

    test("GET /api/health returns 503 within 3.5 s while Mongo is paused (ping never answers)") {
        dedicated.start()
        testApplication {
            healthApp(dedicated)
            // The app cannot START with Mongo down (configureMigration reads it
            // at boot), so prove it answers once before breaking Mongo.
            client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)

            val docker = dedicated.dockerClient
            docker.pauseContainerCmd(dedicated.containerId).exec()
            try {
                val (response, elapsed) = measureTimedValue { client.get("/api/health") }
                response.shouldHaveStatus(HttpStatusCode.ServiceUnavailable)
                response.bodyAsText() shouldBe "UNAVAILABLE"
                elapsed.inWholeMilliseconds shouldBeLessThan 3_500L
            } finally {
                docker.unpauseContainerCmd(dedicated.containerId).exec()
            }
        }
    }

    test("GET /api/health returns 503 within 3.5 s while PostgreSQL is paused (SELECT 1 never answers)") {
        startDedicatedPg()
        testApplication {
            healthApp(container, dedicatedPg)
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
            healthApp(container, dedicatedPg)
            client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)

            dedicatedPg.stop()
            val (response, elapsed) = measureTimedValue { client.get("/api/health") }
            response.shouldHaveStatus(HttpStatusCode.ServiceUnavailable)
            response.bodyAsText() shouldBe "UNAVAILABLE"
            elapsed.inWholeMilliseconds shouldBeLessThan 3_500L
        }
    }

    test("GET /api/health returns 503 within 3.5 s when Mongo is stopped (unreachable)") {
        if (!dedicated.isRunning) dedicated.start()
        testApplication {
            healthApp(dedicated)
            client.get("/api/health").shouldHaveStatus(HttpStatusCode.OK)

            dedicated.stop()
            val (response, elapsed) = measureTimedValue { client.get("/api/health") }
            response.shouldHaveStatus(HttpStatusCode.ServiceUnavailable)
            response.bodyAsText() shouldBe "UNAVAILABLE"
            elapsed.inWholeMilliseconds shouldBeLessThan 3_500L
        }
    }
})
