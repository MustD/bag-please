import {useState} from 'react'
import {Link as RouterLink, useParams} from 'react-router-dom'
import {useMutation, useQuery} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  CategoriesQuery,
  DeleteCategoryMutation,
  DeleteItemMutation,
  ItemsQuery,
  type ListCategory,
  type ListItem as ListItemType,
  ListsQuery,
} from '@/lib/lists/listsQueries'
import {isItemFilterActive, matchesItemFilter, useItemFilter} from '@/lib/lists/itemFilter'
import {groupItemsByCategory} from '@/lib/lists/order'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import AddCategoryDialog from '@/components/AddCategoryDialog'
import AddItemDialog from '@/components/AddItemDialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import EditCategoryDialog from '@/components/EditCategoryDialog'
import EditItemDialog from '@/components/EditItemDialog'
import ListFilters from '@/components/ListFilters'

// List detail / management surface (Story 5.5, FR46/FR51). Renders the list's
// categories and, under each, its items — with add-category / add-item overlays
// and remove-category / remove-item confirmations. This is a MANAGEMENT screen:
// the shopping view (check/uncheck, filters, realtime) is the separate Story-5.6
// /list/:id route. Categories and items are fetched per-list; the caller must
// own or be an accepted member, otherwise the backend returns FORBIDDEN, shown
// as a calm inline notice (never a crash). All feedback is inline (no toasts).
export default function ListDetailPage() {
  const {id} = useParams<{id: string}>()
  const listId = id ?? ''

  // The list name is a nicety pulled from the (cache-only) lists query so this
  // screen never fires its own membership-gated `lists` request or duplicates
  // the FORBIDDEN path; it falls back to a generic title when absent.
  const {data: listsData} = useQuery(ListsQuery, {fetchPolicy: 'cache-only'})
  const listName = listsData?.lists?.lists?.find(l => l.id === listId)?.name ?? 'List'

  const categoriesResult = useQuery(CategoriesQuery, {variables: {listId}, skip: !id})
  const itemsResult = useQuery(ItemsQuery, {variables: {listId}, skip: !id})
  const categories = categoriesResult.data?.getCategories ?? []
  const items = itemsResult.data?.getItems ?? []
  const loading = categoriesResult.loading || itemsResult.loading
  const error = categoriesResult.error ?? itemsResult.error

  const refetch = () => Promise.all([categoriesResult.refetch(), itemsResult.refetch()])

  // The SAME filter unit the shopping view mounts (Story 8.4, FR61) — no
  // checked-status toggle is passed, so none is rendered: "checked" is a shopping
  // concept and this is the management screen (UX-DR-E8-7). Filtering is purely
  // client-side over the Apollo cache this page already holds; nothing here
  // refetches, so the page stays refetch-driven exactly as Story 6.1 designed it.
  const [filter, setFilter] = useItemFilter(listId, categories)
  const filterActive = isItemFilterActive(filter)

  // Ordering AND grouping come from `lib/lists/order.ts` (Story 8.5, FR62) — the
  // SAME function the shopping view renders. Before this story /lists/:id sorted
  // nothing (raw query order, which the backend does not guarantee is stable) and
  // had no synthetic bucket, so the same list read two ways and an item orphaned
  // by a category removal was visible while shopping and invisible on the only
  // screen that can edit or delete it.
  //
  // `keepEmpty: !filterActive` is this screen's half of the ONE deliberate
  // difference (AC5). A category is HIDDEN only while a filter is active and
  // nothing in it matches; with no filter an empty category still renders with
  // its "No items yet." row and its add-item affordance, because this is a
  // management screen and a category you cannot see is a category you cannot
  // fill. The shopping view hides empty groups always.
  //
  // No `useMemo`: this component memoises nothing today, and adding one here
  // alone would imply the rest of its render is cheap by comparison.
  const groups = groupItemsByCategory(
    categories,
    items.filter(item => matchesItemFilter(item, filter)),
    {keepEmpty: !filterActive},
  )

  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [addItemCategoryId, setAddItemCategoryId] = useState<string | undefined>(undefined)
  const [removeCategoryTarget, setRemoveCategoryTarget] = useState<ListCategory | null>(null)
  const [removeItemTarget, setRemoveItemTarget] = useState<ListItemType | null>(null)
  const [editItemTarget, setEditItemTarget] = useState<ListItemType | null>(null)
  const [editCategoryTarget, setEditCategoryTarget] = useState<ListCategory | null>(null)

  const [deleteCategory] = useMutation(DeleteCategoryMutation)
  const [deleteItem] = useMutation(DeleteItemMutation)

  const openAddItem = (categoryId?: string) => {
    setAddItemCategoryId(categoryId)
    setAddItemOpen(true)
  }

  return (
    <Box data-testid="list-detail-page" sx={{flexGrow: 1, py: {xs: 3, sm: 4}}}>
      <Container maxWidth="md">
        <Link
          component={RouterLink}
          to="/lists"
          data-testid="list-detail-back"
          sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2}}
        >
          <ArrowBackIcon fontSize="small"/>
          Back to lists
        </Link>

        {/* Header (Story 8.2, report #3). Below `sm` the title takes its own
            full-width row and the action buttons take the row beneath it, on
            every phone width — NOT on a fit test. The alternative, letting the
            row wrap naturally, makes the break point a function of the list
            name's longest word, and a single long word would then widen the row
            past the viewport. From `sm` up the two share one row exactly as
            before. The title carries no `noWrap` and no `maxWidth`: at 320px the
            old cap was academic anyway, because `noWrap`'s `overflow: hidden`
            resolved the title's min-width to zero and the two buttons squeezed
            it to 68px — every title truncated, not just long ones. */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: {xs: 'column', sm: 'row'},
            justifyContent: 'space-between',
            alignItems: {xs: 'stretch', sm: 'center'},
            gap: 2,
            mb: 3,
          }}
        >
          <Typography
            variant="h4"
            color="text.primary"
            sx={{overflowWrap: 'anywhere'}}
            data-testid="list-detail-title"
          >
            {listName}
          </Typography>
          {/* `flexShrink: 0` so the buttons keep their text labels on the shared
              `sm`+ row: the title wraps instead of squeezing them. */}
          <Stack direction="row" spacing={1} sx={{flexShrink: 0}}>
            <Button
              variant="outlined"
              startIcon={<AddIcon/>}
              onClick={() => setAddCategoryOpen(true)}
              data-testid="add-category-button"
            >
              Category
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon/>}
              onClick={() => openAddItem(undefined)}
              disabled={categories.length === 0}
              data-testid="add-item-button"
            >
              Item
            </Button>
          </Stack>
        </Box>

        {/* NOT gated on `loading`. `notifyOnNetworkStatusChange` defaults to
            TRUE in Apollo Client 4, so every `refetch()` after an add/edit/delete
            flips `loading` back on — a `!loading` gate would unmount the whole
            filter row mid-interaction. The `length` guards already keep it
            hidden through the initial load, when there is nothing yet.

            `|| items.length > 0` since Story 8.5: a list whose only remaining
            content is ORPHANED items has zero categories, and gating on
            categories alone would deny it the one control that reaches them.

            `|| filterActive` is the third clause and it is a DEAD-END GUARD, not
            a nicety. The filter VALUE lives in `useItemFilter` state and outlives
            the content that justified showing the row: type a search term, then
            remove the last category (its items go with it), and both counts hit
            zero while the term is still set — the row would unmount, the
            `!filterActive` empty branch would not be taken, and the page would
            sit on `list-detail-no-matches` with nothing on screen able to clear
            it. Keeping the row mounted whenever a filter is active is the
            smallest thing that cannot strand the user. */}
        {!error && (categories.length > 0 || items.length > 0 || filterActive) && (
          <ListFilters
            testId="list-detail-filters"
            categories={categories}
            value={filter}
            onChange={setFilter}
          />
        )}

        {/* Both empty branches key off `groups`, not `categories` (Story 8.5).
            A list whose only category was removed under a stale client has
            `categories.length === 0` while orphaned items still exist, and the
            old gate showed "No categories yet" OVER an item that is right
            there. `!filterActive` is what still separates the two: genuinely
            empty ⇒ the onboarding copy, filtered-to-nothing ⇒ the no-matches
            notice. The `error` and `loading` branches stay first, in order. */}
        {error ? (
          <Alert severity="info" role="alert" data-testid="list-detail-notice">
            {graphqlErrorMessage(error)}
          </Alert>
        ) : loading ? (
          <Box data-testid="list-detail-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <CircularProgress/>
          </Box>
        ) : groups.length === 0 && !filterActive ? (
          <Paper data-testid="list-detail-empty" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="h6" color="text.primary" sx={{mb: 1}}>
              No categories yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a category first, then add items under it.
            </Typography>
          </Paper>
        ) : groups.length === 0 ? (
          <Paper data-testid="list-detail-no-matches" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              No items match the current filters.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {groups.map(group => {
              // Bound once, so the null check below actually NARROWS. Reading
              // `group.category` inside the handlers instead would lose the
              // narrowing at the closure boundary and let `undefined`/`null`
              // through on a path the JSX guard swears is unreachable.
              const category = group.category
              return (
              <Paper key={group.key} data-testid={`category-row-${group.name}`}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 2,
                    py: 1.5,
                  }}
                >
                  {/* Wraps rather than truncating (Story 8.2): the name takes
                      the room this flex row actually has. Deliberately NOT
                      line-clamped like the item name below — a category
                      heading has no run of controls to outgrow, and a clamp
                      here would trade an ellipsis for a vertical clip. */}
                  <Typography
                    variant="h6"
                    color="text.primary"
                    sx={{overflowWrap: 'anywhere'}}
                    data-testid="category-name"
                  >
                    {group.name}
                  </Typography>
                  {/* `category` (bound above from `group.category`) is null for the synthetic
                      "Uncategorized" bucket, and the category-level controls
                      go with it: there is no category to add an item INTO and
                      none to remove. Each orphaned item below keeps its own
                      edit and remove controls — that pair is the recovery
                      path, and it is the whole point of rendering the bucket
                      on this screen (Story 8.5 AC4). */}
                  {category && (
                    <Box sx={{display: 'flex', flexShrink: 0}}>
                      <Tooltip title="Add item to this category">
                        <IconButton
                          aria-label={`Add item to ${group.name}`}
                          onClick={() => openAddItem(category.id)}
                          data-testid="add-item-in-category-button"
                        >
                          <AddIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      {/* Renaming (Story 8.6, FR63) sits BETWEEN add-item and
                          remove, so the destructive control stays last. Before
                          it, correcting a mistyped name meant removing the
                          category — and its items with it. `category` is the
                          narrowed binding from above, not `group.category`. */}
                      <Tooltip title="Rename category">
                        <IconButton
                          aria-label={`Rename category ${group.name}`}
                          onClick={() => setEditCategoryTarget(category)}
                          data-testid="edit-category-button"
                        >
                          <EditOutlinedIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove category">
                        <IconButton
                          color="error"
                          aria-label={`Remove category ${group.name}`}
                          onClick={() => setRemoveCategoryTarget(category)}
                          data-testid="remove-category-button"
                        >
                          <DeleteOutlinedIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
                <Divider/>
                {group.items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{px: 2, py: 1.5}}>
                    No items yet.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {group.items.map(item => (
                      // The controls are flex SIBLINGS of the name, not the
                      // `secondaryAction` prop they used to be (Story 8.2).
                      // `secondaryAction` positions them absolutely, so the
                      // text box was set by the ListItem's reserved padding
                      // rather than by the controls' real width — which is why
                      // the name needed a hardcoded `maxWidth` to stay clear of
                      // them. As siblings, `ListItemText` (flex: 1 1 auto,
                      // minWidth: 0) takes exactly the room the row has left.
                      <ListItem key={item.id} data-testid={`item-row-${item.name}`} sx={{gap: 1}}>
                        <ListItemText
                          primary={
                            // Wraps to AT MOST TWO LINES, then ellipsises. The
                            // clamp sits on the element that holds the text, so
                            // `expectNotClipped`'s height branch measures the
                            // real text box: a third line makes scrollHeight
                            // exceed clientHeight and the gate goes red.
                            <Typography
                              sx={{
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                                overflowWrap: 'anywhere',
                              }}
                              data-testid="item-name"
                            >
                              {item.name}
                            </Typography>
                          }
                        />
                        <Stack direction="row" sx={{flexShrink: 0}}>
                          <Tooltip title="Edit item">
                            <IconButton
                              aria-label={`Edit item ${item.name}`}
                              onClick={() => setEditItemTarget(item)}
                              data-testid="edit-item-button"
                            >
                              <EditOutlinedIcon fontSize="small"/>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove item">
                            <IconButton
                              color="error"
                              aria-label={`Remove item ${item.name}`}
                              onClick={() => setRemoveItemTarget(item)}
                              data-testid="remove-item-button"
                            >
                              <DeleteOutlinedIcon fontSize="small"/>
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItem>
                    ))}
                    </List>
                  )}
                </Paper>
              )
            })}
          </Stack>
        )}
      </Container>

      <AddCategoryDialog
        open={addCategoryOpen}
        listId={listId}
        onClose={() => setAddCategoryOpen(false)}
        onAdded={() => {
          void refetch().catch(() => {})
        }}
      />

      <AddItemDialog
        open={addItemOpen}
        listId={listId}
        categories={categories}
        defaultCategoryId={addItemCategoryId}
        onClose={() => setAddItemOpen(false)}
        onAdded={() => {
          void refetch().catch(() => {})
        }}
      />

      {/* Item editing (Story 6.1). This page stays refetch-driven by design —
          no subscribeToMore here; the shopping view's existing per-list
          subscription already propagates an edit live to other members. */}
      <EditItemDialog
        item={editItemTarget}
        listId={listId}
        categories={categories}
        onClose={() => setEditItemTarget(null)}
        onSaved={() => {
          void refetch().catch(() => {})
        }}
      />

      {/* Category renaming (Story 8.6). Same refetch-driven contract as the
          item dialog above: no subscribeToMore is added here, and the shopping
          view's existing per-list category subscription carries a rename to
          other members live. */}
      <EditCategoryDialog
        category={editCategoryTarget}
        onClose={() => setEditCategoryTarget(null)}
        onSaved={() => {
          void refetch().catch(() => {})
        }}
      />

      <ConfirmDialog
        open={Boolean(removeCategoryTarget)}
        title="Remove category"
        description={
          <>
            Remove <strong>{removeCategoryTarget?.name}</strong>? Items in this category are removed
            with it. This cannot be undone.
          </>
        }
        confirmLabel="Remove"
        testId="remove-category-dialog"
        onConfirm={async () => {
          if (!removeCategoryTarget) return
          const target = removeCategoryTarget
          // ONE request. Since Story 9.3 the server cascades: deleteCategory
          // removes the category and then every item of it — soft-deleted rows
          // included — so the confirm copy ("items are removed with it") is now
          // a description of what the server does rather than of a loop run
          // here. The loop that used to live here walked only the items THIS
          // client happened to hold, so anything a co-member had added since the
          // last refetch outlived its category as an orphan, and a mid-loop
          // failure left the category gone with items behind.
          await deleteCategory({variables: {id: target.id, listId}})
          void refetch().catch(() => {})
        }}
        onClose={() => setRemoveCategoryTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeItemTarget)}
        title="Remove item"
        description={
          <>
            Remove <strong>{removeItemTarget?.name}</strong>? This cannot be undone.
          </>
        }
        confirmLabel="Remove"
        testId="remove-item-dialog"
        onConfirm={async () => {
          if (!removeItemTarget) return
          await deleteItem({variables: {id: removeItemTarget.id, listId}})
          void refetch().catch(() => {})
        }}
        onClose={() => setRemoveItemTarget(null)}
      />
    </Box>
  )
}
