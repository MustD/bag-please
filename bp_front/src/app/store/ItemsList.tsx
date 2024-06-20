'use client'
import {Grid} from "@mui/material";
import {useQuery} from "@apollo/client";
import {getItemsQuery, itemsSubscription} from "@/lib/item/Queries";
import React, {useEffect} from "react";
import Box from '@mui/material/Box';
import Typography from "@mui/material/Typography";
import {getCategoriesQuery} from "@/lib/category/Queries";
import {List} from "immutable";
import ItemView from "@/app/store/ItemView";
import {ItemUpdateType} from "@/__generated__/graphql";

// export type Item = { id: string, name: string, checked: boolean, category: string }

export default function ItemsList() {

  const {
    data: itemsData,
    loading: itemsLoading,
    error: itemsError,
    subscribeToMore: itemSubscription
  } = useQuery(getItemsQuery);
  const {data: categoryData, loading, error, subscribeToMore: categorySubscription} = useQuery(getCategoriesQuery);

  const subscribe = () => {
    itemSubscription({
      document: itemsSubscription,
      updateQuery: (prev, {subscriptionData}) => {
        if (!subscriptionData.data) return prev;
        const data = prev.getItems
        const update = subscriptionData.data.getItemUpdates
        const updatedData = data.filter((item) => item.id !== update.item.id)
        if (update.type == ItemUpdateType.Deleted) {
          return Object.assign({}, prev, {getItems: updatedData})
        } else {
          return Object.assign({}, prev, {getItems: [update.item, ...updatedData]})
        }
      }
    })
  }

  useEffect(() => subscribe(), [])


  const items = List(itemsData?.getItems || []).sortBy(item => item.name)
  const categories = List(categoryData?.getCategories || []).sortBy(category => category.name)

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <Grid container gap={1} direction={"column"}>
        {categories.map(category => (
          <Grid item key={category.id}>
            <Typography variant={"h6"}>{category.name}</Typography>
            <Grid container direction={"column"} gap={1}>
              {items.filter(item => item.category === category.id).map(item => (
                <Grid item key={item.id}>
                  <ItemView id={item.id} name={item.name} checked={item.checked} category={item.category}></ItemView>
                </Grid>
              ))}
            </Grid>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
