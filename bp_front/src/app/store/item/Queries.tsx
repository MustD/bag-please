import {gql} from "@/__generated__";

export const getItemsQuery = gql(`query getItems {
    getItems {
        id, name, checked
    }
}`);

export const createItemMutation = gql(`mutation saveItem($item: ItemInput!) {
    saveItem(item: $item){
        id, name, checked
    }
}`);

export const deleteItemMutation = gql(`mutation delete($id: ID!) {
    deleteItem(id: $id){
        id, name, checked
    }
}`);

export const itemsSubscription = gql(`subscription ItemUpdates {
    getItemUpdates {
        type
        item {
            id
            name
            checked
        }
    }
}`);
