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
import {CreateUserMutation} from '@/lib/admin/adminQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  onClose: () => void
  // Called after a successful create so the parent can refresh the users table
  // before the new row is asserted. Awaited so the dialog closes only once the
  // table reflects the addition (no full page reload).
  onCreated: () => void | Promise<unknown>
}

interface FieldErrors {
  username?: string
  password?: string
}

// Create-user dialog (Story 5.4, FR14). Mirrors the 5.2/5.3 form conventions:
// manual controlled state, validate-on-submit with inline field errors, a
// same-tick re-entry guard, a real catch that surfaces the GraphQL error inline
// (never a toast), and Enter-submits via a native <form>. The backend does NOT
// validate empty/short fields, so the required-field check is client-side only;
// a duplicate/reserved username returns CONFLICT "Username already taken", shown
// in-dialog with the fields intact and the dialog kept open.
export default function CreateUserDialog({open, onClose, onCreated}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [createUser, {loading}] = useMutation(CreateUserMutation)

  const reset = () => {
    setUsername('')
    setPassword('')
    setFieldErrors({})
    setFormError(null)
  }

  const handleCancel = () => {
    if (loading) return
    reset()
    onClose()
  }

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!username.trim()) errs.username = 'Username is required'
    // Trim-check only: a whitespace-only password is as empty as a blank one
    // (username already trim-checks), but the untrimmed value is what's sent.
    if (!password.trim()) errs.password = 'Password is required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setFormError(null)
    if (!validate()) return

    try {
      await createUser({variables: {username: username.trim(), password}})
    } catch (err) {
      // Keep the dialog open with fields intact; surface the reason inline.
      setFormError(graphqlErrorMessage(err))
      return
    }
    // Success is decided by the mutation alone. Close immediately so the confirm
    // button can't be re-clicked during the refresh, then refresh the table in
    // the background — a failed refetch must never be reported as a failed
    // create (the user WAS created; the new row will appear once the query
    // settles).
    reset()
    onClose()
    void onCreated()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="create-user-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Create user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{mt: 1}}>
            <TextField
              label="Username"
              value={username}
              onChange={e => {
                setUsername(e.target.value)
                setFieldErrors(prev => (prev.username ? {...prev, username: undefined} : prev))
              }}
              error={Boolean(fieldErrors.username)}
              helperText={fieldErrors.username ?? ' '}
              autoComplete="off"
              autoFocus
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'create-user-username'}}}
            />
            <TextField
              label="Initial password"
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                setFieldErrors(prev => (prev.password ? {...prev, password: undefined} : prev))
              }}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password ?? ' '}
              autoComplete="new-password"
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'create-user-password'}}}
            />
          </Stack>
          {formError && (
            <Alert severity="error" role="alert" data-testid="create-user-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="create-user-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="create-user-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
