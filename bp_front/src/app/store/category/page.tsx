'use client'
import {useMutation, useQuery} from "@apollo/client";
import {createCategoryMutation, getCategoriesQuery} from "@/app/store/category/Queries";
import React, {useState} from "react";
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";
import {v4 as uuid} from "uuid"
import {List} from "immutable";
import Typography from "@mui/material/Typography";


/**
 * Todo: Implement delete
 * Todo: Add subscription to live update changes
 * @constructor
 */
export default function ManageCategories() {
  const {data, loading, error} = useQuery(getCategoriesQuery);


  const [newCatName, setNewCatName] = useState("")
  const [editCatName, setEditCatName] = useState("")
  const [currentEdit, setCurrentEdit] = useState(uuid())

  const [saveCategory] = useMutation(createCategoryMutation);

  const saveCategoryAction = (id: string, name: string) => {
    saveCategory({variables: {category: {id: id, name: name}}})
    setNewCatName("")
  }

  const categories = List(data?.getCategories).sortBy(cat => cat.id)

  return (
    <Paper>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <TableContainer component={Paper}>
        <Table sx={{minWidth: 650}} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Category name</TableCell>
              <TableCell>Controls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                <TableCell component="th" scope="row">
                  {currentEdit === category.id ?
                    <TextField
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                    />
                    : category.name
                  }

                </TableCell>
                <TableCell align="right">
                  {currentEdit === category.id ?
                    <Button onClick={() => {
                      saveCategoryAction(category.id, editCatName)
                      setCurrentEdit(uuid())
                    }}>Save</Button>
                    :
                    <Button
                      onClick={() => {
                        setCurrentEdit(category.id)
                        setEditCatName(category.name)
                      }}>Edit</Button>
                  }
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{'&:last-child td, &:last-child th': {border: 0}}}>
              <TableCell component="th" scope="row">
                <TextField
                  id="category_name"
                  name="category_name"
                  label="Add new category"
                  variant="standard"
                  defaultValue={newCatName}
                  onChange={(event) => setNewCatName(event.target.value)}
                />
              </TableCell>
              <TableCell align="right">
                <Button onClick={() => {
                  saveCategoryAction(uuid().toString(), newCatName)
                  setNewCatName("New category")
                }}
                >Add category</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
