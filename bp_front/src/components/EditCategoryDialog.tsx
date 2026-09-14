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
import {type ListCategory, SaveCategoryMutation} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  // The category row the rename was opened on; null keeps the dialog closed.
  category: ListCategory | null
  onClose: () => void
  onSaved: () => void | Promise<unknown>
}

const NAME_MAX = 100

// Rename-category dialog (Story 8.6, FR63) for the list MANAGEMENT screen
// /lists/:id. Before this story the only way to correct a mistyped category name
// was the remove control, whose own confirm reads "Items in this category are
// removed with it. This cannot be undone." — so fixing "Diary" to "Dairy" cost
// the whole aisle (report #8, UX-DR-E8-12).
//
// It saves through the SAME `saveCategory` upsert `AddCategoryDialog` uses —
// there is no separate rename mutation and this story adds none. The ONE line
// that must never be copied across from the add dialog is its
// freshly minted UUID: the id here is the LOADED category's own, and a fresh
// one would leave the old row in place beside a new empty one.
//
// There is deliberately NO `listId` prop. `CategoryRepository.save` `$set`s
// `listId` unconditionally, so the payload has to carry the list the category
// was actually loaded from — `useParams`'s route id is a different value that
// merely happens to agree today, and the two diverging even once would move the
// category to another list and strand its items behind a dangling id.
//
// Renaming is a MEMBER right (`CategoryService.saveCategory` → verifyMembership),
// so there is deliberately no client-side owner check. There is likewise no
// existence check: a rename saved against a category another member has already
// removed RECREATES it, empty — the upsert's documented outcome, recorded in
// deferred-work.md as decided, not guarded.
export default function EditCategoryDialog({category, onClose, onSaved}: Props) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveCategory, {loading}] = useMutation(SaveCategoryMutation)

  // Retain the targeted category so its name still renders through the close
  // transition, and re-seed the field on each open. Adjusting state during
  // render is React's recommended alternative to a syncing effect (which
  // react-hooks/set-state-in-effect forbids). Keyed off the closed→open
  // transition rather than row identity, exactly as EditItemDialog is: reopening
  // the same row after a refetch may hand back an identical object reference,
  // and an identity check alone would leave the previously typed value sitting
  // in the field. The id clause is belt-and-braces against a future surface that
  // could retarget the dialog without closing it.
  const [shown, setShown] = useState<ListCategory | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const open = Boolean(category)
  if (open !== prevOpen || (category !== null && category.id !== shown?.id)) {
    setPrevOpen(open)
    if (open && category) {
      setShown(category)
      setName(category.name)
      setNameError(null)
      setFormError(null)
    }
  }

  const handleCancel = () => {
    if (loading) return
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
    if (loading || !shown) return
    setFormError(null)
    if (!validate()) return

    // Nothing actually changed → send no mutation at all, and close exactly as a
    // successful save does. This is the SAME guard EditItemDialog carries, for
    // the same reason it gives: `saveCategory` is a full-document upsert, so an
    // unchanged submit is not inert under concurrency — it writes this dialog's
    // OPEN-TIME name back over whatever is stored now, silently reverting a
    // co-member's rename that landed while the dialog sat open. Comparing
    // against `shown` rather than the live prop is what makes that true: "did
    // the USER change anything" is a question about what they were shown, so a
    // concurrent rename is left alone rather than reverted.
    if (name.trim() !== shown.name) {
      // `category ?? shown` — the live prop first, the open-time snapshot only
      // as a fallback. Today these are always the SAME object: ListDetailPage
      // passes `editCategoryTarget`, a `useState` value captured at click time
      // that its refetch does not re-derive, so the prop cannot go stale
      // underneath this dialog while it is open. The expression is written this
      // way for what it guarantees regardless: the id and `listId` sent are the
      // LOADED ENTITY's own, never the route's `useParams` id.
      // `CategoryRepository.save` `$set`s `listId` unconditionally, so a wrong
      // one moves the category to another list and strands its items behind a
      // dangling id.
      const current = category ?? shown
      try {
        await saveCategory({
          variables: {category: {id: current.id, name: name.trim(), listId: current.listId}},
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
    <Dialog open={open} onClose={handleCancel} data-testid="edit-category-dialog" fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Rename category</DialogTitle>
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
            slotProps={{htmlInput: {'data-testid': 'edit-category-name', maxLength: NAME_MAX}}}
          />
          {formError && (
            <Alert severity="error" role="alert" data-testid="edit-category-error" sx={{mt: 1}}>
              {formError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={loading} data-testid="edit-category-cancel">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} data-testid="edit-category-submit">
            {loading ? <CircularProgress size={20} color="inherit"/> : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
