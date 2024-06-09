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

export type Category = {
  __typename?: 'Category';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type CategoryInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type CategoryUpdate = {
  __typename?: 'CategoryUpdate';
  item: Category;
  type: CategoryUpdateType;
};

export enum CategoryUpdateType {
  Deleted = 'DELETED',
  Saved = 'SAVED'
}

export type Item = {
  __typename?: 'Item';
  category: Scalars['ID']['output'];
  checked: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ItemInput = {
  category: Scalars['ID']['input'];
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
  deleteCategory: Category;
  deleteItem: Item;
  saveCategory: Category;
  saveItem: Item;
};


export type MutationDeleteCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteItemArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSaveCategoryArgs = {
  category: CategoryInput;
};


export type MutationSaveItemArgs = {
  item: ItemInput;
};

export type Query = {
  __typename?: 'Query';
  getCategories: Array<Category>;
  getItems: Array<Item>;
};

export type Subscription = {
  __typename?: 'Subscription';
  getCategoryUpdates: CategoryUpdate;
  getItemUpdates: ItemUpdate;
};

export type GetCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCategoriesQuery = {
  __typename?: 'Query',
  getCategories: Array<{ __typename?: 'Category', id: string, name: string }>
};

export type SaveCategoryMutationVariables = Exact<{
  category: CategoryInput;
}>;


export type SaveCategoryMutation = {
  __typename?: 'Mutation',
  saveCategory: { __typename?: 'Category', id: string, name: string }
};

export type DeleteCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteCategoryMutation = {
  __typename?: 'Mutation',
  deleteCategory: { __typename?: 'Category', id: string, name: string }
};

export type CategoryUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type CategoryUpdatesSubscription = {
  __typename?: 'Subscription',
  getCategoryUpdates: {
    __typename?: 'CategoryUpdate',
    type: CategoryUpdateType,
    item: { __typename?: 'Category', id: string, name: string }
  }
};

export type GetItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetItemsQuery = {
  __typename?: 'Query',
  getItems: Array<{ __typename?: 'Item', id: string, name: string, checked: boolean, category: string }>
};

export type SaveItemMutationVariables = Exact<{
  item: ItemInput;
}>;


export type SaveItemMutation = {
  __typename?: 'Mutation',
  saveItem: { __typename?: 'Item', id: string, name: string, checked: boolean, category: string }
};

export type DeleteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteMutation = {
  __typename?: 'Mutation',
  deleteItem: { __typename?: 'Item', id: string, name: string, checked: boolean, category: string }
};

export type ItemUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ItemUpdatesSubscription = {
  __typename?: 'Subscription',
  getItemUpdates: {
    __typename?: 'ItemUpdate',
    type: ItemUpdateType,
    item: { __typename?: 'Item', id: string, name: string, checked: boolean, category: string }
  }
};


export const GetCategoriesDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "getCategories"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getCategories"},
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetCategoriesQuery, GetCategoriesQueryVariables>;
export const SaveCategoryDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "saveCategory"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "category"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "CategoryInput"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "saveCategory"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "category"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "category"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<SaveCategoryMutation, SaveCategoryMutationVariables>;
export const DeleteCategoryDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "deleteCategory"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "deleteCategory"},
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
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<DeleteCategoryMutation, DeleteCategoryMutationVariables>;
export const CategoryUpdatesDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "subscription",
    "name": {"kind": "Name", "value": "CategoryUpdates"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getCategoryUpdates"},
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
              }]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<CategoryUpdatesSubscription, CategoryUpdatesSubscriptionVariables>;
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
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "category"}
          }]
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
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "category"}
          }]
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
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "category"}
          }]
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
              }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "category"}
              }]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<ItemUpdatesSubscription, ItemUpdatesSubscriptionVariables>;
