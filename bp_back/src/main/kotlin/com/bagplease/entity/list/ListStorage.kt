package com.bagplease.entity.list

import com.bagplease.entity.list.mongo.ListRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Suppress("RedundantSuspendModifier")
class ListStorage(
    private val repository: ListRepository,
) {
    private val storage: ConcurrentHashMap<UUID, List> = ConcurrentHashMap()
    private var synced = false

    suspend fun sync() {
        if (synced.not()) {
            repository.getAll().forEach {
                storage[it.id] = it
            }
            synced = true
        }
    }

    suspend fun save(list: List): List {
        sync()
        storage[list.id] = list
        repository.save(list)
        return list
    }

    suspend fun getAll(): kotlin.collections.List<List> {
        sync()
        return storage.values.toList()
    }

    suspend fun getById(id: UUID): List? {
        sync()
        return storage[id]
    }

    suspend fun delete(id: UUID): List {
        sync()
        val list = storage.remove(id) ?: throw IllegalStateException("List not found")
        repository.delete(id)
        return list
    }

    suspend fun getByMemberUsername(username: String): kotlin.collections.List<List> {
        sync()
        return storage.values.filter { it.memberUsernames.contains(username) }
    }

    fun getByIdCached(id: UUID): List? = storage[id]

    fun evictFromCache(id: UUID) {
        storage.remove(id)
    }
}
