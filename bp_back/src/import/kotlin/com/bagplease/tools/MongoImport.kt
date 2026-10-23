package com.bagplease.tools

import com.bagplease.config.db.ApplicationConfigTable
import com.bagplease.entity.category.db.CategoryTable
import com.bagplease.entity.feedback.db.FeedbackTable
import com.bagplease.entity.item.db.ItemTable
import com.bagplease.entity.list.db.ListMemberTable
import com.bagplease.entity.list.db.ListTable
import com.bagplease.entity.user.db.UserTable
import com.bagplease.features.auth.db.RefreshTokenTable
import com.bagplease.plugins.PostgresConfig
import com.bagplease.plugins.connectDatabase
import com.bagplease.plugins.migrate
import com.bagplease.plugins.tx
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.selectAll
import java.nio.ByteBuffer
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.Base64
import java.util.UUID
import kotlin.system.exitProcess

/** The import cannot proceed; nothing was written. */
class ImportRefused(message: String) : RuntimeException(message)

/** One record type of the report: `exported == loaded + dropped` always holds. */
data class TypeReport(val type: String, val exported: Int, val loaded: Int, val dropped: List<String>) {
    init {
        check(exported == loaded + dropped.size) { "$type: $exported exported != $loaded loaded + ${dropped.size} dropped" }
    }
}

/**
 * One-time, operator-run load of a `mongoexport --jsonArray` export into an EMPTY PostgreSQL database (Story 11.8,
 * AD-9/AD-18). Not part of the `bp_back` image: it lives in its own Gradle source set.
 *
 * Runs Flyway, refuses a non-empty target or a legacy item shape, then loads everything in ONE [tx]: any failure
 * leaves zero rows. Credentials come from `IMPORT_DB_*` environment variables of this process only.
 */
object MongoImport {
    private val mapper = ObjectMapper()
    private val NIL = UUID(0, 0)
    private val APP_CONFIG_ID = UUID.fromString("00000000-0000-0000-0000-000000000001")

    private val appTables: List<Pair<String, Table>> = listOf(
        "users" to UserTable, "lists" to ListTable, "list_members" to ListMemberTable,
        "categories" to CategoryTable, "items" to ItemTable, "feedback" to FeedbackTable,
        "refresh_tokens" to RefreshTokenTable, "app_config" to ApplicationConfigTable,
    )

    // ---- Extended JSON ----

    private fun JsonNode.isAbsent() = isMissingNode || isNull

    /** UUID as plain string, `{"$uuid"}`, or `{"$binary"}` subtype 04 (standard) / 03 (legacy Java byte order). */
    fun uuidOf(n: JsonNode): UUID? {
        if (n.isAbsent()) return null
        if (n.isTextual) return UUID.fromString(n.asText())
        n.get("\$uuid")?.let { return UUID.fromString(it.asText()) }
        val b = n.get("\$binary") ?: error("Unsupported id: $n")
        val (base64, subType) = if (b.isTextual) b.asText() to n.get("\$type").asText()
        else b.get("base64").asText() to b.get("subType").asText()
        val bytes = Base64.getDecoder().decode(base64)
        require(bytes.size == 16) { "UUID binary must be 16 bytes: $n" }
        val buf = ByteBuffer.wrap(bytes)
        return when (subType.trimStart('0').ifEmpty { "0" }) {
            "4" -> UUID(buf.long, buf.long)
            "3" -> UUID(java.lang.Long.reverseBytes(buf.long), java.lang.Long.reverseBytes(buf.long))
            else -> error("Unsupported binary subtype $subType: $n")
        }
    }

    fun instantOf(n: JsonNode): Instant? {
        if (n.isAbsent()) return null
        val d = n.get("\$date") ?: error("Unsupported date: $n")
        return when {
            d.isTextual -> Instant.parse(d.asText())
            d.isNumber -> Instant.ofEpochMilli(d.asLong())
            d.has("\$numberLong") -> Instant.ofEpochMilli(d.get("\$numberLong").asLong())
            else -> error("Unsupported date: $n")
        }
    }

    private fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asText()
    private fun JsonNode.bool(field: String, default: Boolean = false) = get(field)?.takeUnless { it.isNull }?.asBoolean() ?: default

