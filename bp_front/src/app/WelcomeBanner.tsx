'use client'

import {Box, IconButton, Stack, Typography} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface WelcomeBannerProps {
  username: string
  onDismiss: () => void
}

export default function WelcomeBanner({username, onDismiss}: WelcomeBannerProps) {
  return (
    <Box sx={{p: 2, borderRadius: 1, bgcolor: 'primary.dark', mb: 2}}>
      <Stack direction="row" sx={{alignItems: 'center'}} spacing={1}>
        <Typography sx={{flex: 1}}>
          Welcome, {username}! You now have your own account.
        </Typography>
        <IconButton aria-label="Dismiss" onClick={onDismiss} size="small">
          <CloseIcon fontSize="small"/>
        </IconButton>
      </Stack>
    </Box>
  )
}
