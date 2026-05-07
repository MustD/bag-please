/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core';

export type CategoryInput = {
  id: string | number;
  name: string;
};

export type CategoryUpdateType =
  | 'DELETED'
  | 'SAVED';

export type ItemInput = {
  category: string;
  checked: boolean;
  id: string | number;
  name: string;
};

export type ItemUpdateType =
  | 'DELETED'
  | 'SAVED';

export type GetCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCategoriesQuery = { getCategories: Array<{ __typename: 'Category', id: string, name: string }> };

export type SaveCategoryMutationVariables = Exact<{
  category: CategoryInput;
}>;


export type SaveCategoryMutation = { saveCategory: { __typename: 'Category', id: string, name: string } };

export type DeleteCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCategoryMutation = { deleteCategory: { __typename: 'Category', id: string, name: string } };

export type CategoryUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type CategoryUpdatesSubscription = {
  getCategoryUpdates: {
    __typename: 'CategoryUpdate',
    type: CategoryUpdateType,
    item: { __typename: 'Category', id: string, name: string }
  }
};

export type GetItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetItemsQuery = {
  getItems: Array<{ __typename: 'Item', id: string, name: string, checked: boolean, category: string }>
};

export type SaveItemMutationVariables = Exact<{
  item: ItemInput;
}>;


export type SaveItemMutation = {
  saveItem: { __typename: 'Item', id: string, name: string, checked: boolean, category: string }
};

export type DeleteMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteMutation = {
  deleteItem: { __typename: 'Item', id: string, name: string, checked: boolean, category: string }
};

export type ItemUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ItemUpdatesSubscription = {
  getItemUpdates: {
    __typename: 'ItemUpdate',
    type: ItemUpdateType,
    item: { __typename: 'Item', id: string, name: string, checked: boolean, category: string }
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