    private fun read(dir: Path, collection: String, required: Boolean = true): List<JsonNode> {
        val file = dir.resolve("$collection.json")
        if (!Files.exists(file)) {
            if (required) throw ImportRefused("Export file missing: $file")
            return emptyList()
        }
        val root = mapper.readTree(Files.readString(file))
        if (!root.isArray) throw ImportRefused("$file is not a JSON array (export with --jsonArray)")
        return root.toList()
    }

    // ---- Plan ----

    private data class UserRow(val id: UUID, val username: String, val hash: String, val role: String)
    private data class ListRow(val id: UUID, val name: String, val emoji: String?, val owner: UUID, val origin: String, val createdAt: Instant)
    private data class MemberRow(val listId: UUID, val userId: UUID, val status: String, val createdAt: Instant)
    private data class CategoryRow(val id: UUID, val name: String, val listId: UUID)
    private data class ItemRow(
        val id: UUID, val name: String, val checked: Boolean, val category: UUID, val listId: UUID, val stores: List<String>,
        val recurring: String?, val addedBy: String?, val deleted: Boolean, val deletedAt: Instant?, val checkedAt: Instant?,
    )
    private data class FeedbackRow(val id: UUID, val text: String, val username: String, val createdAt: Instant)

    private class Plan(
        val users: List<UserRow>, val lists: List<ListRow>, val members: List<MemberRow>, val categories: List<CategoryRow>,
        val items: List<ItemRow>, val feedback: List<FeedbackRow>, val registrationEnabled: Boolean?, val reports: List<TypeReport>,
    )

