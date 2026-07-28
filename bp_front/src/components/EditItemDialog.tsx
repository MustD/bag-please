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
import {type ListCategory, type ListItem, SaveItemMutation} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import StoreField from '@/components/StoreField'
import {normalizeStore} from '@/lib/lists/storeValue'

interface Props {
  // The row the edit was opened on; null keeps the dialog closed.
  item: ListItem | null
  listId: string
  categories: ReadonlyArray<ListCategory>
  onClose: () => void
  onSaved: () => void | Promise<unknown>
}

const NAME_MAX = 100

// Edit-item dialog (Story 6.1, FR40/FR44) for the list MANAGEMENT screen
// /lists/:id. Renders name, category and store; the shopping view stays
// check-off-only and gains no edit affordance.
//
// `saveItem` is a full-document upsert (GqlItemMapper.mapItemFromInput builds a
// fresh Item from the input alone and ItemRepository.save $sets every field), so
// the payload MUST carry forward every field this form does not render —
// `checked` and `recurring`. A partial payload silently un-checks the item and
// wipes its cadence. There is no lifecycle control here by design (deferred,
// blocked on the server-side checkedAt reset — see deferred-work.md BUG-E6-2).
//
// Editing is a MEMBER right (ItemService.saveItem → verifyMembership), so there
// is deliberately no client-side owner check.
export default function EditItemDialog({item, listId, categories, onClose, onSaved}: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [store, setStore] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveItem, {loading}] = useMutation(SaveItemMutation)

  // Retain the targeted item so its values still render through the close
  // transition, and re-seed every field on each open. Adjusting state during
  // render is React's recommended alternative to a syncing effect (which
  // react-hooks/set-state-in-effect forbids). Key off the closed→open
  // transition, not the row identity: reopening the same row after a refetch may
  // hand back an identical object reference, and an identity check would leave
  // the previously typed values sitting in the fields.
  // The id clause is belt-and-braces: nothing can retarget the dialog from one
  // row to another without closing it today (the modal backdrop blocks the other
  // rows), but if anything ever did, seeding on the open transition alone would
  // leave `shown` — and therefore the saved id — pointing at the previous item.
  const [shown, setShown] = useState<ListItem | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const open = Boolean(item)
  if (open !== prevOpen || (item !== null && item.id !== shown?.id)) {
    setPrevOpen(open)
    if (open && item) {
      setShown(item)
      setName(item.name)
      setCategoryId(item.category)
      setStore(item.store ?? '')
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
    if (loading || !shown) return
    setFormError(null)
    if (!validate()) return

    // Nothing actually changed → send no mutation at all, and close exactly as a
    // successful save does. The request would only re-attribute a co-member's
    // item (`addedBy` is server-set from the caller — deferred-work BUG-E6-1) for
    // no benefit. Both sides of the store comparison are normalized so a legacy
    // '' stored value does not read as a change.
    const nothingChanged =
      name.trim() === shown.name &&
      categoryId === shown.category &&
      normalizeStore(store) === normalizeStore(shown.store ?? '')
    if (!nothingChanged) {
      // Carry-forward fields read from the LIVE `item` prop, not the open-time
      // `shown` snapshot: ListDetailPage refetches after every mutation, so the
      // prop can be newer, and a full-document upsert turns any stale value into
      // a silent overwrite. The change comparison above deliberately still uses
      // `shown` — "did the user change anything" is about what they were shown,
      // so a co-member's concurrent rename is left alone rather than reverted.
      const current = item ?? shown
      try {
        await saveItem({
          variables: {
            item: {
              id: current.id,
              listId,
              name: name.trim(),
              category: categoryId,
              // Not rendered by this form — omitting either would reset it to its
              // default server-side (un-checking the item, wiping its cadence).
              checked: current.checked,
              recurring: current.recurring ?? null,
              store: normalizeStore(store),
            },
          },
        })
      } catch (err) {
        setFormError(graphqlErrorMessage(err))
        return
      }
    }
    onClose()
    void onSaved()
  }

  return (
    <Dialog open={open} onClose={handleCancel} data-testid="edit-item-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Edit item</DialogTitle>
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
              slotProps={{htmlInput: {'data-testid': 'edit-item-name', maxLength: NAME_MAX}}}
            />
            <FormControl fullWidth error={Boolean(categoryError)} disabled={loading}>
              <InputLabel id="edit-item-category-label">Category</InputLabel>
              <Select
                labelId="edit-item-category-label"
                label="Category"
                value={categoryId}
                onChange={e => {
                  setCategoryId(e.target.value)
                  if (categoryError) setCategoryError(null)
                }}
                data-testid="edit-item-category"
              >
                {categories.map(category => (
                  <MenuItem
                    key={category.id}
                    value={category.id}
                    data-testid={`edit-item-category-option-${category.name}`}
                  >
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{categoryError ?? ' '}</FormHelperText>
            </FormControl>
            <StoreField
              listId={listId}
              value={store}
              onChange={setStore}
              testIdPrefix="edit-item"
              disabled={loading}
            />
          </Stack>
          {formError && (
            <Alert severity="error" role="alert" data-testid="edit-item-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="edit-item-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="edit-item-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
