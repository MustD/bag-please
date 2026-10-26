package com.bagplease.entity.list.db

import com.bagplease.entity.list.List
import com.bagplease.entity.list.ListMember
import com.bagplease.entity.list.MemberStatus
import com.bagplease.entity.user.db.UserTable
import org.jetbrains.exposed.v1.core.ResultRow

/** Both mappers expect the row to be joined to `users` (owner for a list, member for a member row). */
object ListRowMapper {
    fun listFromRow(row: ResultRow): List = List(
        id = row[ListTable.id],
        name = row[ListTable.name],
        emoji = row[ListTable.emoji],
        ownerId = row[ListTable.ownerId],
        ownerUsername = row[UserTable.username],
        origin = row[ListTable.origin],
        createdAt = row[ListTable.createdAt],
    )

    fun memberFromRow(row: ResultRow): ListMember = ListMember(
        listId = row[ListMemberTable.listId],
        userId = row[ListMemberTable.userId],
        username = row[UserTable.username],
        status = MemberStatus.valueOf(row[ListMemberTable.status]),
        createdAt = row[ListMemberTable.createdAt],
    )
}
