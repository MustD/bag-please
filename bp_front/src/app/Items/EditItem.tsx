'use client'
import {Checkbox, FormControlLabel} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/app/Items/Queries";

export type Item = { id: string, name: string, checked: boolean }

export default function EditItem(item: Item) {
  const [save, {data, loading, error}] = useMutation(createItemMutation);

  const update = (state: boolean) => {
    save({variables: {item: {id: item.id, name: item.name, checked: state}}})
  }

  return (
    <FormControlLabel
      key={item.id}
      control={<Checkbox checked={item.checked} onChange={() => update(!item.checked)}/>}
      label={item.name}
    />
  );
}
