package com.bagplease.entity.list.gql

import com.bagplease.entity.list.List
import com.bagplease.entity.list.ListMember
import com.expediagroup.graphql.generator.scalars.ID

object GqlListMapper {

    fun mapListToGql(list: List, members: kotlin.collections.List<ListMember>, uncheckedItemCount: Int = 0): GqlList {
        return GqlList(
            id = ID(list.id.toString()),
            name = list.name,
            emoji = list.emoji,
            ownerId = list.ownerId.toString(),
            ownerUsername = list.ownerUsername,
            members = members
                .filter { it.status != "DECLINED" }
                .map { GqlListMember(userId = it.userId.toString(), username = it.username, status = it.status) },
            createdAt = list.createdAt.toString(),
            uncheckedItemCount = uncheckedItemCount,
        )
    }
}
