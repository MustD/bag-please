package com.bagplease.config.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID

/** The singleton `app_config` table from `V1__baseline.sql`: at most one row, with a fixed id. */
object ApplicationConfigTable : Table("app_config") {
    val id = javaUUID("id")
    val registrationEnabled = bool("registration_enabled")

    override val primaryKey = PrimaryKey(id)
}
