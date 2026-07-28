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
import {CreateListMutation} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  onClose: () => void
  // Called after a successful create so the parent can refetch the lists index.
  // Fired unawaited by the parent — a failed refetch must never be reported as a
  // failed create.
  onCreated: () => void | Promise<unknown>
}

const NAME_MAX = 100

// Create-list dialog (Story 5.5, FR34/FR46). Mirrors the 5.4 form conventions:
// manual controlled state, validate-on-submit (name required + ≤100 chars, since
// the backend returns those only as uncoded generic errors), a same-tick
// re-entry guard, a real catch that surfaces the GraphQL error inline (never a
// toast), and Enter-submits via a native <form>. The optional emoji is sent as
// null when blank. There is no description field — the frozen backend has none
// (deferred).
export default function CreateListDialog({open, onClose, onCreated}: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [createList, {loading}] = useMutation(CreateListMutation)

  const reset = () => {
    setName('')
    setEmoji('')
    setNameError(null)
    setFormError(null)
  }

  const handleCancel = () => {
    if (loading) return
    reset()
    onClose()
  }

  const validate = (): boolean => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return false
    }
    if (trimmed.length > NAME_MAX) {
      setNameError(`Name must be ${NAME_MAX} characters or fewer`)
      return false
    }
    setNameError(null)
    return true
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setFormError(null)
    if (!validate()) return

    const trimmedEmoji = emoji.trim()
    try {
      await createList({
        variables: {name: name.trim(), emoji: trimmedEmoji ? trimmedEmoji : null},
      })
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    // Success is decided by the mutation alone: close immediately (so the button
    // can't be re-clicked during the refresh) then refetch in the background.
    reset()
    onClose()
    void onCreated()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="create-list-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Create list</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{mt: 1}}>
            <TextField
              label="Name"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              error={Boolean(nameError)}
              helperText={nameError ?? ' '}
              autoComplete="off"
              autoFocus
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'create-list-name', maxLength: NAME_MAX}}}
            />
            <TextField
              label="Emoji (optional)"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              helperText=" "
              autoComplete="off"
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'create-list-emoji', maxLength: 8}}}
            />
          </Stack>
          {formError && (
            <Alert severity="error" role="alert" data-testid="create-list-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="create-list-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="create-list-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
