package com.bagplease.config

import com.bagplease.config.mongo.ApplicationConfigRepository
import java.util.concurrent.atomic.AtomicReference

class ApplicationConfigService(private val repository: ApplicationConfigRepository) {
    private val cache = AtomicReference<ApplicationConfig?>(null)

    suspend fun get(): ApplicationConfig =
        cache.get() ?: repository.load().also { cache.set(it) }

    suspend fun update(config: ApplicationConfig) {
        repository.save(config)
        cache.set(config)
    }
}
