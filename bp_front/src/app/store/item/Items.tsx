'use client'
import {Box, FormGroup} from "@mui/material";
import React, {useEffect} from "react";
import Typography from "@mui/material/Typography";
import {useQuery} from "@apollo/client";
import {getItemsQuery, itemsSubscription} from "@/app/store/item/Queries";
import EditItem from "@/app/store/item/EditItem";
import {ItemUpdateType} from "@/__generated__/graphql";


export default function Items(props: { categoryId: string; categoryName: string }) {
  const {data, loading, error, subscribeToMore} = useQuery(getItemsQuery);
  const subscribe = () => {
    subscribeToMore({
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

  const values = data?.getItems
  const toRender = values ? [...values].sort((a, b) => (a.name < b.name ? -1 : 1)) : []
  const filtered = toRender.filter(item => item.category.match(props.categoryId));

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormGroup>
        <Typography style={{color: 'lightgreen'}} variant={"subtitle1"}>{props.categoryName}</Typography>
        {filtered?.map(item => (
          <EditItem key={item.id} id={item.id} name={item.name} checked={item.checked} category={item.category}/>
        ))}
      </FormGroup>
    </Box>
  );
}
