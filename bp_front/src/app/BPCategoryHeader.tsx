'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface BPCategoryHeaderProps {
  name: string
  checkedCount: number
  totalCount: number
  collapsed: boolean
}

export default function BPCategoryHeader({name, checkedCount, totalCount, collapsed}: BPCategoryHeaderProps) {
  if (collapsed) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 12px 6px',
      }}
    >
      <Typography
        color="text.secondary"
        sx={(t) => ({
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          fontFamily: t.typography.fontFamily,
        })}
      >
        {name}
      </Typography>
      <Typography
        color="text.secondary"
        sx={(t) => ({fontSize: '11px', fontWeight: 600, fontFamily: t.typography.fontFamily})}
      >
        {checkedCount}/{totalCount}
      </Typography>
    </Box>
  )
}
