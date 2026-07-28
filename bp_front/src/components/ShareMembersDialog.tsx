import {type FormEvent, useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined'
import {
  type ListMember,
  type ListSummary,
  RemoveMemberMutation,
  ShareListMutation,
} from '@/lib/lists/listsQueries'
import {graphqlErrorMessage} from '@/lib/admin/adminErrors'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Props {
  list: ListSummary
  open: boolean
  onClose: () => void
  // Called after any successful membership change so the parent can refetch the
  // lists query (there is no membership subscription).
  onChanged: () => void | Promise<unknown>
}

// Share & Members dialog (Story 5.7, FR39/FR40/FR48) — owner-only. Invite by
// exact username (shareList), view the owner + every co-member with a status
// chip, and remove a member (removeMember behind a nested ConfirmDialog).
// `shareList`/`removeMember` return the updated List whose `members` seeds the
// dialog immediately; the parent still refetches the lists index via onChanged.
// The backend `list.members` EXCLUDES the owner, so the owner is rendered
// explicitly ("Owner", not removable). All errors — unknown user, self, already
// invited/member — arrive as FORBIDDEN and are surfaced inline verbatim via
// graphqlErrorMessage (branch on the message string, never invent codes).
export default function ShareMembersDialog({list, open, onClose, onChanged}: Props) {
  const [shareList, {loading: sharing}] = useMutation(ShareListMutation)
  const [removeMember] = useMutation(RemoveMemberMutation)

  const [username, setUsername] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  // Local mirror of the members list, seeded from the prop on the closed→open
  // transition and updated from each mutation's returned List — so the dialog
  // reflects the change immediately without waiting on the parent refetch.
  const [members, setMembers] = useState<ListMember[]>(list.members)
  const [prevOpen, setPrevOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ListMember | null>(null)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setUsername('')
      setShareError(null)
      setMembers(list.members)
    }
  }

  const handleClose = () => {
    if (sharing) return
    onClose()
  }

  const handleShare = async (event: FormEvent) => {
    event.preventDefault()
    if (sharing) return
    const trimmed = username.trim()
    if (!trimmed) {
      setShareError('Username is required')
      return
    }
    setShareError(null)
    try {
      const {data} = await shareList({variables: {listId: list.id, username: trimmed}})
      if (data?.shareList.members) setMembers(data.shareList.members)
    } catch (err) {
      setShareError(graphqlErrorMessage(err))
      return
    }
    setUsername('')
    void onChanged()
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} data-testid="share-members-dialog" fullWidth maxWidth="xs">
        <DialogTitle>Share & members</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleShare} noValidate sx={{mt: 1}}>
            <Stack direction="row" spacing={1} sx={{alignItems: 'flex-start'}}>
              <TextField
                label="Username"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  if (shareError) setShareError(null)
                }}
                autoComplete="off"
                fullWidth
                size="small"
                disabled={sharing}
                slotProps={{htmlInput: {'data-testid': 'share-username-input'}}}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={sharing}
                data-testid="share-submit"
                sx={{flexShrink: 0}}
              >
                {sharing ? <CircularProgress size={20} color="inherit"/> : 'Share'}
              </Button>
            </Stack>
          </Box>
          {shareError && (
            <Alert severity="error" role="alert" data-testid="share-error" sx={{mt: 2}}>
              {shareError}
            </Alert>
          )}

          <List sx={{mt: 1}}>
            <ListItem disableGutters data-testid="member-owner-row">
              <ListItemAvatar sx={{minWidth: 40}}>
                <Avatar sx={{width: 24, height: 24, fontSize: '0.75rem'}}>
                  {list.ownerUsername.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={list.ownerUsername}
                secondary="Owner"
              />
            </ListItem>

            {members.map(member => (
              <ListItem
                key={member.userId}
                disableGutters
                data-testid={`member-row-${member.username}`}
                secondaryAction={
                  <Tooltip title="Remove member">
                    <IconButton
                      edge="end"
                      color="error"
                      aria-label={`Remove ${member.username}`}
                      onClick={() => setRemoveTarget(member)}
                      data-testid={`remove-member-${member.username}`}
                    >
                      <PersonRemoveOutlinedIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemAvatar sx={{minWidth: 40}}>
                  <Avatar sx={{width: 24, height: 24, fontSize: '0.75rem'}}>
                    {member.username.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.username}
                  secondary={
                    member.status === 'PENDING' ? (
                      <Chip label="Pending" size="small" sx={{mt: 0.5}}/>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Member
                      </Typography>
                    )
                  }
                  slotProps={{secondary: {component: 'div'}}}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={sharing} data-testid="share-members-close">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove member"
        description={
          <>
            Remove <strong>{removeTarget?.username}</strong> from this list? They lose access
            immediately; any items they added remain.
          </>
        }
        confirmLabel="Remove"
        testId="remove-member-dialog"
        onConfirm={async () => {
          if (!removeTarget) return
          const {data} = await removeMember({
            variables: {listId: list.id, username: removeTarget.username},
          })
          if (data?.removeMember.members) setMembers(data.removeMember.members)
          void onChanged()
        }}
        onClose={() => setRemoveTarget(null)}
      />
    </>
  )
}
