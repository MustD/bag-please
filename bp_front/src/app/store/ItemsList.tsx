'use client'
import {Grid, IconButton, InputAdornment, OutlinedInput} from "@mui/material";
import {useQuery} from "@apollo/client";
import {getItemsQuery, itemsSubscription} from "@/lib/item/Queries";
import React, {useEffect, useState} from "react";
import Box from '@mui/material/Box';
import Typography from "@mui/material/Typography";
import {getCategoriesQuery} from "@/lib/category/Queries";
import {List} from "immutable";
import ItemView from "@/app/store/ItemView";
import {ItemUpdateType} from "@/__generated__/graphql";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {Clear} from "@mui/icons-material";

export default function ItemsList() {

  const {
    data: itemsData,
    loading: itemsLoading,
    error: itemsError,
    subscribeToMore: itemSubscription
  } = useQuery(getItemsQuery);

  const {
    data: categoryData,
    loading,
    error,
    subscribeToMore: categorySubscription
  } = useQuery(getCategoriesQuery);

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

  const [filter, setFilter] = useState<"all" | "y" | "n">("all")
  const [search, setSearch] = useState("")
  const items = List(itemsData?.getItems || []).sortBy(item =>
    item.name
  ).filter(item => {
    switch (filter) {
      case "all":
        return true
      case "y":
        return item.checked
      case "n":
        return !item.checked
    }
  }).filter(item => {
    if ("" === search) {
      return true
    } else {
      return item.name.toLowerCase().includes(search.toLowerCase())
    }
  })
  const categories = List(categoryData?.getCategories || []).sortBy(category => category.name)

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormControl sx={{m: 1, width: '14ch'}} size="small">
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
      <FormControl sx={{m: 1, width: '14ch'}} size="small">
        <InputLabel id="select-filter-label">Filter</InputLabel>
        <Select
          labelId="select-filter-label"
          id="filter-small"
          value={filter}
          label="Filter"
          onChange={(e) => setFilter(e.target.value as "all" | "y" | "n")}
        >
          <MenuItem value={"all"}>All</MenuItem>
          <MenuItem value={"y"}>Checked</MenuItem>
          <MenuItem value={"n"}>Unchecked</MenuItem>
        </Select>
      </FormControl>
      <Grid container gap={2} direction={"column"}>
        {categories.map(category => (
          <Grid item key={category.id}>
            <Typography variant={"h6"}>{category.name}</Typography>
            <Grid container direction={"column"} gap={1}>
              {items.filter(item => item.category === category.id).map(item => (
                <Grid sx={{paddingLeft: 2}} item key={item.id}>
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
