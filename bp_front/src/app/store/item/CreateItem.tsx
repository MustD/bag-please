'use client'
import {Button, ButtonGroup, Dialog, Paper, Stack, TextField} from "@mui/material";
import {useMutation} from "@apollo/client/react";
import {createItemMutation, deleteItemMutation} from "@/lib/item/Queries";
import React, {useEffect, useState} from "react";
import SaveIcon from '@mui/icons-material/Save';
import SelectCategory from "@/app/store/category/SelectCategory";
import DeleteIcon from "@mui/icons-material/Delete";

export type Item = { id: string, name: string, checked: boolean, category: string }
export type CreateDialogProps = {
  item?: Item;
  isNew: boolean;
  onClose: () => void
}

export default function CreateItem(props: CreateDialogProps) {
  const {item, isNew, onClose} = props;

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
        <Stack direction="column" spacing={2}>
          <TextField
            id="item_name"
            name="item_name"
            label="Item name"
            variant="standard"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
          />
          <SelectCategory selectedId={newItemCat} setSelectedId={setNewItemCat}/>
          <ButtonGroup variant="text" fullWidth={true}>
            <Button
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
            </Button>
              {isNew ? null :
                <Button
                  color="error"
                  onClick={() => {
                    deleteItemAction(itemId)
                    onClose()
                  }}
                  loadingPosition="start"
                  startIcon={<DeleteIcon/>}
                  variant="text"
                ><span>Delete</span>
                </Button>
              }
            </ButtonGroup>
        </Stack>
      </Paper>
    </Dialog>
  )
}
