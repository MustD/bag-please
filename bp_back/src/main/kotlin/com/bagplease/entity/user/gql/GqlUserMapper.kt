package com.bagplease.entity.user.gql

import com.bagplease.entity.user.User
import com.bagplease.entity.user.UserPage
import com.expediagroup.graphql.generator.scalars.ID
import java.util.UUID

object GqlUserMapper {
    // `ownedListCount` is a REQUIRED parameter, deliberately: a default of 0 would
    // let a future call site report "no lists will be deleted" about a user who
    // owns five, and the delete confirmation is built on this number.
    fun toGql(user: User, ownedListCount: Int) = GqlUser(
        id = ID(user.id.toString()),
        username = user.username,
        role = user.role,
        ownedListCount = ownedListCount,
    )

    // `getValue` and not `[id] ?: 0`: `ListService.countOwnedLists(userIds)` answers for every id it is asked
    // about, so a miss means the caller built the map from the wrong ids — and reporting that user as owning
    // nothing is the exact silent zero the required parameter above exists to prevent. Fail loudly instead.
    fun toGql(page: UserPage, ownedListCounts: Map<UUID, Int>) = GqlUserPage(
        users = page.users.map { toGql(it, ownedListCounts.getValue(it.id)) },
        totalCount = page.totalCount,
        offset = page.offset,
    )
}
