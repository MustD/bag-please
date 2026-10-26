package com.bagplease.entity.user.db

import com.bagplease.entity.user.User
import com.bagplease.plugins.isUniqueViolation
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.r2dbc.deleteWhere
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.selectAll
import org.jetbrains.exposed.v1.r2dbc.update
import java.util.UUID
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList

/** Thrown by [UserRepository.insert] when the username is already taken (SQLSTATE 23505, AD-5). */
class DuplicateUsernameException(val username: String, cause: Throwable) : RuntimeException("Username already taken", cause)

/**
 * `users` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2); the repository never
 * opens a transaction itself.
 */
class UserRepository {

    suspend fun countAll(): Int = UserTable.selectAll().count().toInt()

    // Binary username order comes from the column's "C" collation, so no application-side collation is needed.
    suspend fun findPage(limit: Int, skip: Int): List<User> =
        UserTable.selectAll()
            .orderBy(UserTable.username, SortOrder.ASC)
            .limit(limit)
            .offset(skip.toLong())
            .map(UserRowMapper::fromRow)
            .toList()

    // How many usernames sort strictly before `username`; total, so it answers for a name that does not exist.
    suspend fun countUsernamesBefore(username: String): Int =
        UserTable.selectAll().where { UserTable.username less username }.count().toInt()

    suspend fun insert(user: User) {
        try {
            UserTable.insert {
                it[id] = user.id
                it[username] = user.username
                it[passwordHash] = user.passwordHash
                it[role] = user.role
            }
        } catch (e: Exception) {
            if (e.isUniqueViolation()) throw DuplicateUsernameException(user.username, e)
            throw e
        }
    }

    suspend fun updatePasswordHash(id: UUID, passwordHash: String) {
        UserTable.update({ UserTable.id eq id }) { it[UserTable.passwordHash] = passwordHash }
    }

    suspend fun findByUsername(username: String): User? =
        UserTable.selectAll().where { UserTable.username eq username }
            .map(UserRowMapper::fromRow)
            .toList()
            .firstOrNull()

    suspend fun findById(id: UUID): User? =
        UserTable.selectAll().where { UserTable.id eq id }
            .map(UserRowMapper::fromRow)
            .toList()
            .firstOrNull()

    /** `SELECT … FOR UPDATE`: the one explicit lock in the system (user deletion). */
    suspend fun findByIdForUpdate(id: UUID): User? =
        UserTable.selectAll().where { UserTable.id eq id }
            .forUpdate()
            .map(UserRowMapper::fromRow)
            .toList()
            .firstOrNull()

    suspend fun deleteById(id: UUID): Boolean = UserTable.deleteWhere { UserTable.id eq id } > 0
}
