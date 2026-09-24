package com.bagplease.entity.user

// One page of the admin user list (Story 9.2).
//
// `offset` is the page the server ACTUALLY served, not the one that was asked
// for: the service clamps the request, and the client adopts what comes back
// rather than recomputing the arithmetic itself.
data class UserPage(
    val users: List<User>,
    val totalCount: Int,
    val offset: Int,
)
