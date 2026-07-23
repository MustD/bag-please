import {useEffect, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
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
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import {
  DeleteListMutation,
  LeaveListMutation,
  type ListSummary,
  ListsQuery,
} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import {useAuth} from '@/lib/auth/AuthContext'
import CreateListDialog from '@/components/CreateListDialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import PendingInvites from '@/components/PendingInvites'
import ShareMembersDialog from '@/components/ShareMembersDialog'
import WelcomeBanner from '@/components/WelcomeBanner'

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
  const location = useLocation()
  const {data, loading, error, refetch} = useQuery(ListsQuery)
  const lists = data?.lists?.lists ?? []
  const pendingInvites = data?.lists?.pendingInvites ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ListSummary | null>(null)
  const [deleteList] = useMutation(DeleteListMutation)
  // Share & Members and Leave targets are held by list id so that, after a
  // refetch, the open dialog re-derives from fresh data rather than a stale
  // snapshot.
  const [manageTargetId, setManageTargetId] = useState<string | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<ListSummary | null>(null)
  const [leaveList] = useMutation(LeaveListMutation)
  const manageTarget = lists.find(list => list.id === manageTargetId) ?? null

  const refresh = () => {
    void refetch().catch(() => {})
  }

  // One-time post-registration welcome (FR5), relocated here from the removed
  // HomePage: `/` (HomeRedirect) forwards `state.welcome` to /lists for a
  // brand-new user (who has no lists yet). Read the signal exactly once into
  // local state — the single source of truth thereafter — set only on the
  // register→login path, never on ordinary login / refresh / expiry re-login.
  const [showWelcome, setShowWelcome] = useState(
    () => Boolean((location.state as {welcome?: boolean} | null)?.welcome),
  )
  // Immediately scrub the history state so a re-render — or a reload that
  // restores history.state — can't resurrect the banner from location.state.
  useEffect(() => {
    if ((location.state as {welcome?: boolean} | null)?.welcome) {
      navigate(location.pathname, {replace: true, state: {}})
    }
    // Run once on mount; deliberately not reacting to later location changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box data-testid="lists-page" sx={{flexGrow: 1, py: {xs: 3, sm: 4}}}>
      <Container maxWidth="md">
        {showWelcome && username && (
          <WelcomeBanner username={username} onDismiss={() => setShowWelcome(false)}/>
        )}

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

        <PendingInvites invites={pendingInvites} onChanged={refresh}/>

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
                        <>
                          <Tooltip title="Share & members">
                            <IconButton
                              edge="end"
                              aria-label={`Share and manage members of ${list.name}`}
                              onClick={() => setManageTargetId(list.id)}
                              data-testid={`manage-members-${list.name}`}
                            >
                              <GroupOutlinedIcon fontSize="small"/>
                            </IconButton>
                          </Tooltip>
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
                        </>
                      ) : (
                        <Tooltip title="Leave list">
                          <IconButton
                            edge="end"
                            color="error"
                            aria-label={`Leave ${list.name}`}
                            onClick={() => setLeaveTarget(list)}
                            data-testid={`leave-list-${list.name}`}
                          >
                            <LogoutOutlinedIcon fontSize="small"/>
                          </IconButton>
                        </Tooltip>
                      )
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
        onCreated={refresh}
      />

      {manageTarget && (
        <ShareMembersDialog
          list={manageTarget}
          open={Boolean(manageTarget)}
          onClose={() => setManageTargetId(null)}
          onChanged={refresh}
        />
      )}

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
          refresh()
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(leaveTarget)}
        title="Leave list"
        description={
          <>
            Leave <strong>{leaveTarget?.name}</strong>? You will lose access to this shared list.
            The owner and other members keep it.
          </>
        }
        confirmLabel="Leave"
        testId="leave-list-dialog"
        onConfirm={async () => {
          if (!leaveTarget) return
          await leaveList({variables: {listId: leaveTarget.id}})
          refresh()
        }}
        onClose={() => setLeaveTarget(null)}
      />
    </Box>
  )
}
