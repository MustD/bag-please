import {graphql} from "@/__generated__"

export const getItemsQuery = graphql(`
  query GetItems($listId: ID!) {
    getItems(listId: $listId) {
      id name checked category listId store recurring addedBy deleted deletedAt checkedAt
    }
  }
`)

export const saveItemMutation = graphql(`
  mutation SaveItem($item: ItemInput!) {
    saveItem(item: $item) {
      id name checked category listId store recurring addedBy deleted deletedAt checkedAt
    }
  }
`)

export const checkItemMutation = graphql(`
  mutation CheckItem($id: ID!, $listId: ID!) {
    checkItem(id: $id, listId: $listId) {
      id checked checkedAt
    }
  }
`)

export const uncheckItemMutation = graphql(`
  mutation UncheckItem($id: ID!, $listId: ID!) {
    uncheckItem(id: $id, listId: $listId) {
      id checked checkedAt
    }
  }
`)

export const getItemUpdatesSubscription = graphql(`
  subscription GetItemUpdates($listId: ID!) {
    getItemUpdates(listId: $listId) {
      type
      item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }
    }
  }
`)
