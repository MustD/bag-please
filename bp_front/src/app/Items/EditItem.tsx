'use client'
import {Checkbox, FormControl, FormControlLabel, FormGroup, IconButton} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation, deleteItemMutation} from "@/app/Items/Queries";
import DeleteIcon from '@mui/icons-material/Delete';

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

  return (
    <FormGroup row={true}>
      <FormControlLabel
        control={<Checkbox checked={item.checked} onChange={() => update(!item.checked)}/>}
        label={item.name}
      />
      <FormControl variant="standard">
        <IconButton aria-label="delete" onClick={() => deleteMe(item.id)}> <DeleteIcon/> </IconButton>
      </FormControl>
    </FormGroup>
  );
}