    private fun plan(dir: Path): Plan {
        val userDocs = read(dir, "users")
        val listDocs = read(dir, "lists")
        val memberDocs = read(dir, "list_members")
        val categoryDocs = read(dir, "categories")
        val itemDocs = read(dir, "items")
        val feedbackDocs = read(dir, "feedback")
        val tokenDocs = read(dir, "refresh_tokens", required = false)
        val configDocs = read(dir, "app_config")

        val legacy = itemDocs.filter { it.get("stores").let { s -> s == null || !s.isArray } || it.has("store") }
            .map { it.get("_id").toString() }
        if (legacy.isNotEmpty()) {
            throw ImportRefused("Items in the legacy single-store shape (missing or non-array 'stores', or carrying 'store'): ${legacy.joinToString()}")
        }

        val reports = mutableListOf<TypeReport>()

        val users = userDocs.map {
            UserRow(uuidOf(it.get("_id"))!!, it.text("username")!!, it.text("passwordHash")!!, it.text("role") ?: "user")
        }
        reports += TypeReport("users", users.size, users.size, emptyList())
        val userIds = users.map { it.id }.toSet()
        val userByName = users.associateBy { it.username }

        // Lists: owner resolved by id, else by ownerUsername.
        val lists = mutableListOf<ListRow>()
        val ownedBy = mutableMapOf<UUID, Set<String>>()
        val listDrops = mutableListOf<String>()
        val memberNames = mutableMapOf<UUID, List<String>>()
        for (d in listDocs) {
            val id = uuidOf(d.get("_id"))!!
            val ownerId = uuidOf(d.get("ownerId"))?.takeIf { it in userIds }
                ?: d.text("ownerUsername")?.let { userByName[it]?.id }
            if (ownerId == null) {
                listDrops += "list $id: owner unresolvable"
                continue
            }
            lists += ListRow(
                id, d.text("name")!!, d.text("emoji"), ownerId, d.text("origin") ?: "USER_CREATED",
                instantOf(d.get("createdAt")) ?: Instant.now(),
            )
            memberNames[id] = d.get("memberUsernames")?.takeIf { it.isArray }?.map { it.asText() } ?: emptyList()
        }
        reports += TypeReport("lists", listDocs.size, lists.size, listDrops)
        val listIds = lists.map { it.id }.toSet()

        // Memberships: owner ACCEPTED + memberUsernames ACCEPTED (authoritative).
        val members = linkedMapOf<Pair<UUID, UUID>, MemberRow>()
        var derivedExported = 0
        val derivedDrops = mutableListOf<String>()
        for (l in lists) {
            derivedExported++
            members[l.id to l.owner] = MemberRow(l.id, l.owner, "ACCEPTED", l.createdAt)
            for (name in memberNames.getValue(l.id)) {
                derivedExported++
                val u = userByName[name]
                when {
                    u == null -> derivedDrops += "list ${l.id}: member '$name' unresolvable"
                    (l.id to u.id) in members -> derivedDrops += "list ${l.id}: member '$name' already ACCEPTED"
                    else -> members[l.id to u.id] = MemberRow(l.id, u.id, "ACCEPTED", l.createdAt)
                }
            }
        }
        reports += TypeReport("list memberships (owner + memberUsernames)", derivedExported, members.size, derivedDrops)

        // list_members docs add PENDING / DECLINED only for users not already ACCEPTED.
        val docDrops = mutableListOf<String>()
        var docLoaded = 0
        for (d in memberDocs) {
            val ref = d.get("_id").toString()
            val listId = uuidOf(d.get("listId"))
            val userId = uuidOf(d.get("userId"))?.takeIf { it in userIds } ?: d.text("username")?.let { userByName[it]?.id }
            val status = d.text("status")
            when {
                listId == null || listId !in listIds -> docDrops += "list_member $ref: list missing or dropped"
                userId == null -> docDrops += "list_member $ref: user unresolvable"
                status != "PENDING" && status != "DECLINED" -> docDrops += "list_member $ref: status '$status' is not carried (memberUsernames decides ACCEPTED)"
                (listId to userId) in members -> docDrops += "list_member $ref: user already has a membership on the list"
                else -> {
                    members[listId to userId] = MemberRow(listId, userId, status, instantOf(d.get("createdAt")) ?: Instant.now())
                    docLoaded++
                }
            }
        }
        reports += TypeReport("list_members", memberDocs.size, docLoaded, docDrops)

        // Categories
        val categories = mutableListOf<CategoryRow>()
        val categoryDrops = mutableListOf<String>()
        for (d in categoryDocs) {
            val id = uuidOf(d.get("_id"))!!
            val listId = uuidOf(d.get("listId"))
            when {
                listId == null -> categoryDrops += "category $id: listId is null"
                listId !in listIds -> categoryDrops += "category $id: list $listId missing or dropped"
                else -> categories += CategoryRow(id, d.text("name")!!, listId)
            }
        }
        reports += TypeReport("categories", categoryDocs.size, categories.size, categoryDrops)
        val categoryList = categories.associate { it.id to it.listId }

        // Items
        val items = mutableListOf<ItemRow>()
        val itemDrops = mutableListOf<String>()
        for (d in itemDocs) {
            val id = uuidOf(d.get("_id"))!!
            val listId = uuidOf(d.get("listId"))
            val category = uuidOf(d.get("category"))
            when {
                listId == null -> itemDrops += "item $id: listId is null"
                listId !in listIds -> itemDrops += "item $id: list $listId missing or dropped"
                category == null || category == NIL -> itemDrops += "item $id: category is nil"
                categoryList[category] != listId -> itemDrops += "item $id: category $category not in the item's list"
                else -> items += ItemRow(
                    id, d.text("name")!!, d.bool("checked"), category, listId, d.get("stores").map { it.asText() },
                    d.text("recurring"), d.text("addedBy"), d.bool("deleted"), instantOf(d.get("deletedAt")), instantOf(d.get("checkedAt")),
                )
            }
        }
        reports += TypeReport("items", itemDocs.size, items.size, itemDrops)

        val feedback = feedbackDocs.map {
            FeedbackRow(uuidOf(it.get("_id"))!!, it.text("text")!!, it.text("username")!!, instantOf(it.get("createdAt")) ?: Instant.now())
        }
        reports += TypeReport("feedback", feedback.size, feedback.size, emptyList())

        reports += TypeReport("refresh_tokens", tokenDocs.size, 0, tokenDocs.map { "refresh token: never loaded (users sign in again)" })

        // The row is written only when the flag is present: a missing row already means the app defaults.
        val registration = configDocs.firstOrNull()?.get("registrationEnabled")?.takeUnless { it.isNull }?.asBoolean()
        reports += TypeReport(
            "app_config", configDocs.size, if (registration != null) 1 else 0,
            configDocs.mapIndexedNotNull { i, _ ->
                when {
                    i > 0 -> "app_config: only one row is kept"
                    registration == null -> "app_config: registrationEnabled missing, defaults apply"
                    else -> null
                }
            },
        )

        return Plan(users, lists, members.values.toList(), categories, items, feedback, registration, reports)
    }

    // ---- Load ----

