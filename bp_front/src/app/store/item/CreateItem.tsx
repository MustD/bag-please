'use client'
import {ButtonGroup, Dialog, Grid, Paper, TextField} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation, deleteItemMutation} from "@/lib/item/Queries";
import React, {useEffect, useState} from "react";
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';
import SelectCategory from "@/app/store/category/SelectCategory";
import DeleteIcon from "@mui/icons-material/Delete";

export type Item = { id: string, name: string, checked: boolean, category: string }
export type CreateDialogProps = {
  item?: Item;
  onClose: () => void;
  deletable: boolean
}

export default function CreateItem(props: CreateDialogProps) {
  const {onClose, item, deletable} = props;

  let isOpen: boolean;
  isOpen = !!item;

  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemCat, setNewItemCat] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");

  useEffect(() => {
    setNewItemName(item?.name || "")
    setNewItemCat(item?.category || "")
    setItemId(item?.id || "")
  }, [item])

  const [createItem, {data, loading, error}] = useMutation(createItemMutation);
  const saveItemAction = (name: string, category: string, id: string) => {
    createItem({
      variables: {item: {id: id, name: name, checked: false, category: category}},
    })
  }

  const [deleteItem] = useMutation(deleteItemMutation)
  const deleteItemAction = (itemId: string) => {
    deleteItem({
      variables: {
        id: itemId
      }
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
            <ButtonGroup variant="text" fullWidth={true}>
              <LoadingButton
                color="success"
                onClick={() => {
                  saveItemAction(newItemName, newItemCat, itemId)
                  onClose()
                }}
                loadingPosition="start"
                startIcon={<SaveIcon/>}
                variant="text"
              >
                <span>Save</span>
              </LoadingButton>
              {deletable ? <LoadingButton
                  color="error"
                  onClick={() => {
                    deleteItemAction(itemId)
                    onClose()
                  }}
                  loadingPosition="start"
                  startIcon={<DeleteIcon/>}
                  variant="text"
                ><span>Delete</span>
                </LoadingButton>
                : null}
            </ButtonGroup>
          </Grid>
        </Grid>
      </Paper>
    </Dialog>
  )
}
