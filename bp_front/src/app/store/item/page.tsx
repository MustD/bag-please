'use client'

import {Box, FormGroup, Paper} from "@mui/material";
import Items from "@/app/store/item/Items";
import CreateItem from "@/app/store/item/CreateItem";
import {useQuery} from "@apollo/client";
import {getCategoriesQuery} from "@/app/Categories/Queries";

export default function ItemsPage() {
  const {data} = useQuery(getCategoriesQuery);
  const values = data?.getCategories
  const toRender = values ? [...values].sort((a, b) => (a.name < b.name ? -1 : 1)) : []

  return (
    <Box>
      <Paper sx={{p: 1}}>
        <FormGroup>
          {toRender?.map(cat => (
            <Items categoryId={cat.id} categoryName={cat.name}/>
          ))}
        </FormGroup>
        <CreateItem/>
      </Paper>
    </Box>
  );
}
