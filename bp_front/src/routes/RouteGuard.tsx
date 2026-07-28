import {useEffect} from 'react'
import {Outlet, useNavigate} from 'react-router-dom'
import {useAuth} from '@/lib/auth/AuthContext'

// Auth guard for protected routes (FR29). While the silent-refresh bootstrap is
// in flight we render nothing (no flash of redirect); once settled, an
// unauthenticated visitor is replaced to /auth (never pushed — avoids a back-
// button loop). This is the single owner of the redirect-to-/auth behaviour: an
// expired session (Apollo error link clears auth with `expired`) is surfaced as
// /auth?expired=1, so no second navigator can race and strip the query.
export default function RouteGuard() {
  const {username, isLoading, expired, passwordChanged} = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !username) {
      // A deliberate password change (FR11) redirects here carrying navigation
      // state so /auth can confirm it; an expired session uses ?expired=1;
      // otherwise a plain sign-out. This guard is the single navigator, so the
      // confirmation can't be stripped by a racing redirect.
      if (passwordChanged) {
        navigate('/auth', {replace: true, state: {passwordChanged: true}})
      } else {
        navigate(expired ? '/auth?expired=1' : '/auth', {replace: true})
      }
    }
  }, [username, isLoading, expired, passwordChanged, navigate])

  if (isLoading || !username) return null

  return <Outlet/>
}
