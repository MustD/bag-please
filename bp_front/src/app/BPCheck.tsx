'use client'

import type {KeyboardEvent} from 'react'
import Box from '@mui/material/Box'
import {useTheme} from '@mui/material/styles'

interface BPCheckProps {
  checked: boolean
  ariaLabel: string
  disabled?: boolean
  onChange: () => void
  onFocusChange?: (focused: boolean) => void
}

export default function BPCheck({checked, ariaLabel, disabled, onChange, onFocusChange}: BPCheckProps) {
  const theme = useTheme()

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      e.preventDefault()
      if (!disabled) onChange()
    }
  }

  return (
    <Box
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={0}
      onClick={() => {
        if (!disabled) onChange()
      }}
      onKeyDown={handleKeyDown}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
      sx={{
        width: 42,
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
          borderRadius: '50%',
        },
      }}
    >
      <Box
        sx={(t) => ({
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: checked ? t.palette.primary.main : 'transparent',
          border: checked ? 'none' : `1.5px solid ${theme.custom.bp.ter}`,
          transition: 'background-color 150ms ease-out, border 150ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {checked && (
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </Box>
    </Box>
  )
}
