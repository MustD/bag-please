import {useState} from 'react'
import {useApolloClient, useMutation, useQuery} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import LockResetIcon from '@mui/icons-material/LockReset'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import {
  AdminConfigQuery,
  type AdminUser,
  AdminUsersQuery,
  SetRegistrationEnabledMutation,
} from '@/lib/admin/adminQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import CreateUserDialog from '@/components/CreateUserDialog'
import DeleteUserDialog from '@/components/DeleteUserDialog'
import ResetPasswordDialog from '@/components/ResetPasswordDialog'

// Admin panel (Story 5.4) — the single /admin route, rendered inside AdminGuard
// + AppShell (role already resolved; non-admins never reach here). A calm,
// confirmation-first surface: a registration toggle and a table of regular
// users with per-row reset/delete actions. All operations are GraphQL via the
// existing Apollo client; all feedback is inline (never a toast).
//
// The users table is SERVER-PAGED since Story 9.2. It used to render every row
// in the database, which degraded as accounts accumulated and gated the
// create-user dialog's close behind a full re-render.

// FR13's page size. One definition; the pager arithmetic below is all derived
// from it and from what the server answers.
const PAGE_SIZE = 20

export default function AdminPage() {
  // Users table, paged.
  //
  // TWO pieces of state, and the difference matters. `requestedOffset` is what
  // the pager ASKS for; `around` is a transient request to be shown whichever
  // page contains a given username, which the server resolves and which
  // overrides the offset. Neither is the page actually displayed: that is the
  // server's `offset`, adopted below.
  const [requestedOffset, setRequestedOffset] = useState(0)
  const [around, setAround] = useState<string | null>(null)

  // `cache-and-network` so a returning render never shows a stale page while the
  // real one loads. Every argument set caches separately (the InMemoryCache
  // declares no typePolicies), which is why create/delete evict the whole field
  // rather than trusting any one page's entry.
  const {
    data: usersData,
    previousData: usersPreviousData,
    loading: usersLoading,
    error: usersError,
    refetch,
  } = useQuery(AdminUsersQuery, {
    variables: {limit: PAGE_SIZE, offset: requestedOffset, around},
    fetchPolicy: 'cache-and-network',
  })

  // `previousData` is what makes the fallback below work at all. Every pager
  // click CHANGES THE VARIABLES, so `data` is undefined until the new page
  // lands — reading `data` alone would blank the table (and the pager with it)
  // on every step, and again after each create/delete eviction. `previousData`
  // is the last page this query actually resolved, whatever its variables.
  const page = usersData?.users ?? usersPreviousData?.users
  const users = page?.users ?? []
  const totalCount = page?.totalCount ?? 0

  // THE CLIENT ADOPTS THE SERVER'S OFFSET. The server clamps (to 0..last page,
  // and to the page containing `around`) and returns the page it actually
  // served, so the pager reads its position from the answer instead of
  // recomputing the clamp — one fewer place for the arithmetic to disagree.
  // Deriving it rather than storing it also means adoption costs no extra round
  // trip: feeding it back into the variables would re-run the query.
  const servedOffset = page?.offset ?? requestedOffset
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageNumber = Math.floor(servedOffset / PAGE_SIZE) + 1
  const onFirstPage = servedOffset <= 0
  const onLastPage = servedOffset + PAGE_SIZE >= totalCount

  // Only a GENUINE first load — nothing resolved yet, not even under different
  // variables — replaces the table with a spinner. Any later load has a
  // `previousData` page to keep rendering, so the rows and the pager stay put
  // instead of flickering empty on each click.
  const firstLoad = usersLoading && !page

  const client = useApolloClient()
  // After any create or delete, EVERY cached page is stale: a row inserted or
  // removed anywhere shifts every page after it. Evicting the whole field and
  // collecting garbage is what stops a later page step rendering pre-shift rows.
  const evictUsers = () => {
    client.cache.evict({fieldName: 'users'})
    client.cache.gc()
  }

  const goToOffset = (offset: number) => {
    // A deliberate page step always outranks a pending `around`.
    setAround(null)
    setRequestedOffset(Math.max(0, offset))
  }

  const handleCreated = (username: string) => {
    evictUsers()
    // Ask for the page CONTAINING the new row rather than walking pages to find
    // it — the row rarely sorts onto the page currently shown.
    if (around === username) void refetch()
    else setAround(username)
  }

  const handleDeleted = () => {
    evictUsers()
    // Same variables as before, so only an explicit refetch re-reads. Note WHICH
    // variable then locates the page: `around` is left as a create set it (it is
    // never cleared here), and `around` outranks `offset` server-side — so after
    // a create-then-delete the server re-locates by NAME, and only a plain
    // delete is located by offset. Either way the answer is the page that
    // contains what is being viewed, re-clamped to the last page if the deleted
    // row emptied one — which is how deleting the last row on the last page
    // moves the table back a page.
    void refetch()
  }

  // Registration toggle. The switch reflects the query directly. The mutation
  // returns the confirmed { registrationEnabled }, which we write straight into
  // the AdminConfig query cache via `update` — ApplicationConfig has no id so
  // the cache can't auto-reconcile, but a single-field writeQuery moves the
  // switch to the server-confirmed value with no second round trip and no
  // desync window (a separate refetch could fail after a successful mutation and
  // strand the UI on the old value). `enabled === null` means "still loading":
  // never render the switch as "off" while unresolved (5.2). A config-query
  // error is surfaced inline instead of spinning forever.
  const {data: configData, error: configError} = useQuery(AdminConfigQuery)
  const enabled = configData?.applicationConfig?.registrationEnabled ?? null
  const [setRegistrationEnabled, {loading: toggling}] = useMutation(SetRegistrationEnabledMutation, {
    update(cache, {data}) {
      if (!data) return
      cache.writeQuery({
        query: AdminConfigQuery,
        data: {applicationConfig: data.setRegistrationEnabled},
      })
    },
  })
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Dialogs. Create is a boolean; delete/reset carry their target row.
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  // Inline panel-level confirmation after a password reset (no success toast).
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleToggle = async (next: boolean) => {
    if (toggling) return
    setToggleError(null)
    try {
      await setRegistrationEnabled({variables: {enabled: next}})
    } catch (err) {
      // Leave the switch at its last confirmed value (no optimistic flip).
      setToggleError(graphqlErrorMessage(err))
    }
  }

  return (
    <Box data-testid="admin-page" sx={{flexGrow: 1, py: {xs: 3, sm: 4}}}>
      <Container maxWidth="md">
        <Typography variant="h4" color="text.primary" sx={{mb: 3}}>
          Admin
        </Typography>

        {/* Registration toggle */}
        <Paper sx={{p: {xs: 2, sm: 3}, mb: 3}}>
          <Typography variant="h6" color="text.primary" sx={{mb: 0.5}}>
            Public registration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
            When off, the sign-in screen hides the Create-account link and directs visitors to
            contact an admin.
          </Typography>
          {configError ? (
            <Alert severity="error" role="alert" data-testid="registration-config-error" sx={{mt: 1}}>
              {graphqlErrorMessage(configError)}
            </Alert>
          ) : enabled === null ? (
            <Box sx={{py: 1}}>
              <CircularProgress size={24}/>
            </Box>
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={e => handleToggle(e.target.checked)}
                  disabled={toggling}
                  data-testid="registration-toggle"
                />
              }
              label={enabled ? 'Registration enabled' : 'Registration disabled'}
            />
          )}
          {toggleError && (
            <Alert severity="error" role="alert" data-testid="registration-toggle-error" sx={{mt: 1}}>
              {toggleError}
            </Alert>
          )}
        </Paper>

        {/* Users */}
        <Paper sx={{p: {xs: 2, sm: 3}}}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            <Typography variant="h6" color="text.primary">
              Users
            </Typography>
            <Button
              variant="contained"
              startIcon={<PersonAddAlt1Icon/>}
              onClick={() => {
                setFeedback(null)
                setCreateOpen(true)
              }}
              data-testid="admin-create-user-button"
            >
              Create user
            </Button>
          </Box>

          {feedback && (
            <Alert
              severity="success"
              role="status"
              data-testid="admin-feedback"
              onClose={() => setFeedback(null)}
              sx={{mb: 2}}
            >
              {feedback}
            </Alert>
          )}

          {usersError && (
            <Alert severity="error" role="alert" data-testid="admin-users-error" sx={{mb: 2}}>
              {graphqlErrorMessage(usersError)}
            </Alert>
          )}

          {firstLoad ? (
            <Box data-testid="admin-users-loading" sx={{display: 'flex', justifyContent: 'center', py: 4}}>
              <CircularProgress/>
            </Box>
          ) : users.length === 0 && !usersError ? (
            <Typography
              data-testid="admin-users-empty"
              variant="body2"
              color="text.secondary"
              sx={{py: 2}}
            >
              No users yet. Create one to get started.
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Table aria-label="Users" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id} data-testid={`admin-user-row-${user.username}`} hover>
                        <TableCell>
                          {/* AR-E9-6b: the `noWrap` + `maxWidth: {xs: 140, sm: 260}` cap this
                              cell used to carry clipped long usernames at the 320px floor —
                              the same construct Story 8.2 removed from /lists/:id. The name
                              wraps instead, and breaks mid-word when it has no space to wrap
                              on (usernames routinely have none). */}
                          <Typography data-testid="admin-user-name" sx={{overflowWrap: 'anywhere'}}>
                            {user.username}
                          </Typography>
                        </TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Reset password">
                            <IconButton
                              aria-label={`Reset password for ${user.username}`}
                              onClick={() => {
                                setFeedback(null)
                                setResetTarget(user)
                              }}
                              data-testid="reset-password-button"
                            >
                              <LockResetIcon fontSize="small"/>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete user">
                            <IconButton
                              aria-label={`Delete ${user.username}`}
                              color="error"
                              onClick={() => {
                                setFeedback(null)
                                setDeleteTarget(user)
                              }}
                              data-testid="delete-user-button"
                            >
                              <DeleteOutlinedIcon fontSize="small"/>
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pager. Wraps at the floor so neither control is pushed off-screen. */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                  mt: 2,
                }}
              >
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                  <Typography variant="body2" color="text.secondary" data-testid="admin-users-total">
                    {totalCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    users
                  </Typography>
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                  {/* A disabled MUI button fires no events, so the Tooltip needs a
                      non-disabled wrapper to hang its listeners on. */}
                  <Tooltip title="Previous page">
                    <span>
                      <IconButton
                        aria-label="Previous page"
                        disabled={onFirstPage}
                        onClick={() => goToOffset(servedOffset - PAGE_SIZE)}
                        data-testid="admin-users-prev"
                      >
                        <ChevronLeftIcon fontSize="small"/>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" data-testid="admin-users-page">
                    {pageNumber} / {pageCount}
                  </Typography>
                  <Tooltip title="Next page">
                    <span>
                      <IconButton
                        aria-label="Next page"
                        disabled={onLastPage}
                        onClick={() => goToOffset(servedOffset + PAGE_SIZE)}
                        data-testid="admin-users-next"
                      >
                        <ChevronRightIcon fontSize="small"/>
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Container>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <DeleteUserDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={username => setFeedback(`Password reset for ${username}. They have been signed out.`)}
      />
    </Box>
  )
}
