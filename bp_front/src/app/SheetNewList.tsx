'use client'

import {type RefObject, useEffect, useRef, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useMutation} from '@apollo/client/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import EmojiPicker, {type EmojiClickData} from 'emoji-picker-react'
import BPSheet, {type BPSheetState} from '@/app/BPSheet'
import {createListMutation, listsQuery} from '@/lib/list/Queries'

const emojiButtonSx = {fontSize: '1.5rem'} as const
const progressSx = {color: 'white'} as const

interface SheetNewListProps {
  state: BPSheetState
  onStateChange: (s: BPSheetState) => void
  triggerRef?: RefObject<HTMLElement | null>
}

export default function SheetNewList({state, onStateChange, triggerRef}: SheetNewListProps) {
  const router = useRouter()
  const [emoji, setEmoji] = useState('')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [inFlight, setInFlight] = useState(false)
  const [snackbarMsg, setSnackbarMsg] = useState('')
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const lastMutationArgs = useRef<{ name: string; emoji?: string } | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef(name)
  nameRef.current = name

  // Intercept BPSheet's back-gesture sentinel before BPSheet consumes it.
  // Without this, the sentinel is gone by the time SheetNewList shows the discard
  // dialog — the next back-press would navigate the browser away instead of
  // re-triggering the dialog.
  useEffect(() => {
    if (state === 'closed') return
    const handlePopState = (e: PopStateEvent) => {
      if (!(e.state as { bpSheetSentinel?: boolean } | null)?.bpSheetSentinel) return
      if (!nameRef.current.trim()) return
      e.stopImmediatePropagation()
      window.history.pushState({bpSheetSentinel: true}, '')
      setPendingClose(true)
      setShowDiscardDialog(true)
    }
    window.addEventListener('popstate', handlePopState, true)
    return () => window.removeEventListener('popstate', handlePopState, true)
  }, [state])

  const [createList] = useMutation(createListMutation, {
    refetchQueries: [{query: listsQuery}],
  })

  const reset = () => {
    setEmoji('')
    setName('')
    setNameError('')
    setShowPicker(false)
    setInFlight(false)
    lastMutationArgs.current = null
  }

  const handleStateChange = (s: BPSheetState) => {
    if (s === 'closed' && state !== 'closed' && name.trim()) {
      setPendingClose(true)
      setShowDiscardDialog(true)
      return
    }
    if (s === 'closed') {
      reset()
    }
    onStateChange(s)
  }

  const handleDiscard = () => {
    setShowDiscardDialog(false)
    setPendingClose(false)
    reset()
    onStateChange('closed')
  }

  const handleKeepEditing = () => {
    setShowDiscardDialog(false)
    setPendingClose(false)
    if (state === 'closed') onStateChange('peeked')
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setEmoji(emojiData.emoji)
    setShowPicker(false)
    nameInputRef.current?.focus()
  }

  const handlePickerToggle = () => {
    setShowPicker(prev => !prev)
    if (!showPicker && state === 'peeked') {
      onStateChange('open')
    }
  }

  const submit = async (args: { name: string; emoji?: string }) => {
    setInFlight(true)
    lastMutationArgs.current = args
    try {
      const result = await createList({
        variables: {name: args.name, emoji: args.emoji},
      })
      const newId = result.data?.createList?.id
      reset()
      if (newId) {
        // Navigate straight into the new list. Don't close the sheet first:
        // closing pops BPSheet's history sentinel, and that history.back() races
        // and clobbers this push. Navigating unmounts the sheet instead, and by
        // then router.push has updated history, so BPSheet's cleanup skips the
        // sentinel pop (it is no longer the top entry).
        router.push(`/list/${newId}`)
      } else {
        onStateChange('closed')
      }
    } catch {
      setSnackbarMsg("Couldn't create list · Retry")
    } finally {
      setInFlight(false)
    }
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return
    }
    setNameError('')
    submit({name: trimmed, emoji: emoji || undefined})
  }

  const handleRetry = () => {
    if (lastMutationArgs.current) {
      setSnackbarMsg('')
      submit(lastMutationArgs.current)
    }
  }

  return (
    <>
      <BPSheet
        state={pendingClose ? 'peeked' : state}
        onStateChange={handleStateChange}
        peekHeight={260}
        title="New list"
        triggerRef={triggerRef}
      >
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          <Typography variant="subtitle1" sx={{fontWeight: 600}}>New list</Typography>

          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <IconButton onClick={handlePickerToggle} sx={emojiButtonSx}>
              {emoji || '🏷️'}
            </IconButton>
            <TextField
              inputRef={nameInputRef}
              label="List name"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              error={Boolean(nameError)}
              helperText={nameError}
              fullWidth
              size="small"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </Box>

          {showPicker && (
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              skinTonesDisabled
              height={320}
              width="100%"
            />
          )}

          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={inFlight}
            fullWidth
          >
            {inFlight ? <CircularProgress size={18} sx={progressSx}/> : 'Create'}
          </Button>
        </Box>
      </BPSheet>

      <Dialog open={showDiscardDialog} onClose={handleKeepEditing}>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your list name will be lost.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleKeepEditing}>Keep editing</Button>
          <Button color="error" onClick={handleDiscard}>Discard</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMsg)}
        message={snackbarMsg}
        action={
          <Button color="inherit" size="small" onClick={handleRetry}>
            Retry
          </Button>
        }
        onClose={() => setSnackbarMsg('')}
        autoHideDuration={null}
      />
    </>
  )
}
