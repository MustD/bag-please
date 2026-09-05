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
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import AddCategoryDialog from '@/components/AddCategoryDialog'
import AddItemDialog from '@/components/AddItemDialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import EditItemDialog from '@/components/EditItemDialog'

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

  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [addItemCategoryId, setAddItemCategoryId] = useState<string | undefined>(undefined)
  const [removeCategoryTarget, setRemoveCategoryTarget] = useState<ListCategory | null>(null)
  const [removeItemTarget, setRemoveItemTarget] = useState<ListItemType | null>(null)
  const [editItemTarget, setEditItemTarget] = useState<ListItemType | null>(null)

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

        {error ? (
          <Alert severity="info" role="alert" data-testid="list-detail-notice">
            {graphqlErrorMessage(error)}
          </Alert>
        ) : loading ? (
          <Box data-testid="list-detail-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <CircularProgress/>
          </Box>
        ) : categories.length === 0 ? (
          <Paper data-testid="list-detail-empty" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="h6" color="text.primary" sx={{mb: 1}}>
              No categories yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a category first, then add items under it.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {categories.map(category => {
              const categoryItems = items.filter(item => item.category === category.id)
              return (
                <Paper key={category.id} data-testid={`category-row-${category.name}`}>
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
                      {category.name}
                    </Typography>
                    <Box sx={{display: 'flex', flexShrink: 0}}>
                      <Tooltip title="Add item to this category">
                        <IconButton
                          aria-label={`Add item to ${category.name}`}
                          onClick={() => openAddItem(category.id)}
                          data-testid="add-item-in-category-button"
                        >
                          <AddIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove category">
                        <IconButton
                          color="error"
                          aria-label={`Remove category ${category.name}`}
                          onClick={() => setRemoveCategoryTarget(category)}
                          data-testid="remove-category-button"
                        >
                          <DeleteOutlinedIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Divider/>
                  {categoryItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{px: 2, py: 1.5}}>
                      No items yet.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {categoryItems.map(item => (
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
          // The backend's deleteCategory does NOT cascade to items — removing a
          // category alone would strand its items (orphaned by a dangling
          // category id, hidden by the group filter, and unreachable for
          // removal). So delete this category's items first, then the category,
          // honouring the confirm copy ("items are removed with it"). If an item
          // delete fails, it propagates and the category is left intact.
          for (const item of items.filter(i => i.category === target.id)) {
            await deleteItem({variables: {id: item.id, listId}})
          }
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
