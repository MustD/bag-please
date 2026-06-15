import {graphql} from "@/__generated__"

export const getCategoriesQuery = graphql(`
  query GetCategories($listId: ID!) {
    getCategories(listId: $listId) {
      id name listId
    }
  }
`)

export const saveCategoryMutation = graphql(`
  mutation SaveCategory($id: ID!, $name: String!, $listId: ID!) {
    saveCategory(category: {id: $id, name: $name, listId: $listId}) {
      id name listId
    }
  }
`)

export const getCategoryUpdatesSubscription = graphql(`
  subscription GetCategoryUpdates($listId: ID!) {
    getCategoryUpdates(listId: $listId) {
      type
      item { id name listId }
    }
  }
`)
