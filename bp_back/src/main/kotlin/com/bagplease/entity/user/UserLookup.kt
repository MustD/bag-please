package com.bagplease.entity.user

import com.bagplease.entity.user.db.UserRepository
import com.bagplease.plugins.tx

/**
 * The narrow user lookup the list service and the startup migration need. Each lookup runs in `tx {}`, which joins
 * the caller's open transaction or opens its own. It does not depend on [UserService], so
 * `UserService -> ListService -> UserLookup` has no cycle.
 */
class UserLookup(private val repository: UserRepository) {
    suspend fun findByUsername(username: String): User? = tx { repository.findByUsername(username) }
}
