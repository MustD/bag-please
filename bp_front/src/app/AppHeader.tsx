'use client'

import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import {styled} from '@mui/material/styles'
import Navigation from '@/app/Navigation'
import {useAuth} from '@/lib/auth/AuthContext'

const ChipContainer = styled(Box)(({theme}) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  borderRadius: 20,
  padding: theme.spacing(0.5, 1.5),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}))

const AvatarCircle = styled(Box)(({theme}) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: theme.palette.background.default,
}))

function UserChip({username}: { username: string }) {
  return (
    <ChipContainer>
      <AvatarCircle>{username.charAt(0).toUpperCase()}</AvatarCircle>
      <Typography variant="body2">{username}</Typography>
    </ChipContainer>
  )
}

export default function AppHeader() {
  const {username} = useAuth()
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>Bag please</Typography>
          {username && <UserChip username={username}/>}
          <Navigation/>
        </Toolbar>
      </AppBar>
    </Box>
  )
}
