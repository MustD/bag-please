"use client"
import {Button, ButtonGroup, Dialog, Paper, Stack, TextField} from "@mui/material";
import React, {useEffect, useState} from "react";
import {useMutation} from "@apollo/client/react";
import {createCategoryMutation, deleteCategoryMutation} from "@/lib/category/Queries";
import SaveIcon from "@mui/icons-material/Save";
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
        <Stack spacing={2}>
          <TextField
            id="category_name"
            name="category_name"
            label="Category name"
            variant="standard"
            value={newCatName}
            onChange={(event) => setNewCatName(event.target.value)}
          />
          <ButtonGroup variant="text" fullWidth={true}>
            <Button
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
            </Button>
              {isNew ? null :
                <Button
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
                </Button>
              }
            </ButtonGroup>
        </Stack>
      </Paper>
    </Dialog>
  )
}
