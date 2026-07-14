import {createContext, type ReactNode, useContext, useEffect, useState} from 'react'
import {authApi} from './authApi'
import {parseJwt} from './jwt'

export interface AuthState {
  username: string | null
  role: 'admin' | 'user' | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: (expired?: boolean) => void
  isLoading: boolean
  registrationEnabled: boolean | null
  // True when the session was cleared because it expired (vs. never signed in);
  // the auth guard turns this into the /auth?expired=1 redirect.
  expired: boolean
}

const AuthContext = createContext<AuthContextValue>({
  username: null,
  role: null,
  accessToken: null,
  isLoading: true,
  registrationEnabled: null,
  expired: false,
  setAuth: () => {
  },
  clearAuth: () => {
  },
})

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function AuthProvider({children}: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    username: null,
    role: null,
    accessToken: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null)
  const [expired, setExpired] = useState(false)

  // On app load: read the registration flag and attempt a silent refresh
  // (httpOnly cookie) to bootstrap a session without ever touching localStorage.
  useEffect(() => {
    authApi.getConfig()
      .then(d => setRegistrationEnabled(d.registrationEnabled))
      .catch(() => {
      })

    authApi.refresh()
      .then(({accessToken}) => {
        const payload = parseJwt(accessToken)
        if (!payload) return
        setAuthState({
          username: payload.username,
          role: payload.role,
          accessToken,
        })
      })
      .catch(() => {
      })
      .finally(() => setIsLoading(false))
  }, [])

  const setAuth = (state: AuthState) => {
    setExpired(false)
    setAuthState(state)
  }

  const clearAuth = (didExpire = false) => {
    setExpired(didExpire)
    setAuthState({username: null, role: null, accessToken: null})
    setIsLoading(false)
  }

  return (
    <AuthContext.Provider value={{...auth, isLoading, registrationEnabled, expired, setAuth, clearAuth}}>
      {children}
    </AuthContext.Provider>
  )
}
