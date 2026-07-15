import {type FormEvent, useEffect, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {authApi} from '@/lib/auth/authApi'
import {useAuth} from '@/lib/auth/AuthContext'
import {parseJwt} from '@/lib/auth/jwt'

type Mode = 'login' | 'register'

// Single-route auth screen (FR1–FR4, FR21, FR27, FR32, FR33). Two modes — Sign
// in (default) and Create account — toggle in place; the Create-account
// affordance only appears when public registration is enabled. Layout is
// edge-to-edge on the dark background (UX "ambient identity", no card).
export default function AuthPage() {
  const {setAuth} = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // The auth page owns its own fresh read of the registration flag (AC #4):
  // useAuth().registrationEnabled is fetched once at bootstrap and can be stale
  // or null. `true` → offer Create account; false / unresolved / failed → hide
  // it and steer the user to their admin. Retry once, then fall back to "off".
  const [canRegister, setCanRegister] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const {registrationEnabled} = await authApi.getConfig()
          if (!cancelled) setCanRegister(registrationEnabled)
          return
        } catch {
          // retry once, then fall through to the safe default
        }
      }
      if (!cancelled) setCanRegister(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const expired = searchParams.get('expired') === '1'

  // Session-expiry banner clears the moment the user engages a field. Dropping
  // the query param (replace, no history entry) is the source of truth so the
  // banner also stays gone across a re-render.
  const clearExpired = () => {
    if (searchParams.has('expired')) {
      const next = new URLSearchParams(searchParams)
      next.delete('expired')
      setSearchParams(next, {replace: true})
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setAuthError(null)
    // Toggling modes is a deliberate engagement with the form — drop the
    // expiry banner (and its ?expired param) so it can't linger over the
    // Create-account view, which isn't a re-sign-in context.
    clearExpired()
  }

  const onUsernameChange = (value: string) => {
    setUsername(value)
    if (fieldErrors.username) setFieldErrors(prev => ({...prev, username: undefined}))
    clearExpired()
  }

  const onPasswordChange = (value: string) => {
    setPassword(value)
    if (fieldErrors.password) setFieldErrors(prev => ({...prev, password: undefined}))
    clearExpired()
  }

  // Establish the session from a fresh access token: decode the validated
  // claims, publish auth state, and leave /auth for the app. RouteGuard doesn't
  // evict an already-authenticated visitor from the public /auth route, so the
  // navigate here is what completes the sign-in.
  const establishSession = (accessToken: string) => {
    const claims = parseJwt(accessToken)
    if (!claims) throw new Error('Invalid username or password')
    setAuth({username: claims.username, role: claims.role, accessToken})
    navigate('/', {replace: true})
  }

  const validate = (): boolean => {
    const errs: { username?: string; password?: string } = {}
    if (!username.trim()) errs.username = 'Username is required'
    if (!password) errs.password = 'Password is required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // Guard against a same-tick double submit: `disabled={loading}` only takes
    // effect on the next render, so two rapid Enter presses can both enter here
    // before the form paints disabled.
    if (loading) return
    setAuthError(null)
    if (!validate()) return

    // Submit the same trimmed username we validated — otherwise " mia " passes
    // the non-empty check but a whitespace-padded account is created / signed in.
    const trimmedUsername = username.trim()

    setLoading(true)
    try {
      if (mode === 'login') {
        // authApi.login maps 429 → rate-limit copy and every other failure →
        // the uniform "Invalid username or password" (FR27); surface it verbatim.
        try {
          const {accessToken} = await authApi.login(trimmedUsername, password)
          establishSession(accessToken)
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : 'Invalid username or password')
        }
        return
      }

      // Register returns { username, role } with no token and sets no cookie, so
      // chain a login to actually open the session — from the user's side this
      // is one "Create account" action (FR4, no separate login step).
      try {
        await authApi.register(trimmedUsername, password)
      } catch (err) {
        // Registration itself failed (taken username, disabled) — show the
        // backend message and stay in register mode.
        setAuthError(err instanceof Error ? err.message : 'Registration failed')
        return
      }

      try {
        const {accessToken} = await authApi.login(trimmedUsername, password)
        establishSession(accessToken)
      } catch {
        // Rare: the account exists but the immediate login was rejected (e.g.
        // throttled). Recover by handing the user to Sign in to finish manually.
        switchMode('login')
        setAuthError('Your account was created. Please sign in.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'
  const prefix = isLogin ? 'login' : 'register'

  return (
    <Box
      data-testid="auth-page"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
      }}
    >
      <Box sx={{width: '100%', maxWidth: 360}}>
        {expired && (
          <Alert
            severity="warning"
            role="alert"
            data-testid="session-expired-alert"
            sx={{mb: 3}}
          >
            Your session has expired. Please sign in again.
          </Alert>
        )}

        <Typography variant="h4" color="text.primary" sx={{mb: 0.5}}>
          Bag Please
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{mb: 3}}>
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              id={`${prefix}-username`}
              label="Username"
              value={username}
              onChange={e => onUsernameChange(e.target.value)}
              error={Boolean(fieldErrors.username)}
              helperText={fieldErrors.username ?? ' '}
              autoComplete="username"
              autoFocus
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': `${prefix}-username`}}}
            />
            <TextField
              id={`${prefix}-password`}
              label="Password"
              type="password"
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password ?? ' '}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': `${prefix}-password`}}}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              data-testid={`${prefix}-submit`}
            >
              {loading
                ? <CircularProgress size={24} color="inherit"/>
                : isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </Stack>
        </Box>

        {authError && (
          <Typography
            role="alert"
            color="error"
            variant="body2"
            data-testid="auth-error"
            sx={{mt: 2}}
          >
            {authError}
          </Typography>
        )}

        <Box sx={{mt: 3}}>
          {isLogin
            ? (canRegister === null
              // Config still loading — render nothing rather than flashing the
              // "contact admin" (disabled) branch on a fresh visit where
              // registration is actually enabled. Decide only once resolved.
              ? null
              : canRegister
                ? (
                  <Typography variant="body2" color="text.secondary">
                    Don't have an account?{' '}
                    <Link
                      component="button"
                      type="button"
                      onClick={() => switchMode('register')}
                      data-testid="to-register-link"
                    >
                      Create one
                    </Link>
                  </Typography>
                )
                : (
                  <Typography variant="body2" color="text.secondary" data-testid="contact-admin">
                    Contact your admin to request access.
                  </Typography>
                ))
            : (
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link
                  component="button"
                  type="button"
                  onClick={() => switchMode('login')}
                  data-testid="to-login-link"
                >
                  Sign in
                </Link>
              </Typography>
            )}
        </Box>
      </Box>
    </Box>
  )
}
