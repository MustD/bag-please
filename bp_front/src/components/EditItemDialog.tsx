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
import {itemSaveErrorMessage} from '@/lib/admin/adminErrors'
import StoreField from '@/components/StoreField'
import {normalizeStores} from '@/lib/lists/storeValue'
import {isKnownCategoryId} from '@/lib/lists/categoryChoice'

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
// /lists/:id. Renders name, category and stores (plural since Story 9.6); the
// shopping view stays check-off-only and gains no edit affordance.
//
// `saveItem` MERGES into the stored row (ItemService.saveItem's update branch):
// it copies only `name`, `category` and `stores` from the input, so `addedBy` and
// anything else the input does not carry survive untouched. `checked` and
// `recurring` are the exception — they go to `applyCheckState`, which derives
// `checkedAt`, `deleted` and `deletedAt` from them. So the payload must carry
// both forward: this form renders neither, and a payload that dropped them would
// un-check the item (clearing its check-off clock) and wipe its cadence.
// A lifecycle control here is still deferred, but no longer blocked: Story 9.5
// fixed the server-side check-state defect that was its blocker.
//
// Editing is a MEMBER right (ItemService.saveItem → verifyMembership), so there
// is deliberately no client-side owner check.
export default function EditItemDialog({item, listId, categories, onClose, onSaved}: Props) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stores, setStores] = useState<string[]>([])
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
      setStores([...item.stores])
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
    // Story 9.6 — the ORPHAN GUARD. An item whose category is no longer on the
    // list opens with a BLANK `Select` while `categoryId` still holds the stale
    // id, so an untouched save used to pass validation, hit `nothingChanged` and
    // close silently, leaving the orphan orphaned with no feedback. Guarded HERE
    // rather than in the short-circuit, because from validate() it covers every
    // path — the short-circuit below is then never reached.
    if (!categoryId || !isKnownCategoryId(categoryId, categories)) {
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
    // successful save does. The merge would preserve `addedBy` either way, but a
    // no-op write still re-emits the item on the list's update flow and makes
    // every subscriber re-render for nothing. The stores comparison is EXACT
    // string equality over the normalized arrays, element by element: identity
    // is the lowercased key, but the stored casing is display data, so changing
    // "Lidl" to "LIDL" IS a change and has to be sent (AR-E9-4).
    const nextStores = normalizeStores(stores)
    const storedStores = normalizeStores(shown.stores)
    const nothingChanged =
      name.trim() === shown.name &&
      categoryId === shown.category &&
      nextStores.length === storedStores.length &&
      nextStores.every((s, i) => s === storedStores[i])
    if (!nothingChanged) {
      // Carry-forward fields read from the LIVE `item` prop, not the open-time
      // `shown` snapshot: ListDetailPage refetches after every mutation, so the
      // prop can be newer, and `checked`/`recurring` are input-owned — the merge
      // applies whatever this payload says, so a stale value here is still a
      // silent overwrite. The change comparison above deliberately still uses
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
              // Not rendered by this form, but still input-owned: the merge feeds
              // both straight to `applyCheckState`, so sending a stale `checked`
              // would un-check the item and clear its check-off clock, and a
              // missing `recurring` would wipe its cadence.
              checked: current.checked,
              recurring: current.recurring ?? null,
              stores: nextStores,
            },
          },
        })
      } catch (err) {
        setFormError(itemSaveErrorMessage(err))
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
              value={stores}
              onChange={setStores}
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
