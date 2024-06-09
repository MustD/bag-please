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
 */
const documents = {
  "query getCategories {\n    getCategories {\n        id, name\n    }\n}": types.GetCategoriesDocument,
  "mutation saveCategory($category: CategoryInput!) {\n    saveCategory(category: $category){\n        id, name\n    }\n}": types.SaveCategoryDocument,
  "mutation deleteCategory($id: ID!) {\n    deleteCategory(id: $id){\n        id, name\n    }\n}": types.DeleteCategoryDocument,
  "subscription CategoryUpdates {\n    getCategoryUpdates {\n        type\n        item {\n            id\n            name\n        }\n    }\n}": types.CategoryUpdatesDocument,
  "query getItems {\n    getItems {\n        id, name, checked, category\n    }\n}": types.GetItemsDocument,
  "mutation saveItem($item: ItemInput!) {\n    saveItem(item: $item){\n        id, name, checked, category\n    }\n}": types.SaveItemDocument,
  "mutation delete($id: ID!) {\n    deleteItem(id: $id){\n        id, name, checked, category\n    }\n}": types.DeleteDocument,
  "subscription ItemUpdates {\n    getItemUpdates {\n        type\n        item {\n            id\n            name\n            checked\n            category\n        }\n    }\n}": types.ItemUpdatesDocument,
};

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = gql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function gql(source: string): unknown;

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "query getCategories {\n    getCategories {\n        id, name\n    }\n}"): (typeof documents)["query getCategories {\n    getCategories {\n        id, name\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "mutation saveCategory($category: CategoryInput!) {\n    saveCategory(category: $category){\n        id, name\n    }\n}"): (typeof documents)["mutation saveCategory($category: CategoryInput!) {\n    saveCategory(category: $category){\n        id, name\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "mutation deleteCategory($id: ID!) {\n    deleteCategory(id: $id){\n        id, name\n    }\n}"): (typeof documents)["mutation deleteCategory($id: ID!) {\n    deleteCategory(id: $id){\n        id, name\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "subscription CategoryUpdates {\n    getCategoryUpdates {\n        type\n        item {\n            id\n            name\n        }\n    }\n}"): (typeof documents)["subscription CategoryUpdates {\n    getCategoryUpdates {\n        type\n        item {\n            id\n            name\n        }\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "query getItems {\n    getItems {\n        id, name, checked, category\n    }\n}"): (typeof documents)["query getItems {\n    getItems {\n        id, name, checked, category\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "mutation saveItem($item: ItemInput!) {\n    saveItem(item: $item){\n        id, name, checked, category\n    }\n}"): (typeof documents)["mutation saveItem($item: ItemInput!) {\n    saveItem(item: $item){\n        id, name, checked, category\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "mutation delete($id: ID!) {\n    deleteItem(id: $id){\n        id, name, checked, category\n    }\n}"): (typeof documents)["mutation delete($id: ID!) {\n    deleteItem(id: $id){\n        id, name, checked, category\n    }\n}"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "subscription ItemUpdates {\n    getItemUpdates {\n        type\n        item {\n            id\n            name\n            checked\n            category\n        }\n    }\n}"): (typeof documents)["subscription ItemUpdates {\n    getItemUpdates {\n        type\n        item {\n            id\n            name\n            checked\n            category\n        }\n    }\n}"];

export function gql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
