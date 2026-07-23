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

// A co-member row on a list (Story 5.7), derived from the widened `lists` query.
// The backend `List.members` array EXCLUDES the owner and only carries invitees
// with status "PENDING" or "ACCEPTED" ("DECLINED" is filtered out).
export type ListMember = ListSummary['members'][number]

// A pending invite the caller has received (Story 5.7), derived from the sibling
// `pendingInvites` field on the `lists` query result.
export type PendingInviteSummary = ListsQueryResult['lists']['pendingInvites'][number]

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

// All lists the caller owns or is an accepted member of, plus the invites the
// caller has yet to accept/decline. `members` excludes the owner and carries
// each invitee's status ("PENDING" / "ACCEPTED"); it drives the owner's Share &
// Members dialog. `pendingInvites` drives the Pending Invites section (Story
// 5.7). There is no membership subscription — consumers refetch this query after
// every membership mutation.
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
                members {
                    userId
                    username
                    status
                }
            }
            pendingInvites {
                listId
                listName
                listEmoji
                ownerUsername
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

// Membership mutations (Story 5.7). All sharing errors arrive as
// extensions.code = FORBIDDEN with a differentiating message string, surfaced
// inline via graphqlErrorMessage. `shareList`/`removeMember` return the updated
// List (its `members` drives immediate dialog state); `rejectInvite`/`leaveList`
// return Boolean, so callers refresh purely by refetching `Lists`.
export const ShareListMutation = graphql(`
    mutation ShareList($listId: ID!, $username: String!) {
        shareList(listId: $listId, username: $username) {
            id
            members {
                userId
                username
                status
            }
        }
    }
`)

export const AcceptInviteMutation = graphql(`
    mutation AcceptInvite($listId: ID!) {
        acceptInvite(listId: $listId) {
            id
        }
    }
`)

export const RejectInviteMutation = graphql(`
    mutation RejectInvite($listId: ID!) {
        rejectInvite(listId: $listId)
    }
`)

export const RemoveMemberMutation = graphql(`
    mutation RemoveMember($listId: ID!, $username: String!) {
        removeMember(listId: $listId, username: $username) {
            id
            members {
                userId
                username
                status
            }
        }
    }
`)

export const LeaveListMutation = graphql(`
    mutation LeaveList($listId: ID!) {
        leaveList(listId: $listId)
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
            store
            addedBy
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

// Shopping-view operations (Story 5.6). check/uncheck return the updated Item;
// with nonOptionalTypename codegen Apollo normalizes by id, so the checkbox
// reflects the new `checked` without manual cache writes. Items authored in
// Story 5.5 are `recurring: null`, so checkItem just sets checked=true and the
// row stays visible (a one-timer would set deleted=true — the realtime merge
// still handles that generically). `deleted` is selected so the SAVED-with-
// deleted case can be merged out of the list.
export const CheckItemMutation = graphql(`
    mutation CheckItem($id: ID!, $listId: ID!) {
        checkItem(id: $id, listId: $listId) {
            id
            name
            checked
            category
            listId
            store
            addedBy
            deleted
        }
    }
`)

export const UncheckItemMutation = graphql(`
    mutation UncheckItem($id: ID!, $listId: ID!) {
        uncheckItem(id: $id, listId: $listId) {
            id
            name
            checked
            category
            listId
            store
            addedBy
            deleted
        }
    }
`)

// Per-list realtime (Story 5.6). Consumed via `subscribeToMore` on the Items /
// Categories queries — never a standalone useSubscription and never a second
// client. The stream ECHOES the caller's own actions, and a SAVED ItemUpdate can
// carry item.deleted === true (one-timer check), so the merge keys by id and is
// idempotent: DELETED / SAVED+deleted → drop, SAVED+!deleted → upsert. The
// CategoryUpdate payload field is literally named `item` even though it carries a
// Category.
export const ItemUpdatesSubscription = graphql(`
    subscription ItemUpdates($listId: ID!) {
        getItemUpdates(listId: $listId) {
            type
            item {
                id
                name
                checked
                category
                listId
                store
                addedBy
                deleted
            }
        }
    }
`)

export const CategoryUpdatesSubscription = graphql(`
    subscription CategoryUpdates($listId: ID!) {
        getCategoryUpdates(listId: $listId) {
            type
            item {
                id
                name
                listId
            }
        }
    }
`)
