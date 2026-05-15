import {graphql} from "@/__generated__";

export const getUsersQuery = graphql(`query GetUsers {
  users {
    id
    username
    role
  }
}`);

export const createUserMutation = graphql(`mutation CreateUser($username: String!, $password: String!) {
  createUser(username: $username, password: $password) {
    id
    username
    role
  }
}`);

export const deleteUserMutation = graphql(`mutation DeleteUser($id: ID!) {
  deleteUser(id: $id) {
    id
    username
    role
  }
}`);

export const resetUserPasswordMutation = graphql(`mutation ResetUserPassword($id: ID!, $newPassword: String!) {
  resetUserPassword(id: $id, newPassword: $newPassword) {
    id
    username
  }
}`);
