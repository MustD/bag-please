'use client'
import {Checkbox, FormControl, FormControlLabel, FormGroup, IconButton, TextField} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation, deleteItemMutation} from "@/app/Items/Queries";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Modal from '@mui/material/Modal';
import React, {useState} from "react";
import Box from '@mui/material/Box';
import LoadingButton from "@mui/lab/LoadingButton";
import SaveIcon from "@mui/icons-material/Save";

export type Item = { id: string, name: string, checked: boolean }

export default function EditItem(item: Item) {
  const [saveItem] = useMutation(createItemMutation);
  const [deleteItem] = useMutation(deleteItemMutation)

  const update = (state: boolean) => {
    saveItem({variables: {item: {id: item.id, name: item.name, checked: state}}})
  }
  const deleteMe = (id: string) => {
    deleteItem({variables: {id: id}})
  }
  const editMe = (newName: string) => {
    saveItem({variables: {item: {id: item.id, name: newName, checked: item.checked}}})
  }
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [itemName, setItemName] = useState<string>(item.name)
  const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
  };


  return (
    <FormGroup row={true}>
      <FormControlLabel
        control={<Checkbox checked={item.checked} onChange={() => update(!item.checked)}/>}
        label={item.name}
      />
      <FormControl variant="standard">
        <IconButton aria-label="edit" onClick={handleOpen}> <EditIcon/> </IconButton>
        <Modal
          open={open}
          onClose={handleClose}
        >
          <Box sx={style}>
            <FormGroup sx={{gap: 1, maxWidth: 'md'}}>
              <TextField
                id="item_name"
                name="item_name"
                label="Name"
                defaultValue={item.name}
                onChange={(event) => setItemName(event.target.value)}
              />
              <LoadingButton
                color="secondary"
                onClick={() => {
                  editMe(itemName);
                  handleClose()
                }}
                loadingPosition="start"
                startIcon={<SaveIcon/>}
                variant="contained"
              >
                <span>Save</span>
              </LoadingButton>
            </FormGroup>
          </Box>
        </Modal>
      </FormControl>
      <FormControl variant="standard">
        <IconButton aria-label="delete" onClick={() => deleteMe(item.id)}> <DeleteIcon/> </IconButton>
      </FormControl>
    </FormGroup>
  );
}
