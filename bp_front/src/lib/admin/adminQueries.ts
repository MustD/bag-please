import {graphql} from '@/__generated__'
// Aliased: the generated result type shares the operation's name (AdminUsersQuery),
// which would collide with the exported document constant of the same name below.
import type {AdminUsersQuery as AdminUsersQueryResult} from '@/__generated__/graphql'

// A single row of the admin users table, derived from the generated query type
// (no inline GraphQL response types — project rule). Shared by AdminPage and the
// delete/reset dialogs.
export type AdminUser = AdminUsersQueryResult['users']['users'][number]

// Admin GraphQL operations (Story 5.4) — the first generated operations of the
// Epic-5 reframe. Authored with the graphql() tagged template so codegen
// (`npm run generate`) discovers them and emits typed documents into
// src/__generated__/. All admin operations are GraphQL over the existing Apollo
// HTTP link (AR2); there are no REST admin endpoints. Every operation requires
// the admin role server-side (a non-admin principal → FORBIDDEN).
//
// Consume these via useQuery/useMutation from @apollo/client/react in AdminPage
// and the dialogs; never hand-edit the generated output.

// Server-paged (Story 9.2). The unpaginated form rendered every row in the
// database, and the create-user dialog's close was gated behind that re-render.
//
// The SERVER owns ordering, clamping and page location: `offset` comes back as
// the page actually served (clamped to 0..lastPage), and `around` locates the
// page containing a given username — which is how the panel jumps to a row it
// just created without walking pages.
export const AdminUsersQuery = graphql(`
    query AdminUsers($limit: Int!, $offset: Int, $around: String) {
        users(limit: $limit, offset: $offset, around: $around) {
            users {
                id
                username
                role
            }
            totalCount
            offset
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
