import {type FormEvent, useState} from 'react'
import {Navigate} from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {authApi, ChangePasswordError} from '@/lib/auth/authApi'
import {useAuth} from '@/lib/auth/AuthContext'

interface FieldErrors {
  current?: string
  next?: string
  confirm?: string
}

// Change Password screen (Story 5.3, FR11) at /account/password. Mirrors the
// Story 5.2 AuthPage form conventions: manual controlled state, validate-on-
// submit, inline field errors + a top-level alert region, no success toast.
//
// On success the backend invalidates every session (the refresh token is
// revoked server-side), so the settled design is a CLEAN SIGN-OUT: clearAuth()
// + redirect to /auth carrying `passwordChanged`, where the confirmation
// message is shown (AC #3). There is deliberately no on-form success banner.
// The confirm-new-password field is validated locally only and never sent.
export default function ChangePasswordPage() {
  const {role, accessToken, clearAuth} = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // AC #7 — the admin account is 403-forbidden from this endpoint, so admins
  // never render the form; a direct visit bounces home. Placed after the hooks
  // so hook order stays stable.
  if (role === 'admin') return <Navigate to="/" replace/>

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors(prev => (prev[field] ? {...prev, [field]: undefined} : prev))
  }

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!current) errs.current = 'Current password is required'
    if (!next) errs.next = 'New password is required'
    if (!confirm) errs.confirm = 'Please confirm your new password'
    // Confirm ≠ new is a client-only check; confirm is never sent to the API.
    if (next && confirm && next !== confirm) errs.confirm = 'Passwords do not match'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // Same-tick re-entry guard: disabled={loading} only applies next render, so
    // two rapid Enter presses could both enter here (Story 5.2 review fix).
    if (loading) return
    setFormError(null)
    if (!validate()) return
    if (!accessToken) {
      setFormError('Your session has expired. Please sign in again.')
      return
    }

    setLoading(true)
    try {
      // Only currentPassword + newPassword go to the backend; confirm stays local.
      await authApi.changePassword(current, next, accessToken)
      // Success (HTTP 200, empty body): every session is already dead server-
      // side, so this is a CLEAN SIGN-OUT. Clear auth with the passwordChanged
      // reason; RouteGuard (the single redirect owner) then sends us to /auth
      // carrying `state: { passwordChanged: true }`, where the confirmation is
      // shown (AC #3). We deliberately do NOT navigate here: an imperative
      // navigate from this page is deferred by react-router and loses the race
      // to the guard's redirect, which would strip the state. No on-form banner.
      clearAuth(false, true)
    } catch (err) {
      // A wrong current password (400) is surfaced verbatim BOTH inline under
      // the current-password field and in the alert region (AC #4). Any other
      // fault (expired token → 401, gateway 5xx) is not a bad password, so it
      // shows in the alert region only — never misattributed to the field. The
      // message is always non-empty (authApi guarantees it), so a failure can
      // never leave the form with no feedback. Stay on screen; clear no field.
      const message = err instanceof Error && err.message
        ? err.message
        : 'Something went wrong. Please try again.'
      const isCredentialError = err instanceof ChangePasswordError && err.isCredentialError
      if (isCredentialError) setFieldErrors(prev => ({...prev, current: message}))
      setFormError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      data-testid="change-password-page"
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 4,
      }}
    >
      <Box sx={{width: '100%', maxWidth: 360}}>
        <Typography variant="h4" color="text.primary" sx={{mb: 0.5}}>
          Change password
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{mb: 3}}>
          Update your account password
        </Typography>

        <Box component="form" data-testid="change-password-form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              id="current-password"
              label="Current password"
              type="password"
              value={current}
              onChange={e => {
                setCurrent(e.target.value)
                clearFieldError('current')
              }}
              error={Boolean(fieldErrors.current)}
              helperText={fieldErrors.current ?? ' '}
              autoComplete="current-password"
              autoFocus
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'current-password-input'}}}
            />
            <TextField
              id="new-password"
              label="New password"
              type="password"
              value={next}
              onChange={e => {
                setNext(e.target.value)
                clearFieldError('next')
              }}
              error={Boolean(fieldErrors.next)}
              helperText={fieldErrors.next ?? ' '}
              autoComplete="new-password"
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'new-password-input'}}}
            />
            <TextField
              id="confirm-password"
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={e => {
                setConfirm(e.target.value)
                clearFieldError('confirm')
              }}
              error={Boolean(fieldErrors.confirm)}
              helperText={fieldErrors.confirm ?? ' '}
              autoComplete="new-password"
              fullWidth
              disabled={loading}
              slotProps={{htmlInput: {'data-testid': 'confirm-password-input'}}}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              data-testid="change-password-submit"
            >
              {loading ? <CircularProgress size={24} color="inherit"/> : 'Change password'}
            </Button>
          </Stack>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="change-password-signout-note"
          sx={{mt: 2}}
        >
          Changing your password will sign you out of all devices.
        </Typography>

        {formError && (
          <Typography
            role="alert"
            color="error"
            variant="body2"
            data-testid="change-password-error"
            sx={{mt: 2}}
          >
            {formError}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
