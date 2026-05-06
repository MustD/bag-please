package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication

class ApplicationTest : FunSpec({
    val container = mongoContainer()
    test("up test") {

        testApplication {
            setUpMongo(container)
            application { }

            client.get("/").apply {
                shouldHaveStatus(HttpStatusCode.NotFound)
            }

        }
    }
})
