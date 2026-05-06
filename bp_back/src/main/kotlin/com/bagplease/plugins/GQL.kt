@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.gql.GqlDefinition
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
import io.ktor.server.request.ApplicationRequest
import io.ktor.server.routing.Routing
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import kotlin.time.Duration.Companion.seconds

fun Application.configureGql() {

    install(GraphQL) {
        schema {
            packages = listOf("com.bagplease.gql")
            queries = GqlDefinition.queries
            mutations = GqlDefinition.mutations
            subscriptions = GqlDefinition.subscriptions
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
    override suspend fun generateContext(request: ApplicationRequest): GraphQLContext =
        super.generateContext(request)
//            .plus(mapOf(GQL_CALL_PRINCIPAL to request.call.principal<JWTPrincipal>()))
}
