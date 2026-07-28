# Story 4.2: WebSocket Auth & Per-List Subscription Scoping

Status: done

## Story

As a list member,
I want real-time item and category updates to be delivered only to members of my list,
So that my data never leaks to users of other lists and my subscriptions are as secure as the rest of the API.

## Acceptance Criteria

**AC1 — WebSocket connection auth (valid token):**
Given a frontend client establishes a WebSocket connection to `/api/subscriptions` with a valid JWT in `connectionParams.Authorization` (`Bearer <token>`),
When the `connection_init` frame is processed,
Then the connection is accepted and subscription streams can be established.

**AC2 — WebSocket connection auth (missing/invalid token):**
Given a client attempts a WebSocket connection with a missing, malformed, or expired JWT,
When the `connection_init` frame is processed,
Then the backend rejects the connection with a `4401` close code; no subscription stream is established.

**AC3 — Subscribe-time membership gate (Point 1):**
Given a client calls `itemUpdates(listId: ID!)` over an authenticated WebSocket,
When the subscription is established,
Then `listService.verifyMembership(caller, listId)` is called immediately; if the caller is not a member, the subscription is rejected with a GQL error and zero events are ever delivered.

**AC4 — Per-event membership re-evaluation (Point 2):**
Given a member's active subscription to `itemUpdates(listId)`,
When an item mutation event is emitted for that `listId`,
Then `.takeWhile { listService.isMember(caller, listId) }` re-evaluates membership on every event; if the caller has been removed from the list since subscribing, the next emitted event terminates the flow — no further events are delivered.

**AC5 — Cross-list isolation:**
Given two lists with active subscribers on each,
When an item is mutated in list A,
Then only subscribers to list A's `itemUpdates` receive the event; subscribers to list B receive zero events under any circumstances.

**AC6 — `categoryUpdates` subscription scoped identically:**
Given `categoryUpdates(listId: ID!)` subscription,
When a category mutation event is emitted,
Then Point 1 (subscribe-time membership gate) and Point 2 (`takeWhile` per-event re-evaluation) are both enforced identically to `itemUpdates`.

**AC7 — Frontend WebSocket `connectionParams`:**
Given the frontend `ApolloWrapper.tsx`,
When the WebSocket connection is initiated,
Then `connectionParams` supplies `{ Authorization: "Bearer <accessToken>" }` sourced from `accessTokenRef.current` (the ref that tracks `AuthContext.accessToken` — not from `localStorage`).

**AC8 — `clearAuth()` dispose ordering:**
Given `clearAuth()` is called (on logout or password reset),
When the auth state is cleared,
Then the sequence is strictly: `client.dispose()` → clear React auth state (`auth.clearAuth()`); this prevents orphaned in-flight subscription events from reaching React state after logout.

**AC9 — No WebSocket connection before login:**
Given an unauthenticated user (no access token) visits the app,
When `ApolloWrapper` initialises,
Then the `connectionParams` function returns `{ Authorization: "Bearer " }` (empty Bearer) — the backend rejects this with `4401`; this is the expected behaviour since no WS connection should succeed before login.

## Tasks / Subtasks

- [x] Task 1: Add `verifyAccessToken` to `AuthService` (AC: 1, 2)
  - [x] Add `fun verifyAccessToken(token: String): JWTPrincipal?` in `AuthService.kt`
  - [x] Build verifier: `JWT.require(Algorithm.HMAC256(jwtSecret)).withAudience(jwtAudience).withIssuer(jwtIssuer).build()`
  - [x] Verify token, validate `username` and `role` claims are non-empty, return `JWTPrincipal(decoded)` on success, `null` on any exception
  - [x] `JWTPrincipal` import: `io.ktor.server.auth.jwt.JWTPrincipal`; `DecodedJWT` implements the `Payload` interface that `JWTPrincipal` accepts

- [x] Task 2: Update `CustomGraphQLContextFactory` in `GQL.kt` (AC: 1, 2)
  - [x] Change `CustomGraphQLContextFactory()` to accept `private val authService: AuthService`
  - [x] Created separate `WsGraphQLContextFactory(authService)` implementing `KtorGraphQLSubscriptionContextFactory` (graphql-kotlin 9.2 uses separate subscription context factory, not `generateContextMap` override)
  - [x] Extract auth header: `payload?.get("Authorization") as? String`
  - [x] If missing or not starting with `"Bearer "`: call `session.close(CloseReason(4401.toShort(), "Unauthorized"))` then `error("Unauthorized")`
  - [x] Strip prefix, call `authService.verifyAccessToken(token)`; if null: close with 4401 and error
  - [x] On success: return `mapOf(GQL_CALL_PRINCIPAL to principal).toGraphQLContext()`
  - [x] Registered in `server { subscriptions { contextFactory = WsGraphQLContextFactory(authService) } }`

