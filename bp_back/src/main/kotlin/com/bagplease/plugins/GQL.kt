@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.config.ApplicationConfigService
import com.bagplease.config.gql.ApplicationConfigMutations
import com.bagplease.config.gql.ApplicationConfigQueries
import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.gql.CategoryMutations
import com.bagplease.entity.category.gql.CategoryQueries
import com.bagplease.entity.category.gql.CategorySubscriptions
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.item.gql.ItemMutations
import com.bagplease.entity.item.gql.ItemQueries
import com.bagplease.entity.item.gql.ItemSubscriptions
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.ListService
import com.bagplease.entity.list.ListStorage
import com.bagplease.entity.list.gql.ListMutations
import com.bagplease.entity.list.gql.ListQueries
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.UserService
import com.bagplease.entity.user.gql.UserAdminMutations
import com.bagplease.entity.user.gql.UserAdminQueries
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.features.auth.AuthService
import com.bagplease.mongo.MongoConnection
import com.expediagroup.graphql.generator.extensions.toGraphQLContext
import com.expediagroup.graphql.server.ktor.DefaultKtorGraphQLContextFactory
import com.expediagroup.graphql.server.ktor.GraphQL
import com.expediagroup.graphql.server.ktor.graphQLPostRoute
import com.expediagroup.graphql.server.ktor.graphQLSDLRoute
import com.expediagroup.graphql.server.ktor.graphQLSubscriptionsRoute
import com.expediagroup.graphql.server.ktor.graphiQLRoute
import com.expediagroup.graphql.server.ktor.subscriptions.KtorGraphQLSubscriptionContextFactory
import graphql.GraphQLContext
import io.ktor.serialization.jackson.JacksonWebsocketContentConverter
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.principal
import io.ktor.server.plugins.di.dependencies
import io.ktor.server.request.ApplicationRequest
import io.ktor.server.routing.Routing
import io.ktor.server.websocket.WebSocketServerSession
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.websocket.CloseReason
import io.ktor.websocket.close
import kotlin.time.Duration.Companion.seconds

fun Application.configureGql(
    appConfigService: ApplicationConfigService,
    adminLogin: String,
    authService: AuthService,
    userService: UserService,
    userRepository: UserRepository,
) {

    val connection: MongoConnection by dependencies

    val itemRepository = ItemRepository(connection.db)
    val categoryRepository = CategoryRepository(connection.db)
    val listRepository = ListRepository(connection.db)

    val itemStorage = ItemStorage(itemRepository)
    val categoryStorage = CategoryStorage(categoryRepository)
    val listStorage = ListStorage(listRepository)

    val listService = ListService(
        listStorage = listStorage,
        listRepository = listRepository,
        userRepository = userRepository,
        itemRepository = itemRepository,
        categoryRepository = categoryRepository,
        itemStorage = itemStorage,
        categoryStorage = categoryStorage,
        adminLogin = adminLogin,
    )

    val itemService = ItemService(itemStorage, listService)
    val categoryService = CategoryService(categoryStorage, listService)

    install(GraphQL) {
        schema {
            packages = listOf(
                "com.bagplease.entity.item.gql",
                "com.bagplease.entity.category.gql",
                "com.bagplease.entity.list.gql",
                "com.bagplease.config.gql",
                "com.bagplease.entity.user.gql",
            )
            queries = listOf(
                ItemQueries(itemService),
                CategoryQueries(categoryService),
                ListQueries(listService),
                ApplicationConfigQueries(appConfigService),
                UserAdminQueries(userService),
            )
            mutations = listOf(
                ItemMutations(itemService),
                CategoryMutations(categoryService),
                ListMutations(listService),
                ApplicationConfigMutations(appConfigService),
                UserAdminMutations(userService, authService),
            )
            subscriptions = listOf(
                ItemSubscriptions(itemService, listService),
                CategorySubscriptions(categoryService, listService)
            )
        }
        server {
            contextFactory = CustomGraphQLContextFactory(authService)
            subscriptions {
                contextFactory = WsGraphQLContextFactory(authService)
            }
        }
    }

    install(WebSockets) {
        pingPeriod = 10.seconds
        contentConverter = JacksonWebsocketContentConverter()
    }

}

fun Routing.gqlRoutes() {
    authenticate(authMethod) {
        graphQLPostRoute()
        graphQLSDLRoute()
        graphiQLRoute()
    }
    graphQLSubscriptionsRoute()

}

const val GQL_CALL_PRINCIPAL = "callPrincipal"

class CustomGraphQLContextFactory(
    private val authService: AuthService,
) : DefaultKtorGraphQLContextFactory() {
    override suspend fun generateContext(request: ApplicationRequest): GraphQLContext {
        val ctx = super.generateContext(request)
        val principal = request.call.principal<JWTPrincipal>()
        if (principal != null) ctx.put(GQL_CALL_PRINCIPAL, principal)
        return ctx
    }
}

class WsGraphQLContextFactory(
    private val authService: AuthService,
) : KtorGraphQLSubscriptionContextFactory {
    override suspend fun generateContext(session: WebSocketServerSession, params: Any?): GraphQLContext {
        val payload = params as? Map<*, *>
        val authHeader = payload?.get("Authorization") as? String
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            session.close(CloseReason(4401.toShort(), "Unauthorized"))
            error("Unauthorized")
        }
        val token = authHeader.removePrefix("Bearer ")
        val principal = authService.verifyAccessToken(token)
        if (principal == null) {
            session.close(CloseReason(4401.toShort(), "Unauthorized"))
            error("Unauthorized")
        }
        return mapOf<Any, Any>(GQL_CALL_PRINCIPAL to principal).toGraphQLContext()
    }
}
