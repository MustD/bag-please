import {type MouseEvent, useEffect, useId, useMemo, useRef, useState} from 'react'
import {Link as RouterLink, Navigate, useNavigate, useParams} from 'react-router-dom'
import {useMutation, useQuery} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select, {type SelectChangeEvent} from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import StorefrontIcon from '@mui/icons-material/Storefront'
import {
  CategoriesQuery,
  CategoryUpdatesSubscription,
  CheckItemMutation,
  ItemsQuery,
  ItemUpdatesSubscription,
  type ListCategory,
  type ListItem as ListItemType,
  ListsQuery,
  UncheckItemMutation,
} from '@/lib/lists/listsQueries'
import {byCreatedAtAsc} from '@/lib/lists/homePath'
import {graphqlErrorMessage, isForbiddenError} from '@/lib/admin/adminErrors'

type CheckedFilter = 'all' | 'unchecked' | 'checked'

const UNCATEGORIZED = '__uncategorized__'

// A displayable group: a real category, or the synthetic "Uncategorized" bucket
// for items whose category id has no local match (live category deletion, or a
// realtime item arriving in a not-yet-known category) so items never vanish.
interface Group {
  key: string
  name: string
  items: ReadonlyArray<ListItemType>
}

// How far a pointer may travel between down and up and still count as a tap
// (Story 8.3, FR60). A tap and the first moments of a scroll are the SAME
// gesture on a touch screen, so activation cannot be "pointer went down here" —
// it has to be "pointer went down and came back up without going anywhere".
const MOVE_TOLERANCE_PX = 10

interface ShoppingItemRowProps {
  item: ListItemType
  onToggle: (item: ListItemType, nextChecked: boolean) => void
}