- [x] Task 3: Update `ItemSubscriptions` in `ItemApi.kt` (AC: 3, 4, 5)
  - [x] Add `private val listService: ListService` to `ItemSubscriptions` constructor
  - [x] Add `import com.bagplease.entity.list.ListService`
  - [x] Update `getItemUpdates` signature: `fun getItemUpdates(listId: ID, env: DataFetchingEnvironment): Flow<GqlItemUpdate>`
  - [x] Add `import kotlinx.coroutines.flow.flow`, `import kotlinx.coroutines.flow.emitAll`, `import kotlinx.coroutines.flow.filter`, `import kotlinx.coroutines.flow.takeWhile`
  - [x] Implemented Point 1 (subscribe-time gate) + Point 2 (takeWhile per-event re-evaluation) + listId filter
  - [x] Update `ItemSubscriptions` instantiation in `GQL.kt`: `ItemSubscriptions(itemService, listService)`

- [x] Task 4: Update `CategorySubscriptions` in `CategoryApi.kt` (AC: 6)
  - [x] Same pattern as Task 3: add `listService`, update `getCategoryUpdates` with `DataFetchingEnvironment`
  - [x] Implementation mirrors `getItemUpdates` exactly with `categoryUpdates`/`categoryDeletions`/`GqlCategoryUpdate`/`GqlCategoryUpdateType`/`GqlCategoryMapper`
  - [x] Update `CategorySubscriptions` instantiation in `GQL.kt`: `CategorySubscriptions(categoryService, listService)`

- [x] Task 5: Update `ApolloWrapper.tsx` (AC: 7, 8, 9)
  - [x] Added `connectionParams: () => ({ Authorization: 'Bearer ...' })` using `wsClient` (graphql-ws Client) extracted separately
  - [x] `makeLink` now returns `{ apolloClient, disposeWs }` to expose ws dispose; `disposeWs()` calls `wsClient.dispose()`
  - [x] `clearAuthRef.current` wraps `disposeWs() + auth.clearAuth()` — single assignment only, old direct assignment removed
  - [x] `client` declaration moved before `clearAuthRef.current` assignment so it's in scope

- [x] Task 6: Backend tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] Created `WebSocketAuthTest.kt` (FunSpec, Testcontainers): unauthenticated→4401, invalid token→4401, valid token→connection_ack
  - [x] Created `SubscriptionScopingTest.kt` (FunSpec, Testcontainers): subscribe-time gate non-member error, cross-list isolation
  - [x] Point 2 (membership revocation) deferred to Story 4.3 with TODO comment

- [x] Task 7: Build verification
  - [x] `cd bp_back && ../gradlew build -x test` — clean build (BUILD SUCCESSFUL)
  - [x] `cd bp_back && ../gradlew test` — all 70 tests pass (0 failures)
  - [x] `cd bp_front && npx tsc --noEmit` — no TypeScript errors

## Dev Notes

### Current State of the Code (READ BEFORE IMPLEMENTING)

**`ItemSubscriptions.getItemUpdates` (current, `ItemApi.kt:59-73`):**
```kotlin
fun getItemUpdates(listId: ID): Flow<GqlItemUpdate> {
    val updates = service.itemUpdates.map { ... }
    val deletions = service.itemDeletions.map { ... }
    return merge(updates, deletions)
}
```
Currently: NO caller extraction, NO listId filtering, NO membership gate, NO `takeWhile`. Emits ALL item events to ALL subscribers regardless of list.

**`GQL.kt` subscription route (`GQL.kt:129`):**
```kotlin
graphQLSubscriptionsRoute()  // outside authenticate() — currently fully unauthenticated
```
Currently: No JWT validation. `CustomGraphQLContextFactory` only overrides HTTP context generation (`generateContext(request)`), not WebSocket context (`generateContextMap(session, initPayload)`).

**`ApolloWrapper.tsx` WebSocket client (`ApolloWrapper.tsx:38-41`):**
```typescript
const wsLink = new GraphQLWsLink(createClient({
  url: `${wsProtocol}${host}/api/subscriptions`,
  // NO connectionParams — no auth token sent
}))
```
Currently: No `connectionParams`, no auth token sent on WebSocket connection.

