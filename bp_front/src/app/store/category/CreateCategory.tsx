"use client"
import {ButtonGroup, Dialog, Grid, Paper, TextField} from "@mui/material";
import React, {useEffect, useState} from "react";
import {useMutation} from "@apollo/client";
import {createCategoryMutation, deleteCategoryMutation} from "@/lib/category/Queries";
import SaveIcon from "@mui/icons-material/Save";
import LoadingButton from "@mui/lab/LoadingButton";
import DeleteIcon from "@mui/icons-material/Delete";

export type Category = { id: string, name: string }
export type CreateDialogProps = {
  category?: Category;
  isNew: boolean;
  onClose: () => void;
}

export default function CreateCategory(props: CreateDialogProps) {
  const {category, isNew, onClose} = props;

  let isOpen: boolean;
  isOpen = !!category;


  const [newCatName, setNewCatName] = useState("")
  const [catId, setCatId] = useState("")
  useEffect(
    () => {
      setNewCatName(category?.name || "")
      setCatId(category?.id || "")
    },
    [category]
  )

  const [saveCategory, {data, loading, error}] = useMutation(createCategoryMutation);
  const saveCategoryAction = (id: string, name: string) => {
    saveCategory({variables: {category: {id: id, name: name}}})
  }
  const [deleteCategory, {data: catData, loading: catLoading, error: catError}] = useMutation(deleteCategoryMutation);
  const deleteCategoryAction = (id: string) => {
    deleteCategory({variables: {id: id}})
  }

  return (
    <Dialog onClose={onClose} open={isOpen}>
      <Paper sx={{p: 3}}>
        <Grid container direction={"column"} gap={2}>
          <Grid item>
            <TextField
              id="category_name"
              name="category_name"
              label="Category name"
              variant="standard"
              value={newCatName}
              onChange={(event) => setNewCatName(event.target.value)}
            />
          </Grid>
          <Grid item>
            <ButtonGroup variant="text" fullWidth={true}>
              <LoadingButton
                color="success"
                onClick={() => {
                  saveCategoryAction(catId, newCatName)
                  onClose()
                }}
                loadingPosition="start"
                startIcon={<SaveIcon/>}
                variant="text"
              >
                <span>Save</span>
              </LoadingButton>
              {isNew ? null :
                <LoadingButton
                  color="error"
                  onClick={() => {
                    deleteCategoryAction(catId)
                    onClose()
                  }}
                  loadingPosition="start"
                  startIcon={<DeleteIcon/>}
                  variant="text"
                >
                  <span>Delete</span>
                </LoadingButton>
              }
            </ButtonGroup>
          </Grid>
        </Grid>
      </Paper>
    </Dialog>
  )
}
