import {useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  AcceptInviteMutation,
  type PendingInviteSummary,
  RejectInviteMutation,
} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'

interface Props {
  invites: readonly PendingInviteSummary[]
  // Called after a successful accept/decline so the parent can refetch the lists
  // query (the sole source of truth — there is no membership subscription).
  onChanged: () => void | Promise<unknown>
}

// Pending Invites section (Story 5.7, FR39/FR50). Renders nothing when the
// caller has no invites. Each row shows the inviting list ({emoji} {name}) and
// "Invited by {ownerUsername}", with Accept (acceptInvite → the list becomes
// accessible) and Decline (rejectInvite → the invite vanishes, no access).
// Errors surface inline; on success the parent refetches so the row and the
// lists index update together. There is no real-time membership channel — an
// invite appears only on the invitee's next /lists load or refetch.
export default function PendingInvites({invites, onChanged}: Props) {
  const [acceptInvite] = useMutation(AcceptInviteMutation)
  const [rejectInvite] = useMutation(RejectInviteMutation)
  // A single in-flight invite id (Accept or Decline) guards same-tick re-entry
  // (`run` no-ops while one is busy) and disables only that row's two buttons.
  const [busyListId, setBusyListId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  const run = async (listId: string, action: () => Promise<unknown>) => {
    if (busyListId) return
    setError(null)
    setBusyListId(listId)
    try {
      await action()
    } catch (err) {
      setError(graphqlErrorMessage(err))
      setBusyListId(null)
      return
    }
    setBusyListId(null)
    void onChanged()
  }

  return (
    <Paper data-testid="pending-invites-section" sx={{mb: 3, p: {xs: 2, sm: 3}}}>
      <Typography variant="h6" color="text.primary" sx={{mb: 1}}>
        Pending invites
      </Typography>
      {error && (
        <Alert severity="error" role="alert" data-testid="pending-invites-error" sx={{mb: 2}}>
          {error}
        </Alert>
      )}
      <List disablePadding>
        {invites.map(invite => (
          <ListItem
            key={invite.listId}
            data-testid={`pending-invite-${invite.listName}`}
            disableGutters
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={busyListId === invite.listId}
                  onClick={() => run(invite.listId, () => acceptInvite({variables: {listId: invite.listId}}))}
                  data-testid={`accept-invite-${invite.listName}`}
                >
                  Accept
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  disabled={busyListId === invite.listId}
                  onClick={() => run(invite.listId, () => rejectInvite({variables: {listId: invite.listId}}))}
                  data-testid={`decline-invite-${invite.listName}`}
                >
                  Decline
                </Button>
              </Stack>
            }
          >
            <ListItemText
              primary={
                <Box component="span">
                  {invite.listEmoji ? `${invite.listEmoji} ` : ''}
                  {invite.listName}
                </Box>
              }
              secondary={`Invited by ${invite.ownerUsername}`}
              sx={{pr: 20}}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}