**`clearAuth` in `ApolloWrapper.tsx` (`ApolloWrapper.tsx:127`):**
```typescript
clearAuthRef.current = auth.clearAuth  // no client.dispose() before clearing
```
Currently: Auth cleared without disposing Apollo client first.

### Architecture Critical Points

#### Two Mandatory Enforcement Points

Both points are required — implementing only one is insufficient:
- **Point 1 alone** misses mid-session membership revocation (member removed while subscribed still gets events)
- **Point 2 alone** allows an unauthenticated initial subscription (if someone bypasses WS auth, they could subscribe)

#### Why `flow { }` Builder (not `runBlocking`, not `suspend fun`)

`getItemUpdates` returns `Flow<T>` (graphql-kotlin subscription function signature). `verifyMembership` is `suspend`. Solution: use `flow { }` builder — its lambda is `suspend`, so you can call suspend functions directly inside it. This is the correct Kotlin pattern for mixing cold flows with suspend init logic.

```kotlin
// CORRECT: flow { } lambda is suspend — can call verifyMembership
fun getItemUpdates(...): Flow<GqlItemUpdate> = flow {
    listService.verifyMembership(...)  // suspend, OK here
    emitAll(...)
}

// WRONG: runBlocking blocks the coroutine thread
fun getItemUpdates(...): Flow<GqlItemUpdate> {
    runBlocking { listService.verifyMembership(...) }  // DO NOT DO THIS
    ...
}
```

#### Why `isMember` (non-suspend) is Safe in `takeWhile`

`ListStorage.getByIdCached` (used by `isMember`) does NOT call `sync()`. It's a direct `storage[id]` lookup. However: since `verifyMembership` at Point 1 calls `listStorage.getById(listId)` which DOES call `sync()`, the list is guaranteed to be in cache before any `isMember` call. The `isMember` cold-cache false-denial is a pre-existing deferred concern but is not triggered here because sync happens first.

#### `generateContextMap` Override for WebSocket

`CustomGraphQLContextFactory` currently only overrides `generateContext(request: ApplicationRequest)` for HTTP. For WebSocket, override `generateContextMap(session: WebSocketServerSession, initPayload: Map<*, *>?)`:
- This is called once per WebSocket connection during `connection_init` handling
- The returned `Map<*, Any>` becomes the GraphQL context for all subscriptions on that connection
- Putting `GQL_CALL_PRINCIPAL to principal` in the map makes `env.graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)` work in subscription functions (same as HTTP)

#### Close Code 4401

WebSocket close code `4401` is the `graphql-ws` protocol standard for authentication failure. In Ktor:
```kotlin
session.close(CloseReason(4401.toShort(), "Unauthorized"))
```
`CloseReason` constructor takes `Short` for the code. `4401.toShort()` is required; `Int` won't compile.

#### `ApolloWrapper.tsx` — Dispose Before Clear

`client.dispose()` stops active WebSocket subscriptions and terminates the underlying `graphql-ws` connection. It does NOT permanently disable the client — HTTP queries/mutations still work after dispose, and new subscriptions will reconnect. The dispose-before-clear ordering prevents a scenario where subscription events arrive in React state after the auth context has been cleared (causing "subscription updating stale state" bugs).

`client` in `ApolloWrapper` is created once via `useState(() => makeLink(...))` and is constant for the component lifetime. The `clearAuthRef.current` assignment runs on every render — the wrapped version must replace the direct assignment entirely.

### Key File Locations

| File | Change Type | What Changes |
|------|-------------|--------------|
| `bp_back/.../features/auth/AuthService.kt` | UPDATE | Add `verifyAccessToken(token)` method |
| `bp_back/.../plugins/GQL.kt` | UPDATE | `CustomGraphQLContextFactory` gets `authService` param + WS context override; subscriptions get `listService` |
| `bp_back/.../entity/item/gql/ItemApi.kt` | UPDATE | `ItemSubscriptions` gets `listService`; `getItemUpdates` adds `env`, Point 1+2 |
| `bp_back/.../entity/category/gql/CategoryApi.kt` | UPDATE | Mirror of item changes |
| `bp_front/src/lib/apollo/ApolloWrapper.tsx` | UPDATE | `connectionParams` on WS link; `clearAuthRef` wraps dispose |
| `bp_back/.../test/.../WebSocketAuthTest.kt` | NEW | WS connection auth tests |
| `bp_back/.../test/.../SubscriptionScopingTest.kt` | NEW | Per-list scoping tests |

