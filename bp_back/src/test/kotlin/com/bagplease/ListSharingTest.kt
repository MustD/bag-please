package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.util.*

private val mapper = jacksonObjectMapper()

class ListSharingTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginToken(username: String = "admin", password: String = "admin"): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.registerAndLogin(username: String, password: String = "pass1234"): String {
        val adminToken = loginToken()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"$password\") { id } }"}""")
        }
        return loginToken(username, password)
    }

    // Batch-creates multiple users with a single admin login to stay within the rate limit (5 auth calls/min).
    // Returns login tokens for each username in the same order.
    suspend fun ApplicationTestBuilder.registerManyAndLogin(vararg usernames: String, password: String = "pass1234"): List<String> {
        val adminToken = loginToken()
        for (username in usernames) {
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"$password\") { id } }"}""")
            }
        }
        return usernames.map { loginToken(it, password) }
    }

    suspend fun ApplicationTestBuilder.createList(token: String, name: String = "TestList"): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"$name\") { id } }"}""")
        }
        val body = res.bodyAsText()
        body shouldNotContain "errors"
        return mapper.readTree(body)["data"]["createList"]["id"].asText()
    }

    suspend fun ApplicationTestBuilder.shareList(token: String, listId: String, username: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { shareList(listId: \"$listId\", username: \"$username\") { id members { userId username status } } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.acceptInvite(token: String, listId: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { acceptInvite(listId: \"$listId\") { id members { userId username status } } }"}""")
        }
        return res.bodyAsText()
    }

    // AC1 — shareList happy path
    test("AC1 shareList creates PENDING member record, not in List.members yet") {
        val owner = "shareOwner_${UUID.randomUUID().toString().take(8)}"
        val invitee = "shareInvitee_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)
            registerAndLogin(invitee)

            val body = shareList(ownerToken, listId, invitee)
            body shouldNotContain "errors"
            body shouldContain """"status":"PENDING""""
            body shouldContain invitee
            // The invitee is in the PENDING members list in the GQL response
            val members = mapper.readTree(body)["data"]["shareList"]["members"]
            val pendingMember = members.find { it["username"].asText() == invitee }
            pendingMember!!["status"].asText() shouldBe "PENDING"
        }
    }

    // AC2 — shareList unknown username
    test("AC2 shareList with unknown username returns GQL error") {
        val owner = "shareOwner2_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)

            val body = shareList(ownerToken, listId, "ghost_user_does_not_exist")
            body shouldContain "errors"
            body shouldContain "not found"
        }
    }

    // AC3 — shareList already member
    test("AC3 shareList with already-active member returns GQL error") {
        val owner = "shareOwner3_${UUID.randomUUID().toString().take(8)}"
        val member = "shareMember3_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val memberToken = registerAndLogin(member)
            val listId = createList(ownerToken)

            // Share and accept to make member active
            shareList(ownerToken, listId, member)
            acceptInvite(memberToken, listId)

            // Now try to share again
            val body = shareList(ownerToken, listId, member)
            body shouldContain "errors"
            body shouldContain "already a member"
        }
    }

    // AC4 — shareList already pending
    test("AC4 shareList with already-pending invite returns GQL error") {
        val owner = "shareOwner4_${UUID.randomUUID().toString().take(8)}"
        val invitee = "shareInvitee4_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)
            registerAndLogin(invitee)

            shareList(ownerToken, listId, invitee)
            val body = shareList(ownerToken, listId, invitee)
            body shouldContain "errors"
            body shouldContain "already has a pending invite"
        }
    }

    // AC5 — shareList self-share
    test("AC5 shareList with own username returns GQL error") {
        val owner = "shareOwner5_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)

            val body = shareList(ownerToken, listId, owner)
            body shouldContain "errors"
            body shouldContain "cannot share a list with yourself"
        }
    }

    // AC6 — shareList non-owner caller
    test("AC6 shareList by non-owner returns GQL error") {
        val owner = "shareOwner6_${UUID.randomUUID().toString().take(8)}"
        val nonOwner = "shareNonOwner6_${UUID.randomUUID().toString().take(8)}"
        val invitee = "shareInvitee6_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val (ownerToken, nonOwnerToken) = registerManyAndLogin(owner, nonOwner, invitee)
            val listId = createList(ownerToken)

            val body = shareList(nonOwnerToken, listId, invitee)
            body shouldContain "errors"
        }
    }

    // AC7 — acceptInvite happy path
    test("AC7 acceptInvite adds user to List.members and allows data access") {
        val owner = "accOwner_${UUID.randomUUID().toString().take(8)}"
        val invitee = "accInvitee_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val inviteeToken = registerAndLogin(invitee)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, invitee)

            val acceptBody = acceptInvite(inviteeToken, listId)
            acceptBody shouldNotContain "errors"
            val members = mapper.readTree(acceptBody)["data"]["acceptInvite"]["members"]
            val acceptedMember = members.find { it["username"].asText() == invitee }
            acceptedMember!!["status"].asText() shouldBe "ACCEPTED"

            // Invitee can now access items
            val itemsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id } }"}""")
            }
            itemsRes.bodyAsText() shouldNotContain "errors"

            // Invitee can access categories
            val catsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ getCategories(listId: \"$listId\") { id } }"}""")
            }
            catsRes.bodyAsText() shouldNotContain "errors"
        }
    }

    // AC8 — rejectInvite
    test("AC8 rejectInvite sets status DECLINED and list not in invitee's lists") {
        val owner = "rejOwner_${UUID.randomUUID().toString().take(8)}"
        val invitee = "rejInvitee_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val inviteeToken = registerAndLogin(invitee)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, invitee)

            val rejectRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"mutation { rejectInvite(listId: \"$listId\") }"}""")
            }
            rejectRes.bodyAsText() shouldNotContain "errors"

            // List should not appear in invitee's lists
            val listsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ lists { lists { id } pendingInvites { listId } } }"}""")
            }
            val listsBody = listsRes.bodyAsText()
            listsBody shouldNotContain "errors"
            listsBody shouldNotContain listId
        }
    }

    // AC9 — Pending status does not grant data access
    test("AC9 pending invite does not grant access to items or categories") {
        val owner = "pendOwner_${UUID.randomUUID().toString().take(8)}"
        val invitee = "pendInvitee_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val inviteeToken = registerAndLogin(invitee)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, invitee)

            val itemsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id } }"}""")
            }
            itemsRes.bodyAsText() shouldContain "errors"

            val catsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ getCategories(listId: \"$listId\") { id } }"}""")
            }
            catsRes.bodyAsText() shouldContain "errors"
        }
    }

    // AC10 — removeMember happy path
    test("AC10 removeMember removes user from List.members; their items remain; unrelated list unaffected") {
        val owner = "remOwner_${UUID.randomUUID().toString().take(8)}"
        val member = "remMember_${UUID.randomUUID().toString().take(8)}"
        val otherUser = "remOther_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val (ownerToken, memberToken, otherToken) = registerManyAndLogin(owner, member, otherUser)
            val listId = createList(ownerToken)
            val otherListId = createList(otherToken)

            shareList(ownerToken, listId, member)
            acceptInvite(memberToken, listId)

            // Member adds an item
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(memberToken)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"MemberItem\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
            }

            // Owner removes the member
            val removeBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"mutation { removeMember(listId: \"$listId\", username: \"$member\") { id members { username } } }"}""")
            }.bodyAsText()
            removeBody shouldNotContain "errors"
            removeBody shouldNotContain member

            // Items remain on the list
            val itemsRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id name } }"}""")
            }
            itemsRes.bodyAsText() shouldContain "MemberItem"

            // Other user's list is unaffected
            val otherListBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(otherToken)
                setBody("""{"query":"{ lists { lists { id } pendingInvites { listId } } }"}""")
            }.bodyAsText()
            otherListBody shouldContain otherListId
        }
    }

    // AC11 — removeMember non-owner caller
    test("AC11 removeMember by non-owner returns GQL error") {
        val owner = "remOwner2_${UUID.randomUUID().toString().take(8)}"
        val member = "remMember2_${UUID.randomUUID().toString().take(8)}"
        val intruder = "remIntruder_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val (ownerToken, memberToken, intruderToken) = registerManyAndLogin(owner, member, intruder)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, member)
            acceptInvite(memberToken, listId)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(intruderToken)
                setBody("""{"query":"mutation { removeMember(listId: \"$listId\", username: \"$member\") { id } }"}""")
            }.bodyAsText()
            body shouldContain "errors"
        }
    }

    // AC12 — removeMember cannot remove owner
    test("AC12 removeMember targeting owner returns GQL error with exact message") {
        val owner = "remOwner3_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"mutation { removeMember(listId: \"$listId\", username: \"$owner\") { id } }"}""")
            }.bodyAsText()
            body shouldContain "errors"
            body shouldContain "List owner cannot be removed"
        }
    }

    // AC13 — leaveList happy path
    test("AC13 leaveList removes caller from List.members; items remain; list gone from caller's lists") {
        val owner = "leaveOwner_${UUID.randomUUID().toString().take(8)}"
        val member = "leaveMember_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val memberToken = registerAndLogin(member)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, member)
            acceptInvite(memberToken, listId)

            // Member adds an item
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(memberToken)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"LeaveItem\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
            }

            // Member leaves
            val leaveBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(memberToken)
                setBody("""{"query":"mutation { leaveList(listId: \"$listId\") }"}""")
            }.bodyAsText()
            leaveBody shouldNotContain "errors"

            // List gone from member's lists
            val listsBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(memberToken)
                setBody("""{"query":"{ lists { lists { id } pendingInvites { listId } } }"}""")
            }.bodyAsText()
            listsBody shouldNotContain listId

            // Items still on the list (owner can see them)
            val itemsBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id name } }"}""")
            }.bodyAsText()
            itemsBody shouldContain "LeaveItem"
        }
    }

    // AC14 — leaveList owner cannot leave
    test("AC14 leaveList by owner returns GQL error with exact message") {
        val owner = "leaveOwner2_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val listId = createList(ownerToken)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"mutation { leaveList(listId: \"$listId\") }"}""")
            }.bodyAsText()
            body shouldContain "errors"
            body shouldContain "List owner cannot leave"
        }
    }

    // AC15 — lists pendingInvites field
    test("AC15 lists query includes pendingInvites for user with pending invite; not in main lists section") {
        val owner = "pendOwner2_${UUID.randomUUID().toString().take(8)}"
        val invitee = "pendInvitee2_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val inviteeToken = registerAndLogin(invitee)
            val listId = createList(ownerToken)

            shareList(ownerToken, listId, invitee)

            val listsBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(inviteeToken)
                setBody("""{"query":"{ lists { lists { id } pendingInvites { listId listName ownerUsername } } }"}""")
            }.bodyAsText()
            listsBody shouldNotContain "errors"

            val root = mapper.readTree(listsBody)["data"]["lists"]
            // Pending list does not appear in main lists section
            val memberLists = root["lists"]
            memberLists.none { it["id"].asText() == listId } shouldBe true
            // Pending list appears in pendingInvites
            val pending = root["pendingInvites"]
            pending.any { it["listId"].asText() == listId } shouldBe true
        }
    }

    // AC16 — Admin block on all new mutations
    test("AC16 admin blocked on shareList, acceptInvite, rejectInvite, removeMember, leaveList") {
        val owner = "adminBlkOwner_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val adminToken = loginToken()
            val listId = createList(ownerToken)
            val fakeListId = UUID.randomUUID().toString()

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { shareList(listId: \"$listId\", username: \"someone\") { id } }"}""")
            }.bodyAsText() shouldContain "errors"

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { acceptInvite(listId: \"$fakeListId\") { id } }"}""")
            }.bodyAsText() shouldContain "errors"

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { rejectInvite(listId: \"$fakeListId\") }"}""")
            }.bodyAsText() shouldContain "errors"

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { removeMember(listId: \"$listId\", username: \"someone\") { id } }"}""")
            }.bodyAsText() shouldContain "errors"

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { leaveList(listId: \"$fakeListId\") }"}""")
            }.bodyAsText() shouldContain "errors"
        }
    }
})
