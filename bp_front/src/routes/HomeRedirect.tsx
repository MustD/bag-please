import {Navigate, useLocation} from 'react-router-dom'
import {useQuery} from '@apollo/client/react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import {ListsQuery} from '@/lib/lists/listsQueries'
import {useAuth} from '@/lib/auth/AuthContext'

// `/` landing redirect (Story 5.6, FR38). Replaces the old HomePage placeholder:
// - admin → /admin (the backend forbids admin from list resources, so its lists
//   query is skipped entirely).
// - a regular user with lists → their oldest list (min createdAt) at /list/:id.
// - a regular user with none → /lists, forwarding the one-time `welcome` signal
//   (AuthPage still navigates here with state.welcome after registration; the
//   banner is rendered once on ListsPage).
// - a lists-query failure → /lists (graceful; the index surfaces any notice).
// All redirects are `replace` so `/` never lingers in history.
export default function HomeRedirect() {
  const {role} = useAuth()
  const location = useLocation()
  const welcome = Boolean((location.state as {welcome?: boolean} | null)?.welcome)

  // Hooks run unconditionally; skip the query for admin (it would only FORBID).
  const {data, loading, error} = useQuery(ListsQuery, {skip: role === 'admin'})

  if (role === 'admin') return <Navigate to="/admin" replace/>

  if (loading) {
    return (
      <Box data-testid="home-redirect-loading" sx={{display: 'flex', justifyContent: 'center', py: 6}}>
        <CircularProgress/>
      </Box>
    )
  }

  // Forward the one-time welcome signal here too — a brand-new user (no lists)
  // can hit a transient lists-query error, and the banner is consumed once.
  if (error) return <Navigate to="/lists" replace state={{welcome}}/>

  const lists = data?.lists?.lists ?? []
  if (lists.length === 0) {
    return <Navigate to="/lists" replace state={{welcome}}/>
  }

  const oldest = [...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  return <Navigate to={`/list/${oldest.id}`} replace/>
}
