"use client"

import {Box, Fab, Paper} from "@mui/material";
import ItemsList from "@/app/store/ItemsList";
import React, {useState} from "react";
import {v4 as uuid} from "uuid";
import AddIcon from "@mui/icons-material/Add";
import CreateItem from "@/app/store/item/CreateItem";
import {Item} from "@/app/store/item/page";

export default function Home() {
  const [itemToEdit, setItemToEdit] = useState<Item>();
  return (
    <Box>
      <Paper sx={{p: 1}}>
        <ItemsList/>
        <Fab
          size="large"
          color="secondary"
          aria-label="add"
          onClick={() => {
            setItemToEdit({
              id: uuid(),
              name: "",
              checked: false,
              category: ""
            })
          }
          }
          style={{position: "fixed", right: "60px", bottom: "60px"}}
        >
          <AddIcon/>
        </Fab>
        <CreateItem
          item={itemToEdit}
          isNew={true}
          onClose={() => {
            setItemToEdit(undefined)
          }}
        />
      </Paper>
    </Box>
  );
}
