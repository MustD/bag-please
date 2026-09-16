package com.bagplease.entity.user.gql

import com.bagplease.entity.user.User
import com.bagplease.entity.user.UserPage
import com.expediagroup.graphql.generator.scalars.ID

object GqlUserMapper {
    fun toGql(user: User) = GqlUser(
        id = ID(user.id.toString()),
        username = user.username,
        role = user.role,
    )

    fun toGql(page: UserPage) = GqlUserPage(
        users = page.users.map(::toGql),
        totalCount = page.totalCount,
        offset = page.offset,
    )
}
