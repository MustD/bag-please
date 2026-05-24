'use client'

import {useParams} from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function TodayPage() {
  const {listId} = useParams<{listId: string}>()
  return (
    <Box sx={{p: 2}}>
      <Typography>Today — list {listId} (Story 4.7)</Typography>
    </Box>
  )
}
