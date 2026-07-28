import {type FormEvent, useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import {type AdminUser, ResetUserPasswordMutation} from '@/lib/admin/adminQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  user: AdminUser | null
  onClose: () => void
  // Called with the affected username on success so the parent can show an
  // inline (panel-level) confirmation — there are no success toasts.
  onReset: (username: string) => void
}

// Reset-password confirmation dialog (Story 5.4, FR16 + FR17). Contains the
// new-password field and a plain-language warning that the reset signs the
// target user out of all sessions (the backend revokes their refresh tokens).
// Confirmation-first, validate-on-submit (empty password blocked client-side),
// same-tick re-entry guard, real catch → inline error. Enter submits the form.
export default function ResetPasswordDialog({user, onClose, onReset}: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetPassword, {loading}] = useMutation(ResetUserPasswordMutation)

  // Retain the last targeted user so the name still renders during the close
  // transition, and clear the field/errors on every open. Adjusting state during
  // render is React's recommended alternative to a syncing effect (converges in
  // one extra render). Key off the closed→open transition, NOT the row identity:
  // reset does not refetch users, so reopening the SAME row leaves the object
  // reference unchanged — an identity check would leave the previously typed
  // password (and any stale error) sitting in the field.
  const [shown, setShown] = useState<AdminUser | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const open = Boolean(user)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && user) {
      setShown(user)
      setNewPassword('')
      setFieldError(null)
      setFormError(null)
    }
  }

  const handleCancel = () => {
    if (loading) return
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading || !user) return
    setFormError(null)
    // Trim-check only: a whitespace-only password is as empty as a blank one,
    // but the untrimmed value is what's sent as the new credential.
    if (!newPassword.trim()) {
      setFieldError('New password is required')
      return
    }

    try {
      await resetPassword({variables: {id: user.id, newPassword}})
      onReset(user.username)
      onClose()
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="reset-password-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <DialogContentText data-testid="reset-password-warning">
            This signs <strong>{shown?.username}</strong> out of all sessions and replaces their
            password with the one you set below.
          </DialogContentText>
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={e => {
              setNewPassword(e.target.value)
              if (fieldError) setFieldError(null)
            }}
            error={Boolean(fieldError)}
            helperText={fieldError ?? ' '}
            autoComplete="new-password"
            autoFocus
            fullWidth
            disabled={loading}
            sx={{mt: 2}}
            slotProps={{htmlInput: {'data-testid': 'reset-password-input'}}}
          />
          {formError && (
            <Alert severity="error" role="alert" data-testid="reset-password-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="reset-password-cancel">
            Cancel
          </Button>
          <Button type="submit" color="warning" variant="contained" disabled={loading}
                  data-testid="reset-password-confirm">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Reset password'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
