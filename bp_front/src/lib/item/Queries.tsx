import {graphql} from "@/__generated__";

export const getItemsQuery = graphql(`query getItems {
    getItems {
        id, name, checked, category
    }
}`);

export const createItemMutation = graphql(`mutation saveItem($item: ItemInput!) {
    saveItem(item: $item){
        id, name, checked, category
    }
}`);

export const deleteItemMutation = graphql(`mutation delete($id: ID!) {
    deleteItem(id: $id){
        id, name, checked, category
    }
}`);

export const itemsSubscription = graphql(`subscription ItemUpdates {
    getItemUpdates {
        type
        item {
            id
            name
            checked
            category
        }
    }
}`);
