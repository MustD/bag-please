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
