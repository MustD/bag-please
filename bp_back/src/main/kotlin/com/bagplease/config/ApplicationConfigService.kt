package com.bagplease.config

import com.bagplease.config.db.ApplicationConfigRepository
import com.bagplease.plugins.tx

class ApplicationConfigService(private val repository: ApplicationConfigRepository) {

    suspend fun get(): ApplicationConfig = tx { repository.load() }

    suspend fun update(config: ApplicationConfig) {
        tx { repository.save(config) }
    }
}
