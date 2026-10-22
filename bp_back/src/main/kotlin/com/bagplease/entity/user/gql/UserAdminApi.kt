package com.bagplease.entity.user.gql

import com.bagplease.entity.list.ListService
import com.bagplease.entity.user.UserService
import com.bagplease.plugins.GraphQLConflictException
import com.bagplease.plugins.GraphQLInvalidInputException
import com.bagplease.plugins.GraphQLNotFoundException
import com.bagplease.plugins.requireAdmin
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import java.util.*

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
        // One service call (Story 11.2): lock, purge the user's lists, drop their refresh tokens, delete the row last —
        // all in one PostgreSQL transaction. Access tokens stay valid until expiry.
        return userService.deleteUser(uuid).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { GqlUserMapper.toGql(it.user, it.ownedListCount) },
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
            // Sessions are dropped inside the service's transaction, together with the new hash.
            ifRight = { user ->
                GqlUserMapper.toGql(user, listService.countOwnedLists(user.id))
            },
        )
    }
}
