package com.bagplease.entity.user

import arrow.core.Either
import arrow.core.raise.either
import at.favre.lib.crypto.bcrypt.BCrypt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

sealed class RegistrationError {
    data object InvalidCredentials : RegistrationError()
}

sealed class AuthError {
    data object InvalidCredentials : AuthError()
    data object WrongCurrentPassword : AuthError()
}

data class LoginResult(val username: String, val role: String)

class UserService(
    private val storage: UserStorage,
    private val adminLogin: String,
    private val adminPass: String,
) {
    // Serialises the duplicate-check + save to close the TOCTOU window: two concurrent requests
    // for the same username must not both pass findByUsername before either write lands
    private val registrationMutex = Mutex()

    suspend fun register(username: String, password: String): Either<RegistrationError, User> =
        registrationMutex.withLock {
            either {
                if (username == adminLogin) raise(RegistrationError.InvalidCredentials)
                if (storage.findByUsername(username) != null) raise(RegistrationError.InvalidCredentials)
                val hash = hashPassword(password)
                val user = User(username = username, passwordHash = hash, role = "user")
                storage.save(user)
            }
        }

    suspend fun login(username: String, password: String): Either<AuthError, LoginResult> = either {
        if (username == adminLogin) {
            if (password == adminPass) return@either LoginResult(username, "admin")
            else raise(AuthError.InvalidCredentials)
        }
        val user = storage.findByUsername(username) ?: raise(AuthError.InvalidCredentials)
        if (!verifyPassword(password, user.passwordHash)) raise(AuthError.InvalidCredentials)
        LoginResult(user.username, user.role)
    }

    suspend fun changePassword(
        username: String,
        currentPassword: String,
        newPassword: String,
    ): Either<AuthError, Unit> = either {
        val user = storage.findByUsername(username) ?: raise(AuthError.WrongCurrentPassword)
        if (!verifyPassword(currentPassword, user.passwordHash)) raise(AuthError.WrongCurrentPassword)
        val newHash = hashPassword(newPassword)
        storage.save(user.copy(passwordHash = newHash))
        Unit
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
