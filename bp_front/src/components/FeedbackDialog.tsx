import {type FormEvent, useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {SendFeedbackMutation} from '@/lib/feedback/feedbackQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  onClose: () => void
}

const MAX_LENGTH = 2000

// Feedback composer (Story 9.9). Mirrors CreateUserDialog.tsx's single-field
// form conventions: manual controlled state, validate-on-submit with an inline
// field error, a same-tick re-entry guard, a real catch that surfaces the
// GraphQL error inline (never a toast), and Enter-submits via a native <form>.
// The close IS the confirmation (no downstream row to show, no toast layer in
// this app) — on success the dialog just closes.
export default function FeedbackDialog({open, onClose}: Props) {
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const [sendFeedback, {loading}] = useMutation(SendFeedbackMutation)

  const reset = () => {
    setText('')
    setFieldError(undefined)
    setFormError(null)
  }

  const handleCancel = () => {
    if (loading) return
    reset()
    onClose()
  }

  const validate = (): boolean => {
    const trimmed = text.trim()
    if (!trimmed) {
      setFieldError('Feedback text is required')
      return false
    }
    if (trimmed.length > MAX_LENGTH) {
      setFieldError(`Feedback text must not exceed ${MAX_LENGTH} characters`)
      return false
    }
    setFieldError(undefined)
    return true
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setFormError(null)
    if (!validate()) return

    try {
      await sendFeedback({variables: {text: text.trim()}})
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="feedback-dialog" fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{mt: 1}}>
            <TextField
              label="Your feedback"
              value={text}
              onChange={e => {
                setText(e.target.value)
                setFieldError(undefined)
              }}
              error={Boolean(fieldError)}
              helperText={fieldError ?? ' '}
              multiline
              minRows={4}
              autoFocus
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'feedback-text'}}}
            />
            <Typography variant="caption" color="text.secondary" sx={{alignSelf: 'flex-end'}}>
              {text.trim().length}/{MAX_LENGTH}
            </Typography>
          </Stack>
          {formError && (
            <Alert severity="error" role="alert" data-testid="feedback-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="feedback-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="feedback-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Send'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
