import {graphql} from "@/__generated__";

export const listsQuery = graphql(`query Lists {
    lists {
        lists {
            id
            name
            emoji
            createdAt
            ownerId
            ownerUsername
            uncheckedItemCount
            members {
                userId
                username
                status
            }
        }
        pendingInvites {
            listId
            listName
            listEmoji
            ownerUsername
        }
    }
}`);

export const createListMutation = graphql(`mutation CreateList($name: String!, $emoji: String) {
    createList(name: $name, emoji: $emoji) {
        id name emoji ownerId ownerUsername createdAt uncheckedItemCount
        members { userId username status }
    }
}`);

export const deleteListMutation = graphql(`mutation DeleteList($id: ID!) {
    deleteList(id: $id) { deletedItemCount deletedCategoryCount }
}`);

export const renameListMutation = graphql(`mutation RenameList($id: ID!, $name: String!) {
    renameList(id: $id, name: $name) { id name }
}`);

export const leaveListMutation = graphql(`mutation LeaveList($listId: ID!) {
    leaveList(listId: $listId)
}`);

export const acceptInviteMutation = graphql(`mutation AcceptInvite($listId: ID!) {
    acceptInvite(listId: $listId) {
        id name emoji ownerId ownerUsername createdAt uncheckedItemCount
        members { userId username status }
    }
}`);

export const rejectInviteMutation = graphql(`mutation RejectInvite($listId: ID!) {
    rejectInvite(listId: $listId)
}`);
