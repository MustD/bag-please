'use client'

import {
  Box,
  Button,
  Checkbox,
  Fab,
  IconButton,
  InputAdornment,
  OutlinedInput,
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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import {Clear} from "@mui/icons-material";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";


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
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")


  const items = List(itemsData?.getItems || []).sortBy(item => item.name
  ).filter(item => {
    if (filter === "all") {
      return true
    } else {
      return item.category === filter
    }
  }).filter(item => {
    if (search === "") {
      return true
    } else {
      return item.name.toLowerCase().includes(search.toLowerCase())
    }
  })

  const categories = List(categoryData?.getCategories || []).sortBy(category => category.name)

  return (
    <Box sx={{p: 1}}>
      {itemsLoading && <Typography>Loading...</Typography>}
      {itemsError && <Typography variant={"caption"} sx={{color: "error.main"}}>{itemsError.message}</Typography>}
      <FormControl sx={{m: 1, width: 4 / 9}} size="small">
        <InputLabel htmlFor="search-input">Search</InputLabel>
        <OutlinedInput
          id="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label="clear search"
                onClick={() => setSearch("")}
                edge="end"
              >
                <Clear/>
              </IconButton>
            </InputAdornment>
          }
          label="Search"
        />
      </FormControl>
      <FormControl sx={{m: 1, width: 4 / 9}} size="small">
        <InputLabel id="select-filter-label">Filter</InputLabel>
        <Select
          labelId="select-filter-label"
          id="filter-small"
          value={filter}
          label="Filter"
          onChange={(e) => setFilter(e.target.value)}
        >
          <MenuItem value={"all"}>All</MenuItem>
          {categories.map(category => (
            <MenuItem value={category.id}>{category.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
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
