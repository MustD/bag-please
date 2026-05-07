'use client'
import {Checkbox, FormControlLabel, FormGroup} from "@mui/material";
import {useMutation} from "@apollo/client/react";
import {createItemMutation} from "@/lib/item/Queries";
import React, {useEffect, useState} from "react";

export type ItemView = { id: string, name: string, checked: boolean, category: string }

export default function EditItem(item: ItemView) {
  const [saveItem] = useMutation(createItemMutation);
  const [checked, setChecked] = useState(item.checked);

  useEffect(() => {
    setChecked(item.checked);
  }, [item.checked]);

  const update = (state: boolean) => {
    setChecked(state);
    saveItem({variables: {item: {id: item.id, name: item.name, checked: state, category: item.category}}});
  }

  return (
    <FormGroup row={true}>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(_, newChecked) => update(newChecked)}/>}
        label={item.name}
      />
    </FormGroup>
  );
}
