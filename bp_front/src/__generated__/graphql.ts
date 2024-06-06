/* eslint-disable */
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core';

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Item = {
  __typename?: 'Item';
  checked: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ItemInput = {
  checked: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type ItemUpdate = {
  __typename?: 'ItemUpdate';
  item: Item;
  type: ItemUpdateType;
};

export enum ItemUpdateType {
  Deleted = 'DELETED',
  Saved = 'SAVED'
}

export type Mutation = {
  __typename?: 'Mutation';
  deleteItem: Item;
  saveItem: Item;
};


export type MutationDeleteItemArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSaveItemArgs = {
  item: ItemInput;
};

export type Query = {
  __typename?: 'Query';
  getItems: Array<Item>;
};

export type Subscription = {
  __typename?: 'Subscription';
  getItemUpdates: ItemUpdate;
};

export type GetItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetItemsQuery = {
  __typename?: 'Query',
  getItems: Array<{ __typename?: 'Item', id: string, name: string, checked: boolean }>
};

export type SaveItemMutationVariables = Exact<{
  item: ItemInput;
}>;


export type SaveItemMutation = {
  __typename?: 'Mutation',
  saveItem: { __typename?: 'Item', id: string, name: string, checked: boolean }
};

export type DeleteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteMutation = {
  __typename?: 'Mutation',
  deleteItem: { __typename?: 'Item', id: string, name: string, checked: boolean }
};

export type ItemUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ItemUpdatesSubscription = {
  __typename?: 'Subscription',
  getItemUpdates: {
    __typename?: 'ItemUpdate',
    type: ItemUpdateType,
    item: { __typename?: 'Item', id: string, name: string, checked: boolean }
  }
};


export const GetItemsDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "getItems"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getItems"},
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetItemsQuery, GetItemsQueryVariables>;
export const SaveItemDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "saveItem"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "item"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ItemInput"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "saveItem"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "item"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "item"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<SaveItemMutation, SaveItemMutationVariables>;
export const DeleteDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "delete"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "deleteItem"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<DeleteMutation, DeleteMutationVariables>;
export const ItemUpdatesDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "subscription",
    "name": {"kind": "Name", "value": "ItemUpdates"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getItemUpdates"},
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "type"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "item"},
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "name"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<ItemUpdatesSubscription, ItemUpdatesSubscriptionVariables>;
