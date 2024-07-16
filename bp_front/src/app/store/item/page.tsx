'use client'

import {
  Box,
  Button,
  Checkbox,
  Fab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import CreateItem from "@/app/store/item/CreateItem";
import {useMutation, useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/lib/category/Queries";
import React, {useEffect, useState} from "react";
import {createItemMutation, getItemsQuery, itemsSubscription} from "@/lib/item/Queries";
import {ItemUpdateType} from "@/__generated__/graphql";
import {List} from "immutable";
import Typography from "@mui/material/Typography";
import {v4 as uuid} from "uuid"
import AddIcon from "@mui/icons-material/Add";


/**
 * Todo: Add category name subscription to handle category name change
 * Todo: Add item edit controls, editable name, category, checked state, also handle delete.
 * @constructor
 */
export type Item = { id: string, name: string, checked: boolean, category: string }

export default function ItemsPage() {
  const {
    data: itemsData,
    loading: itemsLoading,
    error: itemsError,
    subscribeToMore: itemSubscription
  } = useQuery(getItemsQuery);
  const {data: categoryData, subscribeToMore: categorySubscription} = useQuery(getCategoriesQuery);

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

  const [saveItem] = useMutation(createItemMutation);
  const updateItemState = (itemToSave: Item, state: boolean) => {
    saveItem({
      variables: {
        item: {
          id: itemToSave.id,
          name: itemToSave.name,
          checked: state,
          category: itemToSave.category
        }
      }
    })
  }

  const [itemToEdit, setItemToEdit] = useState<Item>();
  const [isNew, setIsNew] = useState(false);

  const items = List(itemsData?.getItems || []).sortBy(item => item.name)
  const categories = List(categoryData?.getCategories || [])

  return (
    <Box sx={{p: 1}}>
      {itemsLoading && <Typography>Loading...</Typography>}
      {itemsError && <Typography variant={"caption"} sx={{color: "error.main"}}>{itemsError.message}</Typography>}
      <TableContainer component={Paper}>
        <Table aria-label="items table" size={"small"}>
          <TableHead>
            <TableRow>
              <TableCell align="center">Checked</TableCell>
              <TableCell>Item name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox checked={item.checked} onChange={() => updateItemState(item, !item.checked)}/>
                </TableCell>
                <TableCell>
                  <Typography>{item.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography>{categories.find(category => category.id === item.category)?.name || "not found"}</Typography>
                </TableCell>
                <TableCell align={"right"}>
                  <Button
                    onClick={() => {
                      setItemToEdit(item)
                    }}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Fab
        size="large"
        color="secondary"
        aria-label="add"
        onClick={() => {
          setItemToEdit({
            id: uuid(),
            name: "",
            checked: false,
            category: ""
          })
          setIsNew(true)
        }
        }
        style={{position: "fixed", right: "60px", bottom: "60px"}}
      >
        <AddIcon/>
      </Fab>
      <CreateItem
        item={itemToEdit}
        isNew={isNew}
        onClose={() => {
          setItemToEdit(undefined)
          setIsNew(false)
        }}
      />
    </Box>
  );
}
