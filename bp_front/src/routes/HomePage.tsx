import {useState} from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import {useAuth} from '@/lib/auth/AuthContext'
import {authApi} from '@/lib/auth/authApi'

// Protected home placeholder — real app content arrives in Stories 5.5+. For
// now it carries a minimal logout control (FR3, FR10); the proper app bar with
// the username label is Story 5.3.
export default function HomePage() {
  const {username, clearAuth} = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  // Invalidate the server session (refresh token) then clear in-memory auth.
  // clearAuth sets username=null, which makes RouteGuard redirect to /auth — no
  // manual navigation here. Guard against a double-click firing two logouts.
  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await authApi.logout()
      clearAuth()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Box
      data-testid="home-page"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
      }}
    >
      <Typography variant="h4" color="text.primary">Bag Please</Typography>
      <Typography variant="body1" color="text.secondary">Signed in as {username}</Typography>
      <Button variant="outlined" onClick={handleLogout} disabled={loggingOut} data-testid="logout-button">
        Log out
      </Button>
    </Box>
  )
}
