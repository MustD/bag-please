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
    // Story 9.6 — `[String!]!` in the schema, REQUIRED, with no Kotlin default on purpose.
    // `stores` is an input-owned field the update branch copies straight onto the stored item, so an
    // omitted argument could only mean "clear every store" — a silent data loss for any caller that
    // forgot it. Making it required turns that into a validation error the caller can see.
    val stores: List<String>,
    val recurring: String? = null,
)
