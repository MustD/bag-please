import {type MouseEvent, useId} from 'react'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select, {type SelectChangeEvent} from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import type {CheckedFilter, ItemFilterValue} from '@/lib/lists/itemFilter'

interface ListFiltersProps {
  categories: ReadonlyArray<{id: string; name: string}>
  value: ItemFilterValue
  onChange: (next: ItemFilterValue) => void
  // Names the whole filter row: `shopping-filters` on /list/:id,
  // `list-detail-filters` on /lists/:id. Nothing in the suite asserts either —
  // every spec reaches the individual controls (`filter-category`,
  // `filter-search`, `filter-checked*`) directly. `shopping-filters` is kept
  // because Story 5.6 shipped it, not because anything is protecting it.
  testId: string
  // OPTIONAL, and its absence is the point (UX-DR-E8-7). The management screen
  // has no notion of "checked", so it passes neither prop and the toggle is not
  // rendered AT ALL — not rendered disabled. A disabled control still occupies
  // the row, still reads as a control to assistive technology, and still invites
  // the question "why can't I use this?".
  checkedFilter?: CheckedFilter
  onCheckedFilter?: (next: CheckedFilter) => void
}

// THE one definition of the filter UI (Story 8.4, FR61, NFR-E8-5): a
// multi-select category filter, an optional checked-status toggle, and a
// case-insensitive name search. Mounted by BOTH list surfaces.
//
// Strictly presentational — no query, no mutation, no subscription. That is what
// lets /lists/:id mount it while staying refetch-driven by Story 6.1's design
// (AR-E8-6): the component must not assume the subscription the shopping view
// happens to have.
//
// The category control is a `multiple` MUI `Select` with checkboxes in the menu
// and a text summary in the closed control — NOT a chip row (UX-DR-E8-4). A chip
// row grows the filter block by a line per selection, which at the NFR-E8-1
// 320px floor pushes the list itself off the fold.
export default function ListFilters({
  categories,
  value,
  onChange,
  testId,
  checkedFilter,
  onCheckedFilter,
}: ListFiltersProps) {
  // Per-instance, because both screens could in principle mount this at once and
  // a hardcoded id would make the label point at the wrong control.
  const labelId = useId()

  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name))

  const handleCategory = (event: SelectChangeEvent<string[]>) => {
    // A `multiple` Select hands the handler an ARRAY, so the "All categories"
    // sentinel (`value=""`) arrives INSIDE it rather than as the whole value.
    // Normalising here is what lets that MenuItem stay a MenuItem — which AC1
    // requires and which two shipped specs click by testid.
    const raw = event.target.value
    const next = typeof raw === 'string' ? raw.split(',') : raw
    onChange({...value, categoryIds: next.includes('') ? [] : next})
  }

  const handleChecked = (_event: MouseEvent<HTMLElement>, next: CheckedFilter | null) => {
    // MUI reports a deselect as `null`; an exclusive group with no selection is
    // not a state this filter has.
    if (next !== null) onCheckedFilter?.(next)
  }

  return (
    <Stack
      direction={{xs: 'column', sm: 'row'}}
      spacing={2}
      data-testid={testId}
      sx={{mb: 3, alignItems: {sm: 'center'}}}
    >
      <FormControl size="small" sx={{minWidth: 180}}>
        {/* `shrink` is forced because a `multiple` Select with an EMPTY value
            renders nothing of its own, so the floating label would never shrink
            and would sit on top of the "All categories" summary below.
            `displayEmpty` is the other half: without it the summary is not
            rendered at all for an empty selection. */}
        <InputLabel id={labelId} shrink>Category</InputLabel>
        <Select
          multiple
          displayEmpty
          labelId={labelId}
          label="Category"
          value={value.categoryIds as string[]}
          onChange={handleCategory}
          // The closed control SUMMARISES the selection as text. This is the
          // "not a chip row" ruling made concrete: one line, ellipsised by MUI's
          // own `.MuiSelect-select` overflow rules, whatever the selection size.
          // Built from `sorted`, the SAME order the menu below renders, so the
          // summary and the checked menu items read in one sequence. Mapping the
          // raw prop here would list the chosen names in server order against an
          // alphabetical menu.
          renderValue={ids =>
            ids.length === 0
              ? 'All categories'
              : sorted.filter(c => ids.includes(c.id)).map(c => c.name).join(', ')
          }
          data-testid="filter-category"
        >
          <MenuItem value="" data-testid="filter-category-option-all">
            <Checkbox size="small" checked={value.categoryIds.length === 0}/>
            <ListItemText primary="All categories"/>
          </MenuItem>
          {sorted.map(category => (
            <MenuItem
              key={category.id}
              value={category.id}
              data-testid={`filter-category-option-${category.name}`}
            >
              <Checkbox size="small" checked={value.categoryIds.includes(category.id)}/>
              <ListItemText primary={category.name}/>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {checkedFilter !== undefined && (
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={checkedFilter}
          onChange={handleChecked}
          aria-label="Filter by checked status"
          data-testid="filter-checked"
        >
          <ToggleButton value="all" data-testid="filter-checked-all">All</ToggleButton>
          <ToggleButton value="unchecked" data-testid="filter-checked-unchecked">To buy</ToggleButton>
          <ToggleButton value="checked" data-testid="filter-checked-checked">Done</ToggleButton>
        </ToggleButtonGroup>
      )}

      <TextField
        size="small"
        label="Search"
        value={value.search}
        onChange={e => onChange({...value, search: e.target.value})}
        sx={{flexGrow: 1}}
        slotProps={{htmlInput: {'data-testid': 'filter-search'}}}
      />
    </Stack>
  )
}
