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
        Unit
    }

    suspend fun getAllRegularUsers(): List<User> = repository.getAll()

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
