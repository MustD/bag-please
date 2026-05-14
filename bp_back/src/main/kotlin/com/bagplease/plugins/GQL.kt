@file:Suppress("unused")

package com.bagplease.plugins

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
import com.bagplease.mongo.MongoConnection
import com.expediagroup.graphql.server.ktor.DefaultKtorGraphQLContextFactory
import com.expediagroup.graphql.server.ktor.GraphQL
import com.expediagroup.graphql.server.ktor.graphQLPostRoute
import com.expediagroup.graphql.server.ktor.graphQLSDLRoute
import com.expediagroup.graphql.server.ktor.graphQLSubscriptionsRoute
import com.expediagroup.graphql.server.ktor.graphiQLRoute
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
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import kotlin.time.Duration.Companion.seconds

fun Application.configureGql() {

    val connection: MongoConnection by dependencies

    val itemRepository = ItemRepository(connection.db)
    val itemStorage = ItemStorage(itemRepository)
    val itemService = ItemService(itemStorage)


    val categoryRepository = CategoryRepository(connection.db)
    val categoryStorage = CategoryStorage(categoryRepository)
    val categoryService = CategoryService(categoryStorage)

    install(GraphQL) {
        schema {
            packages = listOf(
                "com.bagplease.entity.item.gql",
                "com.bagplease.entity.category.gql"
            )
            queries = listOf(
                ItemQueries(itemService),
                CategoryQueries(categoryService),
            )
            mutations = listOf(
                ItemMutations(itemService),
                CategoryMutations(categoryService)
            )
            subscriptions = listOf(
                ItemSubscriptions(itemService),
                CategorySubscriptions(categoryService)
            )
        }
        server {
            contextFactory = CustomGraphQLContextFactory()
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

class CustomGraphQLContextFactory : DefaultKtorGraphQLContextFactory() {
    /*
        // now we can use context auth  like below
        suspend fun getItems(env: DataFetchingEnvironment): List<GqlItem> {
            val principal = env.graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
            return service.getItems().map(GqlItemMapper::mapItemToGql)
        }

     */
    override suspend fun generateContext(request: ApplicationRequest): GraphQLContext {
        val ctx = super.generateContext(request)
        val principal = request.call.principal<JWTPrincipal>()
        if (principal != null) ctx.put(GQL_CALL_PRINCIPAL, principal)
        return ctx
    }
}
