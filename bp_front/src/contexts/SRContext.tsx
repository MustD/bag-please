'use client'

import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react'
import Box from '@mui/material/Box'

interface SRContextValue {
  announceToSR: (message: string) => void
}

const SRContext = createContext<SRContextValue>({
  announceToSR: () => {
  }
})

export function SRProvider({children}: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current)
    }
  }, [])

  const announceToSR = useCallback((text: string) => {
    if (throttleRef.current) {
      pendingRef.current = text
      return
    }
    setMessage(text)
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null
      if (pendingRef.current !== null) {
        setMessage(pendingRef.current)
        pendingRef.current = null
        throttleRef.current = setTimeout(() => {
          throttleRef.current = null
        }, 1500)
      }
    }, 1500)
  }, [])

  return (
    <SRContext.Provider value={{announceToSR}}>
      {children}
      <Box
        component="div"
        aria-live="polite"
        aria-atomic="false"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </Box>
    </SRContext.Provider>
  )
}

export function useSR(): SRContextValue {
  return useContext(SRContext)
}
