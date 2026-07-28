import {useState} from 'react'
import {useMutation, useQuery} from '@apollo/client/react'
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
export default function AdminPage() {
  // Users table.
  const {data: usersData, loading: usersLoading, error: usersError, refetch} = useQuery(AdminUsersQuery)
  const users = usersData?.users ?? []

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

          {usersLoading ? (
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
                        <Typography noWrap sx={{maxWidth: {xs: 140, sm: 260}}}>
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
          )}
        </Paper>
      </Container>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
      <DeleteUserDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => refetch()}
      />
      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={username => setFeedback(`Password reset for ${username}. They have been signed out.`)}
      />
    </Box>
  )
}
