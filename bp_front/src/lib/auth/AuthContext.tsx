'use client'
import {createContext, useContext, useEffect, useState} from 'react'
import {authApi} from './authApi'

export interface AuthState {
  username: string | null
  role: 'admin' | 'user' | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: () => void
  isLoading: boolean
}

function parseJwt(token: string): { username: string; role: string } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue>({
  username: null,
  role: null,
  accessToken: null,
  isLoading: true,
  setAuth: () => {
  },
  clearAuth: () => {
  },
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function AuthProvider({children}: React.PropsWithChildren) {
  const [auth, setAuthState] = useState<AuthState>({
    username: null,
    role: null,
    accessToken: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authApi.refresh()
      .then(({accessToken}) => {
        const payload = parseJwt(accessToken)
        if (!payload) return
        setAuthState({
          username: payload.username,
          role: payload.role as 'admin' | 'user',
          accessToken,
        })
      })
      .catch(() => {
      })
      .finally(() => setIsLoading(false))
  }, [])

  const setAuth = (state: AuthState) => setAuthState(state)

  const clearAuth = () => {
    setAuthState({username: null, role: null, accessToken: null})
    setIsLoading(false)
  }

  return (
    <AuthContext.Provider value={{...auth, isLoading, setAuth, clearAuth}}>
      {children}
    </AuthContext.Provider>
  )
}
