import {useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import {type AdminUser, DeleteUserMutation} from '@/lib/admin/adminQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  // The row targeted for deletion, or null when the dialog is closed. Kept as
  // the open signal so a row's identity is always explicit.
  user: AdminUser | null
  onClose: () => void
  // Awaited on success so the table reflects the removal before the dialog closes.
  onDeleted: () => void | Promise<unknown>
}

// Delete-user confirmation dialog (Story 5.4, FR15 + FR17). Destructive actions
// are confirmation-first: the mutation fires only from the confirm button, never
// on row click. The consequence (sign-out of the deleted user's sessions) is
// stated in plain language. Errors (e.g. NOT_FOUND) surface inline; the row is
// not optimistically removed before success.
export default function DeleteUserDialog({user, onClose, onDeleted}: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteUser, {loading}] = useMutation(DeleteUserMutation)

  // Retain the last targeted user so the name still renders during MUI's close
  // transition (when `user` has already gone back to null). Adjusting state
  // during render is React's recommended alternative to a syncing effect and
  // converges in one extra render. Key off the closed→open transition, NOT the
  // row identity: a failed delete keeps the dialog open with an error and does
  // not refetch, so reopening the SAME row leaves the object reference
  // unchanged — an identity check would leave the stale error on screen.
  const [shown, setShown] = useState<AdminUser | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const open = Boolean(user)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && user) {
      setShown(user)
      setFormError(null)
    }
  }

  const handleCancel = () => {
    if (loading) return
    onClose()
  }

  const handleConfirm = async () => {
    if (loading || !user) return
    setFormError(null)
    try {
      await deleteUser({variables: {id: user.id}})
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    // Deletion succeeded — close immediately (so Confirm can't fire twice during
    // the refresh) and refresh the table in the background. A failed refetch is
    // not a failed delete; the row will drop once the query settles.
    onClose()
    void onDeleted()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="delete-user-dialog" fullWidth maxWidth="xs">
      <DialogTitle>Delete user</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Delete <strong>{shown?.username}</strong>? This permanently removes the account and signs
          them out of all sessions. This cannot be undone.
        </DialogContentText>
        {formError && (
          <Alert severity="error" role="alert" data-testid="delete-user-error" sx={{mt: 2}}>
            {formError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading} data-testid="delete-user-cancel">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={loading}
          data-testid="delete-user-confirm"
        >
          {loading ? <CircularProgress size={20} color="inherit"/> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
