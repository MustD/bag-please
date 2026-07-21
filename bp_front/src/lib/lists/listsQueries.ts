import {graphql} from '@/__generated__'
// Aliased: each generated result type shares its operation's name (ListsQuery,
// CategoriesQuery, ItemsQuery), which would collide with the exported document
// constants of the same name below.
import type {
  CategoriesQuery as CategoriesQueryResult,
  ItemsQuery as ItemsQueryResult,
  ListsQuery as ListsQueryResult,
} from '@/__generated__/graphql'

// A single list row from the `lists` query, derived from the generated type (no
// inline GraphQL response types — project rule). Shared by ListsPage and the
// delete dialog. The backend `List` has no `description` and does not embed its
// categories/items; those are fetched per-list on the detail screen.
export type ListSummary = ListsQueryResult['lists']['lists'][number]

// A category / item row on the list detail screen, derived from their queries.
export type ListCategory = CategoriesQueryResult['getCategories'][number]
export type ListItem = ItemsQueryResult['getItems'][number]

// Lists / category / item GraphQL operations (Story 5.5). Authored with the
// graphql() tagged template so codegen (`npm run generate`) discovers them and
// emits typed documents into src/__generated__/. All operations run over the
// existing Apollo HTTP link; the access token is injected automatically. The
// backend forbids the admin account from every list resource (FORBIDDEN), and
// gates list mutations by ownership/membership — surfaced inline via
// graphqlErrorMessage. Never hand-edit the generated output.

// All lists the caller owns or is an accepted member of. The `lists` query also
// returns `pendingInvites`, which are out of scope for 5.5 (Story 5.7) — only
// the `lists` array is selected here.
export const ListsQuery = graphql(`
    query Lists {
        lists {
            lists {
                id
                name
                emoji
                ownerId
                ownerUsername
                createdAt
            }
        }
    }
`)

export const CreateListMutation = graphql(`
    mutation CreateList($name: String!, $emoji: String) {
        createList(name: $name, emoji: $emoji) {
            id
            name
            emoji
            ownerId
            ownerUsername
            createdAt
        }
    }
`)

export const DeleteListMutation = graphql(`
    mutation DeleteList($id: ID!) {
        deleteList(id: $id) {
            deletedItemCount
            deletedCategoryCount
        }
    }
`)

export const CategoriesQuery = graphql(`
    query Categories($listId: ID!) {
        getCategories(listId: $listId) {
            id
            name
            listId
        }
    }
`)

export const ItemsQuery = graphql(`
    query Items($listId: ID!) {
        getItems(listId: $listId) {
            id
            name
            checked
            category
            listId
        }
    }
`)

export const SaveCategoryMutation = graphql(`
    mutation SaveCategory($category: CategoryInput!) {
        saveCategory(category: $category) {
            id
            name
            listId
        }
    }
`)

export const DeleteCategoryMutation = graphql(`
    mutation DeleteCategory($id: ID!, $listId: ID!) {
        deleteCategory(id: $id, listId: $listId) {
            id
        }
    }
`)

export const SaveItemMutation = graphql(`
    mutation SaveItem($item: ItemInput!) {
        saveItem(item: $item) {
            id
            name
            checked
            category
            listId
        }
    }
`)

export const DeleteItemMutation = graphql(`
    mutation DeleteItem($id: ID!, $listId: ID!) {
        deleteItem(id: $id, listId: $listId) {
            id
        }
    }
`)
