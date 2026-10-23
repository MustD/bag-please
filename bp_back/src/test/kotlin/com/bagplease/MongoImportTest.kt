package com.bagplease

import at.favre.lib.crypto.bcrypt.BCrypt
import com.bagplease.tools.ImportRefused
import com.bagplease.tools.MongoImport
import com.bagplease.tools.TypeReport
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.pgCount
import com.bagplease.utils.pgExec
import com.bagplease.utils.pgRows
import com.bagplease.utils.appConfig
import com.bagplease.utils.postgresContainer
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.nio.file.Path

// Story 11.8 — the operator-run Mongo export importer, against the shared PostgreSQL.
class MongoImportTest : FunSpec({

    val container = postgresContainer()
    beforeTest { SharedPostgres.reset() }

    val mapper = ObjectMapper()
    val tables = listOf("users", "lists", "list_members", "categories", "items", "feedback", "refresh_tokens", "app_config")

    /** A scratch copy of the fixture export that a test may edit. */
    fun fixtureCopy(): Path {
        val src = Path.of(MongoImportTest::class.java.getResource("/mongo-export")!!.toURI())
        val dir = Files.createTempDirectory("mongo-export")
        Files.list(src).use { it.forEach { f -> Files.copy(f, dir.resolve(f.fileName)) } }
        return dir
    }

    fun edit(dir: Path, collection: String, change: (ArrayNode) -> Unit) {
        val file = dir.resolve("$collection.json")
        val arr = mapper.readTree(Files.readString(file)) as ArrayNode
        change(arr)
        Files.writeString(file, mapper.writeValueAsString(arr))
    }

    fun report(rs: List<TypeReport>, type: String) = rs.single { it.type == type }
    fun allEmpty() = tables.forEach { pgCount("SELECT count(*) FROM $it") shouldBe 0 }

    test("happy load: counts balance, owners and memberUsernames win, hash verifies") {
        val rs = MongoImport.run(container.appConfig(), fixtureCopy())
        rs.forEach { it.exported shouldBe it.loaded + it.dropped.size }

        report(rs, "users").let { it.exported to it.loaded } shouldBe (4 to 4)
        report(rs, "lists").let { Triple(it.exported, it.loaded, it.dropped.size) } shouldBe Triple(3, 2, 1)
        report(rs, "list_members").let { Triple(it.exported, it.loaded, it.dropped.size) } shouldBe Triple(4, 1, 3)
        report(rs, "categories").let { Triple(it.exported, it.loaded, it.dropped.size) } shouldBe Triple(3, 2, 1)
        report(rs, "items").let { Triple(it.exported, it.loaded, it.dropped.size) } shouldBe Triple(5, 2, 3)
        report(rs, "refresh_tokens").let { Triple(it.exported, it.loaded, it.dropped.size) } shouldBe Triple(2, 0, 2)

        pgCount("SELECT count(*) FROM refresh_tokens") shouldBe 0
        pgRows("SELECT username FROM users ORDER BY username") shouldBe listOf(listOf("Carol"), listOf("alice"), listOf("bob"), listOf("dave"))
        // Legacy-byte-order (03), standard binary (04) and $uuid ids all resolved to the same ids the lists refer to.
        pgRows("SELECT id FROM users WHERE username = 'alice'") shouldBe listOf(listOf("01020304-0506-0708-090a-0b0c0d0e0f10"))
        pgRows("SELECT u.username, m.status FROM list_members m JOIN users u ON u.id = m.user_id JOIN lists l ON l.id = m.list_id " +
            "WHERE l.name = 'Groceries' ORDER BY u.username") shouldBe
            listOf(listOf("Carol", "DECLINED"), listOf("alice", "ACCEPTED"), listOf("bob", "ACCEPTED")) // bob's PENDING doc lost
        pgRows("SELECT u.username, m.status FROM list_members m JOIN users u ON u.id = m.user_id JOIN lists l ON l.id = m.list_id " +
            "WHERE l.name = 'Hardware' ORDER BY u.username") shouldBe listOf(listOf("Carol", "ACCEPTED"), listOf("bob", "ACCEPTED"))
        pgCount("SELECT count(*) FROM list_members m JOIN users u ON u.id = m.user_id WHERE u.username = 'dave'") shouldBe 0
        pgRows("SELECT name FROM items ORDER BY name") shouldBe listOf(listOf("item64"), listOf("item68"))
        pgRows("SELECT stores::text FROM items WHERE name = 'item64'") shouldBe listOf(listOf("{Lidl,aldi}"))
        pgRows("SELECT registration_enabled FROM app_config") shouldBe listOf(listOf("f"))
        pgCount("SELECT count(*) FROM feedback") shouldBe 1

        val hash = pgRows("SELECT password_hash FROM users WHERE username = 'bob'").single().single()!!
        BCrypt.verifyer().verify("secret-pw".toCharArray(), hash).verified shouldBe true
    }

    val oneRow = mapOf(
        "users" to "INSERT INTO users (id, username, password_hash, role) VALUES ('00000000-0000-0000-0000-0000000000f1', 'x', 'h', 'user')",
        "lists" to "INSERT INTO users (id, username, password_hash, role) VALUES ('00000000-0000-0000-0000-0000000000f1', 'x', 'h', 'user'); " +
            "INSERT INTO lists (id, name, owner_id, origin, created_at) VALUES ('00000000-0000-0000-0000-0000000000f2', 'l', '00000000-0000-0000-0000-0000000000f1', 'o', now())",
        "feedback" to "INSERT INTO feedback (id, text, username, created_at) VALUES ('00000000-0000-0000-0000-0000000000f3', 'x', 'y', now())",
        "refresh_tokens" to "INSERT INTO refresh_tokens (token, username, role, expires_at) VALUES ('t', 'x', 'user', now())",
        "app_config" to "INSERT INTO app_config (id, registration_enabled) VALUES ('00000000-0000-0000-0000-000000000001', true)",
    )
    val withParents = "INSERT INTO users (id, username, password_hash, role) VALUES ('00000000-0000-0000-0000-0000000000f1', 'x', 'h', 'user'); " +
        "INSERT INTO lists (id, name, owner_id, origin, created_at) VALUES ('00000000-0000-0000-0000-0000000000f2', 'l', '00000000-0000-0000-0000-0000000000f1', 'o', now()); "
    val rows = oneRow + mapOf(
        "list_members" to withParents + "INSERT INTO list_members (list_id, user_id, status, created_at) VALUES ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'ACCEPTED', now())",
        "categories" to withParents + "INSERT INTO categories (id, name, list_id) VALUES ('00000000-0000-0000-0000-0000000000f4', 'c', '00000000-0000-0000-0000-0000000000f2')",
        "items" to withParents + "INSERT INTO categories (id, name, list_id) VALUES ('00000000-0000-0000-0000-0000000000f4', 'c', '00000000-0000-0000-0000-0000000000f2'); " +
            "INSERT INTO items (id, name, checked, category_id, list_id) VALUES ('00000000-0000-0000-0000-0000000000f5', 'i', false, '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f2')",
    )
    tables.forEach { table ->
        test("a target holding a $table row is refused, naming the table, and nothing is written") {
            pgExec(rows.getValue(table))
            val before = tables.associateWith { pgCount("SELECT count(*) FROM $it") }
            val e = shouldThrow<ImportRefused> { MongoImport.run(container.appConfig(), fixtureCopy()) }
            e.message!! shouldContain "'$table'"
            tables.associateWith { pgCount("SELECT count(*) FROM $it") } shouldBe before
        }
    }

    test("uuidOf and instantOf accept the string-form binary and numeric date") {
        val expected = java.util.UUID.fromString("01020304-0506-0708-090a-0b0c0d0e0f10")
        val std = java.util.Base64.getEncoder().encodeToString(
            java.nio.ByteBuffer.allocate(16).putLong(expected.mostSignificantBits).putLong(expected.leastSignificantBits).array(),
        )
        val legacy = java.util.Base64.getEncoder().encodeToString(
            java.nio.ByteBuffer.allocate(16).putLong(java.lang.Long.reverseBytes(expected.mostSignificantBits))
                .putLong(java.lang.Long.reverseBytes(expected.leastSignificantBits)).array(),
        )
        MongoImport.uuidOf(mapper.readTree("""{"${'$'}binary":"$std","${'$'}type":"04"}""")) shouldBe expected
        MongoImport.uuidOf(mapper.readTree("""{"${'$'}binary":"$legacy","${'$'}type":"03"}""")) shouldBe expected
        MongoImport.instantOf(mapper.readTree("""{"${'$'}date":1767323045000}""")) shouldBe java.time.Instant.ofEpochMilli(1767323045000)
    }

    test("an item in the legacy single-store shape is refused, listing its id") {
        val dir = fixtureCopy()
        edit(dir, "items") { (it[0] as ObjectNode).put("store", "Lidl") }
        edit(dir, "items") { (it[1] as ObjectNode).remove("stores") }
        edit(dir, "items") { (it[2] as ObjectNode).put("stores", "Lidl") }
        val e = shouldThrow<ImportRefused> { MongoImport.run(container.appConfig(), dir) }
        e.message!! shouldContain "00000000-0000-0000-0000-000000000040"
        e.message!! shouldContain "00000000-0000-0000-0000-000000000041"
        e.message!! shouldContain "00000000-0000-0000-0000-000000000042"
        allEmpty()
    }

    test("a part-way failure leaves zero rows and a corrected rerun succeeds") {
        val dir = fixtureCopy()
        // Duplicate feedback id: fails on the LAST table written, after users, lists and items are already inserted.
        edit(dir, "feedback") { it.add(it[0].deepCopy<ObjectNode>()) }
        shouldThrow<Exception> { MongoImport.run(container.appConfig(), dir) }
        allEmpty()
        edit(dir, "feedback") { it.remove(1) }
        // Duplicate usernames fail on the first table.
        edit(dir, "users") { (it[1] as ObjectNode).put("username", "alice") }
        shouldThrow<Exception> { MongoImport.run(container.appConfig(), dir) }
        allEmpty()
        edit(dir, "users") { (it[1] as ObjectNode).put("username", "bob") }
        MongoImport.run(container.appConfig(), dir)
        pgCount("SELECT count(*) FROM users") shouldBe 4
    }
})
