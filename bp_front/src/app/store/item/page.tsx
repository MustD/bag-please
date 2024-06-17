'use client'

import {
  Button,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";
import CreateItem from "@/app/store/item/CreateItem";
import {useMutation, useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/app/store/category/Queries";
import React, {useEffect, useState} from "react";
import {createItemMutation, getItemsQuery, itemsSubscription} from "@/app/store/item/Queries";
import {ItemUpdateType} from "@/__generated__/graphql";
import {List} from "immutable";
import Typography from "@mui/material/Typography";
import {v4 as uuid} from "uuid"
import Categories from "@/app/store/category/Categories";


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
  const {data: categoryData, loading, error, subscribeToMore: categorySubscription} = useQuery(getCategoriesQuery);
  const [saveItem] = useMutation(createItemMutation);

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


  const [editItemName, setEditItemName] = useState("")
  const [editItemCategory, setEditItemCategory] = useState("")
  const [currentEdit, setCurrentEdit] = useState(uuid())
  const saveItemAction = (itemToSave: Item, newName: string, newCategory: string) => {
    saveItem({
      variables: {
        item: {
          id: itemToSave.id,
          name: newName,
          checked: itemToSave.checked,
          category: newCategory
        }
      }
    })
  }
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
              <TableCell align="left">Checked</TableCell>
              <TableCell>Item name</TableCell>
              <TableCell align="left">Category</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                <TableCell align="left">
                  <Checkbox checked={item.checked} onChange={() => updateItemState(item, !item.checked)}/>
                </TableCell>
                <TableCell component="th" scope="row">
                  {currentEdit === item.id ?
                    <TextField
                      value={editItemName}
                      onChange={e => setEditItemName(e.target.value)}
                    />
                    : item.name
                  }
                </TableCell>
                <TableCell align="left">
                  {currentEdit === item.id ?
                    <Categories prevCat={item.category} categoryUpdate={setEditItemCategory}/>
                    : categories.find(category => category.id === item.category)?.name || "not found"
                  }
                </TableCell>
                <TableCell align="right">
                  {currentEdit === item.id ?
                    <Button onClick={() => {
                      saveItemAction(item, editItemName, editItemCategory)
                      setCurrentEdit(uuid())
                    }}>Save</Button>
                    :
                    <Button onClick={() => {
                      setCurrentEdit(item.id)
                      setEditItemName(item.name)
                      setEditItemCategory(item.category)
                    }}>Edit</Button>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <CreateItem/>
    </Paper>
  );
}
