import {graphql} from "@/__generated__";

export const getCategoriesQuery = graphql(`query getCategories {
    getCategories {
        id, name
    }
}`);

export const createCategoryMutation = graphql(`mutation saveCategory($category: CategoryInput!) {
    saveCategory(category: $category){
        id, name
    }
}`);

export const deleteCategoryMutation = graphql(`mutation deleteCategory($id: ID!) {
    deleteCategory(id: $id){
        id, name
    }
}`);

export const categoriesSubscription = graphql(`subscription CategoryUpdates {
    getCategoryUpdates {
        type
        item {
            id
            name
        }
    }
}`);
