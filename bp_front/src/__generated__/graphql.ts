/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core';

export type CategoryUpdateType =
  | 'DELETED'
  | 'SAVED';

export type ItemUpdateType =
  | 'DELETED'
  | 'SAVED';

export type GetCategoriesQueryVariables = Exact<{
  listId: string | number;
}>;


export type GetCategoriesQuery = {
  getCategories: Array<{ __typename: 'Category', id: string, name: string, listId: string }>
};

export type GetCategoryUpdatesSubscriptionVariables = Exact<{
  listId: string | number;
}>;


export type GetCategoryUpdatesSubscription = {
  getCategoryUpdates: {
    __typename: 'CategoryUpdate',
    type: CategoryUpdateType,
    item: { __typename: 'Category', id: string, name: string, listId: string }
  }
};

export type GetApplicationConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type GetApplicationConfigQuery = { applicationConfig: { __typename: 'ApplicationConfig', registrationEnabled: boolean } };

export type SetRegistrationEnabledMutationVariables = Exact<{
  enabled: boolean;
}>;


export type SetRegistrationEnabledMutation = { setRegistrationEnabled: { __typename: 'ApplicationConfig', registrationEnabled: boolean } };

export type GetItemsQueryVariables = Exact<{
  listId: string | number;
}>;


export type GetItemsQuery = {
  getItems: Array<{
    __typename: 'Item',
    id: string,
    name: string,
    checked: boolean,
    category: string,
    listId: string,
    store: string | null,
    recurring: string | null,
    addedBy: string | null,
    deleted: boolean,
    deletedAt: string | null,
    checkedAt: string | null
  }>
};

export type CheckItemMutationVariables = Exact<{
  id: string | number;
  listId: string | number;
}>;


export type CheckItemMutation = {
  checkItem: { __typename: 'Item', id: string, checked: boolean, checkedAt: string | null }
};

export type UncheckItemMutationVariables = Exact<{
  id: string | number;
  listId: string | number;
}>;


export type UncheckItemMutation = {
  uncheckItem: { __typename: 'Item', id: string, checked: boolean, checkedAt: string | null }
};

export type GetItemUpdatesSubscriptionVariables = Exact<{
  listId: string | number;
}>;


export type GetItemUpdatesSubscription = {
  getItemUpdates: {
    __typename: 'ItemUpdate',
    type: ItemUpdateType,
    item: {
      __typename: 'Item',
      id: string,
      name: string,
      checked: boolean,
      category: string,
      listId: string,
      store: string | null,
      recurring: string | null,
      addedBy: string | null,
      deleted: boolean,
      deletedAt: string | null,
      checkedAt: string | null
    }
  }
};

export type ListsQueryVariables = Exact<{ [key: string]: never; }>;


export type ListsQuery = {
  lists: {
    __typename: 'ListsResult',
    lists: Array<{
      __typename: 'List',
      id: string,
      name: string,
      emoji: string | null,
      createdAt: string,
      ownerId: string,
      ownerUsername: string,
      uncheckedItemCount: number,
      members: Array<{ __typename: 'ListMember', userId: string, username: string, status: string }>
    }>,
    pendingInvites: Array<{
      __typename: 'PendingInvite',
      listId: string,
      listName: string,
      listEmoji: string | null,
      ownerUsername: string
    }>
  }
};

export type CreateListMutationVariables = Exact<{
  name: string;
  emoji?: string | null | undefined;
}>;


export type CreateListMutation = {
  createList: {
    __typename: 'List',
    id: string,
    name: string,
    emoji: string | null,
    ownerId: string,
    ownerUsername: string,
    createdAt: string,
    uncheckedItemCount: number,
    members: Array<{ __typename: 'ListMember', userId: string, username: string, status: string }>
  }
};

export type DeleteListMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteListMutation = {
  deleteList: { __typename: 'DeleteListResult', deletedItemCount: number, deletedCategoryCount: number }
};

export type RenameListMutationVariables = Exact<{
  id: string | number;
  name: string;
}>;


export type RenameListMutation = { renameList: { __typename: 'List', id: string, name: string } };

export type LeaveListMutationVariables = Exact<{
  listId: string | number;
}>;


export type LeaveListMutation = { leaveList: boolean };

export type AcceptInviteMutationVariables = Exact<{
  listId: string | number;
}>;


export type AcceptInviteMutation = {
  acceptInvite: {
    __typename: 'List',
    id: string,
    name: string,
    emoji: string | null,
    ownerId: string,
    ownerUsername: string,
    createdAt: string,
    uncheckedItemCount: number,
    members: Array<{ __typename: 'ListMember', userId: string, username: string, status: string }>
  }
};

export type RejectInviteMutationVariables = Exact<{
  listId: string | number;
}>;


export type RejectInviteMutation = { rejectInvite: boolean };

export type GetUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUsersQuery = { users: Array<{ __typename: 'User', id: string, username: string, role: string }> };

export type CreateUserMutationVariables = Exact<{
  username: string;
  password: string;
}>;


export type CreateUserMutation = { createUser: { __typename: 'User', id: string, username: string, role: string } };

export type DeleteUserMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteUserMutation = { deleteUser: { __typename: 'User', id: string, username: string, role: string } };