    /** Runs Flyway, checks, loads in one tx and returns the report. Throws [ImportRefused] before writing anything. */
    fun run(config: PostgresConfig, exportDir: Path): List<TypeReport> {
        val plan = plan(exportDir)
        migrate(config)
        connectDatabase(config)
        runBlocking {
            tx {
                val nonEmpty = appTables.filter { (_, table) -> table.selectAll().count() > 0 }.map { it.first }
                if (nonEmpty.isNotEmpty()) {
                    throw ImportRefused("Target database is not empty: ${nonEmpty.joinToString { "table '$it'" }} hold(s) rows")
                }
                plan.users.forEach { u ->
                    UserTable.insert {
                        it[id] = u.id; it[username] = u.username; it[passwordHash] = u.hash; it[role] = u.role
                    }
                }
                plan.lists.forEach { l ->
                    ListTable.insert {
                        it[id] = l.id; it[name] = l.name; it[emoji] = l.emoji; it[ownerId] = l.owner
                        it[origin] = l.origin; it[createdAt] = l.createdAt
                    }
                }
                plan.members.forEach { m ->
                    ListMemberTable.insert {
                        it[listId] = m.listId; it[userId] = m.userId; it[status] = m.status; it[createdAt] = m.createdAt
                    }
                }
                plan.categories.forEach { c ->
                    CategoryTable.insert { it[id] = c.id; it[name] = c.name; it[listId] = c.listId }
                }
                plan.items.forEach { i ->
                    ItemTable.insert {
                        it[id] = i.id; it[name] = i.name; it[checked] = i.checked; it[categoryId] = i.category
                        it[listId] = i.listId; it[stores] = i.stores; it[recurring] = i.recurring; it[addedBy] = i.addedBy
                        it[deleted] = i.deleted; it[deletedAt] = i.deletedAt; it[checkedAt] = i.checkedAt
                    }
                }
                plan.feedback.forEach { f ->
                    FeedbackTable.insert {
                        it[id] = f.id; it[text] = f.text; it[username] = f.username; it[createdAt] = f.createdAt
                    }
                }
                plan.registrationEnabled?.let { enabled ->
                    ApplicationConfigTable.insert { it[id] = APP_CONFIG_ID; it[registrationEnabled] = enabled }
                }
            }
        }
        return plan.reports
    }

    fun format(reports: List<TypeReport>): String = buildString {
        appendLine("%-46s %8s %8s %8s".format("record type", "export", "loaded", "dropped"))
        reports.forEach { r ->
            appendLine("%-46s %8d %8d %8d".format(r.type, r.exported, r.loaded, r.dropped.size))
        }
        reports.filter { it.dropped.isNotEmpty() }.forEach { r ->
            appendLine()
            appendLine("Dropped ${r.type}:")
            r.dropped.forEach { appendLine("  - $it") }
        }
    }

    @JvmStatic
    fun main(args: Array<String>) {
        if (args.size != 1) {
            System.err.println("usage: MongoImport <export-dir>   (env: IMPORT_DB_HOST, IMPORT_DB_PORT, IMPORT_DB_NAME, IMPORT_DB_USER, IMPORT_DB_PASSWORD, IMPORT_DB_SSLMODE, IMPORT_DB_SSLROOTCERT)")
            exitProcess(2)
        }
        // No logback config on the importer classpath: default is DEBUG, which floods the report with driver frames.
        (org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as? ch.qos.logback.classic.Logger)
            ?.level = ch.qos.logback.classic.Level.WARN
        fun env(name: String, default: String? = null) =
            System.getenv("IMPORT_DB_$name") ?: default ?: run {
                System.err.println("IMPORT_DB_$name is not set")
                exitProcess(2)
            }
        val config = PostgresConfig(
            host = env("HOST"), port = env("PORT", "5432").toInt(), name = env("NAME"),
            user = env("USER"), password = env("PASSWORD"), sslmode = env("SSLMODE", "disable"),
            sslrootcert = env("SSLROOTCERT", ""),
        )
        try {
            print(format(run(config, Path.of(args[0]))))
            exitProcess(0)
        } catch (e: ImportRefused) {
            System.err.println("Import refused: ${e.message}")
            exitProcess(1)
        } catch (e: Throwable) {
            System.err.println("Import failed, nothing was written: $e")
            exitProcess(1)
        }
    }
}
