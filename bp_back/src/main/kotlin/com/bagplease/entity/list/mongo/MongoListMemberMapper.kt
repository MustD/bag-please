package com.bagplease.entity.list.mongo

import com.bagplease.entity.list.ListMember
import com.bagplease.entity.list.MemberStatus
import java.util.UUID

object MongoListMemberMapper {

    fun mapFromMongo(mongo: MongoListMember): ListMember = ListMember(
        listId = UUID.fromString(mongo.listId),
        userId = UUID.fromString(mongo.userId),
        username = mongo.username,
        status = MemberStatus.valueOf(mongo.status),
        createdAt = mongo.createdAt,
    )
}
