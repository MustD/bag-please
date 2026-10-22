package com.bagplease.entity.user

import arrow.core.Either
import arrow.core.raise.either
import at.favre.lib.crypto.bcrypt.BCrypt
import com.bagplease.entity.list.ListService
import com.bagplease.entity.user.db.DuplicateUsernameException
import com.bagplease.entity.user.db.UserRepository
import com.bagplease.features.auth.db.RefreshTokenRepository
import com.bagplease.plugins.tx
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

/** The user removed by [UserService.deleteUser] and how many lists they owned (all destroyed with them). */
data class DeletedUser(val user: User, val ownedListCount: Int)

class UserService(
    private val repository: UserRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val listService: ListService,
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
            tx {
                try {
                    repository.insert(user)
                } catch (e: DuplicateUsernameException) {
                    raise(RegistrationError.InvalidCredentials)
                }
            }
            user
        }

    suspend fun login(username: String, password: String): Either<AuthError, LoginResult> = either {
        if (username == adminLogin) {
            if (password == adminPass) return@either LoginResult(username, "admin")
            else raise(AuthError.InvalidCredentials)
        }
        val user = tx { repository.findByUsername(username) } ?: raise(AuthError.InvalidCredentials)
        if (!verifyPassword(password, user.passwordHash)) raise(AuthError.InvalidCredentials)
        LoginResult(user.username, user.role)
    }

    suspend fun changePassword(
        username: String,
        currentPassword: String,
        newPassword: String,
    ): Either<AuthError, Unit> = either {
        // One transaction: the new hash and the session invalidation commit together or not at all.
        tx {
            val user = repository.findByUsername(username) ?: raise(AuthError.WrongCurrentPassword)
            if (!verifyPassword(currentPassword, user.passwordHash)) raise(AuthError.WrongCurrentPassword)
            val newHash = hashPassword(newPassword)
            repository.updatePasswordHash(user.id, newHash)
            refreshTokenRepository.deleteAllForUser(username)
        }
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
    suspend fun getUserPage(limit: Int, offset: Int?, around: String?): UserPage = tx {
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

        UserPage(
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
            tx {
                try {
                    repository.insert(user)
                } catch (e: DuplicateUsernameException) {
                    raise(RegistrationError.InvalidCredentials)
                }
            }
            user
        }

    // Story 11.2 (AD-7): the whole sequence is one PostgreSQL transaction. The row is locked FOR UPDATE, the lists
    // (Mongo until Story 11.4) are purged through ListService, the refresh tokens go, and the `users` row is deleted
    // LAST. Access tokens stay valid until expiry; only refresh tokens are dropped. Feedback is untouched (it has no FK).
    suspend fun deleteUser(id: UUID): Either<AdminError, DeletedUser> = either {
        tx {
            val user = repository.findByIdForUpdate(id) ?: raise(AdminError.NotFound)
            // Counted while the lists still exist: it is what the response reports as destroyed.
            val ownedListCount = listService.countOwnedLists(user.id)
            listService.purgeUser(user.id, user.username)
            refreshTokenRepository.deleteAllForUser(user.username)
            if (!repository.deleteById(user.id)) raise(AdminError.NotFound)
            DeletedUser(user, ownedListCount)
        }
    }

    suspend fun adminResetPassword(id: UUID, newPassword: String): Either<AdminError, User> = either {
        tx {
            val user = repository.findById(id) ?: raise(AdminError.NotFound)
            val newHash = hashPassword(newPassword)
            repository.updatePasswordHash(user.id, newHash)
            refreshTokenRepository.deleteAllForUser(user.username)
            user.copy(passwordHash = newHash)
        }
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
