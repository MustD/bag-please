"use client"
import {Dialog, Grid, Paper, TextField} from "@mui/material";
import React, {useState} from "react";
import {v4 as uuid} from "uuid";
import {useMutation} from "@apollo/client";
import {createCategoryMutation} from "@/lib/category/Queries";
import SaveIcon from "@mui/icons-material/Save";
import LoadingButton from "@mui/lab/LoadingButton";

export type CreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateCategory(props: CreateDialogProps) {
  const {isOpen, onClose} = props;

  const [saveCategory, {data, loading, error}] = useMutation(createCategoryMutation);
  const [newCatName, setNewCatName] = useState("")

  const saveCategoryAction = (name: string) => {
    saveCategory({variables: {category: {id: uuid().toString(), name: name}}})
  }

  return (
    <Dialog onClose={onClose} open={isOpen}>
      <Paper sx={{p: 3}}>
        <Grid container direction={"column"} gap={2}>
          <Grid item>
            <TextField
              id="category_name"
              name="category_name"
              label="Add new category"
              variant="standard"
              onChange={(event) => setNewCatName(event.target.value)}
            />
          </Grid>
          <Grid item>
            <LoadingButton
              color="secondary"
              onClick={() => {
                saveCategoryAction(newCatName)
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
