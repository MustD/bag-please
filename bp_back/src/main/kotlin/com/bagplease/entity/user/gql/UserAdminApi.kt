package com.bagplease.entity.user.gql

import com.bagplease.entity.user.UserService
import com.bagplease.features.auth.AuthService
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLConflictException
import com.bagplease.plugins.GraphQLForbiddenException
import com.bagplease.plugins.GraphQLInvalidInputException
import com.bagplease.plugins.GraphQLNotFoundException
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal
import java.util.*

private fun DataFetchingEnvironment.requireAdmin() {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw GraphQLForbiddenException("Forbidden")
    val role = principal.payload.getClaim("role").asString() ?: ""
    if (role != "admin") throw GraphQLForbiddenException("Forbidden")
}

@Suppress("unused")
class UserAdminQueries(
    private val userService: UserService,
) : Query {
    suspend fun users(env: DataFetchingEnvironment): List<GqlUser> {
        env.requireAdmin()
        return userService.getAllRegularUsers().map(GqlUserMapper::toGql)
    }
}

@Suppress("unused")
class UserAdminMutations(
    private val userService: UserService,
    private val authService: AuthService,
) : Mutation {
    suspend fun createUser(username: String, password: String, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        return userService.adminCreateUser(username, password).fold(
            ifLeft = { throw GraphQLConflictException("Username already taken") },
            ifRight = { GqlUserMapper.toGql(it) },
        )
    }

    suspend fun deleteUser(id: ID, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        val uuid = try {
            UUID.fromString(id.value)
        } catch (e: IllegalArgumentException) {
            throw GraphQLInvalidInputException("Invalid user ID format")
        }
        return userService.adminDeleteUser(uuid).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { user ->
                authService.invalidateUserSessions(user.username)
                GqlUserMapper.toGql(user)
            },
        )
    }

    suspend fun resetUserPassword(id: ID, newPassword: String, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        val uuid = try {
            UUID.fromString(id.value)
        } catch (e: IllegalArgumentException) {
            throw GraphQLInvalidInputException("Invalid user ID format")
        }
        return userService.adminResetPassword(uuid, newPassword).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { user ->
                authService.invalidateUserSessions(user.username)
                GqlUserMapper.toGql(user)
            },
        )
    }
}
