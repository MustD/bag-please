package com.bagplease.entity.list.gql

import com.bagplease.entity.list.ListView
import com.expediagroup.graphql.generator.scalars.ID

object GqlListMapper {

    // `view.members` is already PENDING + ACCEPTED, owner excluded, oldest first (ListService composes it).
    fun mapListToGql(view: ListView): GqlList {
        val list = view.list
        return GqlList(
            id = ID(list.id.toString()),
            name = list.name,
            emoji = list.emoji,
            ownerId = list.ownerId.toString(),
            ownerUsername = list.ownerUsername,
            members = view.members
                .map { GqlListMember(userId = it.userId.toString(), username = it.username, status = it.status.name) },
            createdAt = list.createdAt.toString(),
            uncheckedItemCount = view.uncheckedItemCount,
        )
    }
}
