import {type KeyboardEvent, useId, useState} from 'react'
import {useQuery} from '@apollo/client/react'
import CancelIcon from '@mui/icons-material/Cancel'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {ItemStoreSuggestionsQuery} from '@/lib/lists/listsQueries'
import {normalizeStores, STORE_MAX, storeKey} from '@/lib/lists/storeValue'

interface Props {
  listId: string
  value: readonly string[]
  onChange: (next: string[]) => void
  // Namespaces the test ids so the add and edit dialogs can both render this
  // field without colliding (`add-item-store`, `edit-item-store`, …).
  testIdPrefix: string
  disabled?: boolean
}

// Shared MULTI-VALUE store field for the add/edit item dialogs (Story 6.1,
// FR44; multi-value since Story 9.6, UX-DR-E9-6). Selected stores are removable
// chips above a plain text input; suggestions are clickable outlined chips
// below it.
//
// Deliberately NOT an Autocomplete, and Story 9.6 KEEPS that constraint rather
// than re-opening it: a second role=combobox inside `add-item-dialog` would
// break the scoped `getByRole('combobox')` the E2E helpers use to reach the
// category Select (`e2e/support/ui.ts`). A chip input made of a plain
// `<input>` plus buttons has no combobox in it at all.
export default function StoreField({listId, value, onChange, testIdPrefix, disabled}: Props) {
  // The uncommitted text. A store only joins `value` on a commit gesture, so the
  // parent's state is always the real list and never a half-typed name.
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const duplicateId = useId()

  // Since Story 9.6 the server returns one name per case-insensitive key,
  // already sorted (AR-E9-4) — so no trim/dedupe/sort here. Only the names
  // already selected are filtered out, which is a fact about THIS dialog and
  // cannot be computed server-side.
  const {data, error} = useQuery(ItemStoreSuggestionsQuery, {
    variables: {listId},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  })
  const selectedKeys = new Set(value.map(storeKey))
  const suggestions = (data?.itemStoreSuggestions ?? []).filter(s => !selectedKeys.has(storeKey(s)))

  // Add one name. The duplicate check is by KEY, mirroring the server: " lidl "
  // is the store already shown as "Lidl", and adding it would be a no-op the
  // server would silently swallow — so it is refused here, with the reason, and
  // the input is cleared so the user is not left staring at text that will not
  // take.
  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      setDraft('')
      return
    }
    if (selectedKeys.has(storeKey(trimmed))) {
      setDraft('')
      setDraftError(`${trimmed} is already added`)
      return
    }
    setDraft('')
    setDraftError(null)
    onChange(normalizeStores([...value, trimmed]))
  }

  const remove = (name: string) => {
    setDraftError(null)
    onChange(value.filter(s => s !== name))
  }

  // Enter COMMITS a non-empty draft instead of submitting the dialog. Both item
  // dialogs are native forms that submit on Enter (EXPERIENCE.md §8), and Enter
  // is the gesture users expect from a chip input — so this is the explicit
  // per-field decision §8 asks for, and it has its own E2E assertion. With
  // NOTHING to commit the key is left alone, so the form submits as it does from
  // every other field in the app instead of Enter silently doing nothing.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    if (draft.trim().length === 0) return
    event.preventDefault()
    commit(draft)
  }

  return (
    <Stack spacing={1}>
      {value.length > 0 && (
        <Box
          role="group"
          aria-label="Selected stores"
          data-testid={`${testIdPrefix}-store-chips`}
          sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}
        >
          {value.map(name => (
            <Chip
              key={name}
              size="small"
              label={name}
              disabled={disabled}
              data-testid={`${testIdPrefix}-store-chip-${name}`}
              onDelete={() => remove(name)}
              // A REAL button for the remove affordance, supplied as the
              // `deleteIcon` element (MUI clones it and attaches the click
              // handler). The default `deleteIcon` is a bare SVG: giving it a
              // `tabIndex` would make it focusable but Enter would still not
              // activate it, and this control has to be keyboard-operable. It is
              // icon-only, so it carries its own accessible name.
              deleteIcon={
                <IconButton
                  size="small"
                  aria-label={`Remove store ${name}`}
                  data-testid={`${testIdPrefix}-store-chip-remove-${name}`}
                >
                  <CancelIcon fontSize="inherit"/>
                </IconButton>
              }
            />
          ))}
        </Box>
      )}
      <TextField
        label="Store"
        value={draft}
        onChange={e => {
          setDraft(e.target.value)
          if (draftError) setDraftError(null)
        }}
        onKeyDown={handleKeyDown}
        // Blur commits the same draft. Without it "type Lidl, click Save" drops
        // the name silently: the button's pointerdown blurs the input, React
        // flushes this commit, and the click then submits a payload that already
        // holds it.
        onBlur={() => commit(draft)}
        error={Boolean(draftError)}
        helperText=" "
        autoComplete="off"
        fullWidth
        disabled={disabled}
        slotProps={{
          htmlInput: {
            'data-testid': `${testIdPrefix}-store`,
            maxLength: STORE_MAX,
            'aria-describedby': draftError ? duplicateId : undefined,
          },
        }}
      />
      {/* One slot, three states. `mt: -1.5` reclaims the field's reserved
          one-line helperText spacer, so whatever renders here sits directly under
          the input — which is also why a real message goes in THIS slot rather
          than into helperText, where the pull-up would overlap it.
          A failed lookup must not read as "this list has no stores": suggestions
          are a convenience, so the notice is quiet and the field stays typable. */}
      {draftError ? (
        // `role="alert"` so the reason is ANNOUNCED: the field turns invalid and
        // clears its text at the same moment, and without a live region a screen
        // reader user hears neither why nor that anything happened.
        <Typography
          id={duplicateId}
          role="alert"
          variant="caption"
          color="error"
          data-testid={`${testIdPrefix}-store-duplicate`}
          sx={{mt: -1.5}}
        >
          {draftError}
        </Typography>
      ) : error ? (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={`${testIdPrefix}-store-suggestions-error`}
          sx={{mt: -1.5}}
        >
          Store suggestions unavailable
        </Typography>
      ) : (
        suggestions.length > 0 && (
          <Box
            role="group"
            aria-label="Store suggestions"
            data-testid={`${testIdPrefix}-store-suggestions`}
            sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: -1.5}}
          >
            {suggestions.map(suggestion => (
              <Chip
                key={suggestion}
                size="small"
                variant="outlined"
                label={suggestion}
                disabled={disabled}
                data-testid={`${testIdPrefix}-store-suggestion-${suggestion}`}
                onClick={() => commit(suggestion)}
              />
            ))}
          </Box>
        )
      )}
    </Stack>
  )
}
