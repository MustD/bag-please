'use client'
import {useQuery} from "@apollo/client";
import {categoriesSubscription, getCategoriesQuery} from "@/lib/category/Queries";
import React, {useEffect, useState} from "react";
import {
  Box,
  Button,
  Fab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {v4 as uuid} from "uuid"
import {List} from "immutable";
import Typography from "@mui/material/Typography";
import AddIcon from '@mui/icons-material/Add';
import CreateCategory from "@/app/store/category/CreateCategory";
import {CategoryUpdateType} from "@/__generated__/graphql";


export type Category = { id: string, name: string }

export default function ManageCategories() {
  const {
    data,
    loading,
    error, subscribeToMore
  } = useQuery(getCategoriesQuery);

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

  const [catToEdit, setCatToEdit] = useState<Category>()
  const [isNew, setIsNew] = useState(false)

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
                  <Typography>{category.name}</Typography>
                </TableCell>
                <TableCell align={"right"}>
                  <Button
                    onClick={() => {
                      setCatToEdit(category)
                    }}>Edit
                  </Button>
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
        onClick={() => {
          setCatToEdit({id: uuid(), name: ""})
          setIsNew(true)
        }
        }
        style={{position: "fixed", right: "60px", bottom: "60px"}}
      >
        <AddIcon/>
      </Fab>
      <CreateCategory
        category={catToEdit}
        isNew={isNew}
        onClose={() => {
          setCatToEdit(undefined)
          setIsNew(false)
        }}
      />
    </Box>
  )
}
