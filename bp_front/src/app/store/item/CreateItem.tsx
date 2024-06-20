'use client'
import {Dialog, Grid, Paper, TextField} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/lib/item/Queries";
import React, {useState} from "react";
import {v4 as uuid} from "uuid"
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';
import SelectCategory from "@/app/store/category/SelectCategory";

export type CreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateItem(props: CreateDialogProps) {
  const {isOpen, onClose} = props;

  const [createItem, {data, loading, error}] = useMutation(createItemMutation);

  const [newItemName, setNewItemName] = useState<string>("")
  const [newItemCat, setNewItemCat] = useState<string>("");

  const saveItemAction = (name: string, category: string) => {
    createItem({
      variables: {item: {id: uuid(), name: name, checked: false, category: category}},
    })
  }

  return (
    <Dialog onClose={onClose} open={isOpen}>
      <Paper sx={{p: 3}}>
        <Grid container direction={"column"} gap={2}>
          <Grid item>
            <TextField
              id="item_name"
              name="item_name"
              label="Add new item"
              variant="standard"
              onChange={(event) => setNewItemName(event.target.value)}
            />
          </Grid>
          <Grid item>
            <SelectCategory selectedId={newItemCat} setSelectedId={setNewItemCat}/>
          </Grid>
          <Grid item>
            <LoadingButton
              color="secondary"
              onClick={() => {
                saveItemAction(newItemName, newItemCat)
                onClose()
              }}
              loadingPosition="start"
              startIcon={<SaveIcon/>}
              variant="contained"
            >
              <span>Save</span>
            </LoadingButton>
          </Grid>
        </Grid>
      </Paper>
    </Dialog>
  )
}
