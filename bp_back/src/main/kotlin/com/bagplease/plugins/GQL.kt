@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.gql.GqlDefinition
import com.expediagroup.graphql.server.ktor.*
import io.ktor.serialization.jackson.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
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
    }

    install(WebSockets) {
        pingPeriod = Duration.ofSeconds(10)
        contentConverter = JacksonWebsocketContentConverter()
    }

}

fun Routing.gqlRoutes() {
    authenticate(authMethod, optional = true) {
        graphQLPostRoute()
        graphQLSDLRoute()
        graphiQLRoute()
        graphQLSubscriptionsRoute()
    }
}