package com.bagplease.entity.user

import arrow.core.Either
import arrow.core.raise.either
import at.favre.lib.crypto.bcrypt.BCrypt
import com.bagplease.entity.user.mongo.UserRepository
import com.mongodb.MongoWriteException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.*

sealed class RegistrationError {
    data object InvalidCredentials : RegistrationError()
}

sealed class AdminError {
    data object NotFound : AdminError()
}

sealed class AuthError {
    data object InvalidCredentials : AuthError()
    data object WrongCurrentPassword : AuthError()
}

data class LoginResult(val username: String, val role: String)

class UserService(
    private val repository: UserRepository,
    private val adminLogin: String,
    private val adminPass: String,
) {
    private companion object {
        // The bounds `getUserPage` coerces `limit` into. 100 caps what one call
        // can cost the server; 1 keeps a zero or negative limit from asking Mongo
        // for an unbounded page (`.limit(0)` means "no limit" to the driver).
        const val MIN_PAGE_SIZE = 1
        const val MAX_PAGE_SIZE = 100
    }

    suspend fun register(username: String, password: String): Either<RegistrationError, User> =
        either {
            if (username == adminLogin) raise(RegistrationError.InvalidCredentials)
            val hash = hashPassword(password)
            val user = User(username = username, passwordHash = hash, role = "user")
            try {
                repository.save(user)
            } catch (e: MongoWriteException) {
                if (e.error.code == 11000) raise(RegistrationError.InvalidCredentials)
                throw e
            }
            user
        }

    suspend fun login(username: String, password: String): Either<AuthError, LoginResult> = either {
        if (username == adminLogin) {
            if (password == adminPass) return@either LoginResult(username, "admin")
            else raise(AuthError.InvalidCredentials)
        }
        val user = repository.findByUsername(username) ?: raise(AuthError.InvalidCredentials)
        if (!verifyPassword(password, user.passwordHash)) raise(AuthError.InvalidCredentials)
        LoginResult(user.username, user.role)
    }

    suspend fun changePassword(
        username: String,
        currentPassword: String,
        newPassword: String,
    ): Either<AuthError, Unit> = either {
        val user = repository.findByUsername(username) ?: raise(AuthError.WrongCurrentPassword)
        if (!verifyPassword(currentPassword, user.passwordHash)) raise(AuthError.WrongCurrentPassword)
        val newHash = hashPassword(newPassword)
        repository.save(user.copy(passwordHash = newHash))
    }

    // One page of regular users, sorted by username ascending (Story 9.2).
    //
    // THE SERVER IS AUTHORITATIVE for ordering, clamping and page location, and
    // the clamping is a business rule — so it lives here rather than in the
    // resolver. Nothing below can fail on a hostile argument: `limit` is coerced
    // into 1..100, `offset` into 0..lastPage, and the page actually served is
    // returned for the client to adopt.
    //
    // `around` LOCATES a page instead of requesting one: the page index is
    // derived from the count of usernames sorting before the target, so the
    // caller can jump to a just-created row without walking pages. It ignores
    // `offset`, and it is deliberately not an error for a name that does not
    // exist — the count answers "where that name belongs" either way, and a
    // NOT_FOUND here would turn a benign refresh after a concurrent delete into
    // a failure the client could not usefully handle.
    //
    // The `admin` account is config-based and has no row in this collection, so
    // "regular users only" needs no role filter.
    suspend fun getUserPage(limit: Int, offset: Int?, around: String?): UserPage {
        val pageSize = limit.coerceIn(MIN_PAGE_SIZE, MAX_PAGE_SIZE)
        val totalCount = repository.countAll()
        // The offset of the final page. Zero for an empty table, so the clamp
        // below collapses to 0 and the caller gets an empty page, never a
        // negative skip.
        val lastPageOffset = if (totalCount == 0) 0 else ((totalCount - 1) / pageSize) * pageSize

        val servedOffset = if (around != null) {
            val before = repository.countUsernamesBefore(around)
            ((before / pageSize) * pageSize).coerceIn(0, lastPageOffset)
        } else {
            (offset ?: 0).coerceIn(0, lastPageOffset)
        }

        return UserPage(
            users = repository.findPage(pageSize, servedOffset),
            totalCount = totalCount,
            offset = servedOffset,
        )
    }

    suspend fun adminCreateUser(username: String, password: String): Either<RegistrationError, User> =
        either {
            if (username == adminLogin) raise(RegistrationError.InvalidCredentials)
            val hash = hashPassword(password)
            val user = User(username = username, passwordHash = hash, role = "user")
            try {
                repository.save(user)
            } catch (e: MongoWriteException) {
                if (e.error.code == 11000) raise(RegistrationError.InvalidCredentials)
                throw e
            }
            user
        }

    suspend fun adminDeleteUser(id: UUID): Either<AdminError, User> = either {
        val user = repository.findById(id) ?: raise(AdminError.NotFound)
        if (!repository.deleteById(id)) raise(AdminError.NotFound)
        user
    }

    suspend fun adminResetPassword(id: UUID, newPassword: String): Either<AdminError, User> = either {
        val user = repository.findById(id) ?: raise(AdminError.NotFound)
        val newHash = hashPassword(newPassword)
        val updated = user.copy(passwordHash = newHash)
        repository.save(updated)
        updated
    }

    internal suspend fun verifyPassword(plaintext: String, hash: String): Boolean =
        withContext(Dispatchers.IO) {
            BCrypt.verifyer().verify(plaintext.toCharArray(), hash).verified
        }

    private suspend fun hashPassword(password: String): String =
        withContext(Dispatchers.IO) {
            BCrypt.withDefaults().hashToString(12, password.toCharArray())
        }
}
