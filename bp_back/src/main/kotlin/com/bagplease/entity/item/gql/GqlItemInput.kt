package com.bagplease.entity.item.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("ItemInput")
data class GqlItemInput(
    val id: ID,
    val name: String,
    val checked: Boolean,
    val category: String,
    val listId: ID,
    val store: String? = null,
    val recurring: String? = null,
)
