package com.bagplease.entity.list.mongo

import com.bagplease.entity.list.ListMember
import com.bagplease.entity.list.MemberStatus
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexModel
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.util.UUID

class ListMemberRepository(db: MongoDatabase) {

    private val col = db.getCollection<MongoListMember>("list_members")

    init {
        runBlocking {
            col.createIndexes(
                listOf(
                    IndexModel(Indexes.ascending("userId"), IndexOptions().background(true)),
                    IndexModel(Indexes.ascending("listId"), IndexOptions().background(true)),
                )
            ).toList()
        }
    }

    suspend fun save(member: ListMember) {
        val id = "${member.listId}_${member.userId}"
        val filter = Filters.eq("_id", id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoListMember::listId.name, member.listId.toString()),
            Updates.set(MongoListMember::userId.name, member.userId.toString()),
            Updates.set(MongoListMember::username.name, member.username),
            Updates.set(MongoListMember::status.name, member.status.name),
            Updates.set(MongoListMember::createdAt.name, member.createdAt),
        )
        col.updateOne(filter, update, options)
    }

    suspend fun findActiveByListId(listId: UUID): kotlin.collections.List<ListMember> =
        col.find(
            Filters.and(
                Filters.eq("listId", listId.toString()),
                Filters.`in`("status", MemberStatus.PENDING.name, MemberStatus.ACCEPTED.name),
            )
        ).map(MongoListMemberMapper::mapFromMongo).toList()

    suspend fun findByListIdAndUserId(listId: UUID, userId: UUID): ListMember? =
        col.find(
            Filters.eq("_id", "${listId}_${userId}")
        ).map(MongoListMemberMapper::mapFromMongo).toList().firstOrNull()

    suspend fun findPendingByUserId(userId: UUID): kotlin.collections.List<ListMember> =
        col.find(
            Filters.and(
                Filters.eq("userId", userId.toString()),
                Filters.eq("status", MemberStatus.PENDING.name),
            )
        ).map(MongoListMemberMapper::mapFromMongo).toList()

    suspend fun deleteByListIdAndUserId(listId: UUID, userId: UUID) {
        col.deleteOne(Filters.eq("_id", "${listId}_${userId}"))
    }

    suspend fun deleteAllInList(listId: UUID): Int {
        val result = col.deleteMany(Filters.eq("listId", listId.toString()))
        return result.deletedCount.toInt()
    }
}