// One shopping row, and — since Story 8.3 (FR60) — ONE CONTROL. The row element
// itself is the checkbox: it carries the role, the accessible name, the checked
// state and the only tab stop. There is deliberately no interactive element
// inside it (the MUI `Checkbox` that used to live here always renders a real
// `<input>`, which would be a control nested in a control: two tab stops, two
// names, two states). The visible box is now a presentational icon.
//
// This is a component rather than inline JSX purely because `down` is per-row
// state and hooks cannot be called inside the `groups.map` callback.
//
// Activation is pointer-based with a movement threshold, plus a keyboard
// handler. `onClick` is deliberately NOT also attached: a `click` still fires
// after a moved touch, so it would both double-fire alongside `onPointerUp` and
// defeat the scroll guard. `touch-action` is left at its default so the row
// still scrolls.
function ShoppingItemRow({item, onToggle}: ShoppingItemRowProps) {
  const down = useRef<{x: number; y: number} | null>(null)
  const descriptionId = useId()

  // `role="checkbox"` makes the row's children PRESENTATIONAL, and the
  // author-supplied `aria-label` displaces name-from-content on top of that — so
  // the store chip and the `addedBy` name, which used to be plain row content
  // beside a labelled checkbox, would otherwise be announced by nothing at all.
  // They come back as the row's accessible DESCRIPTION, which is computed from a
  // separate traversal and so leaves the accessible NAME exactly
  // `Toggle ${item.name}` (an assertion pins that string).
  const descriptionParts = [
    item.store ? `Store: ${item.store}` : null,
    item.addedBy ? `Added by ${item.addedBy}` : null,
  ].filter((part): part is string => part !== null)

  return (
    <Box
      data-testid={`shopping-item-${item.name}`}
      role="checkbox"
      aria-checked={item.checked}
      aria-label={`Toggle ${item.name}`}
      aria-describedby={descriptionParts.length > 0 ? descriptionId : undefined}
      tabIndex={0}
      onPointerDown={e => {
        // Primary button, primary pointer only. The MUI Checkbox this replaced
        // answered only to a primary activation; without these guards a
        // right-click, a middle-click or a second simultaneous finger toggles
        // the item.
        if (e.button !== 0 || !e.isPrimary) return
        // Capture, so `pointerdown` and `pointerup` are strictly paired on THIS
        // row. Without it a gesture that starts here and is released elsewhere
        // leaves `down.current` populated, and a later stray `pointerup` on this
        // row is then measured against that stale origin.
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // The pointer is already gone; the `!start` guard below still holds.
        }
        down.current = {x: e.clientX, y: e.clientY}
      }}
      onPointerCancel={() => {
        down.current = null
      }}
      onPointerUp={e => {
        if (e.button !== 0 || !e.isPrimary) return
        const start = down.current
        down.current = null
        if (!start) return
        // Moved too far: this was a scroll (or a drag), not a tap.
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) return
        onToggle(item, !item.checked)
      }}
      onClick={e => {
        // ONLY the synthetic click. Assistive technology and voice control
        // activate a control by dispatching a bare `click` with no pointer
        // sequence at all, which the pointer handlers above cannot see; such a
        // click has `detail === 0`, while every click generated by a real mouse
        // or finger has `detail >= 1`. Gating on that is what lets this coexist
        // with `onPointerUp` without double-firing, and leaves the scroll guard
        // untouched (a moved touch produces no click, and would be `detail 1`
        // if it did).
        if (e.detail !== 0) return
        onToggle(item, !item.checked)
      }}
      onKeyDown={e => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        // A held key autorepeats; one activation per press, not per repeat.
        if (e.repeat) return
        // Ctrl/Meta/Alt + Space or Enter belongs to the browser or the OS.
        if (e.ctrlKey || e.metaKey || e.altKey) return
        // Space would otherwise scroll the page under the focused row.
        e.preventDefault()
        onToggle(item, !item.checked)
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        cursor: 'pointer',
        userSelect: 'none',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '-2px',
        },
      }}
    >
      {/* Presentational only — the state it shows lives on the row above. */}
      {item.checked ? (
        <CheckBoxIcon
          color="primary"
          data-testid={`shopping-item-indicator-${item.name}`}
          sx={{m: 1, flexShrink: 0}}
        />
      ) : (
        <CheckBoxOutlineBlankIcon
          color="action"
          data-testid={`shopping-item-indicator-${item.name}`}
          sx={{m: 1, flexShrink: 0}}
        />
      )}
      <Box sx={{flexGrow: 1, minWidth: 0}}>
        <Typography
          noWrap
          color="text.primary"
          sx={{
            textDecoration: item.checked ? 'line-through' : 'none',
            opacity: item.checked ? 0.6 : 1,
          }}
        >
          {item.name}
        </Typography>
        {item.store && (
          <Chip
            size="small"
            variant="outlined"
            icon={<StorefrontIcon/>}
            label={item.store}
            data-testid={`shopping-item-store-${item.name}`}
            sx={{mt: 0.5}}
          />
        )}
      </Box>
      {item.addedBy && (
        <Stack
          direction="row"
          spacing={0.75}
          data-testid={`shopping-item-addedby-${item.name}`}
          sx={{alignItems: 'center', flexShrink: 0}}
        >
          <Avatar sx={{width: 24, height: 24, fontSize: '0.75rem'}}>
            {item.addedBy.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="caption" color="text.secondary" noWrap sx={{maxWidth: 100}}>
            {item.addedBy}
          </Typography>
        </Stack>
      )}
      {descriptionParts.length > 0 && (
        <Box
          component="span"
          id={descriptionId}
          sx={{
            // `width: 1` here would be MUI's 0-1 shorthand for 100%, which put a
            // full-width box at the span's static position and scrolled the page
            // horizontally at the 320px floor. Pixels, explicitly.
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {descriptionParts.join('. ')}
        </Box>
      )}
    </Box>
  )
}

// List shopping view (Story 5.6, FR36/FR40/FR44/FR45/FR49/FR52/FR53). Items
// grouped by category, per-item check/uncheck, client-side filters (category +
// checked-status + free-text search, combined AND), a list-switcher chip row,
// and per-list realtime via subscribeToMore on the Items/Categories queries.
// This is a read+check surface only: item/category CRUD stays on the Story-5.5
// management view (/lists/:id). A member who is forbidden (admin or non-member)
// is redirected to /lists rather than shown a broken screen.
export default function ListShoppingPage() {
  const {id} = useParams<{id: string}>()
  const listId = id ?? ''
  const navigate = useNavigate()

  // The switcher + header read from the membership-scoped lists query (the same
  // cache the index populates). The active list is looked up by id.
  const listsResult = useQuery(ListsQuery)
  // Ordered with the shared NUMERIC comparator (Story 7.5, FR38): this was the
  // second copy of the same lexicographic createdAt sort HomeRedirect carried, so
  // the switcher chips could order two lists differently from `/`.
  const lists = useMemo(
    () => [...(listsResult.data?.lists?.lists ?? [])].sort(byCreatedAtAsc),
    [listsResult.data],
  )
  const activeList = lists.find(l => l.id === listId)

  const itemsResult = useQuery(ItemsQuery, {variables: {listId}, skip: !id})
  const categoriesResult = useQuery(CategoriesQuery, {variables: {listId}, skip: !id})

  const {subscribeToMore: subscribeToMoreItems} = itemsResult
  const {subscribeToMore: subscribeToMoreCategories} = categoriesResult

  // Per-list realtime. subscribeToMore ties the WS subscription to this query's
  // lifecycle, so unmount (e.g. logout → redirect) unsubscribes and the lazy
  // socket closes — no explicit dispose (FR53). The merge keys by id and is
  // idempotent because the stream echoes the caller's own actions.
  useEffect(() => {
    if (!id) return
    const unsubscribe = subscribeToMoreItems({
      document: ItemUpdatesSubscription,
      variables: {listId},
      updateQuery: (prev, {subscriptionData}) => {
        const update = subscriptionData.data?.getItemUpdates
        if (!update) return
        const current = (prev.getItems ?? []) as ListItemType[]
        const {type, item} = update
        // DELETED or a SAVED that carries deleted=true (one-timer check) removes
        // the row; a SAVED with deleted=false upserts by id.
        const drop = type === 'DELETED' || item.deleted
        let next: ListItemType[]
        if (drop) {
          next = current.filter(i => i.id !== item.id)
        } else if (current.some(i => i.id === item.id)) {
          next = current.map(i => (i.id === item.id ? item : i))
        } else {
          next = [...current, item]
        }
        return {getItems: next}
      },
    })
    return () => unsubscribe()
  }, [id, listId, subscribeToMoreItems])

  useEffect(() => {
    if (!id) return
    const unsubscribe = subscribeToMoreCategories({
      document: CategoryUpdatesSubscription,
      variables: {listId},
      updateQuery: (prev, {subscriptionData}) => {
        const update = subscriptionData.data?.getCategoryUpdates
        if (!update) return
        const current = (prev.getCategories ?? []) as ListCategory[]
        const {type, item} = update
        let next: ListCategory[]
        if (type === 'DELETED') {
          next = current.filter(c => c.id !== item.id)
        } else if (current.some(c => c.id === item.id)) {
          next = current.map(c => (c.id === item.id ? item : c))
        } else {
          next = [...current, item]
        }
        return {getCategories: next}
      },
    })
    return () => unsubscribe()
  }, [id, listId, subscribeToMoreCategories])

  const categories = useMemo(
    () => categoriesResult.data?.getCategories ?? [],
    [categoriesResult.data],
  )
  const items = useMemo(() => itemsResult.data?.getItems ?? [], [itemsResult.data])

  // Header + document title reflect the active list.
  const headerLabel = activeList
    ? `${activeList.emoji ? `${activeList.emoji} ` : ''}${activeList.name}`
    : 'List'
  useEffect(() => {
    document.title = activeList ? `${headerLabel} · Bag Please` : 'Bag Please'
    return () => {
      document.title = 'Bag Please'
    }
  }, [activeList, headerLabel])

  const [categoryFilter, setCategoryFilter] = useState('')
  const [checkedFilter, setCheckedFilter] = useState<CheckedFilter>('all')
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  // Switching lists via the chip row re-renders this same route element in place
  // (no unmount), so the filter state would otherwise carry over — a category id
  // from the previous list matches nothing here, leaving the view stuck on
  // "no matches". Reset filters when the active list changes (render-phase
  // adjustment, not a syncing effect — project lint forbids set-state-in-effect).
  const [prevListId, setPrevListId] = useState(listId)
  if (listId !== prevListId) {
    setPrevListId(listId)
    setCategoryFilter('')
    setCheckedFilter('all')
    setSearch('')
  }
  // Drop a category filter that no longer matches any current category (e.g. the
  // selected one was deleted live via a CategoryUpdates event) so the MUI Select
  // never holds an out-of-range value that silently hides every item.
  if (categoryFilter && !categories.some(c => c.id === categoryFilter)) {
    setCategoryFilter('')
  }

  const [checkItem] = useMutation(CheckItemMutation)
  const [uncheckItem] = useMutation(UncheckItemMutation)

  // Client-side filters combined with AND: category (by id), checked status, and
  // a case-insensitive name search.
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter(item => {
      if (categoryFilter && item.category !== categoryFilter) return false
      if (checkedFilter === 'checked' && !item.checked) return false
      if (checkedFilter === 'unchecked' && item.checked) return false
      if (term && !item.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [items, categoryFilter, checkedFilter, search])

  // Group filtered items by category (sorted by name); items whose category id
  // has no local match fall into the synthetic "Uncategorized" bucket.
  const groups = useMemo<Group[]>(() => {
    const known = new Set(categories.map(c => c.id))
    const byCategory = new Map<string, ListItemType[]>()
    const uncategorized: ListItemType[] = []
    for (const item of filteredItems) {
      if (known.has(item.category)) {
        const bucket = byCategory.get(item.category) ?? []
        bucket.push(item)
        byCategory.set(item.category, bucket)
      } else {
        uncategorized.push(item)
      }
    }
    const sortByName = (a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name)
    const result: Group[] = [...categories]
      .sort(sortByName)
      .map(category => ({
        key: category.id,
        name: category.name,
        items: (byCategory.get(category.id) ?? []).sort(sortByName),
      }))
      .filter(group => group.items.length > 0)
    if (uncategorized.length > 0) {
      result.push({
        key: UNCATEGORIZED,
        name: 'Uncategorized',
        items: [...uncategorized].sort(sortByName),
      })
    }
    return result
  }, [categories, filteredItems])

  const loading = itemsResult.loading || categoriesResult.loading
  const queryError = itemsResult.error ?? categoriesResult.error

  // A forbidden viewer (admin or non-member, or an unknown list) is bounced to
  // the index gracefully rather than shown an empty/broken shopping screen.
  if (isForbiddenError(itemsResult.error) || isForbiddenError(categoriesResult.error)) {
    return <Navigate to="/lists" replace/>
  }

  const handleToggle = async (item: ListItemType, nextChecked: boolean) => {
    setActionError(null)
    try {
      if (nextChecked) {
        await checkItem({variables: {id: item.id, listId}})
      } else {
        await uncheckItem({variables: {id: item.id, listId}})
      }
    } catch (err) {
      // The normalized cache is untouched on failure, so the row's indicator
      // reverts to the server state automatically; surface the reason inline.
      setActionError(graphqlErrorMessage(err))
    }
  }

  const handleCheckedFilter = (_event: MouseEvent<HTMLElement>, value: CheckedFilter | null) => {
    if (value !== null) setCheckedFilter(value)
  }

  return (
    <Box data-testid="list-shopping-page" sx={{flexGrow: 1, py: {xs: 3, sm: 4}}}>
      <Container maxWidth="md">
        {/* Back to lists (Story 6.2, FR57) — same idiom as the management
            screen's `list-detail-back`, so there is one back-link pattern. */}
        <Link
          component={RouterLink}
          to="/lists"
          data-testid="list-shopping-back"
          sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2}}
        >
          <ArrowBackIcon fontSize="small"/>
          Back to lists
        </Link>

        <Typography
          variant="h4"
          color="text.primary"
          noWrap
          data-testid="shopping-header"
          sx={{maxWidth: '100%', mb: 2}}
        >
          {headerLabel}
        </Typography>

        {/* List switcher — every list the caller owns or is a member of. */}
        {lists.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            data-testid="list-switcher"
            sx={{flexWrap: 'wrap', gap: 1, mb: 3}}
          >
            {lists.map(list => {
              const active = list.id === listId
              return (
                <Chip
                  key={list.id}
                  label={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  aria-current={active ? 'true' : undefined}
                  onClick={active ? undefined : () => navigate(`/list/${list.id}`)}
                  data-testid={`switcher-chip-${list.name}`}
                />
              )
            })}
          </Stack>
        )}

        {/* Filters: category + checked-status + free-text search (combined AND). */}
        <Stack
          direction={{xs: 'column', sm: 'row'}}
          spacing={2}
          data-testid="shopping-filters"
          sx={{mb: 3, alignItems: {sm: 'center'}}}
        >
          <FormControl size="small" sx={{minWidth: 180}}>
            <InputLabel id="shopping-category-filter-label">Category</InputLabel>
            <Select
              labelId="shopping-category-filter-label"
              label="Category"
              value={categoryFilter}
              onChange={(e: SelectChangeEvent) => setCategoryFilter(e.target.value)}
              data-testid="filter-category"
            >
              <MenuItem value="" data-testid="filter-category-option-all">
                All categories
              </MenuItem>
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(category => (
                  <MenuItem
                    key={category.id}
                    value={category.id}
                    data-testid={`filter-category-option-${category.name}`}
                  >
                    {category.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={checkedFilter}
            onChange={handleCheckedFilter}
            aria-label="Filter by checked status"
            data-testid="filter-checked"
          >
            <ToggleButton value="all" data-testid="filter-checked-all">All</ToggleButton>
            <ToggleButton value="unchecked" data-testid="filter-checked-unchecked">To buy</ToggleButton>
            <ToggleButton value="checked" data-testid="filter-checked-checked">Done</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{flexGrow: 1}}
            slotProps={{htmlInput: {'data-testid': 'filter-search'}}}
          />
        </Stack>

        {actionError && (
          <Alert severity="error" role="alert" data-testid="shopping-action-error" sx={{mb: 2}}>
            {actionError}
          </Alert>
        )}

        {queryError ? (
          <Alert severity="error" role="alert" data-testid="shopping-notice">
            {graphqlErrorMessage(queryError)}
          </Alert>
        ) : loading ? (
          <Box data-testid="shopping-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <CircularProgress/>
          </Box>
        ) : items.length === 0 ? (
          <Paper data-testid="shopping-empty" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="h6" color="text.primary" sx={{mb: 1}}>
              Nothing to shop yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add categories and items from the list management screen.
            </Typography>
          </Paper>
        ) : groups.length === 0 ? (
          <Paper data-testid="shopping-no-matches" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              No items match the current filters.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {groups.map(group => (
              <Paper key={group.key} data-testid={`shopping-group-${group.name}`}>
                <Typography
                  variant="h6"
                  color="text.primary"
                  noWrap
                  sx={{px: 2, py: 1.5, maxWidth: '100%'}}
                >
                  {group.name}
                </Typography>
                <Divider/>
                <Stack divider={<Divider/>}>
                  {group.items.map(item => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onToggle={(target, nextChecked) => void handleToggle(target, nextChecked)}
                    />
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  )
}
