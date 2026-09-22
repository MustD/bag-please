import {type MouseEvent, useId, useRef, useState} from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
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
import {byName} from '@/lib/lists/order'

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

  // Story 9.8 — the menu's `open` state is now CONTROLLED, purely so the sticky
  // "Done" footer below can close it directly.
  // A `multiple` Select never self-closes on selection (that is deliberate, see
  // the module header), and at the 320px floor with many categories it used to
  // cover most of the screen with no discoverable way out short of Escape or an
  // outside tap. `onOpen`/`onClose` keep native open/close paths (clicking the
  // control, Escape, outside tap) working exactly as before; only the confirm
  // control's own `onClick` reaches `setOpen` from outside those paths.
  const [open, setOpen] = useState(false)

  // The confirm control's OTHER job: giving focus back to the trigger it just
  // closed. MUI's own Menu/Modal focus restoration is keyed to ITS exit
  // transition, which is reliable for the paths that were already exercised
  // (Escape, outside tap) but not dependably observed for a click landing on a
  // plain, non-`MenuItem` child inside the menu (measured, 2026-09-22) — so
  // this is done explicitly rather than assumed. `Select`'s `ref` forwards to
  // the closed control's own root node, which is always mounted (only the menu
  // portal opens/closes), so `.focus()` here is safe whether or not the menu
  // is currently open.
  const selectRef = useRef<HTMLDivElement>(null)

  // THE shared name comparator (Story 8.5, AC3) — the same one `order.ts` groups
  // by, so the menu and the closed control's summary below read in one sequence.
  // Deliberately `byName` and NOT the grouping function's `byNameThenId`: the id
  // tiebreak exists to make the RENDERED LIST total against an unstable backend
  // order, and a menu of choices has no such requirement. The consequence, so it
  // is not discovered as a surprise: two categories with the SAME name can order
  // differently here than in the list underneath.
  const sorted = [...categories].sort(byName)

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
          ref={selectRef}
          multiple
          displayEmpty
          labelId={labelId}
          label="Category"
          value={[...value.categoryIds]}
          onChange={handleCategory}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          // Focus is handed back to the trigger from the MENU'S OWN exit
          // transition (`onExited`), explicitly, rather than left to MUI's
          // default restoration or done eagerly from whichever handler flips
          // `open` to false — an eager `.focus()` call made from inside a
          // click that is itself inside the still-mounted `Menu` raced its
          // FocusTrap and lost, landing focus on `<body>` (measured,
          // 2026-09-22). `onExited` runs once the trap is actually gone, for
          // EVERY close path alike (Escape, outside tap, and the confirm
          // control), so this is one rule rather than a special case for the
          // new control.
          MenuProps={{
            slotProps: {
              transition: {onExited: () => selectRef.current?.focus()},
            },
          }}
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
          {/* The confirm control (Story 9.8, UX-DR-E9-10). Deliberately NOT a
              `MenuItem`: MUI's `SelectInput` clones every child and overrides
              `onClick` only on the ones carrying a `value` prop, so a plain
              non-`MenuItem` element passes through untouched and is safe to give
              its own `onClick` — closing the (now controlled) `open` state
              rather than being misread as a category toggle. `component="li"`
              on both keeps them valid children of the `Menu`'s own `<ul>`, the
              same way `MenuItem` renders as one.
              `position: sticky` + `bottom: 0` is what keeps it reachable
              without scrolling the menu at the 320px floor with many
              categories (AR-E9-14 sibling requirement) — it is the LAST child,
              so it stays pinned to the menu's own bottom edge rather than the
              viewport's. */}
          <Divider component="li" role="presentation"/>
          <Box
            component="li"
            role="presentation"
            sx={{
              position: 'sticky',
              bottom: 0,
              bgcolor: 'background.paper',
              display: 'flex',
              justifyContent: 'flex-end',
              px: 1,
              py: 0.5,
              listStyle: 'none',
            }}
          >
            <Button size="small" onClick={() => setOpen(false)} data-testid="filter-category-confirm">
              Done
            </Button>
          </Box>
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
