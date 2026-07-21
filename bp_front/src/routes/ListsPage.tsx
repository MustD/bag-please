import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useMutation, useQuery} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {DeleteListMutation, type ListSummary, ListsQuery} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import {useAuth} from '@/lib/auth/AuthContext'
import CreateListDialog from '@/components/CreateListDialog'
import ConfirmDialog from '@/components/ConfirmDialog'

// Lists index (Story 5.5, FR34/FR35/FR37/FR50). Shows every list the caller owns
// or is an accepted member of, a zero-state onboarding prompt when there are
// none, a create overlay, and an owner-only delete (owner === useAuth().username)
// via a cascade-warning confirm. A row navigates to the management detail at
// /lists/:id. The backend forbids the admin account from list resources, which
// arrives as a FORBIDDEN query error — surfaced as a calm inline notice, never a
// crash. All feedback is inline (no toasts).
export default function ListsPage() {
  const {username} = useAuth()
  const navigate = useNavigate()
  const {data, loading, error, refetch} = useQuery(ListsQuery)
  const lists = data?.lists?.lists ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ListSummary | null>(null)
  const [deleteList] = useMutation(DeleteListMutation)

  return (
    <Box data-testid="lists-page" sx={{flexGrow: 1, py: {xs: 3, sm: 4}}}>
      <Container maxWidth="md">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" color="text.primary">
            Lists
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon/>}
            onClick={() => setCreateOpen(true)}
            data-testid="create-list-button"
          >
            New list
          </Button>
        </Box>

        {error ? (
          <Alert severity="info" role="alert" data-testid="lists-notice">
            {graphqlErrorMessage(error)}
          </Alert>
        ) : loading ? (
          <Box data-testid="lists-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <CircularProgress/>
          </Box>
        ) : lists.length === 0 ? (
          <Paper data-testid="lists-empty" sx={{p: {xs: 3, sm: 4}, textAlign: 'center'}}>
            <Typography variant="h6" color="text.primary" sx={{mb: 1}}>
              No lists yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
              Create your first list to start adding categories and items.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon/>}
              onClick={() => setCreateOpen(true)}
              data-testid="lists-empty-create"
            >
              Create your first list
            </Button>
          </Paper>
        ) : (
          <Paper>
            <List disablePadding>
              {lists.map(list => {
                const isowner = list.ownerUsername === username
                return (
                  <ListItem
                    key={list.id}
                    data-testid={`list-row-${list.name}`}
                    disablePadding
                    secondaryAction={
                      isowner ? (
                        <Tooltip title="Delete list">
                          <IconButton
                            edge="end"
                            color="error"
                            aria-label={`Delete ${list.name}`}
                            onClick={() => setDeleteTarget(list)}
                            data-testid="delete-list-button"
                          >
                            <DeleteOutlinedIcon fontSize="small"/>
                          </IconButton>
                        </Tooltip>
                      ) : undefined
                    }
                  >
                    <ListItemButton
                      onClick={() => navigate(`/lists/${list.id}`)}
                      data-testid={`list-open-${list.name}`}
                    >
                      <ListItemText
                        primary={
                          <Typography noWrap sx={{maxWidth: {xs: 200, sm: 420}}}>
                            {list.emoji ? `${list.emoji} ` : ''}
                            {list.name}
                          </Typography>
                        }
                        secondary={isowner ? 'Owned by you' : `Shared by ${list.ownerUsername}`}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          </Paper>
        )}
      </Container>

      <CreateListDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void refetch().catch(() => {})
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete list"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? This permanently removes the list along
            with all its categories and items. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        testId="delete-list-dialog"
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteList({variables: {id: deleteTarget.id}})
          void refetch().catch(() => {})
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  )
}
