'use client'

import {useRef, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useMutation, useQuery} from '@apollo/client/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Fab from '@mui/material/Fab'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import EmptyState from '@/app/EmptyState'
import ListCard from '@/app/ListCard'
import SheetNewList from '@/app/SheetNewList'
import {useAuth} from '@/lib/auth/AuthContext'
import {acceptInviteMutation, listsQuery, rejectInviteMutation,} from '@/lib/list/Queries'
import type {ListsQuery} from '@/__generated__/graphql'
import type {BPSheetState} from '@/app/BPSheet'

const inviteCardSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  p: 1.5,
  mb: 1,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
} as const

type PendingInviteItem = ListsQuery['lists']['pendingInvites'][0]

export default function ListsPage() {
  const router = useRouter()
  const {username} = useAuth()
  const fabRef = useRef<HTMLButtonElement>(null)
  const [sheetState, setSheetState] = useState<BPSheetState>('closed')
  const [deletedSnackbar, setDeletedSnackbar] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState('')

  const {data, loading} = useQuery(listsQuery)

  const [acceptInvite] = useMutation(acceptInviteMutation, {
    refetchQueries: [{query: listsQuery}],
  })
  const [rejectInvite] = useMutation(rejectInviteMutation, {
    refetchQueries: [{query: listsQuery}],
  })

  const lists = [...(data?.lists?.lists ?? [])].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )
  const pendingInvites = data?.lists?.pendingInvites ?? []

  const hasContent = lists.length > 0 || pendingInvites.length > 0

  const handleAccept = async (listId: string) => {
    setAcceptingId(listId)
    try {
      const result = await acceptInvite({variables: {listId}})
      const newId = result.data?.acceptInvite?.id
      if (newId) router.push(`/list/${newId}`)
    } catch {
      setInviteError('Failed to accept invite. Please try again.')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleReject = async (listId: string) => {
    setRejectingId(listId)
    try {
      await rejectInvite({variables: {listId}})
    } catch {
      setInviteError('Failed to reject invite. Please try again.')
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <Box sx={{p: 2, pb: 12}}>
      {loading && (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={80}/>
          ))}
        </Box>
      )}

      {!loading && !hasContent && (
        <EmptyState
          icon={<FormatListBulletedIcon fontSize="large"/>}
          title="No lists yet"
          subtitle="Create your first list to start shopping"
          action={{label: 'Create list', onClick: () => setSheetState('peeked')}}
        />
      )}

      {!loading && lists.length > 0 && (
        lists.map(list => (
          <ListCard
            key={list.id}
            list={list}
            currentUsername={username}
            onNavigate={id => router.push(`/list/${id}`)}
            onDeleted={(_id, name) => setDeletedSnackbar(`'${name}' deleted`)}
            onLeft={() => {
            }}
          />
        ))
      )}

      {!loading && pendingInvites.length > 0 && (
        <Box sx={{mt: 2}}>
          <Typography variant="subtitle2" sx={{mb: 1}}>Pending invites</Typography>
          {pendingInvites.map((invite: PendingInviteItem) => (
            <Box key={invite.listId} sx={inviteCardSx}>
              <Box sx={{flex: 1, minWidth: 0}}>
                <Typography variant="body2" sx={{fontWeight: 600}}>
                  {invite.listEmoji} {invite.listName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  from {invite.ownerUsername}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={() => handleAccept(invite.listId)}
                disabled={acceptingId === invite.listId || rejectingId === invite.listId}
              >
                Accept
              </Button>
              <Button
                size="small"
                onClick={() => handleReject(invite.listId)}
                disabled={acceptingId === invite.listId || rejectingId === invite.listId}
              >
                Reject
              </Button>
            </Box>
          ))}
        </Box>
      )}

      <Fab
        ref={fabRef}
        color="primary"
        aria-label="Create list"
        sx={{position: 'fixed', bottom: 88, right: 16, zIndex: 'fab'}}
        onClick={() => setSheetState('peeked')}
      >
        <AddIcon/>
      </Fab>

      <SheetNewList
        state={sheetState}
        onStateChange={setSheetState}
        triggerRef={fabRef}
      />

      <Snackbar
        open={Boolean(deletedSnackbar)}
        message={deletedSnackbar}
        autoHideDuration={5000}
        onClose={() => setDeletedSnackbar('')}
      />

      <Snackbar
        open={Boolean(inviteError)}
        message={inviteError}
        autoHideDuration={4000}
        onClose={() => setInviteError('')}
      />
    </Box>
  )
}
