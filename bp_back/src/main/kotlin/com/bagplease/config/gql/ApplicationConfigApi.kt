package com.bagplease.config.gql

import com.bagplease.config.ApplicationConfig
import com.bagplease.config.ApplicationConfigService
import com.bagplease.plugins.requireAdmin
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment

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
