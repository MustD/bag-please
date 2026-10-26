package com.bagplease

import com.bagplease.utils.postgresContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpPostgres
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication

class ApplicationTest : FunSpec({
    val container = postgresContainer()
    test("up test") {

        testApplication {
            setUpPostgres()
            setUpJwt()
            application { }

            client.get("/").apply {
                shouldHaveStatus(HttpStatusCode.NotFound)
            }

        }
    }
})
