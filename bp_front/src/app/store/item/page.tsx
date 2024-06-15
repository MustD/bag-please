'use client'

import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";
import CreateItem from "@/app/store/item/CreateItem";
import {useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/app/store/category/Queries";
import React, {useEffect} from "react";
import {getItemsQuery, itemsSubscription} from "@/app/store/item/Queries";
import {ItemUpdateType} from "@/__generated__/graphql";
import {List} from "immutable";
import Typography from "@mui/material/Typography";

/**
 * Todo: Add category name subscription to handle category name change
 * Todo: Add item edit controls, editable name, category, checked state, also handle delete.
 * @constructor
 */
export default function ItemsPage() {
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
  const categories = List(categoryData?.getCategories || [])

  return (
    <Paper sx={{p: 1}}>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <TableContainer component={Paper}>
        <Table sx={{minWidth: 650}} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Item name</TableCell>
              <TableCell align="right">Checked</TableCell>
              <TableCell align="right">Category</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                <TableCell component="th" scope="row"> {item.name}</TableCell>
                <TableCell align="right">{String(item.checked)}</TableCell>
                <TableCell
                  align="right">{categories.find(category => category.id === item.category)?.name || "not found"}</TableCell>
                <TableCell align="right">Controls</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <CreateItem/>
    </Paper>
  );
}
