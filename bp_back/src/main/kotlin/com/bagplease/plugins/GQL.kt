@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.gql.GqlDefinition
import com.expediagroup.graphql.generator.extensions.plus
import com.expediagroup.graphql.server.ktor.*
import graphql.GraphQLContext
import io.ktor.serialization.jackson.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import java.time.Duration

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
        pingPeriod = Duration.ofSeconds(10)
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
        super.generateContext(request).plus(
            mapOf(GQL_CALL_PRINCIPAL to request.call.principal<JWTPrincipal>())
        )
}