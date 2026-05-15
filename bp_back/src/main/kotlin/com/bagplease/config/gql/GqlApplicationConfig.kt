package com.bagplease.config.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("ApplicationConfig")
data class GqlApplicationConfig(val registrationEnabled: Boolean)
