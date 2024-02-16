package com.bagplease.gql

/**
 * This object represents the GraphQL definition for the application. It contains the list of queries and mutations
 * that can be made.
 */
object GqlDefinition {
    val queries = listOf(ItemQueries)
    val mutations = listOf(ItemMutations)
}