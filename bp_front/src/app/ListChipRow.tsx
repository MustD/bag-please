'use client'

import {KeyboardEvent, useEffect, useRef} from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'

interface ListChipItem {
  id: string
  name: string
  emoji?: string | null
  itemCount: number
}

interface ListChipRowProps {
  lists: ListChipItem[]
  activeListId: string
  onListSelect: (id: string) => void
}

export default function ListChipRow({lists, activeListId, onListSelect}: ListChipRowProps) {
  const chipRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    const chip = chipRefs.current.get(activeListId)
    chip?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'})
  }, [activeListId, lists.length])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, currentIndex: number) => {
    const ids = lists.map(l => l.id)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = ids[(currentIndex + 1) % ids.length]
      chipRefs.current.get(next)?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = ids[(currentIndex - 1 + ids.length) % ids.length]
      chipRefs.current.get(prev)?.focus()
    }
  }

  if (lists.length === 0) {
    return (
      <Box sx={{display: 'flex', gap: 1, px: 2, py: 1, overflowX: 'auto'}}>
        {[0, 1, 2].map(i => (
          <Skeleton key={i} variant="rounded" width={80} height={32}
                    sx={(t) => ({borderRadius: '16px', flexShrink: 0, fontFamily: t.typography.fontFamily})}/>
        ))}
      </Box>
    )
  }

  return (
    <Box
      role="listbox"
      aria-label="Switch list"
      aria-multiselectable="false"
      sx={{
        display: 'flex',
        gap: 1,
        px: 2,
        py: 1,
        overflowX: 'auto',
        '&::-webkit-scrollbar': {display: 'none'},
        scrollbarWidth: 'none'
      }}
    >
      {lists.map((list, index) => {
        const isActive = list.id === activeListId
        const label = list.emoji ? `${list.emoji} ${list.name}` : list.name
        return (
          <Chip
            key={list.id}
            label={label}
            role="option"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            variant={isActive ? 'filled' : 'outlined'}
            color={isActive ? 'primary' : 'default'}
            clickable
            onClick={() => onListSelect(list.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            ref={(node) => {
              if (node) chipRefs.current.set(list.id, node)
              else chipRefs.current.delete(list.id)
            }}
            sx={{flexShrink: 0}}
          />
        )
      })}
    </Box>
  )
}
