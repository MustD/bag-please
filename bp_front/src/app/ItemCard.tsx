'use client'

import type {TransitionEvent} from 'react'
import {useEffect, useRef, useState} from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import {alpha} from '@mui/material/styles'
import EditIcon from '@mui/icons-material/Edit'
import BPCheck from '@/app/BPCheck'

interface ItemCardProps {
  id: string
  name: string
  category?: string | null
  store?: string | null
  checked: boolean
  lifecycle: 'once' | 'weekly' | 'biweekly' | 'monthly' | null
  removing?: boolean
  onCheck: () => void
  onRemoved?: () => void
  onLongPress?: () => void
  checkDisabled?: boolean
  hasError?: boolean
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

export default function ItemCard({
                                   id: _id,
                                   name,
                                   category,
                                   store,
                                   checked,
                                   lifecycle: _lifecycle,
                                   removing,
                                   onCheck,
                                   onRemoved,
                                   onLongPress,
                                   checkDisabled,
                                   hasError,
                                 }: ItemCardProps) {
  const reduced = usePrefersReducedMotion()
  const [checkFocused, setCheckFocused] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const onRemovedRef = useRef(onRemoved)
  useEffect(() => {
    onRemovedRef.current = onRemoved
  })

  // P7: use ref so inline-arrow identity changes in parent don't re-trigger this effect
  useEffect(() => {
    if (removing && reduced) {
      onRemovedRef.current?.()
    }
  }, [removing, reduced])

  // P3+P4: only watch opacity — height transition from auto→0 doesn't animate in CSS
  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (removing && e.propertyName === 'opacity') {
      onRemovedRef.current?.()
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = {x: e.clientX, y: e.clientY}
    longPressTimer.current = setTimeout(() => {
      onLongPress?.()
    }, 500)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    pointerStartRef.current = null
  }

  const metaLine = [category, store].filter(Boolean).join(' · ')
  const ariaLabel = checked ? `${name}, checked` : `Check off ${name}`

  return (
    <Box
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTransitionEnd={handleTransitionEnd}
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        minHeight: 52,
        px: 1,
        opacity: removing && !reduced ? 0 : 1,
        transform: removing && !reduced ? 'translateX(24px)' : 'none',
        overflow: 'hidden',
        transition: removing && !reduced
          ? 'opacity 280ms ease-out, transform 280ms ease-out'
          : 'none',
        borderBottom: '1px solid',
        borderColor: alpha(t.palette.divider, 0.5),
      })}
    >
      <BPCheck
        checked={checked}
        ariaLabel={ariaLabel}
        disabled={checkDisabled}
        onChange={onCheck}
        onFocusChange={setCheckFocused}
      />
      <Box sx={{flex: 1, minWidth: 0, py: 0.5}}>
        <Typography
          variant="body1"
          sx={(t) => ({
            fontSize: '17px',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: t.typography.fontFamily
          })}
        >
          {name}
        </Typography>
        {metaLine && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={(t) => ({
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: t.typography.fontFamily
            })}
          >
            {metaLine}
          </Typography>
        )}
        {hasError && (
          <Typography
            variant="body2"
            color="error"
            sx={(t) => ({fontSize: '12px', fontFamily: t.typography.fontFamily})}
          >
            Failed to save. Try again.
          </Typography>
        )}
      </Box>
      {/* lifecycle badge slot — deferred to 4.9 */}
      {null}
      <Box
        color="text.secondary"
        sx={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: checkFocused ? 1 : 0,
          transition: 'opacity 150ms',
          pointerEvents: checkFocused ? 'auto' : 'none',
        }}
      >
        <EditIcon fontSize="small"/>
      </Box>
    </Box>
  )
}

export function ItemCardSkeleton() {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', minHeight: 52, px: 1, gap: 1.5}}>
      <Skeleton variant="circular" width={42} height={42}/>
      <Box sx={{flex: 1}}>
        <Skeleton variant="text" width="60%" height={20}/>
        <Skeleton variant="text" width="40%" height={16}/>
      </Box>
    </Box>
  )
}
