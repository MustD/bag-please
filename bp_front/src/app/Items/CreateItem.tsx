'use client'
import {Box, FormGroup, TextField} from "@mui/material";
import Typography from "@mui/material/Typography";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/app/Items/Queries";
import React, {useState} from "react";
import {v4 as uuid} from "uuid"
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';

export default function CreateItem() {
  const [createItem, {data, loading, error}] = useMutation(createItemMutation);
  const [itemName, setItemName] = useState<string>("")
  const save = (name: string) => {
    createItem({
      variables: {item: {id: uuid(), name: name, checked: false}},
    })
    setItemName("")
  }

  return (
    <Box>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <FormGroup sx={{gap: 1, maxWidth: 'md'}}>
        <TextField
          id="item_name"
          name="item_name"
          label="Name"
          variant="standard"
          value={itemName}
          onChange={(event) => setItemName(event.target.value)}
        />
        <LoadingButton
          color="secondary"
          onClick={() => save(itemName)}
          loading={loading}
          loadingPosition="start"
          startIcon={<SaveIcon/>}
          variant="contained"
        >
          <span>Save</span>
        </LoadingButton>
      </FormGroup>
    </Box>
  );
}
