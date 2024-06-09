import {gql} from "@/__generated__";

export const getCategoriesQuery = gql(`query getCategories {
    getCategories {
        id, name
    }
}`);

export const createCategoryMutation = gql(`mutation saveCategory($category: CategoryInput!) {
    saveCategory(category: $category){
        id, name
    }
}`);

export const deleteCategoryMutation = gql(`mutation deleteCategory($id: ID!) {
    deleteCategory(id: $id){
        id, name
    }
}`);

export const categoriesSubscription = gql(`subscription CategoryUpdates {
    getCategoryUpdates {
        type
        item {
            id
            name
        }
    }
}`);
