'use client'

import {useEffect, useState} from 'react'
import Box from '@mui/material/Box'
import {useTheme} from '@mui/material/styles'

interface ProgressStripProps {
  checked: number
  total: number
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

export default function ProgressStrip({checked, total}: ProgressStripProps) {
  const theme = useTheme()
  const reduced = usePrefersReducedMotion()
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  const isComplete = total > 0 && checked >= total

  return (
    <Box
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={isComplete ? 'All done' : `${pct}% complete`}
      sx={(t) => ({
        height: '6px',
        borderRadius: '99px',
        bgcolor: theme.custom.bp.bg2,
        overflow: 'hidden',
        fontFamily: t.typography.fontFamily,
      })}
    >
      <Box
        sx={(t) => ({
          height: '100%',
          borderRadius: '99px',
          width: `${pct}%`,
          transition: reduced ? 'none' : 'width 320ms cubic-bezier(0.2,0.7,0.2,1)',
          bgcolor: isComplete ? t.palette.success.main : t.palette.primary.main,
        })}
      />
    </Box>
  )
}
