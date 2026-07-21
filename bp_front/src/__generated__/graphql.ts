/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core';

export type AdminUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminUsersQuery = { users: Array<{ __typename: 'User', id: string, username: string, role: string }> };

export type AdminConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminConfigQuery = { applicationConfig: { __typename: 'ApplicationConfig', registrationEnabled: boolean } };

export type CreateUserMutationVariables = Exact<{
  username: string;
  password: string;
}>;


export type CreateUserMutation = { createUser: { __typename: 'User', id: string, username: string, role: string } };

export type DeleteUserMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteUserMutation = { deleteUser: { __typename: 'User', id: string } };

export type ResetUserPasswordMutationVariables = Exact<{
  id: string | number;
  newPassword: string;
}>;


export type ResetUserPasswordMutation = { resetUserPassword: { __typename: 'User', id: string } };

export type SetRegistrationEnabledMutationVariables = Exact<{
  enabled: boolean;
}>;


export type SetRegistrationEnabledMutation = {
  setRegistrationEnabled: { __typename: 'ApplicationConfig', registrationEnabled: boolean }
};


export const AdminUsersDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "AdminUsers"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "users"},
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "username"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "role"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<AdminUsersQuery, AdminUsersQueryVariables>;
export const AdminConfigDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "query",
    "name": {"kind": "Name", "value": "AdminConfig"},
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "applicationConfig"},
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "registrationEnabled"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<AdminConfigQuery, AdminConfigQueryVariables>;
export const CreateUserDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "CreateUser"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "username"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "password"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "createUser"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "username"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "username"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "password"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "password"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}, {
            "kind": "Field",
            "name": {"kind": "Name", "value": "username"}
          }, {"kind": "Field", "name": {"kind": "Name", "value": "role"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<CreateUserMutation, CreateUserMutationVariables>;
export const DeleteUserDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "DeleteUser"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "deleteUser"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<DeleteUserMutation, DeleteUserMutationVariables>;
export const ResetUserPasswordDocument = {
  "kind": "Document", "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "ResetUserPassword"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "ID"}}}
    }, {
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "newPassword"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "String"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "resetUserPassword"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "id"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "id"}}
        }, {
          "kind": "Argument",
          "name": {"kind": "Name", "value": "newPassword"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "newPassword"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "id"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<ResetUserPasswordMutation, ResetUserPasswordMutationVariables>;
export const SetRegistrationEnabledDocument = {
  "kind": "Document",
  "definitions": [{
    "kind": "OperationDefinition",
    "operation": "mutation",
    "name": {"kind": "Name", "value": "SetRegistrationEnabled"},
    "variableDefinitions": [{
      "kind": "VariableDefinition",
      "variable": {"kind": "Variable", "name": {"kind": "Name", "value": "enabled"}},
      "type": {"kind": "NonNullType", "type": {"kind": "NamedType", "name": {"kind": "Name", "value": "Boolean"}}}
    }],
    "selectionSet": {
      "kind": "SelectionSet",
      "selections": [{
        "kind": "Field",
        "name": {"kind": "Name", "value": "setRegistrationEnabled"},
        "arguments": [{
          "kind": "Argument",
          "name": {"kind": "Name", "value": "enabled"},
          "value": {"kind": "Variable", "name": {"kind": "Name", "value": "enabled"}}
        }],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [{"kind": "Field", "name": {"kind": "Name", "value": "registrationEnabled"}}]
        }
      }]
    }
  }]
} as unknown as DocumentNode<SetRegistrationEnabledMutation, SetRegistrationEnabledMutationVariables>;
