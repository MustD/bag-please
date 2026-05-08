package com.bagplease.entity.user

import com.bagplease.entity.user.mongo.UserRepository
import java.util.*
import java.util.concurrent.ConcurrentHashMap

@Suppress("RedundantSuspendModifier")
class UserStorage(private val repository: UserRepository) {
    private val byId = ConcurrentHashMap<UUID, User>()
    private val byUsername = ConcurrentHashMap<String, UUID>()

    // @Volatile ensures the write is immediately visible across all coroutine threads; without it
    // the JVM may cache synced=true per-thread and a second thread re-runs the full sync on startup
    @Volatile
    private var synced = false

    private suspend fun sync() {
        if (!synced) {
            repository.getAll().forEach {
                byId[it.id] = it
                byUsername[it.username] = it.id
            }
            synced = true
        }
    }

    suspend fun save(user: User): User {
        sync()
        byId[user.id] = user
        byUsername[user.username] = user.id
        repository.save(user)
        return user
    }

    suspend fun findByUsername(username: String): User? {
        sync()
        return byUsername[username]?.let { byId[it] }
    }

    suspend fun getAll(): List<User> {
        sync()
        return byId.values.toList()
    }
}
