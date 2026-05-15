package com.bagplease.config.gql

import com.bagplease.config.ApplicationConfig

object GqlApplicationConfigMapper {
    fun toGql(config: ApplicationConfig) = GqlApplicationConfig(config.registrationEnabled)
}
