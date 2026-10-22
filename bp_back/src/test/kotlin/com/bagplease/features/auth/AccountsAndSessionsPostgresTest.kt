package com.bagplease.features.auth

import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.ListService
import com.bagplease.entity.user.AdminError
import com.bagplease.entity.user.AuthError
import com.bagplease.entity.user.RegistrationError
import com.bagplease.entity.user.UserService
import com.bagplease.entity.user.db.UserRepository
import com.bagplease.features.auth.db.RefreshTokenRepository
import com.bagplease.plugins.SchedulerStep
import com.bagplease.plugins.connectDatabase
import com.bagplease.plugins.runSchedulerCycle
import com.bagplease.plugins.schedulerSteps
import com.bagplease.plugins.tx
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appConfig
import com.bagplease.utils.appJdbcUrl
import com.bagplease.utils.mongoContainer
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.kotlin.client.coroutine.MongoClient
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import org.bson.UuidRepresentation
import java.sql.Connection
import java.sql.DriverManager
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

// Story 11.2: accounts and sessions live in PostgreSQL. These specs drive the services directly against the
// shared PostgreSQL container (and Mongo for the list purge that deleteUser still routes through ListService).
class AccountsAndSessionsPostgresTest : FunSpec({

    val container = mongoContainer()

    val userRepository = UserRepository()
    val tokenRepository = RefreshTokenRepository()

    fun jdbc(): Connection = DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    )

    fun sql(statement: String) = jdbc().use { c -> c.createStatement().use { it.execute(statement) } }

    fun scalar(query: String): String? = jdbc().use { c ->
        c.createStatement().use { st -> st.executeQuery(query).use { if (it.next()) it.getString(1) else null } }
    }

    fun listService(): ListService {
        val credential = MongoCredential.createScramSha1Credential("test_user", "admin", "test_pass".toCharArray())
        val settings = MongoClientSettings.builder()
            .credential(credential)
            .uuidRepresentation(UuidRepresentation.STANDARD)
            .applyConnectionString(ConnectionString("mongodb://localhost:${container.firstMappedPort}/test"))
            .build()
        val db = MongoClient.create(settings).getDatabase("test")
        return com.bagplease.utils.buildTestServices(db).listService
    }

    lateinit var userService: UserService
    lateinit var authService: AuthService

    beforeSpec { connectDatabase(SharedPostgres.container.appConfig()) }

    beforeEach {
        SharedPostgres.reset()
        userService = UserService(userRepository, tokenRepository, listService(), "admin", "admin")
        authService = AuthService(userService, tokenRepository, "secret", "localhost", "localhost", 15, 30)
    }

    test("usernames differing only in case are distinct accounts; an identical one is the existing conflict") {
        userService.register("Bob", "pw").isRight() shouldBe true
        userService.register("bob", "pw").isRight() shouldBe true
        userService.register("Bob", "pw").leftOrNull() shouldBe RegistrationError.InvalidCredentials
        userService.adminCreateUser("bob", "pw").leftOrNull() shouldBe RegistrationError.InvalidCredentials
        userService.adminCreateUser("BOB", "pw").isRight() shouldBe true
        scalar("SELECT count(*) FROM users") shouldBe "3"
    }

    test("the admin page is in binary username order, so a locale collation would fail it") {
        for (name in listOf("Zed", "apple", "Bob", "Alice")) userService.register(name, "pw")
        val page = userService.getUserPage(20, null, null)
        // Binary order: uppercase before lowercase. A locale collation gives Alice, apple, Bob, Zed.
        page.users.map { it.username }.shouldContainExactly("Alice", "Bob", "Zed", "apple")
        page.totalCount shouldBe 4
    }

    test("around locates a page by the count of names before the target in the same order") {
        for (name in listOf("Zed", "apple", "Bob", "Alice")) userService.register(name, "pw")
        // Page size 1 makes the page offset equal the number of names sorting before the target.
        userService.getUserPage(1, null, "Zed").offset shouldBe 2
        userService.getUserPage(1, null, "apple").offset shouldBe 3
        userService.getUserPage(1, null, "Bob").offset shouldBe 1
        userService.getUserPage(1, null, "Carl").offset shouldBe 2 // total: also answers for a missing name
    }

    test("the admin list is paged 20 at a time") {
        for (i in 0 until 25) userService.register("u%02d".format(i), "pw")
        userService.getUserPage(20, 0, null).users.size shouldBe 20
        userService.getUserPage(20, 20, null).users.size shouldBe 5
    }

    test("an expired refresh token is rejected; purge deletes the expired rows and only those") {
        val now = Instant.now()
        tx {
            tokenRepository.save(RefreshToken("expired-1", "a", "user", now.minus(1, ChronoUnit.HOURS)))
            tokenRepository.save(RefreshToken("expired-2", "b", "user", now.minus(1, ChronoUnit.SECONDS)))
            tokenRepository.save(RefreshToken("live-1", "a", "user", now.plus(1, ChronoUnit.HOURS)))
        }
        authService.refresh("expired-1").leftOrNull() shouldBe AuthError.InvalidCredentials
        authService.refresh("live-1").isRight() shouldBe true

        authService.purgeExpiredTokens() shouldBe 2

        tx { tokenRepository.findById("expired-1") }.shouldBeNull()
        tx { tokenRepository.findById("expired-2") }.shouldBeNull()
        tx { tokenRepository.findById("live-1") }.shouldNotBeNull()
    }

    test("a scheduler step that throws is logged and the next step still runs") {
        tx { tokenRepository.save(RefreshToken("old", "a", "user", Instant.now().minusSeconds(60))) }
        val ran = mutableListOf<String>()
        runSchedulerCycle(
            listOf(
                SchedulerStep("item cycle") { ran += "item"; error("boom") },
                SchedulerStep("purge") { ran += "purge"; authService.purgeExpiredTokens() },
            )
        )
        ran shouldContainExactly listOf("item", "purge")
        scalar("SELECT count(*) FROM refresh_tokens") shouldBe "0"
    }

    test("the production scheduler steps purge expired refresh tokens, even after a failing item cycle") {
        tx { tokenRepository.save(RefreshToken("old", "a", "user", Instant.now().minusSeconds(60))) }
        runSchedulerCycle(schedulerSteps({ error("boom") }, authService))
        scalar("SELECT count(*) FROM refresh_tokens") shouldBe "0"
    }

    test("an admin password reset drops the user's refresh tokens") {
        val user = userService.register("erin", "pw").getOrNull().shouldNotBeNull()
        val tokens = authService.login("erin", "pw").getOrNull().shouldNotBeNull()
        userService.adminResetPassword(user.id, "newpw").isRight() shouldBe true
        authService.refresh(tokens.refreshToken).isLeft() shouldBe true
        userService.login("erin", "newpw").isRight() shouldBe true
    }

    test("a failing password change keeps the old hash AND the old sessions") {
        userService.register("carol", "oldpw")
        val tokens = authService.login("carol", "oldpw").getOrNull().shouldNotBeNull()
        val oldHash = scalar("SELECT password_hash FROM users WHERE username = 'carol'")

        // Failure injected AFTER the new hash is computed and written: deleting sessions raises.
        sql(
            """CREATE FUNCTION fail_token_delete() RETURNS trigger LANGUAGE plpgsql AS
               ${'$'}${'$'} BEGIN RAISE EXCEPTION 'injected failure'; END ${'$'}${'$'}"""
        )
        sql("CREATE TRIGGER fail_token_delete BEFORE DELETE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION fail_token_delete()")
        try {
            shouldThrow<Exception> { userService.changePassword("carol", "oldpw", "newpw") }
        } finally {
            sql("DROP TRIGGER fail_token_delete ON refresh_tokens")
            sql("DROP FUNCTION fail_token_delete()")
        }

        scalar("SELECT password_hash FROM users WHERE username = 'carol'") shouldBe oldHash
        authService.refresh(tokens.refreshToken).isRight() shouldBe true
        userService.login("carol", "oldpw").isRight() shouldBe true

        // And the healthy path commits both together.
        userService.changePassword("carol", "oldpw", "newpw").isRight() shouldBe true
        authService.refresh(tokens.refreshToken).isLeft() shouldBe true
        userService.login("carol", "newpw").isRight() shouldBe true
    }

    test("deleteUser locks the row, purges lists and tokens, deletes the user last, keeps feedback") {
        val lists = listService()
        userService = UserService(userRepository, tokenRepository, lists, "admin", "admin")
        authService = AuthService(userService, tokenRepository, "secret", "localhost", "localhost", 15, 30)

        val user = userService.register("dave", "pw").getOrNull().shouldNotBeNull()
        lists.createList("Groceries", null, CallerUsername("dave")).isRight() shouldBe true
        lists.createList("Hardware", null, CallerUsername("dave")).isRight() shouldBe true
        authService.login("dave", "pw").isRight() shouldBe true
        val feedbackId = UUID.randomUUID()
        sql("INSERT INTO feedback (id, text, username, created_at) VALUES ('$feedbackId', 'hi', 'dave', now())")

        // A concurrent transaction holds the row: deleteUser must wait on its FOR UPDATE.
        val holder = jdbc().apply { autoCommit = false }
        holder.createStatement().use { it.execute("SELECT 1 FROM users WHERE id = '${user.id}' FOR UPDATE") }
        val result = async { userService.deleteUser(user.id) }
        delay(700)
        result.isCompleted shouldBe false
        holder.commit()
        holder.close()

        val deleted = withTimeoutOrNull(10_000) { result.await() }.shouldNotBeNull().getOrNull().shouldNotBeNull()
        deleted.ownedListCount shouldBe 2
        deleted.user.username shouldBe "dave"
        scalar("SELECT count(*) FROM users WHERE username = 'dave'") shouldBe "0"
        scalar("SELECT count(*) FROM refresh_tokens WHERE username = 'dave'") shouldBe "0"
        scalar("SELECT count(*) FROM feedback WHERE id = '$feedbackId'") shouldBe "1"
        lists.countOwnedLists(user.id) shouldBe 0

        userService.deleteUser(user.id).leftOrNull() shouldBe AdminError.NotFound
    }

    test("a deleteUser that fails midway leaves the user and the sessions in place") {
        val user = userService.register("erin", "pw").getOrNull().shouldNotBeNull()
        authService.login("erin", "pw").isRight() shouldBe true
        sql(
            """CREATE FUNCTION fail_token_delete() RETURNS trigger LANGUAGE plpgsql AS
               ${'$'}${'$'} BEGIN RAISE EXCEPTION 'injected failure'; END ${'$'}${'$'}"""
        )
        sql("CREATE TRIGGER fail_token_delete BEFORE DELETE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION fail_token_delete()")
        try {
            shouldThrow<Exception> { userService.deleteUser(user.id) }
        } finally {
            sql("DROP TRIGGER fail_token_delete ON refresh_tokens")
            sql("DROP FUNCTION fail_token_delete()")
        }
        scalar("SELECT count(*) FROM users WHERE username = 'erin'") shouldBe "1"
        scalar("SELECT count(*) FROM refresh_tokens WHERE username = 'erin'") shouldBe "1"
    }
})
