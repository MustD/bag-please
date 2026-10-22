package com.bagplease.entity.user

import com.bagplease.entity.user.db.UserRepository
import com.bagplease.plugins.tx

/**
 * The narrow user lookup the Mongo-backed slices need (list service, startup migration). They are not
 * transactional themselves, so each lookup opens its own `tx {}`. It does not depend on [UserService], so
 * `UserService -> ListService -> UserLookup` has no cycle.
 */
class UserLookup(private val repository: UserRepository) {
    suspend fun findByUsername(username: String): User? = tx { repository.findByUsername(username) }
}
