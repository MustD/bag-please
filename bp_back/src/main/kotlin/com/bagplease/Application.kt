package com.bagplease

import com.bagplease.config.ApplicationConfigService
import com.bagplease.config.db.ApplicationConfigRepository
import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.category.db.CategoryRepository
import com.bagplease.entity.item.db.ItemRepository
import com.bagplease.entity.list.db.ListRepository
import com.bagplease.entity.user.UserService
import com.bagplease.entity.list.ListService
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.user.UserLookup
import com.bagplease.entity.user.db.UserRepository
import com.bagplease.features.auth.AuthService
import com.bagplease.features.auth.db.RefreshTokenRepository
import com.bagplease.features.auth.configureAuthRoutes
import com.bagplease.plugins.configureCors
import com.bagplease.plugins.configureDatabase
import com.bagplease.plugins.configureForwardedHeaders
import com.bagplease.plugins.configureGql
import com.bagplease.plugins.configureMonitoring
import com.bagplease.plugins.configureRateLimiting
import com.bagplease.plugins.configureRouting
import com.bagplease.plugins.configureSecurity
import io.ktor.server.application.Application

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    val config = environment.config
    val adminLogin = config.property("jwt.admin_login").getString()
    val adminPass = config.property("jwt.admin_pass").getString()

    // Repositories take no connection: they run inside a service's `tx {}` (configureDatabase() below
    // opens the pool before any service method is called).
    val userRepository = UserRepository()
    val refreshTokenRepository = RefreshTokenRepository()
    val userLookup = UserLookup(userRepository)

    // ItemService verifies membership through ListService, ListService counts items through ItemService and cascades
    // into CategoryService, and CategoryService cascades into ItemService: the cycle is cut with lazy references.
    lateinit var itemService: ItemService
    lateinit var categoryService: CategoryService
    val listService = ListService(
        repository = ListRepository(),
        userLookup = userLookup,
        itemService = lazy { itemService },
        categoryService = lazy { categoryService },
        adminLogin = adminLogin,
    )
    itemService = ItemService(listService, ItemRepository(), lazy { categoryService })
    categoryService = CategoryService(CategoryRepository(), listService, itemService)
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

    val appConfigRepository = ApplicationConfigRepository()
    val appConfigService = ApplicationConfigService(appConfigRepository)

    configureCors()
    configureMonitoring()
    configureForwardedHeaders()
    configureRateLimiting()
    configureSecurity()

    // Flyway + the R2DBC pool, before GQL (AD-5).
    configureDatabase()

    configureAuthRoutes(appConfigService, adminLogin, authService, userService)
    configureGql(
        appConfigService = appConfigService,
        adminLogin = adminLogin,
        authService = authService,
        userService = userService,
        listService = listService,
        itemService = itemService,
        categoryService = categoryService,
    )
    configureRouting()
}
