package com.bagplease.entity.list.mongo

import com.bagplease.entity.list.ListMember
import java.util.UUID

object MongoListMemberMapper {

    fun mapFromMongo(mongo: MongoListMember): ListMember = ListMember(
        listId = UUID.fromString(mongo.listId),
        userId = UUID.fromString(mongo.userId),
        username = mongo.username,
        status = mongo.status,
        createdAt = mongo.createdAt,
    )
}
