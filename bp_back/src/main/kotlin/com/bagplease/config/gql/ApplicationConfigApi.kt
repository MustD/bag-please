package com.bagplease.config.gql

import com.bagplease.config.ApplicationConfig
import com.bagplease.config.ApplicationConfigService
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal

private fun DataFetchingEnvironment.requireAdmin() {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw GraphQLForbiddenException("Forbidden")
    val role = principal.payload.getClaim("role").asString() ?: ""
    if (role != "admin") throw GraphQLForbiddenException("Forbidden")
}

@Suppress("unused")
class ApplicationConfigQueries(private val service: ApplicationConfigService) : Query {
    suspend fun applicationConfig(env: DataFetchingEnvironment): GqlApplicationConfig {
        env.requireAdmin()
        return GqlApplicationConfigMapper.toGql(service.get())
    }
}

@Suppress("unused")
class ApplicationConfigMutations(private val service: ApplicationConfigService) : Mutation {
    suspend fun setRegistrationEnabled(enabled: Boolean, env: DataFetchingEnvironment): GqlApplicationConfig {
        env.requireAdmin()
        val updated = ApplicationConfig(registrationEnabled = enabled)
        service.update(updated)
        return GqlApplicationConfigMapper.toGql(updated)
    }
}
