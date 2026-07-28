import {type ReactNode, useState} from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  // Root testid; the confirm/cancel buttons and error alert derive from it.
  testId: string
  confirmColor?: 'error' | 'primary'
  // Performs the destructive mutation. Throws on failure (caught here and shown
  // inline). On success this dialog closes; the caller should also kick off a
  // background refetch inside onConfirm (unawaited) so a failed refetch is never
  // reported as a failed mutation (the 5.4 dialog-success pattern).
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Reusable confirmation overlay (Story 5.5) for destructive actions — delete
// list (with cascade warning), remove category, remove item. Confirmation-first:
// the mutation fires only from the confirm button. Errors surface inline in an
// <Alert role="alert">, never a toast; the dialog stays open on failure. Manages
// its own loading + error state with a same-tick re-entry guard, resetting when
// reopened (render-phase adjustment on the closed→open transition — no syncing
// effect).
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  testId,
  confirmColor = 'error',
  onConfirm,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  // Retain the title/description captured when the dialog opened so they don't
  // blank out during MUI's close transition — the parent clears its target (and
  // thus these props) the moment `open` flips to false.
  const [shownTitle, setShownTitle] = useState(title)
  const [shownDescription, setShownDescription] = useState<ReactNode>(description)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setError(null)
      setLoading(false)
      setShownTitle(title)
      setShownDescription(description)
    }
  }

  const handleCancel = () => {
    if (loading) return
    onClose()
  }

  const handleConfirm = async () => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(graphqlErrorMessage(err))
      setLoading(false)
      return
    }
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid={testId} fullWidth maxWidth="xs">
      <DialogTitle>{shownTitle}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{shownDescription}</DialogContentText>
        {error && (
          <Alert severity="error" role="alert" data-testid={`${testId}-error`} sx={{mt: 2}}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading} data-testid={`${testId}-cancel`}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          data-testid={`${testId}-confirm`}
        >
          {loading ? <CircularProgress size={20} color="inherit"/> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
