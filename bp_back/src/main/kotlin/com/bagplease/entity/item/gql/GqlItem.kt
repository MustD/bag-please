package com.bagplease.entity.item.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("Item")
data class GqlItem(
    val id: ID,
    val name: String,
    val checked: Boolean,
    val category: String,
    val listId: ID,
    val store: String? = null,
    val recurring: String? = null,
    val addedBy: String? = null,
    val deleted: Boolean = false,
    val deletedAt: String? = null,
    val checkedAt: String? = null,
)