export type ResetUserPasswordMutationVariables = Exact<{
  id: string | number;
  newPassword: string;
}>;


export type ResetUserPasswordMutation = { resetUserPassword: { __typename: 'User', id: string, username: string } };


export const GetCategoriesDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "GetCategories"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getCategories"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "listId"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetCategoriesQuery, GetCategoriesQueryVariables>;
export const GetCategoryUpdatesDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "subscription",
    "name": {"kind": "Name", "value": "GetCategoryUpdates"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getCategoryUpdates"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
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
              }, {"kind": "Field", "name": {"kind": "Name", "value": "listId"}}]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetCategoryUpdatesSubscription, GetCategoryUpdatesSubscriptionVariables>;
export const GetApplicationConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetApplicationConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"applicationConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registrationEnabled"}}]}}]}}]} as unknown as DocumentNode<GetApplicationConfigQuery, GetApplicationConfigQueryVariables>;
export const SetRegistrationEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetRegistrationEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setRegistrationEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registrationEnabled"}}]}}]}}]} as unknown as DocumentNode<SetRegistrationEnabledMutation, SetRegistrationEnabledMutationVariables>;
export const GetItemsDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "GetItems"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getItems"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checked"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "category"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "listId"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "store"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "recurring"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "addedBy"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "deleted"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "deletedAt"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checkedAt"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetItemsQuery, GetItemsQueryVariables>;
export const CheckItemDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "CheckItem"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "checkItem"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "checked"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checkedAt"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<CheckItemMutation, CheckItemMutationVariables>;
export const UncheckItemDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "UncheckItem"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "uncheckItem"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "checked"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "checkedAt"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<UncheckItemMutation, UncheckItemMutationVariables>;
export const GetItemUpdatesDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "subscription",
    "name": {"kind": "Name", "value": "GetItemUpdates"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet", "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "getItemUpdates"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
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
              }, {"kind": "Field", "name": {"kind": "Name", "value": "listId"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "store"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "recurring"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "addedBy"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "deleted"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "deletedAt"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "checkedAt"}}]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<GetItemUpdatesSubscription, GetItemUpdatesSubscriptionVariables>;
export const ListsDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition", "operation": "query", "name": {"kind": "Name", "value": "Lists"}, "selectionSet": {
      "kind": "SelectionSet", "selections": [{
        "kind": "Field", "name": {"kind": "Name", "value": "lists"}, "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{
            "kind": "Field",
            "name": {"kind": "Name", "value": "lists"},
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "name"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "emoji"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "createdAt"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "ownerId"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "ownerUsername"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "uncheckedItemCount"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "members"},
                "selectionSet": {
                  "kind": "SelectionSet",
                  "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "userId"}}, {
                    "kind": "Field",
                    "name": {"kind": "Name", "value": "username"}
                  }, {"kind": "Field", "name": {"kind": "Name", "value": "status"}}]
                }
              }]
            }
          }, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "pendingInvites"},
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "listId"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "listName"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "listEmoji"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "ownerUsername"}
              }]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<ListsQuery, ListsQueryVariables>;
export const CreateListDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "CreateList"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "name"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "emoji"}},
      "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}
    }],
    "selectionSet": {
      "kind": "SelectionSet", "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "createList"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "name"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "name"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "emoji"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "emoji"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "emoji"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "ownerId"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "ownerUsername"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "createdAt"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "uncheckedItemCount"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "members"},
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "userId"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "username"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "status"}}]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<CreateListMutation, CreateListMutationVariables>;
export const DeleteListDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "DeleteList"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "deleteList"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "deletedItemCount"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "deletedCategoryCount"}
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<DeleteListMutation, DeleteListMutationVariables>;
export const RenameListDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "RenameList"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "name"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "renameList"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "name"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "name"}}
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
} as unknown as DocumentNode<RenameListMutation, RenameListMutationVariables>;
export const LeaveListDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "LeaveList"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "leaveList"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }]
      }]
    }
  }]
} as unknown as DocumentNode<LeaveListMutation, LeaveListMutationVariables>;
export const AcceptInviteDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "AcceptInvite"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "acceptInvite"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "name"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "emoji"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "ownerId"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "ownerUsername"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "createdAt"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "uncheckedItemCount"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "members"},
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "userId"}}, {
                "kind": "Field",
                "name": {"kind": "Name", "value": "username"}
              }, {"kind": "Field", "name": {"kind": "Name", "value": "status"}}]
            }
          }]
        }
      }]
    }
  }]
} as unknown as DocumentNode<AcceptInviteMutation, AcceptInviteMutationVariables>;
export const RejectInviteDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "RejectInvite"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "rejectInvite"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "listId"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "listId"}}
        }]
      }]
    }
  }]
} as unknown as DocumentNode<RejectInviteMutation, RejectInviteMutationVariables>;
export const GetUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]} as unknown as DocumentNode<GetUsersQuery, GetUsersQueryVariables>;
export const CreateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]} as unknown as DocumentNode<CreateUserMutation, CreateUserMutationVariables>;
export const DeleteUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]} as unknown as DocumentNode<DeleteUserMutation, DeleteUserMutationVariables>;
export const ResetUserPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetUserPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetUserPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"newPassword"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]} as unknown as DocumentNode<ResetUserPasswordMutation, ResetUserPasswordMutationVariables>;
