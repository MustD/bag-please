'use client'
import {useState} from 'react'
import {useMutation, useQuery} from '@apollo/client/react'
import type {GetUsersQuery} from '@/__generated__/graphql'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import LockResetIcon from '@mui/icons-material/LockReset'
import {createUserMutation, deleteUserMutation, getUsersQuery, resetUserPasswordMutation,} from '@/lib/user/Queries'
import ConfirmDialog from '@/app/admin/ConfirmDialog'

export default function AdminUsersPage() {
  const {data, loading} = useQuery(getUsersQuery)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; username: string } | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  const [createUser] = useMutation(createUserMutation, {
    update(cache, {data: mutData}) {
      const existing = cache.readQuery({query: getUsersQuery})
      if (existing && mutData?.createUser) {
        cache.writeQuery({
          query: getUsersQuery,
          data: {users: [...existing.users, mutData.createUser]},
        })
      }
    },
  })

  const [deleteUser] = useMutation(deleteUserMutation, {
    update(cache, {data: mutData}) {
      const existing = cache.readQuery({query: getUsersQuery})
      if (existing && mutData?.deleteUser) {
        cache.writeQuery({
          query: getUsersQuery,
          data: {users: existing.users.filter(u => u.id !== mutData.deleteUser?.id)},
        })
      }
    },
  })

  const [resetUserPassword] = useMutation(resetUserPasswordMutation)

  const handleCreate = async () => {
    await createUser({variables: {username: newUsername, password: newPassword}})
    setCreateOpen(false)
    setNewUsername('')
    setNewPassword('')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteUser({variables: {id: deleteTarget.id}})
    setDeleteTarget(null)
  }

  const handleReset = async () => {
    if (!resetTarget) return
    await resetUserPassword({variables: {id: resetTarget.id, newPassword: resetPassword}})
    setResetTarget(null)
    setResetPassword('')
  }

  const users = data?.users ?? []

  return (
    <Box sx={{p: 2}}>
      <Box sx={{mb: 2}}>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          Create user
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{py: 4}}>
                  <CircularProgress/>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">No users yet. Create the first one.</Typography>
                </TableCell>
              </TableRow>
            ) : users.map((user: GetUsersQuery['users'][number]) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell align="right">
                  <IconButton
                    title="Reset password"
                    onClick={() => setResetTarget({id: user.id, username: user.username})}
                  >
                    <LockResetIcon/>
                  </IconButton>
                  <IconButton
                    title="Delete user"
                    onClick={() => setDeleteTarget({id: user.id, username: user.username})}
                  >
                    <DeleteIcon/>
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={createOpen}
        title="Create user"
        message=""
        confirmLabel="Create"
        confirmColor="primary"
        confirmDisabled={!newUsername.trim() || !newPassword.trim()}
        onConfirm={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          setNewUsername('')
          setNewPassword('')
        }}
      >
        <TextField
          label="Username"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          fullWidth
          sx={{mt: 1}}
        />
        <TextField
          label="Password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          fullWidth
          sx={{mt: 2}}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user?"
        message="This cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        title="Reset password?"
        message="The user's current session will be invalidated."
        confirmLabel="Reset"
        confirmColor="primary"
        confirmDisabled={!resetPassword.trim()}
        onConfirm={handleReset}
        onCancel={() => {
          setResetTarget(null)
          setResetPassword('')
        }}
      >
        <TextField
          label="New password"
          type="password"
          value={resetPassword}
          onChange={e => setResetPassword(e.target.value)}
          fullWidth
          sx={{mt: 2}}
        />
      </ConfirmDialog>
    </Box>
  )
}
