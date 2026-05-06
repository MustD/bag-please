package com.bagplease

import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication

class ApplicationTest : FunSpec({

    test("up test") {

        testApplication {
            application { }

            client.get("/").apply {
                shouldHaveStatus(HttpStatusCode.NotFound)
            }
        }
    }
})
