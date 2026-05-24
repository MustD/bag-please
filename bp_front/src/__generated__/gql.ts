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
    "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}": typeof types.GetApplicationConfigDocument,
    "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}": typeof types.SetRegistrationEnabledDocument,
    "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}": typeof types.ListsDocument,
    "query GetUsers {\n  users {\n    id\n    username\n    role\n  }\n}": typeof types.GetUsersDocument,
    "mutation CreateUser($username: String!, $password: String!) {\n  createUser(username: $username, password: $password) {\n    id\n    username\n    role\n  }\n}": typeof types.CreateUserDocument,
    "mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    id\n    username\n    role\n  }\n}": typeof types.DeleteUserDocument,
    "mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n  resetUserPassword(id: $id, newPassword: $newPassword) {\n    id\n    username\n  }\n}": typeof types.ResetUserPasswordDocument,
};
const documents: Documents = {
    "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}": types.GetApplicationConfigDocument,
    "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}": types.SetRegistrationEnabledDocument,
    "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}": types.ListsDocument,
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
export function graphql(source: "query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}"): (typeof documents)["query GetApplicationConfig {\n    applicationConfig {\n        registrationEnabled\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}"): (typeof documents)["mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n        registrationEnabled\n    }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}"): (typeof documents)["query Lists {\n    lists {\n        lists {\n            id\n            name\n            emoji\n            createdAt\n            ownerId\n            ownerUsername\n            members {\n                userId\n                username\n                status\n            }\n        }\n        pendingInvites {\n            listId\n            listName\n            listEmoji\n            ownerUsername\n        }\n    }\n}"];
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