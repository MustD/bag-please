package com.bagplease.entity.user.mongo

import com.bagplease.entity.user.User

object MongoUserMapper {
    fun mapUserToMongo(user: User): MongoUser = MongoUser(
        id = user.id,
        username = user.username,
        passwordHash = user.passwordHash,
        role = user.role,
    )

    fun mapUserFromMongo(mongoUser: MongoUser): User = User(
        id = mongoUser.id,
        username = mongoUser.username,
        passwordHash = mongoUser.passwordHash,
        role = mongoUser.role,
    )
}
