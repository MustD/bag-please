/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n    query AdminUsers {\n        users {\n            id\n            username\n            role\n        }\n    }\n": typeof types.AdminUsersDocument,
    "\n    query AdminConfig {\n        applicationConfig {\n            registrationEnabled\n        }\n    }\n": typeof types.AdminConfigDocument,
    "\n    mutation CreateUser($username: String!, $password: String!) {\n        createUser(username: $username, password: $password) {\n            id\n            username\n            role\n        }\n    }\n": typeof types.CreateUserDocument,
    "\n    mutation DeleteUser($id: ID!) {\n        deleteUser(id: $id) {\n            id\n        }\n    }\n": typeof types.DeleteUserDocument,
    "\n    mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n        resetUserPassword(id: $id, newPassword: $newPassword) {\n            id\n        }\n    }\n": typeof types.ResetUserPasswordDocument,
    "\n    mutation SetRegistrationEnabled($enabled: Boolean!) {\n        setRegistrationEnabled(enabled: $enabled) {\n            registrationEnabled\n        }\n    }\n": typeof types.SetRegistrationEnabledDocument,
    "\n    query Lists {\n        lists {\n            lists {\n                id\n                name\n                emoji\n                ownerId\n                ownerUsername\n                createdAt\n                members {\n                    userId\n                    username\n                    status\n                }\n            }\n            pendingInvites {\n                listId\n                listName\n                listEmoji\n                ownerUsername\n            }\n        }\n    }\n": typeof types.ListsDocument,
    "\n    mutation CreateList($name: String!, $emoji: String) {\n        createList(name: $name, emoji: $emoji) {\n            id\n            name\n            emoji\n            ownerId\n            ownerUsername\n            createdAt\n        }\n    }\n": typeof types.CreateListDocument,
    "\n    mutation DeleteList($id: ID!) {\n        deleteList(id: $id) {\n            deletedItemCount\n            deletedCategoryCount\n        }\n    }\n": typeof types.DeleteListDocument,
    "\n    mutation ShareList($listId: ID!, $username: String!) {\n        shareList(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n": typeof types.ShareListDocument,
    "\n    mutation AcceptInvite($listId: ID!) {\n        acceptInvite(listId: $listId) {\n            id\n        }\n    }\n": typeof types.AcceptInviteDocument,
    "\n    mutation RejectInvite($listId: ID!) {\n        rejectInvite(listId: $listId)\n    }\n": typeof types.RejectInviteDocument,
    "\n    mutation RemoveMember($listId: ID!, $username: String!) {\n        removeMember(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n": typeof types.RemoveMemberDocument,
    "\n    mutation LeaveList($listId: ID!) {\n        leaveList(listId: $listId)\n    }\n": typeof types.LeaveListDocument,
    "\n    query Categories($listId: ID!) {\n        getCategories(listId: $listId) {\n            id\n            name\n            listId\n        }\n    }\n": typeof types.CategoriesDocument,
    "\n    query Items($listId: ID!) {\n        getItems(listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n        }\n    }\n": typeof types.ItemsDocument,
    "\n    mutation SaveCategory($category: CategoryInput!) {\n        saveCategory(category: $category) {\n            id\n            name\n            listId\n        }\n    }\n": typeof types.SaveCategoryDocument,
    "\n    mutation DeleteCategory($id: ID!, $listId: ID!) {\n        deleteCategory(id: $id, listId: $listId) {\n            id\n        }\n    }\n": typeof types.DeleteCategoryDocument,
    "\n    mutation SaveItem($item: ItemInput!) {\n        saveItem(item: $item) {\n            id\n            name\n            checked\n            category\n            listId\n        }\n    }\n": typeof types.SaveItemDocument,
    "\n    mutation DeleteItem($id: ID!, $listId: ID!) {\n        deleteItem(id: $id, listId: $listId) {\n            id\n        }\n    }\n": typeof types.DeleteItemDocument,
    "\n    mutation CheckItem($id: ID!, $listId: ID!) {\n        checkItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n": typeof types.CheckItemDocument,
    "\n    mutation UncheckItem($id: ID!, $listId: ID!) {\n        uncheckItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n": typeof types.UncheckItemDocument,
    "\n    subscription ItemUpdates($listId: ID!) {\n        getItemUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                checked\n                category\n                listId\n                store\n                addedBy\n                deleted\n            }\n        }\n    }\n": typeof types.ItemUpdatesDocument,
    "\n    subscription CategoryUpdates($listId: ID!) {\n        getCategoryUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                listId\n            }\n        }\n    }\n": typeof types.CategoryUpdatesDocument,
};
const documents: Documents = {
    "\n    query AdminUsers {\n        users {\n            id\n            username\n            role\n        }\n    }\n": types.AdminUsersDocument,
    "\n    query AdminConfig {\n        applicationConfig {\n            registrationEnabled\n        }\n    }\n": types.AdminConfigDocument,
    "\n    mutation CreateUser($username: String!, $password: String!) {\n        createUser(username: $username, password: $password) {\n            id\n            username\n            role\n        }\n    }\n": types.CreateUserDocument,
    "\n    mutation DeleteUser($id: ID!) {\n        deleteUser(id: $id) {\n            id\n        }\n    }\n": types.DeleteUserDocument,
    "\n    mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n        resetUserPassword(id: $id, newPassword: $newPassword) {\n            id\n        }\n    }\n": types.ResetUserPasswordDocument,
    "\n    mutation SetRegistrationEnabled($enabled: Boolean!) {\n        setRegistrationEnabled(enabled: $enabled) {\n            registrationEnabled\n        }\n    }\n": types.SetRegistrationEnabledDocument,
    "\n    query Lists {\n        lists {\n            lists {\n                id\n                name\n                emoji\n                ownerId\n                ownerUsername\n                createdAt\n                members {\n                    userId\n                    username\n                    status\n                }\n            }\n            pendingInvites {\n                listId\n                listName\n                listEmoji\n                ownerUsername\n            }\n        }\n    }\n": types.ListsDocument,
    "\n    mutation CreateList($name: String!, $emoji: String) {\n        createList(name: $name, emoji: $emoji) {\n            id\n            name\n            emoji\n            ownerId\n            ownerUsername\n            createdAt\n        }\n    }\n": types.CreateListDocument,
    "\n    mutation DeleteList($id: ID!) {\n        deleteList(id: $id) {\n            deletedItemCount\n            deletedCategoryCount\n        }\n    }\n": types.DeleteListDocument,
    "\n    mutation ShareList($listId: ID!, $username: String!) {\n        shareList(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n": types.ShareListDocument,
    "\n    mutation AcceptInvite($listId: ID!) {\n        acceptInvite(listId: $listId) {\n            id\n        }\n    }\n": types.AcceptInviteDocument,
    "\n    mutation RejectInvite($listId: ID!) {\n        rejectInvite(listId: $listId)\n    }\n": types.RejectInviteDocument,
    "\n    mutation RemoveMember($listId: ID!, $username: String!) {\n        removeMember(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n": types.RemoveMemberDocument,
    "\n    mutation LeaveList($listId: ID!) {\n        leaveList(listId: $listId)\n    }\n": types.LeaveListDocument,
    "\n    query Categories($listId: ID!) {\n        getCategories(listId: $listId) {\n            id\n            name\n            listId\n        }\n    }\n": types.CategoriesDocument,
    "\n    query Items($listId: ID!) {\n        getItems(listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n        }\n    }\n": types.ItemsDocument,
    "\n    mutation SaveCategory($category: CategoryInput!) {\n        saveCategory(category: $category) {\n            id\n            name\n            listId\n        }\n    }\n": types.SaveCategoryDocument,
    "\n    mutation DeleteCategory($id: ID!, $listId: ID!) {\n        deleteCategory(id: $id, listId: $listId) {\n            id\n        }\n    }\n": types.DeleteCategoryDocument,
    "\n    mutation SaveItem($item: ItemInput!) {\n        saveItem(item: $item) {\n            id\n            name\n            checked\n            category\n            listId\n        }\n    }\n": types.SaveItemDocument,
    "\n    mutation DeleteItem($id: ID!, $listId: ID!) {\n        deleteItem(id: $id, listId: $listId) {\n            id\n        }\n    }\n": types.DeleteItemDocument,
    "\n    mutation CheckItem($id: ID!, $listId: ID!) {\n        checkItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n": types.CheckItemDocument,
    "\n    mutation UncheckItem($id: ID!, $listId: ID!) {\n        uncheckItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n": types.UncheckItemDocument,
    "\n    subscription ItemUpdates($listId: ID!) {\n        getItemUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                checked\n                category\n                listId\n                store\n                addedBy\n                deleted\n            }\n        }\n    }\n": types.ItemUpdatesDocument,
    "\n    subscription CategoryUpdates($listId: ID!) {\n        getCategoryUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                listId\n            }\n        }\n    }\n": types.CategoryUpdatesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query AdminUsers {\n        users {\n            id\n            username\n            role\n        }\n    }\n"): (typeof documents)["\n    query AdminUsers {\n        users {\n            id\n            username\n            role\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query AdminConfig {\n        applicationConfig {\n            registrationEnabled\n        }\n    }\n"): (typeof documents)["\n    query AdminConfig {\n        applicationConfig {\n            registrationEnabled\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation CreateUser($username: String!, $password: String!) {\n        createUser(username: $username, password: $password) {\n            id\n            username\n            role\n        }\n    }\n"): (typeof documents)["\n    mutation CreateUser($username: String!, $password: String!) {\n        createUser(username: $username, password: $password) {\n            id\n            username\n            role\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation DeleteUser($id: ID!) {\n        deleteUser(id: $id) {\n            id\n        }\n    }\n"): (typeof documents)["\n    mutation DeleteUser($id: ID!) {\n        deleteUser(id: $id) {\n            id\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n        resetUserPassword(id: $id, newPassword: $newPassword) {\n            id\n        }\n    }\n"): (typeof documents)["\n    mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n        resetUserPassword(id: $id, newPassword: $newPassword) {\n            id\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation SetRegistrationEnabled($enabled: Boolean!) {\n        setRegistrationEnabled(enabled: $enabled) {\n            registrationEnabled\n        }\n    }\n"): (typeof documents)["\n    mutation SetRegistrationEnabled($enabled: Boolean!) {\n        setRegistrationEnabled(enabled: $enabled) {\n            registrationEnabled\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query Lists {\n        lists {\n            lists {\n                id\n                name\n                emoji\n                ownerId\n                ownerUsername\n                createdAt\n                members {\n                    userId\n                    username\n                    status\n                }\n            }\n            pendingInvites {\n                listId\n                listName\n                listEmoji\n                ownerUsername\n            }\n        }\n    }\n"): (typeof documents)["\n    query Lists {\n        lists {\n            lists {\n                id\n                name\n                emoji\n                ownerId\n                ownerUsername\n                createdAt\n                members {\n                    userId\n                    username\n                    status\n                }\n            }\n            pendingInvites {\n                listId\n                listName\n                listEmoji\n                ownerUsername\n            }\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation CreateList($name: String!, $emoji: String) {\n        createList(name: $name, emoji: $emoji) {\n            id\n            name\n            emoji\n            ownerId\n            ownerUsername\n            createdAt\n        }\n    }\n"): (typeof documents)["\n    mutation CreateList($name: String!, $emoji: String) {\n        createList(name: $name, emoji: $emoji) {\n            id\n            name\n            emoji\n            ownerId\n            ownerUsername\n            createdAt\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation DeleteList($id: ID!) {\n        deleteList(id: $id) {\n            deletedItemCount\n            deletedCategoryCount\n        }\n    }\n"): (typeof documents)["\n    mutation DeleteList($id: ID!) {\n        deleteList(id: $id) {\n            deletedItemCount\n            deletedCategoryCount\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation ShareList($listId: ID!, $username: String!) {\n        shareList(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n"): (typeof documents)["\n    mutation ShareList($listId: ID!, $username: String!) {\n        shareList(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation AcceptInvite($listId: ID!) {\n        acceptInvite(listId: $listId) {\n            id\n        }\n    }\n"): (typeof documents)["\n    mutation AcceptInvite($listId: ID!) {\n        acceptInvite(listId: $listId) {\n            id\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation RejectInvite($listId: ID!) {\n        rejectInvite(listId: $listId)\n    }\n"): (typeof documents)["\n    mutation RejectInvite($listId: ID!) {\n        rejectInvite(listId: $listId)\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation RemoveMember($listId: ID!, $username: String!) {\n        removeMember(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n"): (typeof documents)["\n    mutation RemoveMember($listId: ID!, $username: String!) {\n        removeMember(listId: $listId, username: $username) {\n            id\n            members {\n                userId\n                username\n                status\n            }\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation LeaveList($listId: ID!) {\n        leaveList(listId: $listId)\n    }\n"): (typeof documents)["\n    mutation LeaveList($listId: ID!) {\n        leaveList(listId: $listId)\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query Categories($listId: ID!) {\n        getCategories(listId: $listId) {\n            id\n            name\n            listId\n        }\n    }\n"): (typeof documents)["\n    query Categories($listId: ID!) {\n        getCategories(listId: $listId) {\n            id\n            name\n            listId\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query Items($listId: ID!) {\n        getItems(listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n        }\n    }\n"): (typeof documents)["\n    query Items($listId: ID!) {\n        getItems(listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation SaveCategory($category: CategoryInput!) {\n        saveCategory(category: $category) {\n            id\n            name\n            listId\n        }\n    }\n"): (typeof documents)["\n    mutation SaveCategory($category: CategoryInput!) {\n        saveCategory(category: $category) {\n            id\n            name\n            listId\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation DeleteCategory($id: ID!, $listId: ID!) {\n        deleteCategory(id: $id, listId: $listId) {\n            id\n        }\n    }\n"): (typeof documents)["\n    mutation DeleteCategory($id: ID!, $listId: ID!) {\n        deleteCategory(id: $id, listId: $listId) {\n            id\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation SaveItem($item: ItemInput!) {\n        saveItem(item: $item) {\n            id\n            name\n            checked\n            category\n            listId\n        }\n    }\n"): (typeof documents)["\n    mutation SaveItem($item: ItemInput!) {\n        saveItem(item: $item) {\n            id\n            name\n            checked\n            category\n            listId\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation DeleteItem($id: ID!, $listId: ID!) {\n        deleteItem(id: $id, listId: $listId) {\n            id\n        }\n    }\n"): (typeof documents)["\n    mutation DeleteItem($id: ID!, $listId: ID!) {\n        deleteItem(id: $id, listId: $listId) {\n            id\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation CheckItem($id: ID!, $listId: ID!) {\n        checkItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n"): (typeof documents)["\n    mutation CheckItem($id: ID!, $listId: ID!) {\n        checkItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation UncheckItem($id: ID!, $listId: ID!) {\n        uncheckItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n"): (typeof documents)["\n    mutation UncheckItem($id: ID!, $listId: ID!) {\n        uncheckItem(id: $id, listId: $listId) {\n            id\n            name\n            checked\n            category\n            listId\n            store\n            addedBy\n            deleted\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    subscription ItemUpdates($listId: ID!) {\n        getItemUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                checked\n                category\n                listId\n                store\n                addedBy\n                deleted\n            }\n        }\n    }\n"): (typeof documents)["\n    subscription ItemUpdates($listId: ID!) {\n        getItemUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                checked\n                category\n                listId\n                store\n                addedBy\n                deleted\n            }\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    subscription CategoryUpdates($listId: ID!) {\n        getCategoryUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                listId\n            }\n        }\n    }\n"): (typeof documents)["\n    subscription CategoryUpdates($listId: ID!) {\n        getCategoryUpdates(listId: $listId) {\n            type\n            item {\n                id\n                name\n                listId\n            }\n        }\n    }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;