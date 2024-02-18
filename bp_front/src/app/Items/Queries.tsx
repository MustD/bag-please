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
