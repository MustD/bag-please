'use client'
import {Box, FormGroup, TextField} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/app/store/item/Queries";
import React, {useState} from "react";
import {v4 as uuid} from "uuid"
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';
import Categories from "@/app/store/category/Categories";

export default function CreateItem() {
  const [createItem, {data, loading, error}] = useMutation(createItemMutation);
  const [itemName, setItemName] = useState<string>("")
  const save = (name: string, category: string) => {
    createItem({
      variables: {item: {id: uuid(), name: name, checked: false, category: category}},
    })
    setItemName("")
  }
  const [cat, setCat] = useState<string>("");

  return (
    <Box>
      <FormGroup sx={{gap: 1, maxWidth: 'md'}}>
        <TextField
          id="item_name"
          name="item_name"
          label="Name"
          variant="standard"
          value={itemName}
          onChange={(event) => setItemName(event.target.value)}
        />
        <Categories prevCat={""} categoryUpdate={setCat}/>
        <LoadingButton
          color="secondary"
          onClick={() => save(itemName, cat)}
          loading={loading}
          loadingPosition="start"
          startIcon={<SaveIcon/>}
          variant="contained"
        >
          <span>Save</span>
        </LoadingButton>
      </FormGroup>
    </Box>
  )
}
