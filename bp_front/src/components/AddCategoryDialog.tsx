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
import TextField from '@mui/material/TextField'
import {SaveCategoryMutation} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  listId: string
  onClose: () => void
  onAdded: () => void | Promise<unknown>
}

const NAME_MAX = 100

// Add-category dialog (Story 5.5, FR46). A category is a first-class entity with
// a client-supplied UUID, scoped to its list. Uses saveCategory (upsert) — there
// is no addCategory. Mirrors the 5.4 form conventions: validate-on-submit,
// re-entry guard, real catch → inline error, Enter-submits via a native <form>.
export default function AddCategoryDialog({open, listId, onClose, onAdded}: Props) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveCategory, {loading}] = useMutation(SaveCategoryMutation)

  const reset = () => {
    setName('')
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

    try {
      await saveCategory({
        variables: {category: {id: crypto.randomUUID(), name: name.trim(), listId}},
      })
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    reset()
    onClose()
    void onAdded()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="add-category-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Add category</DialogTitle>
        <DialogContent>
          <TextField
            label="Category name"
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
            sx={{mt: 1}}
            slotProps={{htmlInput: {'data-testid': 'add-category-name', maxLength: NAME_MAX}}}
          />
          {formError && (
            <Alert severity="error" role="alert" data-testid="add-category-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="add-category-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="add-category-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Add'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
