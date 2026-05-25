'use client'

import {useRef, useState} from 'react'
import {useMutation} from '@apollo/client/react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import BPAvatar from '@/app/BPAvatar'
import {deleteListMutation, leaveListMutation, listsQuery, renameListMutation} from '@/lib/list/Queries'
import type {ListsQuery} from '@/__generated__/graphql'

const destructiveItemSx = {color: 'error.main'} as const

type ListItem = ListsQuery['lists']['lists'][0]

interface ListCardProps {
  list: ListItem
  currentUsername: string | null
  onNavigate: (id: string) => void
  onDeleted: (id: string, name: string) => void
  onLeft: (id: string) => void
}

export default function ListCard({list, currentUsername, onNavigate, onDeleted, onLeft}: ListCardProps) {
  const isOwner = list.ownerUsername === currentUsername

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(list.name)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [deleteInFlight, setDeleteInFlight] = useState(false)
  const [leaveInFlight, setLeaveInFlight] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [leaveError, setLeaveError] = useState(false)

  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const [renameList] = useMutation(renameListMutation)
  const [deleteList] = useMutation(deleteListMutation, {
    refetchQueries: [{query: listsQuery}],
  })
  const [leaveList] = useMutation(leaveListMutation, {
    refetchQueries: [{query: listsQuery}],
  })

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
  }
  const closeMenu = () => setMenuAnchor(null)

  const handleRenameSelect = () => {
    closeMenu()
    setRenameValue(list.name)
    setRenaming(true)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === list.name) {
      setRenaming(false)
      return
    }
    setRenaming(false)
    renameList({
      variables: {id: list.id, name: trimmed},
      optimisticResponse: {
        renameList: {__typename: 'List', id: list.id, name: trimmed},
      },
    })
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setRenaming(false)
  }

  const handleDelete = async () => {
    setDeleteInFlight(true)
    setDeleteError(false)
    try {
      await deleteList({variables: {id: list.id}})
      setShowDeleteDialog(false)
      onDeleted(list.id, list.name)
    } catch {
      setDeleteError(true)
    } finally {
      setDeleteInFlight(false)
    }
  }

  const handleLeave = async () => {
    setLeaveInFlight(true)
    setLeaveError(false)
    try {
      await leaveList({variables: {listId: list.id}})
      setShowLeaveDialog(false)
      onLeft(list.id)
    } catch {
      setLeaveError(true)
    } finally {
      setLeaveInFlight(false)
    }
  }

  const activeMembers = list.members.filter(m => m.status !== 'DECLINED')

  return (
    <>
      <Card
        elevation={0}
        onClick={() => !renaming && onNavigate(list.id)}
        sx={{cursor: 'pointer', mb: 1, border: '1px solid', borderColor: 'divider'}}
      >
        <CardContent sx={{display: 'flex', alignItems: 'flex-start', gap: 1, pr: 1}}>
          <Box sx={{flex: 1, minWidth: 0}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
              {list.emoji && (
                <Typography variant="h6" component="span" sx={{lineHeight: 1}}>
                  {list.emoji}
                </Typography>
              )}
              {renaming ? (
                <TextField
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={() => setRenaming(false)}
                  size="small"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  sx={{flex: 1}}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton size="small" onMouseDown={e => {
                          e.preventDefault();
                          commitRename()
                        }}>
                          ✓
                        </IconButton>
                      )
                    }
                  }}
                />
              ) : (
                <Typography variant="subtitle1"
                            sx={{fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {list.name}
                </Typography>
              )}
            </Box>

            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5}}>
              {activeMembers.map(m => (
                <BPAvatar
                  key={m.userId}
                  displayName={m.username}
                  status={m.status === 'ACCEPTED' ? 'active' : 'pending'}
                />
              ))}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{mt: 0.5, display: 'block'}}>
              {list.uncheckedItemCount} items
            </Typography>
          </Box>

          <IconButton
            ref={moreButtonRef}
            size="small"
            sx={{width: 48, height: 48, flexShrink: 0}}
            onClick={openMenu}
            aria-label="List options"
          >
            <MoreVertIcon/>
          </IconButton>
        </CardContent>
      </Card>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={handleRenameSelect}>Rename</MenuItem>
        <MenuItem onClick={() => {
          closeMenu()
        }}>Share &amp; Members</MenuItem>
        {isOwner ? (
          <MenuItem onClick={() => {
            closeMenu();
            setShowDeleteDialog(true)
          }} sx={destructiveItemSx}>
            Delete
          </MenuItem>
        ) : (
          <MenuItem onClick={() => {
            closeMenu();
            setShowLeaveDialog(true)
          }} sx={destructiveItemSx}>
            Leave list
          </MenuItem>
        )}
      </Menu>

      <Dialog open={showDeleteDialog} onClose={() => !deleteInFlight && setShowDeleteDialog(false)}>
        <DialogTitle>Delete list?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete &ldquo;{list.name}&rdquo;? This list and all {list.uncheckedItemCount} items will be permanently
            removed.
          </DialogContentText>
          {deleteError && (
            <DialogContentText color="error" sx={{mt: 1}}>
              Failed to delete. Please try again.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)} disabled={false}>Cancel</Button>
          <Button color="error" onClick={handleDelete} disabled={deleteInFlight}>
            {deleteInFlight ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showLeaveDialog} onClose={() => !leaveInFlight && setShowLeaveDialog(false)}>
        <DialogTitle>Leave list?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Leave &ldquo;{list.name}&rdquo;? You will lose access to this list.
          </DialogContentText>
          {leaveError && (
            <DialogContentText color="error" sx={{mt: 1}}>
              Failed to leave. Please try again.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeaveDialog(false)} disabled={false}>Cancel</Button>
          <Button color="error" onClick={handleLeave} disabled={leaveInFlight}>
            {leaveInFlight ? 'Leaving…' : 'Leave'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
