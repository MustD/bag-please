/* eslint-disable */
import * as types from './graphql';
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core';

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
  "\n  query GetCategories($listId: ID!) {\n    getCategories(listId: $listId) {\n      id name listId\n    }\n  }\n": typeof types.GetCategoriesDocument,
  "\n  subscription GetCategoryUpdates($listId: ID!) {\n    getCategoryUpdates(listId: $listId) {\n      type\n      item { id name listId }\n    }\n  }\n": typeof types.GetCategoryUpdatesDocument,
    "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}": typeof types.GetApplicationConfigDocument,
    "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}": typeof types.SetRegistrationEnabledDocument,
  "\n  query GetItems($listId: ID!) {\n    getItems(listId: $listId) {\n      id name checked category listId store recurring addedBy deleted deletedAt checkedAt\n    }\n  }\n": typeof types.GetItemsDocument,
  "\n  mutation CheckItem($id: ID!, $listId: ID!) {\n    checkItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n": typeof types.CheckItemDocument,
  "\n  mutation UncheckItem($id: ID!, $listId: ID!) {\n    uncheckItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n": typeof types.UncheckItemDocument,
  "\n  subscription GetItemUpdates($listId: ID!) {\n    getItemUpdates(listId: $listId) {\n      type\n      item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }\n    }\n  }\n": typeof types.GetItemUpdatesDocument,
  "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            uncheckedItemCount\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}": typeof types.ListsDocument,
  "mutation CreateList($name: String!, $emoji: String) {\n    createList(name: $name, emoji: $emoji) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}": typeof types.CreateListDocument,
  "mutation DeleteList($id: ID!) {\n    deleteList(id: $id) { deletedItemCount deletedCategoryCount }\n}": typeof types.DeleteListDocument,
  "mutation RenameList($id: ID!, $name: String!) {\n    renameList(id: $id, name: $name) { id name }\n}": typeof types.RenameListDocument,
  "mutation LeaveList($listId: ID!) {\n    leaveList(listId: $listId)\n}": typeof types.LeaveListDocument,
  "mutation AcceptInvite($listId: ID!) {\n    acceptInvite(listId: $listId) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}": typeof types.AcceptInviteDocument,
  "mutation RejectInvite($listId: ID!) {\n    rejectInvite(listId: $listId)\n}": typeof types.RejectInviteDocument,
    "query GetUsers {\n  users {\n    id\n    username\n    role\n  }\n}": typeof types.GetUsersDocument,
    "mutation CreateUser($username: String!, $password: String!) {\n  createUser(username: $username, password: $password) {\n    id\n    username\n    role\n  }\n}": typeof types.CreateUserDocument,
    "mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    id\n    username\n    role\n  }\n}": typeof types.DeleteUserDocument,
    "mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n  resetUserPassword(id: $id, newPassword: $newPassword) {\n    id\n    username\n  }\n}": typeof types.ResetUserPasswordDocument,
};
const documents: Documents = {
  "\n  query GetCategories($listId: ID!) {\n    getCategories(listId: $listId) {\n      id name listId\n    }\n  }\n": types.GetCategoriesDocument,
  "\n  subscription GetCategoryUpdates($listId: ID!) {\n    getCategoryUpdates(listId: $listId) {\n      type\n      item { id name listId }\n    }\n  }\n": types.GetCategoryUpdatesDocument,
    "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}": types.GetApplicationConfigDocument,
    "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}": types.SetRegistrationEnabledDocument,
  "\n  query GetItems($listId: ID!) {\n    getItems(listId: $listId) {\n      id name checked category listId store recurring addedBy deleted deletedAt checkedAt\n    }\n  }\n": types.GetItemsDocument,
  "\n  mutation CheckItem($id: ID!, $listId: ID!) {\n    checkItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n": types.CheckItemDocument,
  "\n  mutation UncheckItem($id: ID!, $listId: ID!) {\n    uncheckItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n": types.UncheckItemDocument,
  "\n  subscription GetItemUpdates($listId: ID!) {\n    getItemUpdates(listId: $listId) {\n      type\n      item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }\n    }\n  }\n": types.GetItemUpdatesDocument,
  "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            uncheckedItemCount\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}": types.ListsDocument,
  "mutation CreateList($name: String!, $emoji: String) {\n    createList(name: $name, emoji: $emoji) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}": types.CreateListDocument,
  "mutation DeleteList($id: ID!) {\n    deleteList(id: $id) { deletedItemCount deletedCategoryCount }\n}": types.DeleteListDocument,
  "mutation RenameList($id: ID!, $name: String!) {\n    renameList(id: $id, name: $name) { id name }\n}": types.RenameListDocument,
  "mutation LeaveList($listId: ID!) {\n    leaveList(listId: $listId)\n}": types.LeaveListDocument,
  "mutation AcceptInvite($listId: ID!) {\n    acceptInvite(listId: $listId) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}": types.AcceptInviteDocument,
  "mutation RejectInvite($listId: ID!) {\n    rejectInvite(listId: $listId)\n}": types.RejectInviteDocument,
    "query GetUsers {\n  users {\n    id\n    username\n    role\n  }\n}": types.GetUsersDocument,
    "mutation CreateUser($username: String!, $password: String!) {\n  createUser(username: $username, password: $password) {\n    id\n    username\n    role\n  }\n}": types.CreateUserDocument,
    "mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    id\n    username\n    role\n  }\n}": types.DeleteUserDocument,
    "mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n  resetUserPassword(id: $id, newPassword: $newPassword) {\n    id\n    username\n  }\n}": types.ResetUserPasswordDocument,
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
export function graphql(source: "\n  query GetCategories($listId: ID!) {\n    getCategories(listId: $listId) {\n      id name listId\n    }\n  }\n"): (typeof documents)["\n  query GetCategories($listId: ID!) {\n    getCategories(listId: $listId) {\n      id name listId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription GetCategoryUpdates($listId: ID!) {\n    getCategoryUpdates(listId: $listId) {\n      type\n      item { id name listId }\n    }\n  }\n"): (typeof documents)["\n  subscription GetCategoryUpdates($listId: ID!) {\n    getCategoryUpdates(listId: $listId) {\n      type\n      item { id name listId }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}"): (typeof documents)["query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}"): (typeof documents)["mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetItems($listId: ID!) {\n    getItems(listId: $listId) {\n      id name checked category listId store recurring addedBy deleted deletedAt checkedAt\n    }\n  }\n"): (typeof documents)["\n  query GetItems($listId: ID!) {\n    getItems(listId: $listId) {\n      id name checked category listId store recurring addedBy deleted deletedAt checkedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CheckItem($id: ID!, $listId: ID!) {\n    checkItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n"): (typeof documents)["\n  mutation CheckItem($id: ID!, $listId: ID!) {\n    checkItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UncheckItem($id: ID!, $listId: ID!) {\n    uncheckItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n"): (typeof documents)["\n  mutation UncheckItem($id: ID!, $listId: ID!) {\n    uncheckItem(id: $id, listId: $listId) {\n      id checked checkedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription GetItemUpdates($listId: ID!) {\n    getItemUpdates(listId: $listId) {\n      type\n      item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }\n    }\n  }\n"): (typeof documents)["\n  subscription GetItemUpdates($listId: ID!) {\n    getItemUpdates(listId: $listId) {\n      type\n      item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            uncheckedItemCount\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}"): (typeof documents)["query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            uncheckedItemCount\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateList($name: String!, $emoji: String) {\n    createList(name: $name, emoji: $emoji) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}"): (typeof documents)["mutation CreateList($name: String!, $emoji: String) {\n    createList(name: $name, emoji: $emoji) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteList($id: ID!) {\n    deleteList(id: $id) { deletedItemCount deletedCategoryCount }\n}"): (typeof documents)["mutation DeleteList($id: ID!) {\n    deleteList(id: $id) { deletedItemCount deletedCategoryCount }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RenameList($id: ID!, $name: String!) {\n    renameList(id: $id, name: $name) { id name }\n}"): (typeof documents)["mutation RenameList($id: ID!, $name: String!) {\n    renameList(id: $id, name: $name) { id name }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation LeaveList($listId: ID!) {\n    leaveList(listId: $listId)\n}"): (typeof documents)["mutation LeaveList($listId: ID!) {\n    leaveList(listId: $listId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AcceptInvite($listId: ID!) {\n    acceptInvite(listId: $listId) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}"): (typeof documents)["mutation AcceptInvite($listId: ID!) {\n    acceptInvite(listId: $listId) {\n        id name emoji ownerId ownerUsername createdAt uncheckedItemCount\n        members { userId username status }\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RejectInvite($listId: ID!) {\n    rejectInvite(listId: $listId)\n}"): (typeof documents)["mutation RejectInvite($listId: ID!) {\n    rejectInvite(listId: $listId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetUsers {\n  users {\n    id\n    username\n    role\n  }\n}"): (typeof documents)["query GetUsers {\n  users {\n    id\n    username\n    role\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateUser($username: String!, $password: String!) {\n  createUser(username: $username, password: $password) {\n    id\n    username\n    role\n  }\n}"): (typeof documents)["mutation CreateUser($username: String!, $password: String!) {\n  createUser(username: $username, password: $password) {\n    id\n    username\n    role\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    id\n    username\n    role\n  }\n}"): (typeof documents)["mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    id\n    username\n    role\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n  resetUserPassword(id: $id, newPassword: $newPassword) {\n    id\n    username\n  }\n}"): (typeof documents)["mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n  resetUserPassword(id: $id, newPassword: $newPassword) {\n    id\n    username\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
