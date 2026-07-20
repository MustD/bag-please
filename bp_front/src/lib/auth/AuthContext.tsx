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
  clearAuth: (expired?: boolean, passwordChanged?: boolean) => void
  isLoading: boolean
  registrationEnabled: boolean | null
  // True when the session was cleared because it expired (vs. never signed in);
  // the auth guard turns this into the /auth?expired=1 redirect.
  expired: boolean
  // True when the session was cleared by a deliberate password change; the auth
  // guard turns this into a /auth redirect carrying `state: { passwordChanged }`
  // so the destination can show the confirmation (FR11). Routing this through
  // the guard — the single owner of the redirect-to-/auth behaviour — avoids a
  // second navigator racing it (react-router defers an imperative navigate, so
  // clearing auth from the page itself lets the guard's stateless redirect win).
  passwordChanged: boolean
}

const AuthContext = createContext<AuthContextValue>({
  username: null,
  role: null,
  accessToken: null,
  isLoading: true,
  registrationEnabled: null,
  expired: false,
  passwordChanged: false,
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
  const [passwordChanged, setPasswordChanged] = useState(false)

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
    setPasswordChanged(false)
    setAuthState(state)
  }

  const clearAuth = (didExpire = false, didChangePassword = false) => {
    setExpired(didExpire)
    setPasswordChanged(didChangePassword)
    setAuthState({username: null, role: null, accessToken: null})
    setIsLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{...auth, isLoading, registrationEnabled, expired, passwordChanged, setAuth, clearAuth}}
    >
      {children}
    </AuthContext.Provider>
  )
}
