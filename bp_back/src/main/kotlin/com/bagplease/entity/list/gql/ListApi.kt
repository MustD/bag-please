package com.bagplease.entity.list.gql

import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.entity.list.mongo.ListMemberRepository
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal
import java.util.UUID

@Suppress("unused")
class ListQueries(
    private val service: ListService,
    private val listMemberRepository: ListMemberRepository,
    private val itemStorage: ItemStorage,
) : Query {

    suspend fun lists(env: DataFetchingEnvironment): GqlListsResult {
        val caller = env.caller()
        return service.getLists(caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { result ->
                val gqlLists = result.lists.map { list ->
                    val members = listMemberRepository.findActiveByListId(list.id)
                    val count = itemStorage.getByListId(list.id).count { !it.checked }
                    GqlListMapper.mapListToGql(list, members, count)
                }
                val gqlPending = result.pendingInvites.map { invite ->
                    GqlPendingInvite(
                        listId = ID(invite.listId.toString()),
                        listName = invite.listName,
                        listEmoji = invite.listEmoji,
                        ownerUsername = invite.ownerUsername,
                    )
                }
                GqlListsResult(lists = gqlLists, pendingInvites = gqlPending)
            },
        )
    }
}

@Suppress("unused")
class ListMutations(
    private val service: ListService,
    private val listMemberRepository: ListMemberRepository,
    private val itemStorage: ItemStorage,
) : Mutation {

    suspend fun createList(name: String, emoji: String? = null, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.createList(name, emoji, caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { list ->
                val members = listMemberRepository.findActiveByListId(list.id)
                val count = itemStorage.getByListId(list.id).count { !it.checked }
                GqlListMapper.mapListToGql(list, members, count)
            },
        )
    }

    suspend fun renameList(id: ID, name: String, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.renameList(UUID.fromString(id.value), name, caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { list ->
                val members = listMemberRepository.findActiveByListId(list.id)
                val count = itemStorage.getByListId(list.id).count { !it.checked }
                GqlListMapper.mapListToGql(list, members, count)
            },
        )
    }

    suspend fun deleteList(id: ID, env: DataFetchingEnvironment): GqlDeleteListResult {
        val caller = env.caller()
        return service.deleteList(UUID.fromString(id.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlDeleteListResult(it.deletedItemCount, it.deletedCategoryCount) },
        )
    }

    suspend fun shareList(listId: ID, username: String, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.shareList(UUID.fromString(listId.value), username, caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { list ->
                val members = listMemberRepository.findActiveByListId(list.id)
                val count = itemStorage.getByListId(list.id).count { !it.checked }
                GqlListMapper.mapListToGql(list, members, count)
            },
        )
    }

    suspend fun acceptInvite(listId: ID, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.acceptInvite(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { list ->
                val members = listMemberRepository.findActiveByListId(list.id)
                val count = itemStorage.getByListId(list.id).count { !it.checked }
                GqlListMapper.mapListToGql(list, members, count)
            },
        )
    }

    suspend fun rejectInvite(listId: ID, env: DataFetchingEnvironment): Boolean {
        val caller = env.caller()
        return service.rejectInvite(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it },
        )
    }

    suspend fun removeMember(listId: ID, username: String, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.removeMember(UUID.fromString(listId.value), username, caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { list ->
                val members = listMemberRepository.findActiveByListId(list.id)
                val count = itemStorage.getByListId(list.id).count { !it.checked }
                GqlListMapper.mapListToGql(list, members, count)
            },
        )
    }

    suspend fun leaveList(listId: ID, env: DataFetchingEnvironment): Boolean {
        val caller = env.caller()
        return service.leaveList(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it },
        )
    }
}

private fun DataFetchingEnvironment.caller(): CallerUsername {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw IllegalStateException("Unauthenticated")
    return CallerUsername(principal.payload.getClaim("username").asString())
}

internal fun ListAuthError.toException(): GraphQLForbiddenException = when (this) {
    is ListAuthError.AdminBlocked -> GraphQLForbiddenException("Admin cannot access list resources")
    is ListAuthError.NotMember -> GraphQLForbiddenException("Access denied: not a list member")
    is ListAuthError.NotOwner -> GraphQLForbiddenException("Access denied: only the list owner can perform this action")
    is ListAuthError.UserNotFound -> GraphQLForbiddenException("User '${this.username}' not found")
    is ListAuthError.AlreadyMember -> GraphQLForbiddenException("User '${this.username}' is already a member")
    is ListAuthError.AlreadyPending -> GraphQLForbiddenException("User '${this.username}' already has a pending invite")
    is ListAuthError.SelfShare -> GraphQLForbiddenException("You cannot share a list with yourself")
    is ListAuthError.CannotRemoveOwner -> GraphQLForbiddenException("List owner cannot be removed — delete the list instead")
    is ListAuthError.CannotLeaveAsOwner -> GraphQLForbiddenException("List owner cannot leave — delete the list instead")
    is ListAuthError.NotPendingInvite -> GraphQLForbiddenException("No pending invite found for this list")
    is ListAuthError.CallerNotFound -> GraphQLForbiddenException("Authenticated user record not found")
}
