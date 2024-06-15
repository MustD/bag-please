'use client'
import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import {useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/app/store/category/Queries";
import React, {useState} from "react";
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';

export default function Categories(props: { prevCat: string; categoryUpdate: (category: string) => void; }) {
  const {data, loading, error} = useQuery(getCategoriesQuery);
  const values = data?.getCategories
  const toRender = values ? [...values].sort((a, b) => (a.name < b.name ? -1 : 1)) : []
  const [cat, setCategory] = useState<string>(props.prevCat)
  const handleChange = (event: SelectChangeEvent) => {
    setCategory(event.target.value.toString());
    props.categoryUpdate(event.target.value.toString())
  };

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormControl fullWidth>
        <InputLabel id="select-category">Category</InputLabel>
        <Select
          labelId="select-category-label"
          id="select-category"
          value={cat}
          label="Category"
          onChange={handleChange}
        >
          {toRender?.map(category => (
            <MenuItem value={category.id}>{category.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
