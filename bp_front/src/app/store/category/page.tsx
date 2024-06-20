'use client'
import {useMutation, useQuery} from "@apollo/client";
import {
  categoriesSubscription,
  createCategoryMutation,
  deleteCategoryMutation,
  getCategoriesQuery
} from "@/lib/category/Queries";
import React, {useEffect, useState} from "react";
import {
  Box,
  Button,
  Fab,
  IconButton,
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
import AddIcon from '@mui/icons-material/Add';
import CreateCategory from "@/app/store/category/CreateCategory";
import {CategoryUpdateType} from "@/__generated__/graphql";
import DeleteIcon from "@mui/icons-material/Delete";


/**
 * Todo: Implement delete
 * Todo: Add subscription to live update changes
 * @constructor
 */
export default function ManageCategories() {
  const {data, loading, error, subscribeToMore} = useQuery(getCategoriesQuery);

  const subscribe = () => {
    subscribeToMore({
      document: categoriesSubscription,
      updateQuery: (prev, {subscriptionData}) => {
        if (!subscriptionData.data) return prev;
        const data = prev.getCategories
        const update = subscriptionData.data.getCategoryUpdates
        const updatedData = data.filter((cat) => cat.id !== update.item.id)
        if (update.type == CategoryUpdateType.Deleted) {
          return Object.assign({}, prev, {getCategories: updatedData})
        } else {
          return Object.assign({}, prev, {getCategories: [update.item, ...updatedData]})
        }
      }
    })
  }
  useEffect(() => subscribe(), [])

  const [editCatName, setEditCatName] = useState("")
  const [currentEdit, setCurrentEdit] = useState(uuid())

  const [saveCategory] = useMutation(createCategoryMutation);
  const saveCategoryAction = (id: string, name: string) => {
    saveCategory({variables: {category: {id: id, name: name}}})
  }

  const [deleteCat] = useMutation(deleteCategoryMutation)
  const deleteCategoryAction = (catId: string) => {
    deleteCat({
      variables: {
        id: catId
      }
    })
  }

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const categories = List(data?.getCategories).sortBy(cat => cat.name)

  return (
    <Box sx={{p: 1}}>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography variant={"caption"} sx={{color: "error.main"}}>{error.message}</Typography>}
      <TableContainer component={Paper}>
        <Table aria-label="Categories table" size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>Category name</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                <TableCell>
                  {currentEdit === category.id ?
                    <IconButton onClick={() => {
                      deleteCategoryAction(category.id)
                      setCurrentEdit(uuid())
                    }}>
                      <DeleteIcon color={"warning"} sx={{width: 32, height: 32}}/>
                    </IconButton>
                    : null
                  }

                </TableCell>
                <TableCell>
                  {currentEdit === category.id ?
                    <TextField
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                    />
                    : <Typography>{category.name}</Typography>
                  }

                </TableCell>
                <TableCell align={"right"}>
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
          </TableBody>
        </Table>
      </TableContainer>
      <Fab
        size="large"
        color="secondary"
        aria-label="add"
        onClick={() => setIsCreateOpen(true)}
        style={{position: "fixed", right: "60px", bottom: "60px"}}
      >
        <AddIcon/>
      </Fab>
      <CreateCategory isOpen={isCreateOpen} onClose={() => {
        setIsCreateOpen(false)
      }}
      />
    </Box>
  )
}
