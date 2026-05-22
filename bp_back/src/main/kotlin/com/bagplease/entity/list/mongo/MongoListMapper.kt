package com.bagplease.entity.list.mongo

import com.bagplease.entity.list.List

object MongoListMapper {

    fun mapListToMongo(list: List): MongoList {
        return MongoList(
            id = list.id,
            name = list.name,
            emoji = list.emoji,
            ownerId = list.ownerId,
            ownerUsername = list.ownerUsername,
            memberUsernames = list.memberUsernames,
            members = list.members,
            origin = list.origin,
            createdAt = list.createdAt,
        )
    }

    fun mapListFromMongo(list: MongoList): List {
        return List(
            id = list.id,
            name = list.name,
            emoji = list.emoji,
            ownerId = list.ownerId,
            ownerUsername = list.ownerUsername,
            memberUsernames = list.memberUsernames,
            members = list.members,
            origin = list.origin,
            createdAt = list.createdAt,
        )
    }
}
