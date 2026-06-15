'use client'

import {useRef, useState} from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import BPSheet, {type BPSheetState} from '@/app/BPSheet'

const LONG_TEXT_ITEMS = Array.from({length: 40}, (_, i) => `Sample list item #${i + 1} — long enough to scroll inside the sheet`)

export default function BPSheetTestPage() {
  const [state, setState] = useState<BPSheetState>('closed')
  const openBtnRef = useRef<HTMLButtonElement | null>(null)
  const peekBtnRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Box sx={{p: 3}}>
      <Typography variant="h5" gutterBottom>BPSheet Spike Test</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Current state: <strong>{state}</strong>
      </Typography>

      <Stack direction="row" spacing={1} sx={{my: 2}}>
        <Button
          ref={peekBtnRef}
          variant="outlined"
          onClick={() => setState('peeked')}
        >
          Open as PEEKED
        </Button>
        <Button
          ref={openBtnRef}
          variant="contained"
          onClick={() => setState('open')}
        >
          Open as OPEN
        </Button>
        <Button variant="text" onClick={() => setState('closed')}>
          Force CLOSED
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Spike checklist:
      </Typography>
      <Typography component="ol" variant="body2" sx={{pl: 3, color: 'text.secondary'}}>
        <li>OPEN the sheet → scroll the inner list (iOS Safari emulation) — sheet must NOT close</li>
        <li>OPEN → focus a text field → virtual keyboard must not fight focus trap</li>
        <li>PEEKED → swipe up → OPEN: open Performance panel with CPU 4× throttle; check &lt; 16ms frame time</li>
        <li>OPEN → browser back → must go to PEEKED (no route change); back again → CLOSED</li>
        <li>Escape from OPEN → PEEKED; Escape from PEEKED → CLOSED</li>
        <li>Scrim tap from OPEN → PEEKED (not CLOSED); scrim tap from PEEKED → CLOSED</li>
        <li>Trigger-button focus must return after CLOSED</li>
        <li>Toggle OS Reduce Motion → animation becomes opacity crossfade (no slide)</li>
      </Typography>

      <BPSheet
        state={state}
        onStateChange={setState}
        title="Spike test sheet"
        triggerRef={state === 'open' ? openBtnRef : peekBtnRef}
      >
        <Typography variant="h6" gutterBottom>Sheet content</Typography>
        <TextField
          fullWidth
          label="Focusable input"
          placeholder="First focusable element"
          margin="dense"
        />
        <TextField
          fullWidth
          label="Another input"
          placeholder="Test focus trap with Tab"
          margin="dense"
        />
        <Box sx={{mt: 2}}>
          {LONG_TEXT_ITEMS.map((line) => (
            <Typography key={line} variant="body2" sx={{py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
              {line}
            </Typography>
          ))}
        </Box>
      </BPSheet>
    </Box>
  )
}
