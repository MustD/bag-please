import {useQuery} from '@apollo/client/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {ItemStoreSuggestionsQuery} from '@/lib/lists/listsQueries'
import {STORE_MAX} from '@/lib/lists/storeValue'

interface Props {
  listId: string
  value: string
  onChange: (next: string) => void
  // Namespaces the test ids so the add and edit dialogs can both render this
  // field without colliding (`add-item-store`, `edit-item-store`, …).
  testIdPrefix: string
  disabled?: boolean
}

// Shared store input + suggestion chips for the add/edit item dialogs (Story
// 6.1, FR44). Deliberately NOT an Autocomplete: a second role=combobox inside
// `add-item-dialog` would break the existing strict-mode category selectors in
// lists.spec.ts / shopping.spec.ts. Suggestions are clickable Chips (role=button)
// below a freely typable field, and the row is absent entirely when the list has
// no stores yet — no empty container, no placeholder.
export default function StoreField({listId, value, onChange, testIdPrefix, disabled}: Props) {
  // `itemStoreSuggestions` is `mapNotNull { it.store }.distinct()` over an
  // in-memory map: unsorted, and '' survives it (there is no backend trim). Trim,
  // drop empties, dedupe and sort here so the rendered order is deterministic.
  const {data, error} = useQuery(ItemStoreSuggestionsQuery, {
    variables: {listId},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  })
  const suggestions = [
    ...new Set((data?.itemStoreSuggestions ?? []).map(s => s.trim()).filter(s => s.length > 0)),
  ].sort((a, b) => a.localeCompare(b))

  return (
    <Stack spacing={1}>
      <TextField
        label="Store"
        value={value}
        onChange={e => onChange(e.target.value)}
        helperText=" "
        autoComplete="off"
        fullWidth
        disabled={disabled}
        slotProps={{htmlInput: {'data-testid': `${testIdPrefix}-store`, maxLength: STORE_MAX}}}
      />
      {/* One slot, three states. `mt: -1.5` reclaims the field's reserved
          one-line helperText spacer, so whatever renders here sits directly under
          the input — which is also why a real message goes in THIS slot rather
          than into helperText, where the pull-up would overlap it.
          A failed lookup must not read as "this list has no stores": suggestions
          are a convenience, so the notice is quiet and the field stays typable. */}
      {error ? (
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
                onClick={() => onChange(suggestion)}
              />
            ))}
          </Box>
        )
      )}
    </Stack>
  )
}
