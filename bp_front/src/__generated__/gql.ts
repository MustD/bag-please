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
    "\n  query AdminUsers {\n    users {\n      id\n      username\n      role\n    }\n  }\n": typeof types.AdminUsersDocument,
    "\n  query AdminConfig {\n    applicationConfig {\n      registrationEnabled\n    }\n  }\n": typeof types.AdminConfigDocument,
    "\n  mutation CreateUser($username: String!, $password: String!) {\n    createUser(username: $username, password: $password) {\n      id\n      username\n      role\n    }\n  }\n": typeof types.CreateUserDocument,
    "\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteUserDocument,
    "\n  mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n    resetUserPassword(id: $id, newPassword: $newPassword) {\n      id\n    }\n  }\n": typeof types.ResetUserPasswordDocument,
    "\n  mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n      registrationEnabled\n    }\n  }\n": typeof types.SetRegistrationEnabledDocument,
};
const documents: Documents = {
    "\n  query AdminUsers {\n    users {\n      id\n      username\n      role\n    }\n  }\n": types.AdminUsersDocument,
    "\n  query AdminConfig {\n    applicationConfig {\n      registrationEnabled\n    }\n  }\n": types.AdminConfigDocument,
    "\n  mutation CreateUser($username: String!, $password: String!) {\n    createUser(username: $username, password: $password) {\n      id\n      username\n      role\n    }\n  }\n": types.CreateUserDocument,
    "\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n": types.DeleteUserDocument,
    "\n  mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n    resetUserPassword(id: $id, newPassword: $newPassword) {\n      id\n    }\n  }\n": types.ResetUserPasswordDocument,
    "\n  mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n      registrationEnabled\n    }\n  }\n": types.SetRegistrationEnabledDocument,
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
export function graphql(source: "\n  query AdminUsers {\n    users {\n      id\n      username\n      role\n    }\n  }\n"): (typeof documents)["\n  query AdminUsers {\n    users {\n      id\n      username\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AdminConfig {\n    applicationConfig {\n      registrationEnabled\n    }\n  }\n"): (typeof documents)["\n  query AdminConfig {\n    applicationConfig {\n      registrationEnabled\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateUser($username: String!, $password: String!) {\n    createUser(username: $username, password: $password) {\n      id\n      username\n      role\n    }\n  }\n"): (typeof documents)["\n  mutation CreateUser($username: String!, $password: String!) {\n    createUser(username: $username, password: $password) {\n      id\n      username\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n    resetUserPassword(id: $id, newPassword: $newPassword) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation ResetUserPassword($id: ID!, $newPassword: String!) {\n    resetUserPassword(id: $id, newPassword: $newPassword) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n      registrationEnabled\n    }\n  }\n"): (typeof documents)["\n  mutation SetRegistrationEnabled($enabled: Boolean!) {\n    setRegistrationEnabled(enabled: $enabled) {\n      registrationEnabled\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
