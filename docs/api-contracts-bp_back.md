# API Contracts — bp_back

The backend exposes two API surfaces: a REST endpoint for authentication and a GraphQL API for all data operations.

## REST API

### POST /api/login

Authenticates the admin user and returns a JWT.

**Request**

```json
{ "username": "admin", "password": "admin" }
```

**Response 200**

```json
{ "token": "<jwt>", "user": "admin" }
```

**Response 401**

```
Username and password does not match the password
```

**Notes**

- Only one user exists (admin). Credentials are configurable via `KTOR_ADMIN_LOGIN` / `KTOR_ADMIN_PASS`.
- Token is HMAC-256 signed, expires in 7 days.
- All GraphQL operations (except subscriptions) require `Authorization: Bearer <token>`.

### GET /api/auth-test

Validates token and returns expiry info. Requires `Authorization: Bearer <token>`.

---

## GraphQL API

**Endpoint:** `POST /api/graphql`  
**Auth:** `Authorization: Bearer <token>` required on all queries and mutations.  
**Subscriptions:** `ws://<host>/api/subscriptions` — no auth required (known tech debt).  
**Playground:** `GET /api/graphiql`

---

## Queries

### getItems

Returns all shopping list items.

```graphql
query {
  getItems {
    id
    name
    checked
    category   # UUID string of the owning Category
  }
}
```

**Response type:** `[Item!]!`

---

### getCategories

Returns all categories.

```graphql
query {
  getCategories {
    id
    name
  }
}
```

**Response type:** `[Category!]!`

---

## Mutations

### saveItem (create or update)

Upserts an item by its `id`. If `id` already exists in storage, it is updated; otherwise it is created. The client
generates the UUID.

```graphql
mutation {
  saveItem(item: {
    id: "550e8400-e29b-41d4-a716-446655440000"
    name: "Milk"
    checked: false
    category: "c1d2e3f4-..."
  }) {
    id
    name
    checked
    category
  }
}
```

**Input type:** `ItemInput` (`id: ID!, name: String!, checked: Boolean!, category: String!`)  
**Response type:** `Item`

---

### deleteItem

Deletes an item by ID and returns the deleted item. Returns a GraphQL error if not found.

```graphql
mutation {
  deleteItem(id: "550e8400-e29b-41d4-a716-446655440000") {
    id
    name
  }
}
```

**Response type:** `Item`  
**Error:** `IllegalStateException: Item not found` surfaced as a GQL error (HTTP 200 with `errors` field).

---

### saveCategory (create or update)

Upserts a category by its `id`.

```graphql
mutation {
  saveCategory(category: {
    id: "c1d2e3f4-..."
    name: "Dairy"
  }) {
    id
    name
  }
}
```

**Input type:** `CategoryInput` (`id: ID!, name: String!`)  
**Response type:** `Category`

---

### deleteCategory

Deletes a category by ID and returns the deleted category.

```graphql
mutation {
  deleteCategory(id: "c1d2e3f4-...") {
    id
    name
  }
}
```

**Response type:** `Category`  
**Error:** `IllegalStateException: Category not found` as GQL error.

---

## Subscriptions

Subscriptions connect over WebSocket at `ws://<host>/api/subscriptions` using the `graphql-ws` protocol. No auth
required.

### getItemUpdates

Streams item changes (saves and deletes).

```graphql
subscription {
  getItemUpdates {
    type   # "SAVED" | "DELETED"
    item {
      id
      name
      checked
      category
    }
  }
}
```

**Response type:** `ItemUpdate { type: ItemUpdateType!, item: Item! }`  
**Note:** Both creates and updates emit `SAVED`. Subscribers must handle upsert logic client-side.

---

### getCategoryUpdates

Streams category changes.

```graphql
subscription {
  getCategoryUpdates {
    type   # "SAVED" | "DELETED"
    item {
      id
      name
    }
  }
}
```

**Response type:** `CategoryUpdate { type: CategoryUpdateType!, item: Category! }`

---

## GraphQL Schema Types

```graphql
type Item {
  id: ID!
  name: String!
  checked: Boolean!
  category: String!   # UUID of the owning Category
}

input ItemInput {
  id: ID!
  name: String!
  checked: Boolean!
  category: String!
}

type ItemUpdate {
  type: ItemUpdateType!
  item: Item!
}

enum ItemUpdateType {
  SAVED
  DELETED
}

type Category {
  id: ID!
  name: String!
}

input CategoryInput {
  id: ID!
  name: String!
}

type CategoryUpdate {
  type: CategoryUpdateType!
  item: Category!
}

enum CategoryUpdateType {
  SAVED
  DELETED
}
```

---

## Error Handling

- GraphQL always returns HTTP 200. Errors appear in `{"errors": [...], "data": {"field": null}}`.
- REST `/login` returns HTTP 401 on bad credentials.
- Auth failures on GraphQL HTTP routes return HTTP 401 (Ktor auth plugin challenge).
