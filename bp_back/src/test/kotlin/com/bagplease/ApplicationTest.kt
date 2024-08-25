package com.bagplease

import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.*

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
