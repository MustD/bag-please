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
import {type AdminFeedback, DeleteFeedbackMutation} from '@/lib/admin/adminQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  // The row targeted for deletion, or null when the dialog is closed. Kept as
  // the open signal so a row's identity is always explicit — same shape as
  // DeleteUserDialog.
  entry: AdminFeedback | null
  onClose: () => void
  // Awaited on success so the panel reflects the removal before the dialog closes.
  onDeleted: () => void | Promise<unknown>
}

// How much of the feedback text to quote in the confirmation prompt.
const SNIPPET_LENGTH = 80

// Delete-feedback confirmation dialog (Story 9.10), modeled on
// DeleteUserDialog.tsx: confirmation-first, no optimistic row removal, errors
// surface inline (never a toast). Permanent, no undo — feedback has no
// status/reply/tagging to soften the loss.
export default function DeleteFeedbackDialog({entry, onClose, onDeleted}: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteFeedback, {loading}] = useMutation(DeleteFeedbackMutation)

  // Retain the last targeted entry so its text/username still render during
  // MUI's close transition (when `entry` has already gone back to null). Same
  // closed→open-transition key as DeleteUserDialog, not row identity: a failed
  // delete keeps the dialog open with an error and does not refetch, so
  // reopening the SAME row leaves the object reference unchanged.
  const [shown, setShown] = useState<AdminFeedback | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const open = Boolean(entry)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && entry) {
      setShown(entry)
      setFormError(null)
    }
  }

  const snippet = shown
    ? shown.text.length > SNIPPET_LENGTH
      ? `${Array.from(shown.text).slice(0, SNIPPET_LENGTH).join('')}…`
      : shown.text
    : ''

  const handleCancel = () => {
    if (loading) return
    onClose()
  }

  const handleConfirm = async () => {
    if (loading || !entry) return
    setFormError(null)
    try {
      await deleteFeedback({variables: {id: entry.id}})
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    // Deletion succeeded — close immediately (so Confirm can't fire twice during
    // the refresh) and refresh the panel in the background. A failed refetch is
    // not a failed delete; the row will drop once the query settles.
    onClose()
    void onDeleted()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="delete-feedback-dialog" fullWidth maxWidth="xs">
      <DialogTitle>Delete feedback</DialogTitle>
      <DialogContent>
        {/* `overflowWrap: 'anywhere'` — the quoted snippet is arbitrary user text
            and may contain no spaces to wrap on (NFR-E8-1's 320px floor). */}
        <DialogContentText sx={{overflowWrap: 'anywhere'}}>
          Delete this feedback from <strong>{shown?.username}</strong>: &ldquo;{snippet}&rdquo;? This
          cannot be undone.
        </DialogContentText>
        {formError && (
          <Alert severity="error" role="alert" data-testid="delete-feedback-error" sx={{mt: 2}}>
            {formError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading} data-testid="delete-feedback-cancel">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={loading}
          data-testid="delete-feedback-confirm"
        >
          {loading ? <CircularProgress size={20} color="inherit"/> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
