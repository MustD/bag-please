package com.bagplease.features.admin

import com.bagplease.module
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.mongodb.MongoDBContainer
import java.util.*

class AdminUserManagementTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginAdmin(): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.loginRegularUser(username: String, password: String = "pass123"): String {
        val adminToken = loginAdmin()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
        client.post("/auth/register") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    // ── Story 9.2: the paged users(limit, offset, around) field ───────────────
    //
    // The Mongo container is PROJECT-SCOPED and shared, so rows leak in from
    // every other test in the run and the `users` collection has no total any
    // test may assume. Every assertion below is therefore either a property of
    // the page the server served (sorted, clamped, sized) or an index DERIVED
    // from the server's own answers — never a literal count.
    //
    // The derivation trick, used by the two `around` tests: `limit: 1` makes the
    // page index EQUAL the number of usernames sorting before the target, so the
    // arithmetic can be pinned exactly without knowing the table size. The
    // page-size-20 case is then asserted against that measured index rather than
    // against a guess.
    val mapper = jacksonObjectMapper()

    suspend fun ApplicationTestBuilder.usersPage(
        token: String,
        limit: Int,
        offset: Int? = null,
        around: String? = null,
    ): JsonNode {
        val args = buildString {
            append("limit: $limit")
            if (offset != null) append(", offset: $offset")
            if (around != null) append(", around: \\\"$around\\\"")
        }
        val body = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"{ users($args) { users { id username role } totalCount offset } }"}""")
        }.bodyAsText()
        body shouldNotContain """"errors":"""
        return mapper.readTree(body)["data"]["users"]
    }

    fun JsonNode.usernames(): List<String> = this["users"].map { it["username"].asText() }
    fun JsonNode.totalCount(): Int = this["totalCount"].asInt()
    fun JsonNode.offset(): Int = this["offset"].asInt()

    // The number of usernames sorting strictly before `username`, read off the
    // server at page size 1 (where page index == that count).
    suspend fun ApplicationTestBuilder.indexOf(token: String, username: String): Int =
        usersPage(token, limit = 1, around = username).offset()

    suspend fun ApplicationTestBuilder.seedUsers(token: String, prefix: String, count: Int): List<String> {
        // Created out of order on purpose: the ascending order under test is the
        // server's, not insertion order.
        val names = (0 until count).map { "${prefix}_%03d".format(it) }
        for (name in names.shuffled()) {
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { createUser(username: \"$name\", password: \"pass123\") { id } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)
        }
        return names
    }

    fun uniquePrefix(label: String) = "page_${label}_${UUID.randomUUID().toString().take(8)}"

    test("9.2 the users page is sorted by username ascending") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val prefix = uniquePrefix("sorted")
            val seeded = seedUsers(adminToken, prefix, 25)

            // A page big enough to hold the whole seeded block wherever it lands.
            val page = usersPage(adminToken, limit = 100, around = seeded.first())
            val returned = page.usernames()
            returned shouldBe returned.sorted()

            // …and the seeded block itself, which is immune to leaked rows: the
            // prefix carries a UUID, so nothing else can sort inside it.
            val mine = returned.filter { it.startsWith(prefix) }
            mine shouldBe mine.sorted()
            mine.isNotEmpty() shouldBe true
        }
    }

    test("9.2 limit is clamped to 1..100") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            seedUsers(adminToken, uniquePrefix("limit"), 3)

            val tooSmall = usersPage(adminToken, limit = 0)
            tooSmall.usernames().size shouldBe 1

            val tooLarge = usersPage(adminToken, limit = 500)
            tooLarge.usernames().size shouldBe minOf(100, tooLarge.totalCount())
        }
    }

    test("9.2 offset is clamped to the last page and to zero") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            seedUsers(adminToken, uniquePrefix("offset"), 3)

            val pastEnd = usersPage(adminToken, limit = 20, offset = 999_999)
            val total = pastEnd.totalCount()
            val lastPageOffset = ((total - 1) / 20) * 20
            // The last page, not an empty one.
            pastEnd.offset() shouldBe lastPageOffset
            pastEnd.usernames().size shouldBe total - lastPageOffset

            val negative = usersPage(adminToken, limit = 20, offset = -5)
            negative.offset() shouldBe 0
        }
    }

    test("9.2 around returns the page containing that user") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val seeded = seedUsers(adminToken, uniquePrefix("around"), 25)
            val target = seeded[10]

            val index = indexOf(adminToken, target)
            val page = usersPage(adminToken, limit = 20, offset = 0, around = target)

            // The `offset` ARGUMENT is ignored when `around` is set.
            page.offset() shouldBe (index / 20) * 20
            page.usernames().contains(target) shouldBe true
        }
    }

    test("9.2 around on an absent username returns the page where it would sort") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val prefix = uniquePrefix("absent")
            val seeded = seedUsers(adminToken, prefix, 25)
            // Sorts immediately after the seeded block and exists nowhere: the
            // prefix is unique, so exactly one more username (the block's last)
            // sorts before this than before that last one.
            val absent = "${prefix}_999_absent"

            val lastIndex = indexOf(adminToken, seeded.last())
            val one = usersPage(adminToken, limit = 1, around = absent)
            val total = one.totalCount()
            one.offset() shouldBe minOf(lastIndex + 1, total - 1)

            val page = usersPage(adminToken, limit = 20, around = absent)
            page.offset() shouldBe minOf(((lastIndex + 1) / 20) * 20, ((total - 1) / 20) * 20)
        }
    }

    test("9.2 omitting offset serves the first page") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            // 25 seeded guarantees the table holds more than one page, so a full
            // page is the meaningful assertion rather than a coincidence.
            seedUsers(adminToken, uniquePrefix("firstpage"), 25)

            val page = usersPage(adminToken, limit = 20)

            // A null `offset` is not "no paging": it is page one.
            page.offset() shouldBe 0
            page.usernames().size shouldBe 20
            val names = page.usernames()
            names shouldBe names.sorted()
        }
    }

    test("9.2 an explicit in-range offset is served exactly") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            seedUsers(adminToken, uniquePrefix("explicit"), 25)

            // Measured, not assumed: the shared container's size is whatever the
            // rest of the run left behind, and 25 seeded rows only guarantee that
            // offset 20 is in range.
            val probe = usersPage(adminToken, limit = 20)
            val total = probe.totalCount()
            val lastPageOffset = ((total - 1) / 20) * 20
            val requested = minOf(20, lastPageOffset)

            val page = usersPage(adminToken, limit = 20, offset = requested)

            // In range, so the clamp must NOT move it — the distinction from the
            // past-the-end and negative cases above.
            page.offset() shouldBe requested
            page.usernames().size shouldBe minOf(20, total - requested)
            val names = page.usernames()
            names shouldBe names.sorted()
            // A real second slice, not page one served again.
            page.usernames() shouldNotBe probe.usernames()
        }
    }

    test("9.2 an empty users table serves an empty page rather than failing") {
        // A DEDICATED container, following HealthApiTest's precedent. The shared
        // project-scoped one can never be empty — every other test in the run
        // seeds it — so the zero-row branch of `getUserPage` (where lastPageOffset
        // would otherwise go negative) is unreachable there.
        //
        // The `admin` account is config-based and has no row, so a fresh database
        // really does mean zero users. `configureMigration` returns early on it:
        // with no unscoped items or categories there is nothing to migrate, so it
        // never asks for MIGRATION_TARGET_USER.
        val emptyContainer = MongoDBContainer("mongo:8")
            .withEnv("MONGO_INITDB_ROOT_USERNAME", "test_user")
            .withEnv("MONGO_INITDB_ROOT_PASSWORD", "test_pass")
            .waitingFor(Wait.forListeningPort())
        emptyContainer.start()
        try {
            testApplication {
                setUpMongo(emptyContainer)
                setUpJwt()
                application { module() }
                val adminToken = loginAdmin()

                val page = usersPage(adminToken, limit = 20)

                page.totalCount() shouldBe 0
                page.usernames() shouldBe emptyList()
                // Zero, not a negative skip.
                page.offset() shouldBe 0
            }
        } finally {
            emptyContainer.stop()
        }
    }

    test("9.2 paging is exact against a table this test fully controls") {
        // A DEDICATED container again, for the reason the empty-table case above
        // gives — but here it buys something the shared container cannot: a table
        // whose EVERY row this test wrote, so the expectations below are LITERALS
        // rather than values derived from the server's own answers.
        //
        // That distinction is the point. The other `around` cases read the page
        // index back out of a `users(around: …)` call, so an off-by-one in
        // `countUsernamesBefore` (`Filters.lt` → `lte`) would move both sides of
        // the comparison and keep them agreeing; and `limit is clamped to 1..100`
        // can only observe the upper clamp on a table that HOLDS more than 100
        // rows, which the shared one need not. 105 seeded rows pin both.
        val isolatedContainer = MongoDBContainer("mongo:8")
            .withEnv("MONGO_INITDB_ROOT_USERNAME", "test_user")
            .withEnv("MONGO_INITDB_ROOT_PASSWORD", "test_pass")
            .waitingFor(Wait.forListeningPort())
        isolatedContainer.start()
        try {
            testApplication {
                setUpMongo(isolatedContainer)
                setUpJwt()
                application { module() }
                val adminToken = loginAdmin()
                // Seeded out of insertion order (see `seedUsers`); `names` is the
                // ascending order the server must reproduce.
                val names = seedUsers(adminToken, "iso", 105)

                // `around` the 20th name is the LAST row of page one…
                val firstPage = usersPage(adminToken, limit = 20, around = names[19])
                firstPage.offset() shouldBe 0
                firstPage.usernames() shouldBe names.subList(0, 20)

                // …and the 21st is the FIRST row of page two. One name apart,
                // two different pages: this is what an off-by-one would break.
                val secondPage = usersPage(adminToken, limit = 20, around = names[20])
                secondPage.offset() shouldBe 20
                secondPage.usernames() shouldBe names.subList(20, 40)

                // Ordering holds ACROSS the boundary, not merely within a page.
                firstPage.usernames().last() shouldBe names[19]
                secondPage.usernames().first() shouldBe names[20]
                val across = firstPage.usernames() + secondPage.usernames()
                across shouldBe across.sorted()

                // The upper clamp, observed: 105 rows exist and 500 was asked for.
                val clamped = usersPage(adminToken, limit = 500)
                clamped.totalCount() shouldBe 105
                clamped.usernames().size shouldBe 100
                clamped.usernames() shouldBe names.subList(0, 100)
            }
        } finally {
            isolatedContainer.stop()
        }
    }

    test("AC1 users query returns registered users excluding admin") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "user_ac1_${UUID.randomUUID().toString().take(8)}"
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            // `around` is how a single page is asked to contain a known row: the
            // shared container means the created user is nowhere near page 0.
            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users(limit: 20, around: \"$username\") { users { id username role } totalCount offset } }"}""")
            }.bodyAsText()

            body shouldNotContain """"errors":"""
            body shouldContain """"username":"$username""""

            // The EXCLUSION has to be observed where `admin` would be if it were
            // stored — the page above is located by the created user's name and
            // could never hold an `admin` row however the server behaved.
            val adminPage = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users(limit: 20, around: \"admin\") { users { id username role } totalCount offset } }"}""")
            }.bodyAsText()

            adminPage shouldNotContain """"errors":"""
            adminPage shouldNotContain """"username":"admin""""
        }
    }

    test("AC2 createUser mutation creates user and subsequent users query includes them") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "user_ac2_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"initial123\") { id username role } }"}""")
            }.bodyAsText()

            createBody shouldNotContain """"errors":"""
            createBody shouldContain """"username":"$username""""
            createBody shouldContain """"role":"user""""

            val listBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users(limit: 20, around: \"$username\") { users { id username role } totalCount offset } }"}""")
            }.bodyAsText()

            listBody shouldNotContain """"errors":"""
            listBody shouldContain """"username":"$username""""
        }
    }

    test("AC3 deleteUser removes user and subsequent query excludes them") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "delete_ac3_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
            }.bodyAsText()
            createBody shouldNotContain """"errors":"""
            val userId = jacksonObjectMapper().readTree(createBody)["data"]["createUser"]["id"].asText()

            val deleteBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { deleteUser(id: \"$userId\") { id username } }"}""")
            }.bodyAsText()
            deleteBody shouldNotContain """"errors":"""

            val listBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                // `around` on a name that no longer exists is a total function by
                // design — it answers with the page where the name WOULD sort.
                setBody("""{"query":"{ users(limit: 20, around: \"$username\") { users { id username } totalCount offset } }"}""")
            }.bodyAsText()
            listBody shouldNotContain """"username":"$username""""
        }
    }

    test("AC4 resetUserPassword updates hash and new password works for login") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "reset_ac4_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"oldpass\") { id username role } }"}""")
            }.bodyAsText()
            createBody shouldNotContain """"errors":"""
            val userId = jacksonObjectMapper().readTree(createBody)["data"]["createUser"]["id"].asText()

            val resetBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { resetUserPassword(id: \"$userId\", newPassword: \"newpass\") { id username } }"}""")
            }.bodyAsText()
            resetBody shouldNotContain """"errors":"""

            val oldPassRes = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"oldpass"}""")
            }
            oldPassRes.shouldHaveStatus(HttpStatusCode.Unauthorized)

            val loginRes = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"newpass"}""")
            }
            loginRes.shouldHaveStatus(HttpStatusCode.OK)
            val loginBody = loginRes.bodyAsText()
            loginBody shouldContain "accessToken"
        }
    }

    test("AC5 non-admin JWT on users query returns FORBIDDEN") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val username = "nonAdmin_ac5_${UUID.randomUUID().toString().take(8)}"
            val userToken = loginRegularUser(username)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"{ users(limit: 20) { users { id username role } totalCount offset } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("AC5 non-admin JWT on createUser mutation returns FORBIDDEN") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val username = "nonAdmin_ac5m_${UUID.randomUUID().toString().take(8)}"
            val userToken = loginRegularUser(username)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"mutation { createUser(username: \"newuser\", password: \"pass\") { id } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("AC6 deleteUser with non-existent UUID returns NOT_FOUND") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { deleteUser(id: \"00000000-0000-0000-0000-000000000000\") { id } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"NOT_FOUND""""
        }
    }
})
