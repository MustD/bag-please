import {graphql} from '@/__generated__'
// Aliased: each generated result type shares its operation's name (ListsQuery,
// CategoriesQuery, ItemsQuery), which would collide with the exported document
// constants of the same name below.
import type {
  CategoriesQuery as CategoriesQueryResult,
  ListItemFieldsFragment,
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

// A category row on the list detail screen, derived from its query.
export type ListCategory = CategoriesQueryResult['getCategories'][number]

// An item row. Derived from the FRAGMENT rather than from `ItemsQuery`, because
// since Story 9.6 all five item-returning documents spread `ListItemFields` and
// therefore return exactly this shape — including the subscription payload,
// which `ListShoppingPage` writes straight into the query's cached result. It
// used to be `ItemsQuery['getItems'][number]`, which made that merge's cast an
// assertion about two field lists somebody had to keep in step by hand.
export type ListItem = ListItemFieldsFragment

// Lists / category / item GraphQL operations (Story 5.5). Authored with the
// graphql() tagged template so codegen (`npm run generate`) discovers them and
// emits typed documents into src/__generated__/. All operations run over the
// existing Apollo HTTP link; the access token is injected automatically. The
// backend forbids the admin account from every list resource (FORBIDDEN), and
// gates list mutations by ownership/membership — surfaced inline via
// graphqlErrorMessage. Never hand-edit the generated output.

// THE item shape, spread by every operation that returns an `Item` (AR-E9-10a):
// `ItemsQuery`, `SaveItemMutation`, `CheckItemMutation`, `UncheckItemMutation`
// and `ItemUpdatesSubscription`. Before Story 9.6 those five carried four
// different hand-written field lists, and `ListShoppingPage`'s realtime merge
// wrote a subscription payload into the query's cached rows through a cast that
// only held because somebody kept the lists in step. One fragment, one shape.
//
// `recurring` is selected even though no UI renders it (the one-timer/recurring
// control is deferred): the edit dialog must carry the cadence forward in its
// payload, and it can only carry a field the query fetched. `deleted` is
// selected so a SAVED-with-deleted item (a checked one-timer) can be merged out
// of the shopping list.
//
// Codegen runs with `fragmentMasking: false`, so this flattens into every
// operation type instead of becoming a `$fragmentRefs` marker — see codegen.ts.
export const ListItemFields = graphql(`
    fragment ListItemFields on Item {
        id
        name
        checked
        category
        listId
        stores
        addedBy
        recurring
        deleted
    }
`)

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

// The rows behind both list screens. The selection is `ListItemFields` and
// nothing else — see the fragment for why each field is in it.
export const ItemsQuery = graphql(`
    query Items($listId: ID!) {
        getItems(listId: $listId) {
            ...ListItemFields
        }
    }
`)

// Store names already used on this list, offered as suggestion chips under the
// store field in the add/edit item dialogs (Story 6.1). Scalar list — no
// sub-selection. Since Story 9.6 the server answers with ONE name per
// case-insensitive key, already sorted (AR-E9-4), so `StoreField` renders them
// in the order given and only filters out the ones already selected.
export const ItemStoreSuggestionsQuery = graphql(`
    query ItemStoreSuggestions($listId: ID!) {
        itemStoreSuggestions(listId: $listId)
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

// The result selection is the shared fragment, so Apollo's by-id normalization
// refreshes every field an edit can change. A narrower selection would leave a
// stale `stores`/`addedBy`/`recurring` in the cache after a save (Story 6.1).
export const SaveItemMutation = graphql(`
    mutation SaveItem($item: ItemInput!) {
        saveItem(item: $item) {
            ...ListItemFields
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
            ...ListItemFields
        }
    }
`)

export const UncheckItemMutation = graphql(`
    mutation UncheckItem($id: ID!, $listId: ID!) {
        uncheckItem(id: $id, listId: $listId) {
            ...ListItemFields
        }
    }
`)

// Per-list realtime (Story 5.6). Consumed via `subscribeToMore` on the Items /
// Categories queries — never a standalone useSubscription and never a second
// client. The stream ECHOES the caller's own actions, and a SAVED ItemUpdate can
// carry item.deleted === true (one-timer check), so the merge keys by id and is
// idempotent: DELETED / SAVED+deleted → drop, SAVED+!deleted → upsert. The
// CategoryUpdate payload field is literally named `item` even though it carries a
// Category. `recurring` was selected (Story 6.1) purely so the payload stayed a
// superset of ItemsQuery's item shape — ListShoppingPage writes the event's
// `item` straight into the Items result, so a field missing here would be a
// missing field in the cache (and a type error at the merge). Since Story 9.6
// that superset relationship is not a convention to maintain but the SAME
// fragment: the payload and the query row are one type. No merge or
// subscription behaviour changed.
export const ItemUpdatesSubscription = graphql(`
    subscription ItemUpdates($listId: ID!) {
        getItemUpdates(listId: $listId) {
            type
            item {
                ...ListItemFields
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
