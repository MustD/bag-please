package com.bagplease.entity.user.gql

import com.bagplease.entity.list.ListService
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
    private val listService: ListService,
) : Query {
    // Server-paged user list (Story 9.2). Replaces the unpaginated `users` field,
    // which rendered every row in the database and degraded as accounts
    // accumulated.
    //
    // The admin gate is unchanged and stays the FIRST statement. Ordering,
    // clamping and page location are all the service's: this resolver passes the
    // arguments through and maps the result.
    suspend fun users(
        env: DataFetchingEnvironment,
        limit: Int,
        offset: Int? = null,
        around: String? = null,
    ): GqlUserPage {
        env.requireAdmin()
        val page = userService.getUserPage(limit, offset, around)
        // Owned-list counts are joined here, off the in-memory list cache: one
        // scan for the whole page, not 20 Mongo round-trips, and `getUserPage`
        // stays list-agnostic (Story 9.4).
        val counts = listService.countOwnedLists(page.users.map { it.id })
        return GqlUserMapper.toGql(page, counts)
    }
}

@Suppress("unused")
class UserAdminMutations(
    private val userService: UserService,
    private val authService: AuthService,
    private val listService: ListService,
) : Mutation {
    suspend fun createUser(username: String, password: String, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        return userService.adminCreateUser(username, password).fold(
            ifLeft = { throw GraphQLConflictException("Username already taken") },
            // A just-created account owns nothing yet.
            ifRight = { GqlUserMapper.toGql(it, 0) },
        )
    }

    suspend fun deleteUser(id: ID, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        val uuid = try {
            UUID.fromString(id.value)
        } catch (e: IllegalArgumentException) {
            throw GraphQLInvalidInputException("Invalid user ID format")
        }
        // Counted BEFORE the delete, while the lists still exist: it is what the
        // response reports back as destroyed.
        val ownedListCount = listService.countOwnedLists(uuid)
        return userService.adminDeleteUser(uuid).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { user ->
                // The ordered three-step sequence (AR-E9-8), and the order is
                // load-bearing:
                //   1. the user row is already gone above, so a createList or
                //      acceptInvite racing step 2 on a still-valid ACCESS token
                //      resolves no caller and is refused (CallerNotFound) instead
                //      of re-creating the membership the purge just removed;
                //   2. the list purge removes every membership row, strips the
                //      user from lists they did not own and cascades the ones
                //      they did;
                //   3. session invalidation drops refresh tokens only — access
                //      tokens stay valid until expiry, which is exactly why 1
                //      precedes 2.
                // `finally`, so a purge that throws still cannot leave the deleted user's refresh tokens live —
                // and the exception still propagates, because a half-done purge must not report success.
                try {
                    listService.purgeUser(user.id, user.username)
                } finally {
                    authService.invalidateUserSessions(user.username)
                }
                GqlUserMapper.toGql(user, ownedListCount)
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
                GqlUserMapper.toGql(user, listService.countOwnedLists(user.id))
            },
        )
    }
}
