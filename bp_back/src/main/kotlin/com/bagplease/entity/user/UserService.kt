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

class UserService(
    private val storage: UserStorage,
    private val adminLogin: String,
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

    private suspend fun hashPassword(password: String): String =
        withContext(Dispatchers.IO) {
            BCrypt.withDefaults().hashToString(12, password.toCharArray())
        }
}