### `toException()` is already imported

`ItemApi.kt` already imports `com.bagplease.entity.list.gql.toException`. No new import needed for the fold pattern in `getItemUpdates`. Same for `CategoryApi.kt`.

### `caller()` Extension Already Defined

Both `ItemApi.kt` and `CategoryApi.kt` already have `private fun DataFetchingEnvironment.caller(): CallerUsername`. No duplication needed.

### Testing WebSocket Connections in Ktor

Use `testApplication { handleWebSocketConversation(...) }` to test WebSocket behavior. Pattern:
```kotlin
testApplication {
    application { module() }
    handleWebSocketConversation("/api/subscriptions") { incoming, outgoing ->
        // Send connection_init without Authorization
        outgoing.send(Frame.Text("""{"type":"connection_init","payload":{}}"""))
        // Expect close frame with code 4401
        val frame = incoming.receive()
        assertTrue(frame is Frame.Close)
        assertEquals(4401, (frame as Frame.Close).readReason()?.code?.toInt())
    }
}
```

### Testing Subscription Events (Cross-List Isolation)

Within a single `testApplication`, start two WebSocket subscriptions concurrently. Use `kotlinx.coroutines.async` to collect events and assert. Identify events by UUID (not name) per project testing rules.

### Deferred Concerns from 4.1 Relevant Here

- **`isMember` cold-cache false-denial**: `getByIdCached` bypasses sync. As noted above, Point 1 (`verifyMembership`) triggers sync first, mitigating this for the subscription case. Still a latent concern if `isMember` is ever called without a prior `verifyMembership` on the same list.
- **Point 2 for membership revocation**: Full test requires the member removal mutation (Story 4.3). Document this in the test file and add a `TODO` for the test to be completed in Story 4.3.

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, the dev agent must verify and explicitly check each item:

- [ ] **Mutation errors surface to the user** — N/A (backend-only + minimal frontend change)
- [ ] **Dialog does not close on error** — N/A
- [ ] **Cancel remains interactive during in-flight requests** — N/A
- [ ] **Client-side input validation** — N/A for this story
- [ ] **Concurrent write safety** — Two simultaneous `connection_init` messages on different WebSocket sessions each get independent context maps; no shared mutable state in `generateContextMap`
- [ ] **Loading state prevents double-submit** — N/A

Additional story-specific checks:
- [ ] **4401 close sent BEFORE error()** — `session.close(...)` must be called before `error(...)` in `generateContextMap`; if reversed, the exception may prevent the close frame from being sent
- [ ] **Both subscription classes updated** — `ItemSubscriptions` AND `CategorySubscriptions` both get the scoping treatment; missing one leaves a data-leak vector
- [ ] **`clearAuthRef.current` not double-assigned** — only one assignment to `clearAuthRef.current` in `ApolloWrapper.tsx`; the old `clearAuthRef.current = auth.clearAuth` line must be REMOVED and replaced with the wrapped version
- [ ] **`connectionParams` is a function, not an object** — `connectionParams: () => ({...})` not `connectionParams: {...}`; passing an object freezes the token at connection creation time; passing a function reads the current token at reconnect time

### References

- [project-context.md §Ktor/graphql-kotlin] — subscription SharedFlow pattern, GQL_CALL_PRINCIPAL, `@Suppress("unused")` on Subscription classes
- [project-context.md §Testing] — FunSpec only, no mocks, Testcontainers, UUID-based assertions
- [epics.md §Story 4.2] — full AC list and Technical Notes
- [architecture.md §WebSocket Auth] — `generateContextMap` override pattern, connection lifecycle
- [architecture.md §Per-List Subscription Scoping] — exact `flow { }` builder pattern with Point 1 + Point 2
- [GQL.kt:135-142] — current `CustomGraphQLContextFactory` to extend
- [ItemApi.kt:54-73] — current `ItemSubscriptions` to update
- [CategoryApi.kt:54-73] — current `CategorySubscriptions` to update
- [ApolloWrapper.tsx:38-41] — current `createClient` call (add `connectionParams`)
- [ApolloWrapper.tsx:121-131] — current ref assignments (update `clearAuthRef.current`)
- [AuthService.kt] — existing JWT signing pattern to mirror for verification
- [Security.kt:26] — existing `JWTVerifier` construction pattern to copy in `verifyAccessToken`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- graphql-kotlin 9.2 uses a separate `KtorGraphQLSubscriptionContextFactory` for WebSocket auth, NOT `generateContextMap` on `DefaultKtorGraphQLContextFactory`. The dev notes spec was based on an older API version.
- graphql-ws `Client.dispose()` is on the graphql-ws client, not on `ApolloClient`. `ApolloClient.stop()` exists but doesn't close the WebSocket. Restructured `makeLink` to return `{ apolloClient, disposeWs }`.
- WebSocket test engine delivers Close frames as `ClosedReceiveChannelException` on `incoming.receive()`. Must catch this and use `closeReason.await()` to read the code.
- Test WebSocket path is `/subscriptions` (no `/api/` prefix — nginx adds that in production).
- `webSocket(path, protocol)` route requires `Sec-WebSocket-Protocol: graphql-transport-ws` header in test client.

