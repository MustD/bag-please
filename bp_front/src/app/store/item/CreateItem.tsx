'use client'
import {Dialog, Grid, Paper, TextField} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/lib/item/Queries";
import React, {useEffect, useState} from "react";
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';
import SelectCategory from "@/app/store/category/SelectCategory";

export type Item = { id: string, name: string, checked: boolean, category: string }
export type CreateDialogProps = {
  onClose: () => void;
  item?: Item;
}

export default function CreateItem(props: CreateDialogProps) {
  const {onClose, item} = props;

  let isOpen: boolean;
  isOpen = !!item;

  useEffect(() => {
    setNewItemName(item?.name || "")
    setNewItemCat(item?.category || "")
    setItemId(item?.id || "")
  }, [item])

  const [createItem, {data, loading, error}] = useMutation(createItemMutation);

  const [newItemName, setNewItemName] = useState<string>(item?.name || "");
  const [newItemCat, setNewItemCat] = useState<string>(item?.category || "");
  const [itemId, setItemId] = useState<string>(item?.id || "");

  const saveItemAction = (name: string, category: string, id: string) => {
    createItem({
      variables: {item: {id: id, name: name, checked: false, category: category}},
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
              label="Item name"
              variant="standard"
              value={newItemName}
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
                saveItemAction(newItemName, newItemCat, itemId)
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
