import {graphql} from '@/__generated__'
// Aliased: the generated result type shares the operation's name (AdminUsersQuery),
// which would collide with the exported document constant of the same name below.
import type {AdminUsersQuery as AdminUsersQueryResult} from '@/__generated__/graphql'

// A single row of the admin users table, derived from the generated query type
// (no inline GraphQL response types — project rule). Shared by AdminPage and the
// delete/reset dialogs.
export type AdminUser = AdminUsersQueryResult['users'][number]

// Admin GraphQL operations (Story 5.4) — the first generated operations of the
// Epic-5 reframe. Authored with the graphql() tagged template so codegen
// (`npm run generate`) discovers them and emits typed documents into
// src/__generated__/. All admin operations are GraphQL over the existing Apollo
// HTTP link (AR2); there are no REST admin endpoints. Every operation requires
// the admin role server-side (a non-admin principal → FORBIDDEN).
//
// Consume these via useQuery/useMutation from @apollo/client/react in AdminPage
// and the dialogs; never hand-edit the generated output.

export const AdminUsersQuery = graphql(`
    query AdminUsers {
        users {
            id
            username
            role
        }
    }
`)

export const AdminConfigQuery = graphql(`
    query AdminConfig {
        applicationConfig {
            registrationEnabled
        }
    }
`)

export const CreateUserMutation = graphql(`
    mutation CreateUser($username: String!, $password: String!) {
        createUser(username: $username, password: $password) {
            id
            username
            role
        }
    }
`)

export const DeleteUserMutation = graphql(`
    mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) {
            id
        }
    }
`)

export const ResetUserPasswordMutation = graphql(`
    mutation ResetUserPassword($id: ID!, $newPassword: String!) {
        resetUserPassword(id: $id, newPassword: $newPassword) {
            id
        }
    }
`)

export const SetRegistrationEnabledMutation = graphql(`
    mutation SetRegistrationEnabled($enabled: Boolean!) {
        setRegistrationEnabled(enabled: $enabled) {
            registrationEnabled
        }
    }
`)
