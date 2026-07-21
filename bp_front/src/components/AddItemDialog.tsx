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
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import {type ListCategory, SaveItemMutation} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  open: boolean
  listId: string
  categories: ReadonlyArray<ListCategory>
  // Pre-selected category (e.g. the row the "+" was pressed under). Optional.
  defaultCategoryId?: string
  onClose: () => void
  onAdded: () => void | Promise<unknown>
}

const NAME_MAX = 100

// Add-item dialog (Story 5.5, FR46). An item carries a client-supplied UUID and
// is scoped to its list + an existing category (Item.category is that category's
// UUID). New items are unchecked and non-recurring (recurring UI is Story 5.6).
// Mirrors the 5.4 form conventions: validate-on-submit (name + category
// required), re-entry guard, real catch → inline error, Enter-submits.
export default function AddItemDialog({
  open,
  listId,
  categories,
  defaultCategoryId,
  onClose,
  onAdded,
}: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveItem, {loading}] = useMutation(SaveItemMutation)

  // Seed the category selection from the caller when the dialog opens
  // (render-phase adjustment on the closed→open transition — no syncing effect).
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setName('')
      setCategoryId(defaultCategoryId ?? '')
      setNameError(null)
      setCategoryError(null)
      setFormError(null)
    }
  }

  const handleCancel = () => {
    if (loading) return
    onClose()
  }

  const validate = (): boolean => {
    let ok = true
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      ok = false
    } else if (trimmed.length > NAME_MAX) {
      setNameError(`Name must be ${NAME_MAX} characters or fewer`)
      ok = false
    } else {
      setNameError(null)
    }
    if (!categoryId) {
      setCategoryError('Choose a category')
      ok = false
    } else {
      setCategoryError(null)
    }
    return ok
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setFormError(null)
    if (!validate()) return

    try {
      await saveItem({
        variables: {
          item: {
            id: crypto.randomUUID(),
            name: name.trim(),
            checked: false,
            category: categoryId,
            listId,
            recurring: null,
          },
        },
      })
    } catch (err) {
      setFormError(graphqlErrorMessage(err))
      return
    }
    onClose()
    void onAdded()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="add-item-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Add item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{mt: 1}}>
            <TextField
              label="Item name"
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
              slotProps={{htmlInput: {'data-testid': 'add-item-name', maxLength: NAME_MAX}}}
            />
            <FormControl fullWidth error={Boolean(categoryError)} disabled={loading}>
              <InputLabel id="add-item-category-label">Category</InputLabel>
              <Select
                labelId="add-item-category-label"
                label="Category"
                value={categoryId}
                onChange={e => {
                  setCategoryId(e.target.value)
                  if (categoryError) setCategoryError(null)
                }}
                data-testid="add-item-category"
              >
                {categories.map(category => (
                  <MenuItem
                    key={category.id}
                    value={category.id}
                    data-testid={`add-item-category-option-${category.name}`}
                  >
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{categoryError ?? ' '}</FormHelperText>
            </FormControl>
          </Stack>
          {formError && (
            <Alert severity="error" role="alert" data-testid="add-item-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="add-item-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="add-item-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Add'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
