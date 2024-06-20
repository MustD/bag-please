'use client'
import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import {useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/lib/category/Queries";
import React from "react";
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import {List} from "immutable";

export type SelectCategoryProps = {
  selectedId: string
  setSelectedId: (id: string) => void
}

export default function SelectCategory(props: SelectCategoryProps) {
  const {selectedId, setSelectedId} = props
  const {data: categoryData, loading, error} = useQuery(getCategoriesQuery);

  const categories = List(categoryData?.getCategories || []).sortBy(cat => cat.name)

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormControl fullWidth variant="standard">
        <InputLabel id="select-category">Category</InputLabel>
        <Select
          labelId="select-category-label"
          id="select-category"
          value={selectedId}
          label="Select category"
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {categories.map(category => (
            <MenuItem value={category.id}>{category.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
