import {Navigate, useLocation} from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import {useHomePath} from '@/lib/lists/homePath'

// `/` landing redirect (Story 5.6, FR38). Replaces the old HomePage placeholder.
// Resolution itself lives in useHomePath (Story 7.5) so the app-bar title link
// can observe the same answer without re-deriving it. "Same answer" holds once
// the lists query has resolved: the app bar observes cache-only, so before that
// (and if the query fails) it reads `null` and keeps its link live rather than
// guessing — see the comment on `alreadyHome` in AppShell.tsx.
// - admin → /admin (the backend forbids admin from list resources, so its lists
//   query is skipped entirely).
// - a regular user with lists → their oldest list (min createdAt, compared
//   NUMERICALLY) at /list/:id.
// - a regular user with none → /lists, forwarding the one-time `welcome` signal
//   (AuthPage still navigates here with state.welcome after registration; the
//   banner is rendered once on ListsPage).
// - a lists-query failure → /lists (graceful; the index surfaces any notice).
// - not resolved yet (the query is in flight) → the spinner below.
// All redirects are `replace` so `/` never lingers in history.
export default function HomeRedirect() {
  const location = useLocation()
  const welcome = Boolean((location.state as {welcome?: boolean} | null)?.welcome)

  const path = useHomePath('resolve')

  if (path === null) {
    return (
      <Box data-testid="home-redirect-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
        <CircularProgress/>
      </Box>
    )
  }

  // Forward the one-time welcome signal on both /lists branches — a brand-new
  // user (no lists) can also hit a transient lists-query error, and the banner is
  // consumed once. The admin and oldest-list branches never carried it.
  return <Navigate to={path} replace state={path === '/lists' ? {welcome} : undefined}/>
}
