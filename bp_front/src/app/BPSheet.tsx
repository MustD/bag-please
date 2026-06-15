'use client'

import type {KeyboardEvent, ReactNode, RefObject, SyntheticEvent, TransitionEvent} from 'react'
import {useEffect, useRef, useState} from 'react'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import {useTheme} from '@mui/material/styles'
import {useSwipeable} from 'react-swipeable'

export type BPSheetState = 'closed' | 'peeked' | 'open'

export interface BPSheetProps {
  state: BPSheetState
  onStateChange: (state: BPSheetState) => void
  peekHeight?: number
  title: string
  triggerRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

export default function BPSheet({
                                  state,
                                  onStateChange,
                                  peekHeight = 200,
                                  title,
                                  triggerRef,
                                  children,
                                }: BPSheetProps) {
  const theme = useTheme()
  const sentinelOwnedRef = useRef(false)
  const lastStateRef = useRef<BPSheetState>(state)
  const stateRef = useRef<BPSheetState>(state)
  stateRef.current = state
  // Keep the latest onStateChange without re-running the history effect below;
  // callers pass an inline callback whose identity changes every render, and
  // including it in the effect deps tore the sentinel down on every keystroke
  // (its cleanup history.back() fired a popstate read as a back-gesture → close).
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  })
  const prefersReducedMotion = usePrefersReducedMotion()
  const sheetOpen = state !== 'closed'
  const clampedPeekHeight = Math.max(peekHeight, 60)

  const handleClose = () => {
    onStateChange('closed')
  }

  const handleOpen = (_event: SyntheticEvent) => {
    if (state === 'closed') onStateChange('peeked')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    if (state === 'open') {
      e.nativeEvent.stopImmediatePropagation()
      onStateChange('peeked')
    }
  }

  const swipeHandlers = useSwipeable({
    onSwipedUp: () => {
      if (state === 'peeked') onStateChange('open')
    },
    onSwipedDown: () => {
      if (state === 'open') onStateChange('peeked')
      else if (state === 'peeked') onStateChange('closed')
    },
    delta: 24,
    trackTouch: true,
    trackMouse: false,
  })

  // Consolidated sentinel + back-gesture; stateRef keeps the closure fresh without
  // re-registering on every state change (which creates a gap where no listener is active).
  // Listener is removed before history.back() in cleanup so the sentinel popstate
  // doesn't re-enter this handler.
  useEffect(() => {
    if (!sheetOpen) return
    window.history.pushState({bpSheetSentinel: true}, '')
    sentinelOwnedRef.current = true

    const handlePopState = () => {
      sentinelOwnedRef.current = false
      if (stateRef.current === 'open') {
        window.history.pushState({bpSheetSentinel: true}, '')
        sentinelOwnedRef.current = true
        onStateChangeRef.current('peeked')
      } else if (stateRef.current === 'peeked') {
        onStateChangeRef.current('closed')
      }
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (sentinelOwnedRef.current) {
        sentinelOwnedRef.current = false
        // Only pop our sentinel when it is still the current entry. If the
        // consumer navigated (e.g. router.push to the new list) while the sheet
        // closed, the sentinel is buried and history.back() would undo that
        // navigation, bouncing the user back.
        if ((window.history.state as { bpSheetSentinel?: boolean } | null)?.bpSheetSentinel) {
          window.history.back()
        }
      }
    }
    // Depend only on sheetOpen: run once when the sheet opens, clean up when it
    // closes. onStateChange is read via a ref so re-renders don't re-run this.
  }, [sheetOpen])

  // Focus restore to trigger on close
  useEffect(() => {
    if (state === 'closed' && lastStateRef.current !== 'closed') {
      triggerRef?.current?.focus()
    }
    lastStateRef.current = state
  }, [state, triggerRef])

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    // Ignore transitions bubbling up from children (e.g. emoji-picker-react's own
    // height transition) — only the Paper's own transition should drive focus.
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'height') return
    if (state === 'closed') return
    const first = e.currentTarget.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    first?.focus()
  }

  const targetHeight = state === 'open' ? '92dvh' : `${clampedPeekHeight}px`

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={sheetOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      disableDiscovery
      disableSwipeToOpen
      hysteresis={1}
      minFlingVelocity={99999}
      disableEnforceFocus={false}
      disableRestoreFocus={false}
      onKeyDown={handleKeyDown}
      slots={prefersReducedMotion ? {transition: Fade} : undefined}
      slotProps={{
        paper: {
          onTransitionEnd: handleTransitionEnd,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title,
          sx: {
            height: targetHeight,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: theme.palette.background.paper,
            zIndex: theme.zIndex.drawer,
            transition: prefersReducedMotion
              ? 'none'
              : 'height 240ms cubic-bezier(0.32, 0.72, 0, 1)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
        <Box
          {...swipeHandlers}
          aria-hidden="true"
          sx={{
            cursor: 'grab',
            touchAction: 'none',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.custom.bp.ter,
              mx: 'auto',
              mt: 1,
              mb: 0,
            }}
          />
        </Box>
        <Box sx={{padding: '4px 16px 16px', flex: 1, overflowY: 'auto', minHeight: 0}}>
          {children}
        </Box>
      </Box>
    </SwipeableDrawer>
  )
}
