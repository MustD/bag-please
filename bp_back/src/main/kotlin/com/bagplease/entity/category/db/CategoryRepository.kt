package com.bagplease.entity.category.db

import com.bagplease.entity.category.Category
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.r2dbc.deleteWhere
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.selectAll
import org.jetbrains.exposed.v1.r2dbc.update
import java.util.UUID

/**
 * `categories` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2); the repository never
 * opens a transaction itself, and only `CategoryService` calls it.
 */
class CategoryRepository {

    suspend fun findById(id: UUID): Category? =
        CategoryTable.selectAll().where { CategoryTable.id eq id }
            .map(CategoryRowMapper::categoryFromRow).toList().firstOrNull()

    suspend fun findByListId(listId: UUID): List<Category> =
        CategoryTable.selectAll().where { CategoryTable.listId eq listId }
            .orderBy(CategoryTable.name to SortOrder.ASC, CategoryTable.id to SortOrder.ASC)
            .map(CategoryRowMapper::categoryFromRow).toList()

    suspend fun existsOnList(id: UUID, listId: UUID): Boolean =
        CategoryTable.selectAll().where { (CategoryTable.id eq id) and (CategoryTable.listId eq listId) }.count() > 0

    suspend fun insert(category: Category) {
        CategoryTable.insert {
            it[id] = category.id
            it[name] = category.name
            it[listId] = category.listId
        }
    }

    suspend fun rename(id: UUID, name: String) {
        CategoryTable.update({ CategoryTable.id eq id }) { it[CategoryTable.name] = name }
    }

    suspend fun delete(id: UUID): Boolean = CategoryTable.deleteWhere { CategoryTable.id eq id } > 0

    suspend fun deleteAllInList(listId: UUID): Int = CategoryTable.deleteWhere { CategoryTable.listId eq listId }
}
