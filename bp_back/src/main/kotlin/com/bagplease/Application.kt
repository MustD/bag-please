package com.bagplease

import com.bagplease.config.ApplicationConfigService
import com.bagplease.config.mongo.ApplicationConfigRepository
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.UserService
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.list.ListService
import com.bagplease.entity.list.ListStorage
import com.bagplease.entity.list.mongo.ListMemberRepository
import com.bagplease.entity.user.UserLookup
import com.bagplease.entity.user.db.UserRepository
import com.bagplease.features.auth.AuthService
import com.bagplease.features.auth.db.RefreshTokenRepository
import com.bagplease.features.auth.configureAuthRoutes
import com.bagplease.mongo.MongoConnection
import com.bagplease.plugins.configureCors
import com.bagplease.plugins.configureDatabase
import com.bagplease.plugins.configureForwardedHeaders
import com.bagplease.plugins.configureGql
import com.bagplease.plugins.configureMigration
import com.bagplease.plugins.configureMonitoring
import com.bagplease.plugins.configureRateLimiting
import com.bagplease.plugins.configureRouting
import com.bagplease.plugins.configureSecurity
import io.ktor.server.application.Application
import io.ktor.server.plugins.di.dependencies

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    val config = environment.config
    dependencies {
        provide { MongoConnection(config) }
    }

    val connection: MongoConnection by dependencies
    val adminLogin = config.property("jwt.admin_login").getString()
    val adminPass = config.property("jwt.admin_pass").getString()

    // PostgreSQL repositories take no connection: they run inside a service's `tx {}` (configureDatabase() below
    // opens the pool before any service method is called). The Mongo slices are still built here because
    // UserService.deleteUser purges the user's lists through ListService.
    val userRepository = UserRepository()
    val refreshTokenRepository = RefreshTokenRepository()
    val userLookup = UserLookup(userRepository)

    val itemRepository = ItemRepository(connection.db)
    val categoryRepository = CategoryRepository(connection.db)
    val listRepository = ListRepository(connection.db)
    val listMemberRepository = ListMemberRepository(connection.db)
    val itemStorage = ItemStorage(itemRepository)
    val categoryStorage = CategoryStorage(categoryRepository)
    val listStorage = ListStorage(listRepository)
    val listService = ListService(
        listStorage = listStorage,
        listRepository = listRepository,
        userLookup = userLookup,
        itemRepository = itemRepository,
        categoryRepository = categoryRepository,
        itemStorage = itemStorage,
        categoryStorage = categoryStorage,
        adminLogin = adminLogin,
        listMemberRepository = listMemberRepository,
    )
    val userService = UserService(userRepository, refreshTokenRepository, listService, adminLogin, adminPass)

    val secret = config.property("jwt.secret").getString()
    val issuer = config.property("jwt.issuer").getString()
    val audience = config.property("jwt.audience").getString()
    val accessExpiryMinutes = config.property("jwt.accessExpiryMinutes").getString().toLong()
    val refreshExpiryDays = config.property("jwt.refreshExpiryDays").getString().toLong()
    val authService = AuthService(
        userService,
        refreshTokenRepository,
        secret,
        issuer,
        audience,
        accessExpiryMinutes,
        refreshExpiryDays
    )

    val appConfigRepository = ApplicationConfigRepository(connection.db)
    val appConfigService = ApplicationConfigService(appConfigRepository)

    val migrationTargetUser = config.propertyOrNull("migration.targetUser")?.getString() ?: ""

    configureCors()
    configureMonitoring()
    configureForwardedHeaders()
    configureRateLimiting()
    configureSecurity()

    // Flyway + the R2DBC pool, before GQL (AD-5). Users and refresh tokens live in PostgreSQL (Story 11.2).
    configureDatabase()

    configureMigration(
        db = connection.db,
        userLookup = userLookup,
        itemRepository = itemRepository,
        categoryRepository = categoryRepository,
        listRepository = listRepository,
        migrationTargetUsername = migrationTargetUser,
    )

    configureAuthRoutes(appConfigService, adminLogin, authService, userService)
    configureGql(
        appConfigService = appConfigService,
        adminLogin = adminLogin,
        authService = authService,
        userService = userService,
        listService = listService,
        listMemberRepository = listMemberRepository,
        itemRepository = itemRepository,
        itemStorage = itemStorage,
        categoryStorage = categoryStorage,
    )
    configureRouting()
}
