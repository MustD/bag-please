'use client'

import {
  Box,
  Button,
  Checkbox,
  Fab,
  IconButton,
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
import {getCategoriesQuery} from "@/lib/category/Queries";
import React, {useEffect, useState} from "react";
import {createItemMutation, deleteItemMutation, getItemsQuery, itemsSubscription} from "@/lib/item/Queries";
import {ItemUpdateType} from "@/__generated__/graphql";
import {List} from "immutable";
import Typography from "@mui/material/Typography";
import {v4 as uuid} from "uuid"
import SelectCategory from "@/app/store/category/SelectCategory";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";


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

  const [saveItem] = useMutation(createItemMutation);
  const [deleteItem] = useMutation(deleteItemMutation)

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

  const deleteItemAction = (itemId: string) => {
    deleteItem({
      variables: {
        id: itemId
      }
    })
  }

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

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
                  {currentEdit === item.id ?
                    <IconButton onClick={() => {
                      deleteItemAction(item.id)
                      setCurrentEdit(uuid())
                    }}>
                      <DeleteIcon color={"warning"} sx={{width: 32, height: 32}}/>
                    </IconButton>
                    :
                    <Checkbox checked={item.checked} onChange={() => updateItemState(item, !item.checked)}/>
                  }
                </TableCell>
                <TableCell>
                  {currentEdit === item.id ?
                    <TextField
                      value={editItemName}
                      onChange={e => setEditItemName(e.target.value)}
                    />
                    :
                    <Typography>{item.name}</Typography>
                  }
                </TableCell>
                <TableCell>
                  {currentEdit === item.id ?
                    <SelectCategory
                      selectedId={editItemCategory === "" ? item.category : editItemCategory}
                      setSelectedId={setEditItemCategory}
                    />
                    :
                    <Typography>{categories.find(category => category.id === item.category)?.name || "not found"}</Typography>
                  }
                </TableCell>
                <TableCell align={"right"}>
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
      <Fab
        size="large"
        color="secondary"
        aria-label="add"
        onClick={() => setIsCreateOpen(true)}
        style={{position: "fixed", right: "60px", bottom: "60px"}}
      >
        <AddIcon/>
      </Fab>
      <CreateItem isOpen={isCreateOpen} onClose={() => {
        setIsCreateOpen(false)
      }}
      />
    </Box>
  );
}
