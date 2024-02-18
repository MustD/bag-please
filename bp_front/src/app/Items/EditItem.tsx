'use client'
import {Checkbox, FormControlLabel} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/app/Items/Queries";
import {useState} from "react";

export type Item = { id: string, name: string, checked: boolean }

export default function EditItem(item: Item) {
  const [save, {data, loading, error}] = useMutation(createItemMutation);
  const [check, setCheck] = useState(item.checked)

  const update = (state: boolean) => {
    setCheck(state)
    save({variables: {item: {id: item.id, name: item.name, checked: state}}})
  }

  return (
    <FormControlLabel
      key={item.id}
      control={<Checkbox checked={check} onChange={() => update(!check)}/>}
      label={item.name}
    />
  );
}
