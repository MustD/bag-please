'use client'
import {Checkbox, FormControlLabel, FormGroup} from "@mui/material";
import {useMutation} from "@apollo/client";
import {createItemMutation} from "@/lib/item/Queries";
import React from "react";

export type ItemView = { id: string, name: string, checked: boolean, category: string }

export default function EditItem(item: ItemView) {
  const [saveItem] = useMutation(createItemMutation);

  const update = (state: boolean) => {
    saveItem({variables: {item: {id: item.id, name: item.name, checked: state, category: item.category}}})
  }

  return (
    <FormGroup row={true}>
      <FormControlLabel
        control={<Checkbox checked={item.checked} onChange={() => update(!item.checked)}/>}
        label={item.name}
      />
    </FormGroup>
  );
}
