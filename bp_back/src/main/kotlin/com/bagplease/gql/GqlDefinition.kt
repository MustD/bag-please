package com.bagplease.gql

/**
 * This object represents the GraphQL definition for the application.
 * It contains a list of queries, mutations, and subscriptions.
 */
object GqlDefinition {
    val queries = listOf(ItemQueries, CategoryQueries)
    val mutations = listOf(ItemMutations, CategoryMutations)
    val subscriptions = listOf(ItemSubscriptions, CategorySubscriptions)
}