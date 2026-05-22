package com.bagplease.entity.list.gql

import com.bagplease.entity.list.List
import com.expediagroup.graphql.generator.scalars.ID

object GqlListMapper {

    fun mapListToGql(list: List): GqlList {
        return GqlList(
            id = ID(list.id.toString()),
            name = list.name,
            emoji = list.emoji,
            ownerId = list.ownerId.toString(),
        )
    }
}
