package com.bagplease.config.db

import com.bagplease.config.ApplicationConfig
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.r2dbc.selectAll
import org.jetbrains.exposed.v1.r2dbc.upsert
import java.util.UUID

/** `app_config` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2). */
class ApplicationConfigRepository {
    private val configId = UUID.fromString("00000000-0000-0000-0000-000000000001")

    /** The stored config, or the defaults when no row exists. Never writes: reads must leave an empty database empty. */
    suspend fun load(): ApplicationConfig =
        ApplicationConfigTable.selectAll().where { ApplicationConfigTable.id eq configId }
            .map { ApplicationConfig(it[ApplicationConfigTable.registrationEnabled]) }
            .toList()
            .firstOrNull()
            ?: ApplicationConfig()

    /** The only writer: creates the singleton row or replaces its value. */
    suspend fun save(config: ApplicationConfig) {
        ApplicationConfigTable.upsert {
            it[id] = configId
            it[registrationEnabled] = config.registrationEnabled
        }
    }
}
