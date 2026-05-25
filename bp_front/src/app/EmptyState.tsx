'use client'

import type {ReactNode} from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({icon, title, subtitle, action}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 8,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Box sx={{mb: 1}} color="text.secondary">{icon}</Box>
      <Typography variant="h6" sx={{fontWeight: 600}}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      {action && (
        <Button variant="contained" onClick={action.onClick} sx={{mt: 1}}>
          {action.label}
        </Button>
      )}
    </Box>
  )
}
