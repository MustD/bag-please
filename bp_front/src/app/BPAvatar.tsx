'use client'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

interface BPAvatarProps {
  displayName: string
  avatarUrl?: string
  status: 'active' | 'pending'
}

const overlayBase = {
  position: 'absolute',
  inset: 0,
  bgcolor: 'rgba(0,0,0,0.35)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  transition: 'opacity 200ms',
} as const

const clockIconSx = {fontSize: 12, color: 'white'} as const

export default function BPAvatar({displayName, avatarUrl, status}: BPAvatarProps) {
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || displayName.slice(0, 1).toUpperCase() || '?'

  return (
    <Box sx={{position: 'relative', display: 'inline-flex'}}>
      <Avatar
        src={avatarUrl}
        aria-label={status === 'pending' ? `${displayName} (pending invite)` : displayName}
      >
        {initials}
      </Avatar>
      <Box sx={{...overlayBase, opacity: status === 'pending' ? 1 : 0}}>
        <AccessTimeIcon sx={clockIconSx}/>
      </Box>
    </Box>
  )
}