### Completion Notes List

- `AuthService.verifyAccessToken(token)` added — mirrors `Security.kt` verifier pattern, returns `JWTPrincipal?`
- `WsGraphQLContextFactory` created in `GQL.kt` implementing `KtorGraphQLSubscriptionContextFactory` — closes with 4401 before throwing to ensure client receives 4401 even though framework catches the exception and would close with 4403
- `ItemSubscriptions` and `CategorySubscriptions` both updated with Point 1 (subscribe-time gate) + listId filter + Point 2 (takeWhile per-event re-evaluation)
- `ApolloWrapper.tsx`: `connectionParams` function added, `clearAuthRef.current` wraps `disposeWs()` + `auth.clearAuth()`, `makeLink` returns `{apolloClient, disposeWs}` to expose ws dispose
- `WebSocketAuthTest.kt` (3 tests): unauthenticated→4401, invalid→4401, valid→connection_ack
- `SubscriptionScopingTest.kt` (2 tests): subscribe-time gate, cross-list isolation; Point 2 deferred to Story 4.3
- All 70 backend tests pass, 0 failures; TypeScript check clean

### File List

- `bp_back/src/main/kotlin/com/bagplease/features/auth/AuthService.kt`
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/item/gql/ItemApi.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/category/gql/CategoryApi.kt`
- `bp_front/src/lib/apollo/ApolloWrapper.tsx`
- `bp_back/src/test/kotlin/com/bagplease/WebSocketAuthTest.kt` (new)
- `bp_back/src/test/kotlin/com/bagplease/SubscriptionScopingTest.kt` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] AC3 test accepts `null` timeout as a passing result — non-member subscribe-time gate test uses `if (response != null)` which treats a silent hang as valid; AC3 requires a GQL error response to be actively received [SubscriptionScopingTest.kt:86-91]
- [x] [Review][Patch] AC5/AC6 cross-list isolation test missing for `categoryUpdates` — `SubscriptionScopingTest.kt` only tests `itemUpdates` cross-list isolation; no equivalent test for `categoryUpdates` subscription scoping [SubscriptionScopingTest.kt]
- [x] [Review][Defer] Stale `isMember` cache — `getByIdCached` bypasses `sync()`; revoked members may continue receiving subscription events until cache is refreshed — deferred, pre-existing (acknowledged in spec dev notes; full test blocked on Story 4.3 member-removal mutation)
- [x] [Review][Defer] Race window between Point 1 `verifyMembership` and `emitAll` start — theoretical TOCTOU gap between membership check and flow subscription; mitigated by Point 2 `takeWhile` re-check — deferred, pre-existing design tradeoff
- [x] [Review][Defer] Lost SharedFlow events during subscribe setup — events emitted between `verifyMembership` and `emitAll` may be dropped if buffer is full; pre-existing SharedFlow buffer behavior not introduced by this change — deferred, pre-existing
- [x] [Review][Defer] AC4 Point 2 (`takeWhile` revocation) test absent — implementation exists; test blocked on Story 4.3 member-removal mutation — deferred, per spec dev notes

## Change Log

- 2026-05-22: Implemented Story 4.2 — WebSocket auth via `WsGraphQLContextFactory`, per-list subscription scoping in `ItemSubscriptions` and `CategorySubscriptions`, `ApolloWrapper.tsx` connectionParams + dispose-before-clear, `WebSocketAuthTest` + `SubscriptionScopingTest`. All 70 tests pass.
