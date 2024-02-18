@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.gql.GqlDefinition
import com.expediagroup.graphql.server.ktor.GraphQL
import com.expediagroup.graphql.server.ktor.graphQLPostRoute
import com.expediagroup.graphql.server.ktor.graphQLSDLRoute
import com.expediagroup.graphql.server.ktor.graphiQLRoute
import io.ktor.server.application.*
import io.ktor.server.routing.*

fun Application.configureGql() {
    install(GraphQL) {
        schema {
            packages = listOf("com.bagplease.gql")
            queries = GqlDefinition.queries
            mutations = GqlDefinition.mutations

        }
    }
    install(Routing) {
        graphQLPostRoute()
        graphQLSDLRoute()
        graphiQLRoute()
    }
}